import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RELICS, OPPONENTS, ROUTE, createRun as createNewRun, routeFor, availableNodes, act, forecast, cardText, validateSave } from '../dist/engine.js';
const copy = value => JSON.parse(JSON.stringify(value));
// Preserve the original seven-stage fixtures to exercise schema2 compatibility.
function createRun(seed) { const run = createNewRun(seed); run.schema = 2; delete run.route; return run; }
const openDuel = seed => act(createRun(seed), { type: 'choose-node', id: 'opening-match' });
const cardCost = card => card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost;

// A tactical player uses the legal public actions and current forecast only.
function playBestTurn(run) {
  let best = run, bestValue = -Infinity;
  const seen = new Set(), startingEnemyHp = run.match.enemyHp;
  function visit(state) {
    if (state.phase === 'defeat') return;
    const m = state.match, f = forecast(state);
    const key = `${m.energy}|${m.enemyHp}|${m.enemyBlock}|${m.defense}|${m.momentum}|${m.defenseCardPlayed}|${m.dribbleCardPlayed}|${m.counterReady}|${m.hand.map(c => c.uid).sort()}|${m.draw.map(c => c.uid)}|${state.condition}`;
    if (seen.has(key)) return;
    seen.add(key);
    const value = state.phase === 'reward' ? 100000 + state.condition
      : (startingEnemyHp - m.enemyHp) * 1.1 - f.incoming * 1.4 + m.momentum * 0.7 + state.condition * 1.4 + m.energy * 0.001;
    if (value > bestValue) { best = state; bestValue = value; }
    if (state.phase !== 'match') return;
    for (const card of m.hand) if (cardCost(card) <= m.energy) visit(act(state, { type: 'play-card', uid: card.uid }));
  }
  visit(run);
  return best;
}
function finishDuel(run, checkpoint = false) {
  let state = run, safety = 0;
  while (state.phase === 'match') {
    assert.ok(++safety <= 40, 'sensible play finishes duels without a fixed timer');
    state = playBestTurn(state);
    if (state.phase === 'match') state = act(state, { type: 'end-turn' });
    if (checkpoint) { const saved = validateSave(copy(state)); assert.ok(saved, `valid ${state.phase} turn ${safety}`); state = saved; }
  }
  return state;
}
const rewardOrder = ['power-shot', 'shot', 'captain', 'switch', 'feint', 'clutch', 'volley', 'wall-pass', 'dribble', 'long-pass', 'cover', 'one-two', 'through-pass', 'intercept', 'quick-pass', 'focus', 'tackle', 'sprint'];
const relicOrder = ['energy-flask', 'power-cleats', 'training-kit', 'swift-boots', 'grip-socks', 'scouting-bag', 'captain-band', 'golden-whistle', 'lucky-coin'];
function completeJourney(seed, { checkpoint = false, elite = false, event = false } = {}) {
  let run = createRun(seed), actions = 0;
  const visited = new Set();
  while (!['victory', 'defeat'].includes(run.phase)) {
    visited.add(run.phase);
    assert.ok(++actions < 50);
    switch (run.phase) {
      case 'map': {
        const choices = { 1: 'first-training', 3: event ? 'scout-event' : 'market', 4: elite ? 'elite-match' : 'semifinal-rest', 5: 'final-training' };
        run = act(run, { type: 'choose-node', id: choices[run.routeIndex] ?? ROUTE[run.routeIndex].choices[0].id }); break;
      }
      case 'match': run = finishDuel(run, checkpoint); break;
      case 'reward':
        if (run.relicOffers.length) run = act(run, { type: 'take-elite-relic', id: run.relicOffers[0] });
        run = act(run, { type: 'take-reward', id: rewardOrder.find(id => run.offers.includes(id)) }); break;
      case 'training': {
        const card = ['power-shot', 'shot', 'feint', 'switch'].flatMap(id => run.deck.filter(c => c.id === id && !c.upgraded))[0];
        run = act(run, { type: 'upgrade-card', uid: card.uid }); break;
      }
      case 'rest': run = act(run, { type: 'rest' }); break;
      case 'event': run = act(run, { type: 'event-choice', id: 'risk' }); break;
      case 'shop':
        for (const id of relicOrder) run = act(run, { type: 'buy-relic', id });
        run = act(run, { type: 'leave-node' }); break;
      default: assert.fail(`unknown phase ${run.phase}`);
    }
    if (checkpoint) { const saved = validateSave(copy(run)); assert.ok(saved, `valid checkpoint ${run.phase} stage ${run.routeIndex}`); run = saved; }
  }
  return { run, visited };
}
function handFixture(ids, relics = []) {
  const run = createRun(1);
  run.relics = relics;
  if (relics.includes('captain-band')) { run.maxCondition = 115; run.condition = 115; }
  run.deck = Array.from({ length: 12 }, (_, i) => ({ uid: `c${i + 1}`, id: ids[i] ?? 'through-pass', upgraded: false }));
  run.nextUid = 13;
  const state = act(run, { type: 'choose-node', id: 'opening-match' }), all = copy(state.deck);
  state.match.hand = all.splice(0, ids.length); state.match.draw = all;
  return state;
}
function reachCrossroads(seed = 'crossroads') {
  let run = act(finishDuel(openDuel(seed)), { type: 'take-reward', id: null });
  run = act(run, { type: 'choose-node', id: 'first-training' });
  run = act(run, { type: 'upgrade-card', uid: run.deck.find(c => c.id === 'shot').uid });
  run = finishDuel(act(run, { type: 'choose-node', id: 'press-match' }));
  assert.equal(run.phase, 'reward');
  return act(run, { type: 'take-reward', id: null });
}

test('schema2 retains its personal hero route and nine shop items beside the legendary drop', () => {
  const run = createRun('same');
  assert.equal(run.schema, 2);
  assert.equal(run.condition, 100);
  assert.equal(run.deck.length, 12);
  assert.equal(Object.keys(CARDS).length, 18);
  assert.equal(Object.values(RELICS).filter(relic => relic.shop !== false).length, 9);
  assert.equal(ROUTE.length, 7);
  assert.deepEqual(ROUTE.flatMap((stage, index) => stage.choices.filter(node => node.type === 'shop').map(node => [index, node.id])), [[3, 'market']]);
  assert.ok(ROUTE[3].choices.some(node => node.id === 'scout-event'));
  assert.deepEqual(openDuel('same'), openDuel('same'));
  assert.notDeepEqual(openDuel('one').match.hand, openDuel('two').match.hand);
  assert.ok(!('homeScore' in openDuel('same').match));
  assert.ok(!('totalTurns' in openDuel('same').match));
  for (const card of Object.values(CARDS)) {
    assert.equal(cardText(card), card.description);
    assert.equal(cardText({ id: card.id, upgraded: true }), card.upgradedDescription);
  }
  for (const relic of Object.values(RELICS)) { assert.ok(relic.category); assert.ok(relic.rarity); if (relic.shop !== false) assert.ok(relic.price >= 30 && relic.price <= 75); }
});

test('attacks damage a single enemy immediately, consume its block, and do not mutate inputs', () => {
  const run = handFixture(['shot', 'through-pass', 'cover']), original = copy(run);
  let next = act(run, { type: 'play-card', uid: 'c1' });
  assert.notEqual(next, run); assert.deepEqual(run, original);
  assert.equal(next.match.enemyHp, 42 - (9 - 2));
  assert.equal(next.match.enemyBlock, 0);
  assert.equal(next.match.chance, 7);
  assert.equal(next.stats.damage, 7);
  assert.equal(next.condition, 100, 'no automatic retaliation when a card is played');
  next = act(next, { type: 'play-card', uid: 'c2' });
  assert.equal(next.match.enemyHp, 28);
  assert.equal(next.match.chance, 14);
  assert.equal(forecast(next).attack, 14);
  assert.equal(forecast(next).target, 28);
  assert.ok(validateSave(next));
});

test('energy prevents unaffordable and repeated cards; invalid actions preserve identity', () => {
  const run = handFixture(['shot', 'power-shot', 'cover']);
  const first = act(run, { type: 'play-card', uid: 'c1' });
  assert.equal(first.match.energy, 2);
  assert.equal(act(first, { type: 'play-card', uid: 'c1' }), first);
  const spent = act(first, { type: 'play-card', uid: 'c2' });
  assert.equal(spent.match.energy, 0);
  assert.equal(act(spent, { type: 'play-card', uid: 'c3' }), spent);
  for (const action of [{ type: 'leave-node' }, { type: 'take-reward', id: null }, { type: 'choose-node', id: 'championship' }, { type: 'play-card', uid: 'missing' }, { type: 'unknown' }]) assert.equal(act(first, action), first);
});

test('dribble momentum persists across turns and the next shot consumes it once', () => {
  let run = handFixture(['dribble', 'feint', 'cover']);
  run = act(run, { type: 'play-card', uid: 'c1' });
  run = act(run, { type: 'play-card', uid: 'c2' });
  run = act(run, { type: 'play-card', uid: 'c3' });
  assert.equal(run.match.momentum, 6);
  assert.equal(run.match.defense, 8);
  assert.equal(forecast(run).incoming, 0);
  const turn = act(run, { type: 'end-turn' });
  assert.equal(turn.match.momentum, 6);
  assert.equal(turn.match.defense, 0);
  assert.equal(turn.match.energy, 3);
  assert.equal(turn.match.chance, 0);
  assert.equal(turn.condition, 100);
  assert.equal(turn.stats.blocks, 7);
  const shot = handFixture(['shot', 'shot']); shot.match.momentum = 6;
  const one = act(shot, { type: 'play-card', uid: 'c1' });
  assert.equal(one.match.chance, 9 + 6 - 2);
  assert.equal(one.match.momentum, 0);
  const two = act(one, { type: 'play-card', uid: 'c2' });
  assert.equal(two.match.chance - one.match.chance, 9);
  assert.ok(validateSave(turn));
});

test('enemy attacks on end-turn, hero HP persists, and enemy intent/block refresh predictably', () => {
  let run = handFixture(['intercept']);
  run = act(run, { type: 'play-card', uid: 'c1' });
  assert.equal(forecast(run).incoming, 2);
  const next = act(run, { type: 'end-turn' });
  assert.equal(next.condition, 98);
  assert.equal(next.match.lastOutcome.damageTaken, 2);
  assert.equal(next.match.turn, 2);
  assert.equal(next.match.intent.attack, 9);
  assert.equal(next.match.enemyBlock, 0);
  assert.equal(next.match.defense, 0);
  assert.equal(next.match.defenseCardPlayed, false);
  assert.equal(next.match.enemyHp, run.match.enemyHp);
  assert.ok(validateSave(next));
});

test('lethal damage wins immediately; overkill is capped and no enemy response or fatigue occurs', () => {
  let run = handFixture(['power-shot', 'focus', 'power-shot', 'shot']);
  run.match.hand[0].upgraded = true; run.deck[0].upgraded = true;
  run.match.hand[2].upgraded = true; run.deck[2].upgraded = true;
  run.condition = 20;
  run = act(run, { type: 'play-card', uid: 'c1' });
  run = act(run, { type: 'play-card', uid: 'c3' });
  assert.equal(run.match.enemyHp, 2);
  const won = act(run, { type: 'play-card', uid: 'c4' });
  assert.equal(won.phase, 'reward');
  assert.equal(won.match.enemyHp, 0);
  assert.equal(won.stats.damage, 42);
  assert.equal(won.condition, 20);
  assert.equal(won.match.lastOutcome.damageTaken, 0);
  assert.equal(won.gold, 65);
  assert.equal(act(won, { type: 'end-turn' }), won);
  assert.ok(validateSave(won));
});

test('power-shot upgrade lowers cost, volley doubles consumed momentum, and focus exhausts', () => {
  let run = handFixture(['power-shot', 'focus']);
  run.match.hand[0].upgraded = true; run.deck[0].upgraded = true;
  run = act(run, { type: 'play-card', uid: 'c1' });
  assert.equal(run.match.energy, 2);
  run = act(run, { type: 'play-card', uid: 'c2' });
  assert.equal(run.match.energy, 3);
  run = act(run, { type: 'end-turn' });
  assert.deepEqual(run.match.exhaust.map(c => c.id), ['focus']);
  assert.ok(validateSave(run));
  const volley = handFixture(['volley']); volley.match.momentum = 4;
  const struck = act(volley, { type: 'play-card', uid: 'c1' });
  assert.equal(struck.match.chance, 11 + 8 - 2);
  assert.equal(struck.match.momentum, 0);
});

test('passive play loses by HP, and zero HP from risk cannot be bypassed by a simultaneous kill', () => {
  let run = openDuel('passive');
  while (run.phase === 'match') run = act(run, { type: 'end-turn' });
  assert.equal(run.phase, 'defeat'); assert.equal(run.condition, 0); assert.equal(run.match.enemyHp, 42);
  assert.equal(act(run, { type: 'end-turn' }), run); assert.ok(validateSave(run));
  let risky = handFixture(['power-shot', 'power-shot', 'sprint'], ['golden-whistle']);
  risky.deck[0].upgraded = risky.match.hand[0].upgraded = true;
  risky.deck[1].upgraded = risky.match.hand[1].upgraded = true;
  risky = act(risky, { type: 'play-card', uid: 'c1' }); risky = act(risky, { type: 'play-card', uid: 'c2' });
  risky.condition = 3;
  const failed = act(risky, { type: 'play-card', uid: 'c3' });
  assert.equal(failed.match.enemyHp, 0); assert.equal(failed.phase, 'defeat'); assert.equal(failed.condition, 0);
  assert.equal(failed.stats.wins, 0); assert.equal(failed.gold, 40); assert.ok(validateSave(failed));
});

test('duels have no fixed-turn victory and pressure increases after twelve turns', () => {
  const initial = createRun('patient');
  initial.deck = initial.deck.map(card => ({ ...card, id: 'cover' }));
  let run = act(initial, { type: 'choose-node', id: 'opening-match' });
  for (let turn = 0; turn < 13; turn++) {
    for (const card of run.match.hand.slice(0, 3)) run = act(run, { type: 'play-card', uid: card.uid });
    run = act(run, { type: 'end-turn' });
  }
  assert.equal(run.phase, 'match'); assert.equal(run.match.turn, 14);
  assert.equal(run.match.enemyHp, 42); assert.equal(run.condition, 100);
  assert.equal(run.match.intent.attack, 9 + 4); assert.match(run.match.intent.name, /고조/);
  assert.ok(validateSave(run));
});

test('reward is granted once, take-or-skip advances the node once, and future battles cannot be skipped', () => {
  const won = finishDuel(openDuel('reward'), true);
  assert.equal(won.phase, 'reward'); assert.equal(won.gold, 65); assert.equal(won.stats.wins, 1);
  assert.equal(act(won, { type: 'take-reward', id: 'not-offered' }), won);
  const picked = act(won, { type: 'take-reward', id: won.offers[0] });
  assert.equal(picked.deck.length, 13); assert.equal(picked.routeIndex, 1); assert.equal(picked.history[0].damageDealt, 42);
  assert.equal(act(picked, { type: 'take-reward', id: won.offers[0] }), picked);
  assert.equal(act(picked, { type: 'choose-node', id: 'championship' }), picked);
  const skipped = act(won, { type: 'take-reward', id: null }); assert.equal(skipped.deck.length, 12); assert.equal(skipped.gold, 65);
});

test('training consumes one choice, removal keeps eight cards, and rest heals persistent HP', () => {
  const map = act(finishDuel(openDuel('training')), { type: 'take-reward', id: null });
  const training = act(map, { type: 'choose-node', id: 'first-training' }), uid = training.deck[0].uid;
  const upgraded = act(training, { type: 'upgrade-card', uid });
  assert.equal(upgraded.deck[0].upgraded, true); assert.equal(upgraded.routeIndex, 2);
  assert.equal(act(upgraded, { type: 'upgrade-card', uid }), upgraded);
  const removed = act(training, { type: 'remove-card', uid }); assert.equal(removed.deck.length, 11); assert.ok(validateSave(removed));
  const minimum = copy(training); minimum.deck = minimum.deck.slice(0, 8); assert.equal(act(minimum, { type: 'remove-card', uid }), minimum);
  const rest = act(map, { type: 'choose-node', id: 'first-rest' }); rest.condition = 35;
  const healed = act(rest, { type: 'rest' }); assert.equal(healed.condition, 65); assert.equal(healed.routeIndex, 2); assert.ok(validateSave(healed));
});

test('the single midpoint shop stocks four random unowned items with no equipment-slot limit', () => {
  const map = reachCrossroads('shop');
  const shop = act(map, { type: 'choose-node', id: 'market' });
  assert.equal(shop.shopOffers.length, 4);
  assert.deepEqual(shop, act(map, { type: 'choose-node', id: 'market' }));
  const id = shop.shopOffers.find(id => RELICS[id].price <= shop.gold), bought = act(shop, { type: 'buy-relic', id });
  assert.equal(bought.gold, shop.gold - RELICS[id].price); assert.ok(bought.relics.includes(id));
  assert.equal(bought.phase, 'shop'); assert.equal(bought.routeIndex, 3); assert.equal(act(bought, { type: 'buy-relic', id }), bought);
  const broke = copy(shop); broke.gold = 0; assert.equal(act(broke, { type: 'buy-relic', id }), broke);
  const stock = copy(shop); stock.gold = 1000; stock.shopOffers = ['swift-boots', 'power-cleats', 'captain-band', 'training-kit']; stock.condition = 60;
  let all = stock;
  for (const item of stock.shopOffers) all = act(all, { type: 'buy-relic', id: item });
  assert.equal(all.relics.length, 4); assert.ok(all.relics.includes('swift-boots') && all.relics.includes('power-cleats'));
  assert.equal(all.maxCondition, 115); assert.equal(all.condition, 75); assert.ok(validateSave(all));
  const left = act(all, { type: 'leave-node' }); assert.equal(left.routeIndex, 4); assert.equal(left.shopOffers.length, 0);
});

test('shop entry and purchases are gated by the map node and cannot resume after leaving', () => {
  const fresh = createRun('shop-gates');
  assert.equal(act(fresh, { type: 'choose-node', id: 'market' }), fresh);
  assert.equal(act(fresh, { type: 'buy-relic', id: 'grip-socks' }), fresh);
  const battle = act(fresh, { type: 'choose-node', id: 'opening-match' });
  assert.equal(act(battle, { type: 'choose-node', id: 'market' }), battle);
  assert.equal(act(battle, { type: 'buy-relic', id: 'grip-socks' }), battle);
  const firstStop = act(finishDuel(battle), { type: 'take-reward', id: null });
  assert.equal(act(firstStop, { type: 'choose-node', id: 'early-shop' }), firstStop);
  assert.equal(act(firstStop, { type: 'choose-node', id: 'market' }), firstStop);
  const crossroads = reachCrossroads('shop-gates');
  assert.equal(act(crossroads, { type: 'buy-relic', id: 'grip-socks' }), crossroads);
  const shop = act(crossroads, { type: 'choose-node', id: 'market' });
  const offeredId = shop.shopOffers[0];
  const left = act(shop, { type: 'leave-node' });
  assert.equal(left.routeIndex, 4); assert.equal(left.gold, shop.gold);
  assert.equal(act(left, { type: 'buy-relic', id: offeredId }), left);
  assert.equal(act(left, { type: 'choose-node', id: 'market' }), left);
  const finalStop = act(act(left, { type: 'choose-node', id: 'semifinal-rest' }), { type: 'rest' });
  assert.equal(finalStop.routeIndex, 5);
  assert.equal(act(finalStop, { type: 'choose-node', id: 'final-shop' }), finalStop);
  assert.equal(act(finalStop, { type: 'choose-node', id: 'market' }), finalStop);
  assert.equal(act(finalStop, { type: 'buy-relic', id: offeredId }), finalStop);
  const event = act(crossroads, { type: 'choose-node', id: 'scout-event' });
  assert.equal(act(event, { type: 'buy-relic', id: 'grip-socks' }), event);
  const afterEvent = act(event, { type: 'event-choice', id: 'safe' });
  assert.equal(act(afterEvent, { type: 'choose-node', id: 'market' }), afterEvent);
  assert.ok(validateSave(left)); assert.ok(validateSave(finalStop)); assert.ok(validateSave(afterEvent));
});

test('stacked relics affect energy, draw, starting block, first defense, momentum and shot damage', () => {
  let run = handFixture(['dribble', 'cover', 'cover', 'shot'], ['swift-boots', 'power-cleats', 'training-kit', 'grip-socks', 'scouting-bag', 'energy-flask']);
  assert.equal(run.match.maxEnergy, 4); assert.equal(run.match.defense, 3);
  run = act(run, { type: 'play-card', uid: 'c1' }); assert.equal(run.match.momentum, 3);
  run = act(run, { type: 'play-card', uid: 'c2' }); assert.equal(run.match.defense, 13);
  run = act(run, { type: 'play-card', uid: 'c3' }); assert.equal(run.match.defense, 21, 'sock bonus only once each turn');
  const before = run.match.enemyHp;
  run = act(run, { type: 'play-card', uid: 'c4' }); assert.equal(before - run.match.enemyHp, 9 + 3 + 3);
  run = act(run, { type: 'end-turn' });
  assert.equal(run.match.hand.length, 6); assert.equal(run.match.defense, 3); assert.equal(run.match.defenseCardPlayed, false); assert.equal(run.match.energy, 4);
  assert.ok(validateSave(run));
});

test('victory relics grant gold and HP once, and never rescue zero-HP defeat', () => {
  let run = handFixture(['power-shot', 'power-shot', 'shot'], ['lucky-coin', 'golden-whistle']);
  for (let i = 0; i < 2; i++) run.deck[i].upgraded = run.match.hand[i].upgraded = true;
  run.condition = 50;
  for (const uid of ['c1', 'c2', 'c3']) run = act(run, { type: 'play-card', uid });
  assert.equal(run.phase, 'reward'); assert.equal(run.gold, 75); assert.equal(run.condition, 55);
  assert.equal(act(run, { type: 'end-turn' }), run); assert.ok(validateSave(run));
});

test('event choices apply exact HP/currency/card changes once and risk can end the journey', () => {
  const event = act(reachCrossroads('event'), { type: 'choose-node', id: 'scout-event' });
  const safe = act(event, { type: 'event-choice', id: 'safe' }); assert.equal(safe.gold, event.gold + 15); assert.equal(safe.condition, Math.min(100, event.condition + 5));
  const risk = act(event, { type: 'event-choice', id: 'risk' }); assert.equal(risk.gold, event.gold + 35); assert.equal(risk.condition, event.condition - 12); assert.equal(risk.deck.length, event.deck.length + 1);
  assert.equal(CARDS[risk.deck.at(-1).id].rarity, 'rare'); assert.equal(act(risk, { type: 'event-choice', id: 'risk' }), risk);
  const exhausted = copy(event); exhausted.condition = 12;
  const failed = act(exhausted, { type: 'event-choice', id: 'risk' }); assert.equal(failed.phase, 'defeat'); assert.equal(failed.gold, event.gold);
  assert.ok(validateSave(safe)); assert.ok(validateSave(risk)); assert.ok(validateSave(failed));
});

test('save validation rejects schema1 and corrupt HP, zones, intent, resources, histories and statistics', () => {
  const valid = openDuel('save');
  const mutations = [
    r => { r.schema = 1; }, r => { r.phase = 'unknown'; }, r => { r.condition = -1; }, r => { r.condition = 0; }, r => { r.condition = NaN; },
    r => { r.maxCondition = 115; }, r => { r.seed = -1; }, r => { r.gold = -1; }, r => { r.routeIndex = 7; },
    r => { r.deck[0].id = ['shot']; }, r => { r.deck[0].uid = r.deck[1].uid; }, r => { r.nextUid = 1; },
    r => { r.relics = ['unknown']; }, r => { r.offers = ['shot']; }, r => { r.match.hand.push(copy(r.match.hand[0])); },
    r => { r.match.draw.pop(); }, r => { r.match.enemyHp = 0; }, r => { r.match.enemyHp = 999; }, r => { r.match.enemyBlock = 999; },
    r => { r.match.intent.attack = 0; }, r => { r.match.energy = 99; }, r => { r.match.momentum = -1; }, r => { r.match.chance = 10; },
    r => { r.match.defenseCardPlayed = 'yes'; }, r => { r.match.lastOutcome = {}; }, r => { r.match.status = 'won'; },
    r => { r.stats.wins = 4; }, r => { r.stats.damage = 4; }, r => { r.stats.goals = 1; }, r => { r.activeNode = null; },
  ];
  for (const change of mutations) { const broken = copy(valid); change(broken); assert.equal(validateSave(broken), null, change.toString()); }
  const cyclic = {}; cyclic.self = cyclic;
  for (const value of [undefined, null, 5, [], {}, 'save', cyclic, { seed: 1n }]) assert.equal(validateSave(value), null);
  const restored = validateSave(valid); assert.deepEqual(restored, valid); restored.deck[0].upgraded = true; assert.equal(valid.deck[0].upgraded, false);
});

test('save recovery updates old node labels without losing progress or accepting incorrect node relationships', () => {
  const current = act(reachCrossroads('old-labels'), { type: 'choose-node', id: 'market' });
  const old = copy(current);
  old.activeNode.name = '이전 상점 이름'; old.activeNode.description = '이전 상점 안내';
  for (const item of old.history) { item.name = '이전 포인트 이름'; item.description = '이전 포인트 안내'; }
  const before = copy(old), restored = validateSave(old);
  assert.ok(restored);
  assert.deepEqual(old, before, 'validation must not mutate the original saved value');
  assert.equal(restored.phase, current.phase); assert.equal(restored.routeIndex, current.routeIndex);
  assert.equal(restored.gold, current.gold); assert.equal(restored.condition, current.condition);
  assert.deepEqual(restored.deck, current.deck); assert.deepEqual(restored.relics, current.relics);
  assert.deepEqual(restored.stats, current.stats); assert.deepEqual(restored.shopOffers, current.shopOffers);
  assert.equal(restored.activeNode.name, ROUTE[3].choices[0].name);
  assert.equal(restored.activeNode.description, ROUTE[3].choices[0].description);
  for (const item of restored.history) {
    const node = ROUTE[item.stageIndex].choices.find(choice => choice.id === item.nodeId);
    assert.equal(item.name, node.name); assert.equal(item.description, node.description);
  }
  const duel = openDuel('old-duel-label'); duel.activeNode.name = '이전 대결'; duel.activeNode.description = '이전 안내';
  const recoveredDuel = validateSave(duel);
  assert.ok(recoveredDuel); assert.equal(recoveredDuel.activeNode.name, ROUTE[0].choices[0].name);
  assert.deepEqual(recoveredDuel.match, duel.match);
  for (const id of ['early-shop', 'final-shop']) {
    const removed = copy(old); removed.activeNode.id = id; assert.equal(validateSave(removed), null);
    const oldHistory = copy(old); oldHistory.history[1].nodeId = id; assert.equal(validateSave(oldHistory), null);
  }
  const wrongType = copy(old); wrongType.activeNode.type = 'rest'; assert.equal(validateSave(wrongType), null);
  const wrongStage = copy(old); wrongStage.history[1].stageIndex = 3; assert.equal(validateSave(wrongStage), null);
  const wrongOpponent = copy(duel); wrongOpponent.activeNode.opponentId = 'champion'; assert.equal(validateSave(wrongOpponent), null);
  const wrongPastOpponent = copy(old); wrongPastOpponent.history[0].opponentId = 'champion'; assert.equal(validateSave(wrongPastOpponent), null);
});

test('legacy early-shop recovery preserves a purchased bag, HP, currency and deck then exits once', () => {
  const won = finishDuel(openDuel('legacy-bag'));
  const old = act(won, { type: 'take-reward', id: won.offers[0] });
  old.phase = 'shop'; old.condition = 96; old.gold = 10; old.relics = ['scouting-bag'];
  old.activeNode = { id: 'early-shop', type: 'shop', name: '예전 장비점', description: '예전 상점 설명' };
  old.shopOffers = ['swift-boots', 'training-kit', 'grip-socks'];
  const before = copy(old), restored = validateSave(old);
  assert.ok(restored); assert.deepEqual(old, before);
  assert.equal(restored.phase, 'map'); assert.equal(restored.routeIndex, 2); assert.equal(restored.activeNode, null); assert.deepEqual(restored.shopOffers, []);
  assert.equal(restored.condition, 96); assert.equal(restored.gold, 10); assert.equal(restored.deck.length, 13);
  for (const field of ['deck', 'relics', 'stats', 'seed', 'initialSeed', 'nextUid', 'maxCondition']) assert.deepEqual(restored[field], old[field]);
  assert.equal(restored.history[1].nodeId, 'early-shop'); assert.equal(restored.history[1].type, 'shop'); assert.equal(restored.history[1].result, 'skip');
  assert.equal(restored.history[1].name, '동네 스포츠점'); assert.equal(restored.history[1].description, '첫 보상 코인으로 나에게 맞는 유물을 찾아보세요.');
  assert.deepEqual(validateSave(restored), restored, 'migration is idempotent');
  assert.equal(act(restored, { type: 'choose-node', id: 'early-shop' }), restored);
  assert.equal(act(restored, { type: 'buy-relic', id: 'grip-socks' }), restored);
  const resumed = act(restored, { type: 'choose-node', id: 'press-match' });
  assert.equal(resumed.phase, 'match'); assert.equal(resumed.match.hand.length, 6); assert.equal(resumed.condition, 96); assert.ok(validateSave(resumed));
  for (const change of [r => { r.routeIndex = 3; }, r => { r.activeNode.type = 'rest'; }, r => { r.activeNode.opponentId = 'school'; }, r => { r.phase = 'training'; }, r => { r.offers = ['shot']; }]) {
    const broken = copy(old); change(broken); assert.equal(validateSave(broken), null, change.toString());
  }
  const wrongHistory = copy(restored); wrongHistory.history[1].type = 'training'; assert.equal(validateSave(wrongHistory), null);
  const wrongResult = copy(restored); wrongResult.history[1].result = 'upgrade'; assert.equal(validateSave(wrongResult), null);
});

test('legacy final-shop and historical visits remain recoverable only at their original stages', () => {
  let old = reachCrossroads('legacy-final');
  old = act(act(old, { type: 'choose-node', id: 'market' }), { type: 'leave-node' });
  old = act(act(old, { type: 'choose-node', id: 'semifinal-rest' }), { type: 'rest' });
  old.phase = 'shop'; old.activeNode = { id: 'final-shop', type: 'shop', name: '옛 노점', description: '옛 안내' }; old.shopOffers = ['grip-socks'];
  const restored = validateSave(old);
  assert.ok(restored); assert.equal(restored.routeIndex, 6); assert.equal(restored.phase, 'map');
  assert.equal(restored.history[5].nodeId, 'final-shop'); assert.equal(restored.history[5].name, '백화점 스포츠관');
  for (const field of ['condition', 'gold', 'deck', 'relics', 'stats']) assert.deepEqual(restored[field], old[field]);
  assert.deepEqual(validateSave(restored), restored);
  assert.equal(act(restored, { type: 'choose-node', id: 'final-shop' }), restored);
  const resumed = act(restored, { type: 'choose-node', id: 'championship' }); assert.equal(resumed.phase, 'match'); assert.ok(validateSave(resumed));
  const swapped = copy(restored); swapped.history[5].nodeId = 'early-shop'; assert.equal(validateSave(swapped), null);
  const mislabeled = copy(restored); mislabeled.history[5].name = '옛 이름'; mislabeled.history[5].description = '옛 설명';
  const normalized = validateSave(mislabeled); assert.ok(normalized); assert.equal(normalized.history[5].name, '백화점 스포츠관');
});

test('a full seven-stage personal victory is deterministic through save recovery in every phase', () => {
  const direct = completeJourney('hero-journey'), restored = completeJourney('hero-journey', { checkpoint: true });
  assert.equal(direct.run.phase, 'victory'); assert.deepEqual(restored.run, direct.run);
  assert.equal(restored.run.routeIndex, 7); assert.equal(restored.run.history.length, 7); assert.equal(restored.run.stats.wins, 3);
  assert.equal(restored.run.stats.damage, 42 + 52 + 85); assert.ok(restored.run.condition > 0);
  for (const phase of ['map', 'match', 'reward', 'training', 'rest', 'shop']) assert.ok(restored.visited.has(phase));
  assert.ok(validateSave(restored.run)); assert.equal(act(restored.run, { type: 'choose-node', id: 'opening-match' }), restored.run);
});

test('the midpoint shop supplies stacking items and the alternative event route remains playable', () => {
  const shopping = completeJourney('item-journey', { checkpoint: true });
  assert.equal(shopping.run.phase, 'victory'); assert.ok(shopping.run.relics.length >= 1);
  assert.equal(shopping.run.history.filter(node => node.type === 'shop').length, 1);
  assert.equal(new Set(shopping.run.relics).size, shopping.run.relics.length);
  const results = ['solo-1', 'solo-2', 'solo-3'].map(seed => completeJourney(seed, { checkpoint: true, elite: true, event: true }).run);
  assert.ok(results.filter(run => run.phase === 'victory').length >= 2, JSON.stringify(results.map(r => ({ phase: r.phase, stage: r.routeIndex, hp: r.condition }))));
  for (const run of results.filter(r => r.phase === 'victory')) { assert.equal(run.stats.wins, 4); assert.equal(run.stats.damage, 42 + 52 + 66 + 85); assert.equal(run.history.filter(node => node.type === 'shop').length, 0); }
});

function completeNewJourney(seed, { elites = 0, checkpoint = false, stopStage = null, bossReward = false, startingRelics = [] } = {}) {
  let run = createNewRun(seed, '지우'), actions = 0, eliteCount = 0;
  run.relics = startingRelics.slice();
  if (run.relics.includes('captain-band')) run.maxCondition = run.condition = 115;
  const trace = [];
  while (!['victory', 'defeat'].includes(run.phase)) {
    if ((run.phase === 'map' && run.routeIndex === stopStage) || (bossReward && run.phase === 'reward' && run.activeNode.type === 'boss')) break;
    assert.ok(++actions < 80);
    switch (run.phase) {
      case 'map': {
        const nodes = availableNodes(run);
        assert.ok(nodes.length, `reachable map stage ${run.routeIndex}`);
        let node;
        if (nodes.some(n => n.type === 'elite')) {
          node = eliteCount < elites ? nodes.find(n => n.opponentId === 'legend') ?? nodes.find(n => n.type === 'elite') : nodes.find(n => n.type === 'event');
        } else if (nodes.some(n => n.type === 'shop')) node = nodes.find(n => n.type === 'shop');
        else if (nodes.some(n => ['rest', 'training'].includes(n.type))) {
          node = run.condition < 65 ? nodes.find(n => n.type === 'rest') : nodes.find(n => n.type === 'training');
        }
        node ??= nodes[0]; if (node.type === 'elite') eliteCount++;
        trace.push({ stage: run.routeIndex, id: node.id, type: node.type, gold: run.gold, hp: run.condition });
        run = act(run, { type: 'choose-node', id: node.id }); break;
      }
      case 'match': run = finishDuel(run, checkpoint); break;
      case 'reward':
        if (run.relicOffers.length) run = act(run, { type: 'take-elite-relic', id: run.relicOffers[0] });
        run = act(run, { type: 'take-reward', id: rewardOrder.find(id => run.offers.includes(id)) }); break;
      case 'training': {
        const card = [...['power-shot', 'shot', 'feint', 'switch'].flatMap(id => run.deck.filter(c => c.id === id && !c.upgraded)), ...run.deck.filter(c => !c.upgraded)][0];
        run = card ? act(run, { type: 'upgrade-card', uid: card.uid }) : act(run, { type: 'leave-node' }); break;
      }
      case 'rest': run = act(run, { type: 'rest' }); break;
      case 'event': run = act(run, { type: 'event-choice', id: 'safe' }); break;
      case 'shop':
        for (const id of relicOrder) run = act(run, { type: 'buy-relic', id });
        run = act(run, { type: 'leave-node' }); break;
      default: assert.fail(run.phase);
    }
    if (checkpoint) { const restored = validateSave(copy(run)); assert.ok(restored, `schema3 checkpoint: ${run.phase} stage ${run.routeIndex}`); run = restored; }
  }
  return { run, trace };
}
function newEncounterFixture(seed, stage, opponentId, ids) {
  for (let attempt = 0; !routeFor(createNewRun(seed))[stage].choices.some(node => node.opponentId === opponentId); attempt++) {
    assert.ok(attempt < 64, `seed containing ${opponentId}`); seed = `${seed}:${attempt}`;
  }
  const journey = completeNewJourney(seed, { stopStage: stage });
  let run = journey.run;
  assert.equal(run.phase, 'map'); assert.equal(run.routeIndex, stage);
  run.relics = run.relics.filter(id => id === 'captain-band'); run.condition = run.maxCondition;
  run.deck = Array.from({ length: 12 }, (_, i) => ({ uid: `c${i + 1}`, id: ids[i] ?? 'cover', upgraded: false })); run.nextUid = 13;
  const node = availableNodes(run).find(n => n.opponentId === opponentId);
  assert.ok(node, `available ${opponentId}`);
  run = act(run, { type: 'choose-node', id: node.id });
  const all = copy(run.deck); run.match.hand = all.splice(0, ids.length); run.match.draw = all;
  return run;
}

test('schema3 seeded maps satisfy every complete path across 128 seeds', () => {
  let pathCount = 0; const coaches = new Set(), structures = new Set();
  for (let seed = 0; seed < 128; seed++) {
    const run = createNewRun(seed), route = routeFor(run), reached = new Set();
    assert.equal(run.schema, 3); assert.equal(route.length, 12); assert.deepEqual(route, routeFor(createNewRun(seed)));
    structures.add(JSON.stringify(route.map(row => row.choices.map(n => [n.lane, n.next]))));
    const flat = route.flatMap(row => row.choices); assert.equal(new Set(flat.map(n => n.id)).size, flat.length);
    for (let i = 0; i < route.length; i++) {
      assert.equal(new Set(route[i].choices.map(n => n.lane)).size, route[i].choices.length);
      for (const node of route[i].choices) {
        assert.ok(node.lane >= 0 && node.lane <= 2); assert.equal(new Set(node.next).size, node.next.length);
        if (i < 11) { assert.ok(node.next.length); assert.ok(node.next.every(id => route[i + 1].choices.some(n => n.id === id))); }
        else { assert.deepEqual(node.next, []); assert.ok(OPPONENTS[node.opponentId].coach); coaches.add(node.opponentId); }
        if ([4, 8].includes(i)) assert.ok(node.next.some(id => route[i + 1].choices.find(n => n.id === id).type === 'event'), 'every elite approach has a bypass');
        if (i === 9) assert.deepEqual(new Set(node.next.map(id => route[10].choices.find(n => n.id === id).type)), new Set(['rest', 'training']));
      }
    }
    function walk(node, stage, path) {
      reached.add(node.id); const nextPath = [...path, node];
      if (stage === 11) {
        pathCount++;
        const battles = nextPath.filter(n => ['match', 'elite', 'boss'].includes(n.type));
        assert.ok(battles.length >= 4 && battles.length <= 6); assert.deepEqual(battles.slice(0, 2).map(n => n.opponentId), ['school', 'rookie']);
        assert.ok(nextPath.filter(n => n.type === 'elite').length <= 2); assert.ok(nextPath.filter(n => n.type === 'shop').length <= 2);
        nextPath.forEach((n, i) => {
          if (n.type === 'elite') assert.ok(i >= 5);
          if (n.type === 'shop') assert.ok([3, 6].includes(i));
          if (i) { assert.ok(!(n.type === 'elite' && nextPath[i - 1].type === 'elite')); assert.ok(!(['rest', 'training'].includes(n.type) && ['rest', 'training'].includes(nextPath[i - 1].type))); }
        });
        assert.ok(['rest', 'training'].includes(nextPath[10].type)); return;
      }
      for (const id of node.next) walk(route[stage + 1].choices.find(n => n.id === id), stage + 1, nextPath);
    }
    for (const node of route[0].choices) walk(node, 0, []);
    assert.equal(reached.size, flat.length, 'every generated node is reachable');
  }
  assert.ok(pathCount > 10000); assert.equal(coaches.size, 7); assert.ok(structures.size > 100);
});

test('schema3 enforces actual next links and validates its stored graph without consuming combat RNG', () => {
  const seed = Array.from({ length: 128 }, (_, i) => i).find(i => {
    const route = routeFor(createNewRun(i)); return route[3].choices.find(n => n.type === 'shop').next.length < route[4].choices.length;
  });
  assert.notEqual(seed, undefined);
  const { run } = completeNewJourney(seed, { stopStage: 4, checkpoint: true });
  const route = routeFor(run), allowed = availableNodes(run), excluded = route[4].choices.find(n => !allowed.some(a => a.id === n.id));
  assert.ok(excluded); assert.equal(act(run, { type: 'choose-node', id: excluded.id }), run);
  const entered = act(run, { type: 'choose-node', id: allowed[0].id }); assert.notEqual(entered, run); assert.deepEqual(availableNodes(entered), []);
  assert.deepEqual(routeFor(entered), routeFor(createNewRun(seed))); assert.ok(validateSave(entered));
  const tampered = copy(run); tampered.route[3].choices[0].next.push('path-11-forged'); assert.equal(validateSave(tampered), null);
  const relabeled = copy(run); relabeled.route[4].choices[0].name = '예전 표기'; assert.ok(validateSave(relabeled));
  assert.deepEqual(routeFor(validateSave(relabeled)), route);
  const initial = createNewRun(seed); assert.equal(initial.seed, initial.initialSeed);
  assert.deepEqual(routeFor(createRun(seed)).map(row => row.choices.map(n => n.id)), ROUTE.map(row => row.choices.map(n => n.id)));
});

test('legend stance telegraphs one reflection, dribbles break block, and intent cycles predictably', () => {
  let run = newEncounterFixture('legend-rules', 5, 'legend', ['dribble', 'shot', 'cover']);
  const hp = run.condition, block = run.match.enemyBlock;
  assert.equal(block, 12); assert.equal(run.match.intent.attack, 6); assert.equal(run.match.counterReady, true);
  assert.match(run.match.intent.rule, /체력 3 반사/); assert.match(run.match.intent.description, /방어 6 파괴/);
  run = act(run, { type: 'play-card', uid: 'c1' });
  assert.equal(run.condition, hp - 3); assert.equal(run.match.enemyBlock, 2); assert.equal(run.match.counterReady, false); assert.equal(run.match.momentum, 2);
  run = act(run, { type: 'play-card', uid: 'c2' });
  assert.equal(run.condition, hp - 3, 'only the first attack reflects'); assert.equal(run.match.enemyHp, 72 - 9);
  assert.ok(validateSave(run));
  run = act(run, { type: 'play-card', uid: 'c3' }); run = act(run, { type: 'end-turn' });
  assert.equal(run.match.intent.attack, 18); assert.equal(run.match.enemyBlock, 4); assert.equal(run.match.counterReady, false);
  run = act(run, { type: 'end-turn' }); assert.equal(run.match.intent.attack, 7); assert.equal(run.match.enemyBlock, 0);
  run = act(run, { type: 'end-turn' }); assert.equal(run.match.intent.attack, 6); assert.equal(run.match.enemyBlock, 12); assert.equal(run.match.counterReady, true);
  assert.ok(validateSave(run));
});

test('legend rewards guarantee a rare option, currency and one exclusive relic that cannot enter shops', () => {
  let run = newEncounterFixture('legend-reward', 5, 'legend', Array(5).fill('power-shot'));
  for (const card of run.deck) if (card.id === 'power-shot') card.upgraded = true;
  for (const card of [...run.match.hand, ...run.match.draw]) if (card.id === 'power-shot') card.upgraded = true;
  const gold = run.gold, before = copy(run);
  run = finishDuel(run, true);
  assert.equal(run.phase, 'reward'); assert.equal(run.gold, gold + 65); assert.ok(run.offers.some(id => CARDS[id].rarity === 'rare'));
  assert.deepEqual(run.relicOffers, ['libero-seal', 'catenaccio-band', 'clean-sheet-crest']); assert.equal(run.rewardRelic, null); assert.ok(!run.relics.includes('libero-seal'));
  assert.equal(act(run, { type: 'take-reward', id: null }), run);
  run = act(run, { type: 'take-elite-relic', id: 'libero-seal' });
  assert.equal(run.rewardRelic, 'libero-seal'); assert.equal(run.relics.filter(id => id === 'libero-seal').length, 1); assert.equal(RELICS['libero-seal'].category, 'medal');
  const duplicate = copy(before); duplicate.relics.push('libero-seal'); const second = finishDuel(duplicate, true);
  assert.equal(second.phase, 'reward'); assert.equal(second.rewardRelic, null); assert.equal(second.gold, gold + 65); assert.equal(second.relics.filter(id => id === 'libero-seal').length, 1);
  assert.deepEqual(second.relicOffers, ['catenaccio-band', 'clean-sheet-crest']);
  let next = act(run, { type: 'take-reward', id: null }); assert.equal(next.rewardRelic, null);
  const shop = availableNodes(next).find(n => n.type === 'shop');
  if (shop) { next = act(next, { type: 'choose-node', id: shop.id }); assert.ok(!next.shopOffers.includes('libero-seal')); assert.equal(act(next, { type: 'buy-relic', id: 'libero-seal' }), next); }
  const forged = copy(next); forged.shopOffers = ['libero-seal']; assert.equal(validateSave(forged), null);
  let shield = handFixture(['dribble', 'dribble'], ['libero-seal']);
  shield = act(shield, { type: 'play-card', uid: 'c1' }); assert.equal(shield.match.defense, 4);
  shield = act(shield, { type: 'play-card', uid: 'c2' }); assert.equal(shield.match.defense, 4);
  shield = act(shield, { type: 'end-turn' }); assert.equal(shield.match.dribbleCardPlayed, false); assert.ok(validateSave(shield));
});

test('seven seeded coach bosses expose distinct predictable rules and Ancelotti changes only between turns', () => {
  const seeds = new Map();
  for (let seed = 0; seed < 128; seed++) { const boss = routeFor(createNewRun(seed)).at(-1).choices[0]; if (!seeds.has(boss.opponentId)) seeds.set(boss.opponentId, seed); }
  assert.equal(seeds.size, 7);
  for (const [id, seed] of seeds) {
    let run = newEncounterFixture(seed, 11, id, Array(5).fill('cover'));
    assert.ok(OPPONENTS[id].coach); assert.match(run.match.intent.description, /턴 종료 시 피해/); assert.ok(run.match.intent.rule);
    assert.equal(run.match.enemyMaxHp, OPPONENTS[id].maxHp); assert.ok(run.match.enemyMaxHp >= 85 && run.match.enemyMaxHp <= 95);
    for (let turn = 1; turn <= 5; turn++) {
      const base = OPPONENTS[id].patterns[(turn - 1) % OPPONENTS[id].patterns.length][1];
      const bonus = id === 'coach-wenger' ? Math.floor((turn - 1) / 2) * 2 : id === 'coach-ferguson' && turn >= 5 ? 4 : 0;
      assert.equal(run.match.intent.attack, base + bonus);
      for (const card of run.match.hand.slice(0, 3)) run = act(run, { type: 'play-card', uid: card.uid });
      run = act(run, { type: 'end-turn' }); assert.ok(validateSave(run));
    }
  }
  let half = newEncounterFixture(seeds.get('coach-ancelotti'), 11, 'coach-ancelotti', Array(5).fill('power-shot'));
  for (const card of [...half.deck, ...half.match.hand, ...half.match.draw]) if (card.id === 'power-shot') card.upgraded = true;
  const intent = copy(half.match.intent);
  for (const uid of ['c1', 'c2', 'c3']) half = act(half, { type: 'play-card', uid });
  assert.ok(half.match.enemyHp < 45); assert.deepEqual(half.match.intent, intent); assert.ok(validateSave(half));
  half = act(half, { type: 'end-turn' }); assert.match(half.match.intent.rule, /후반 역습 태세/); assert.equal(half.match.intent.attack, 20); assert.ok(validateSave(half));
});

test('schema3 checkpoints preserve a whole journey and post-boss healing after reward completion', () => {
  const direct = completeNewJourney('new-save', { startingRelics: ['golden-whistle'], bossReward: true });
  const restored = completeNewJourney('new-save', { startingRelics: ['golden-whistle'], bossReward: true, checkpoint: true });
  assert.equal(direct.run.phase, 'reward'); assert.deepEqual(restored.run, direct.run);
  assert.equal(restored.run.condition, Math.min(restored.run.maxCondition, restored.run.match.lastOutcome.heroHp + 5));
  const finalHp = restored.run.condition, victory = act(restored.run, { type: 'take-reward', id: null });
  assert.equal(victory.phase, 'victory'); assert.equal(victory.routeIndex, 12); assert.equal(victory.condition, finalHp);
  assert.deepEqual(validateSave(copy(victory)), victory); assert.equal(victory.playerName, '지우');
  const legacy = openDuel('really-old-save'); delete legacy.playerName; delete legacy.rewardRelic;
  delete legacy.match.dribbleCardPlayed; delete legacy.match.counterReady; delete legacy.match.intentHp;
  const old = validateSave(legacy); assert.ok(old); assert.equal(old.schema, 2); assert.equal(old.playerName, '루키'); assert.equal(routeFor(old).length, 7);
});

test('player names normalize Unicode safely and rename without changing gameplay state', () => {
  const initial = createNewRun('name', '  손  흥민\u0000  '); assert.equal(initial.playerName, '손 흥민');
  assert.equal(createNewRun('name', '').playerName, '루키'); assert.equal(createNewRun('name', '가'.repeat(13)).playerName, '루키');
  const renamed = act(initial, { type: 'rename-player', name: '😀'.repeat(12) }); assert.equal([...renamed.playerName].length, 12);
  const original = copy(initial), actual = copy(renamed); delete original.playerName; delete actual.playerName; assert.deepEqual(actual, original);
  for (const name of ['', '   ', '\u0000\u0001', '😀'.repeat(13), null, 5]) assert.equal(act(initial, { type: 'rename-player', name }), initial);
  const old = copy(initial); delete old.playerName; assert.equal(validateSave(old).playerName, '루키');
  const broken = copy(initial); broken.playerName = '가'.repeat(13); assert.equal(validateSave(broken), null);
});

test('victory and defeat allow saved name changes while every gameplay field remains unchanged', () => {
  const victory = completeNewJourney('new-save').run;
  assert.equal(victory.phase, 'victory');
  let defeat = createNewRun('terminal-name');
  defeat = act(defeat, { type: 'choose-node', id: availableNodes(defeat)[0].id });
  while (defeat.phase === 'match') defeat = act(defeat, { type: 'end-turn' });
  assert.equal(defeat.phase, 'defeat');
  for (const finished of [victory, defeat]) {
    const before = copy(finished), renamed = act(finished, { type: 'rename-player', name: '  새  이름  ' });
    assert.notEqual(renamed, finished); assert.equal(renamed.playerName, '새 이름'); assert.deepEqual(finished, before);
    const expected = copy(finished); expected.playerName = '새 이름'; assert.deepEqual(renamed, expected);
    assert.deepEqual(validateSave(copy(renamed)), renamed);
    assert.equal(act(renamed, { type: 'rename-player', name: '' }), renamed);
    assert.equal(act(renamed, { type: 'end-turn' }), renamed);
    assert.equal(act(renamed, { type: 'take-reward', id: null }), renamed);
    assert.equal(act(renamed, { type: 'choose-node', id: routeFor(renamed)[0].choices[0].id }), renamed);
  }
});

test('safe, one-elite and two-elite paths remain viable with earned shop currency across ten seeds each', t => {
  const totals = [];
  for (const elites of [0, 1, 2]) {
    const results = Array.from({ length: 10 }, (_, i) => completeNewJourney(`balance-v3-${i}`, { elites, checkpoint: true }));
    const wins = results.filter(result => result.run.phase === 'victory');
    assert.ok(wins.length >= 7, `elite count ${elites}: ${wins.length}/10 wins`);
    for (const { run, trace } of results) {
      const firstShop = trace.find(node => node.type === 'shop');
      if (firstShop) assert.ok(firstShop.gold >= 95, 'two introductory victories fund at least one first-shop item');
      if (run.phase === 'victory') { assert.equal(run.stats.wins, 4 + elites); assert.equal(run.history.length, 12); }
    }
    totals.push({ elites, wins: wins.length, hp: wins.map(result => result.run.condition), relics: wins.map(result => result.run.relics.length) });
  }
  assert.ok(new Set(totals.flatMap(t => t.hp)).size > 5, 'seeded route and rewards create different health outcomes');
  for (const sample of totals) t.diagnostic(`elite=${sample.elites}: wins=${sample.wins}/10, finalHP=${Math.min(...sample.hp)}-${Math.max(...sample.hp)}, relics=${Math.min(...sample.relics)}-${Math.max(...sample.relics)}`);
});

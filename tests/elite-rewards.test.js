import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CARDS, RELICS, ELITE_RELICS, OPPONENTS, createRun, act, availableNodes, routeFor, forecast, validateSave } from '../dist/legacy-engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/pre-elite-choice-saves.json', import.meta.url), 'utf8'));
const shape = route => route.map(stage => ({ id: stage.id, choices: stage.choices.map(({ id, type, opponentId, lane, next }) => ({ id, type, opponentId, lane, next })) }));
const cost = card => card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost;
function finishDuel(run) {
  let steps = 0;
  while (run.phase === 'match') {
    assert.ok(++steps < 100);
    const before = run, incoming = forecast(run).incoming;
    const options = run.match.hand.filter(card => cost(card) <= run.match.energy).map(card => act(run, { type: 'play-card', uid: card.uid }))
      .filter(next => next.phase !== 'defeat').map(next => ({ next, value: (before.match.enemyHp - next.match.enemyHp) * 2 + incoming - forecast(next).incoming + (next.match.momentum - before.match.momentum) * 0.5 }));
    options.sort((a, b) => b.value - a.value);
    run = options[0]?.next ?? act(run, { type: 'end-turn' });
    assert.ok(validateSave(run), `valid ${run.phase} ${run.match.opponentId}`);
  }
  assert.equal(run.phase, 'reward');
  return run;
}
const mapCache = new Map();
function eliteMap(opponentId) {
  if (mapCache.has(opponentId)) return copy(mapCache.get(opponentId));
  let seed = 0;
  while (createRun(seed).route[5].choices[0].opponentId !== opponentId) { assert.ok(++seed < 128); }
  let run = createRun(seed);
  while (run.routeIndex < 5) {
    const choices = availableNodes(run), node = choices.find(n => n.type === 'rest') ?? choices.find(n => n.type === 'event') ?? choices[0];
    run = act(run, { type: 'choose-node', id: node.id });
    if (run.phase === 'match') run = act(finishDuel(run), { type: 'take-reward', id: null });
    else if (run.phase === 'rest') run = act(run, { type: 'rest' });
    else if (run.phase === 'event') run = act(run, { type: 'event-choice', id: 'safe' });
    else run = act(run, { type: 'leave-node' });
    assert.ok(validateSave(run));
  }
  mapCache.set(opponentId, copy(run)); return run;
}
function fixture(ids, relics = [], opponentId = 'school', upgraded = false, fill = 'cover') {
  let run = opponentId === 'school' ? createRun(17) : eliteMap(opponentId);
  run.relics = relics.slice(); run.condition = 100;
  run.deck = Array.from({ length: Math.max(12, ids.length) }, (_, i) => ({ uid: `c${i + 1}`, id: ids[i] ?? fill, upgraded })); run.nextUid = run.deck.length + 1;
  const node = availableNodes(run).find(n => n.opponentId === opponentId); assert.ok(node);
  run = act(run, { type: 'choose-node', id: node.id });
  run.match.hand = copy(run.deck.slice(0, ids.length)); run.match.draw = copy(run.deck.slice(ids.length));
  assert.ok(validateSave(run)); return run;
}
const play = (run, uid) => act(run, { type: 'play-card', uid });
function atHp(run, hp) {
  const damage = run.match.enemyHp - hp;
  run.match.enemyHp = hp; run.match.chance += damage; run.match.damageDealt += damage; run.stats.damage += damage;
  assert.ok(validateSave(run)); return run;
}

test('four elites have separate three-item pools and all twelve rewards stay out of shops', () => {
  assert.deepEqual(Object.keys(ELITE_RELICS).sort(), ['elite', 'legend', 'legend-ronaldo', 'legend-zidane']);
  const ids = Object.values(ELITE_RELICS).flat(); assert.equal(ids.length, 12); assert.equal(new Set(ids).size, 12);
  for (const [opponentId, pool] of Object.entries(ELITE_RELICS)) {
    assert.deepEqual(OPPONENTS[opponentId].eliteRelics, pool); assert.equal(pool.length, 3);
    for (const id of pool) { assert.equal(RELICS[id].shop, false); assert.equal(RELICS[id].price, 0); }
  }
  assert.equal(Object.values(RELICS).filter(item => item.shop !== false).length, 9);
  for (const id of ['legend', 'legend-zidane', 'legend-ronaldo']) assert.equal(OPPONENTS[id].legend, true);
});

test('new maps rotate four elite identities with three distinct candidates and preserve bypasses', () => {
  const first = new Set(), later = new Set();
  for (let seed = 0; seed < 128; seed++) {
    const run = createRun(seed), early = run.route[5].choices.filter(n => n.type === 'elite'), late = run.route[9].choices.filter(n => n.type === 'elite');
    assert.equal(run.routeVersion, 2); assert.equal(run.seed, run.initialSeed);
    assert.equal(early.length, 1); assert.equal(late.length, 2);
    assert.equal(new Set([...early, ...late].map(n => n.opponentId)).size, 3);
    first.add(early[0].opponentId); late.forEach(node => later.add(node.opponentId));
    for (const stage of [5, 9]) {
      const bypass = run.route[stage].choices.find(n => n.type === 'event');
      assert.ok(run.route[stage - 1].choices.every(node => node.next.includes(bypass.id)));
    }
    assert.deepEqual(shape(run.route), shape(createRun(seed).route)); assert.ok(validateSave(run));
  }
  assert.equal(first.size, 4); assert.equal(later.size, 4);
});

test('pre-update maps, active combat and automatic libero rewards survive migration without rerolls', () => {
  for (const saved of Object.values(legacy)) {
    const original = copy(saved), restored = validateSave(saved); assert.ok(restored); assert.deepEqual(saved, original);
    assert.equal(restored.routeVersion, 1); assert.deepEqual(restored.relicOffers, []);
    assert.deepEqual(shape(restored.route), shape(saved.route));
    for (const key of ['condition', 'maxCondition', 'gold', 'deck', 'relics', 'seed', 'initialSeed', 'stats', 'phase', 'routeIndex', 'rewardRelic']) assert.deepEqual(restored[key], saved[key], key);
    const oldCombat = copy(restored.match);
    for (const key of ['passCardPlayed', 'tacticCardPlayed', 'shotCardPlayed', 'tempoTriggered', 'enemyExposed', 'enemyWeakened']) delete oldCombat[key];
    assert.deepEqual(oldCombat, saved.match);
    assert.deepEqual(validateSave(restored), restored);
    const changed = copy(saved); changed.routeVersion = 2; assert.equal(validateSave(changed), null);
  }
  const rewarded = validateSave(legacy.eliteReward);
  assert.equal(rewarded.rewardRelic, 'libero-seal'); assert.ok(rewarded.relics.includes('libero-seal'));
  assert.equal(act(rewarded, { type: 'take-elite-relic', id: 'catenaccio-band' }), rewarded);
  const next = act(rewarded, { type: 'take-reward', id: null });
  assert.equal(next.phase, 'map'); assert.equal(next.routeVersion, 1); assert.ok(validateSave(next));
});

test('each elite offers a rare card and exactly one chosen relic before card rewards can advance', () => {
  for (const opponentId of Object.keys(ELITE_RELICS)) {
    const started = fixture(Array(5).fill('power-shot'), [], opponentId, true, 'power-shot');
    const won = finishDuel(started), before = copy(won), pool = ELITE_RELICS[opponentId];
    assert.deepEqual(won.relicOffers, pool); assert.deepEqual(won.relics, []); assert.equal(won.rewardRelic, null);
    assert.equal(won.gold - started.gold, OPPONENTS[opponentId].reward); assert.ok(won.offers.some(id => CARDS[id].rarity === 'rare'));
    for (const id of [null, won.offers[0]]) assert.equal(act(won, { type: 'take-reward', id }), won);
    assert.equal(act(won, { type: 'leave-node' }), won);
    for (const id of ['swift-boots', 'not-a-relic']) assert.equal(act(won, { type: 'take-elite-relic', id }), won);
    const chosen = act(won, { type: 'take-elite-relic', id: pool[1] });
    assert.deepEqual(won, before); assert.deepEqual(chosen.relicOffers, []); assert.deepEqual(chosen.relics, [pool[1]]); assert.equal(chosen.rewardRelic, pool[1]);
    for (const key of ['seed', 'deck', 'condition', 'gold', 'stats', 'match', 'offers']) assert.deepEqual(chosen[key], won[key]);
    assert.ok(validateSave(chosen));
    for (const id of pool) assert.equal(act(chosen, { type: 'take-elite-relic', id }), chosen);
    const next = act(chosen, { type: 'take-reward', id: null });
    assert.equal(next.phase, 'map'); assert.deepEqual(next.relicOffers, []); assert.equal(next.rewardRelic, null); assert.ok(validateSave(next));
  }
});

test('owned elite rewards shrink the pool and owning all three never blocks card rewards', () => {
  for (const count of [1, 2, 3]) {
    const owned = ELITE_RELICS.legend.slice(0, count);
    const won = finishDuel(fixture(Array(5).fill('power-shot'), owned, 'legend', true, 'power-shot'));
    assert.deepEqual(won.relicOffers, ELITE_RELICS.legend.slice(count));
    assert.deepEqual(won.relics, owned);
    if (count === 3) { const next = act(won, { type: 'take-reward', id: null }); assert.equal(next.phase, 'map'); assert.ok(validateSave(next)); }
  }
});

test('Maldini relics stack first-card defense and heal only surviving zero-damage turn endings', () => {
  let run = fixture(['dribble', 'dribble', 'cover', 'cover'], ['libero-seal', 'catenaccio-band', 'grip-socks']);
  run = play(run, 'c1'); assert.equal(run.match.defense, 4);
  run = play(run, 'c2'); assert.equal(run.match.defense, 4);
  run = play(run, 'c3'); assert.equal(run.match.defense, 17);
  run = act(run, { type: 'end-turn' }); assert.equal(run.match.defense, 0); assert.ok(validateSave(run));
  for (const hp of [90, 99]) {
    let protectedRun = fixture(['cover'], ['clean-sheet-crest']); protectedRun.condition = hp;
    protectedRun = act(play(protectedRun, 'c1'), { type: 'end-turn' });
    assert.equal(protectedRun.condition, Math.min(100, hp + 2)); assert.ok(validateSave(protectedRun));
  }
  const exposed = fixture(['cover'], ['clean-sheet-crest']); exposed.condition = 90;
  assert.equal(act(exposed, { type: 'end-turn' }).condition, 83);
  exposed.condition = 1; const dead = act(exposed, { type: 'end-turn' }); assert.equal(dead.phase, 'defeat'); assert.equal(dead.condition, 0);
  const risk = fixture(['sprint'], ['clean-sheet-crest']); risk.condition = 3; assert.equal(play(risk, 'c1').phase, 'defeat');
});

test('Zidane relics grant one touch bonus, one tactic draw, and a conditional first-shot bonus', () => {
  let touch = fixture(['quick-pass', 'quick-pass'], ['maestro-touch']);
  touch = play(touch, 'c1'); assert.equal(touch.match.momentum, 2);
  touch = play(touch, 'c2'); assert.equal(touch.match.momentum, 2); assert.ok(validateSave(touch));
  let tactic = fixture(['focus', 'switch'], ['roulette-rune']);
  tactic = play(tactic, 'c1'); assert.equal(tactic.match.hand.length, 2);
  tactic = play(tactic, 'c2'); assert.equal(tactic.match.hand.length, 1); assert.ok(validateSave(tactic));
  const normal = play(fixture(['shot', 'shot'], ['burst-laces']), 'c1');
  const empowered = play(fixture(['shot', 'shot'], ['burst-laces', 'playmaker-lens']), 'c1');
  assert.equal(normal.match.enemyHp - empowered.match.enemyHp, 4);
  assert.equal(normal.match.enemyHp - play(normal, 'c2').match.enemyHp, empowered.match.enemyHp - play(empowered, 'c2').match.enemyHp);
  let late = fixture(['clutch', 'feint', 'shot'], ['playmaker-lens']);
  late = play(play(late, 'c1'), 'c2'); const before = late.match.enemyHp;
  late = play(late, 'c3'); assert.equal(before - late.match.enemyHp, 13, 'a later charged shot cannot regain the first-shot bonus'); assert.ok(validateSave(late));
});

test('Ronaldo relics apply first-shot, pre-shot half-health, and once-per-duel starting momentum', () => {
  let run = fixture(['shot', 'shot'], ['fenom-cleats']);
  run = play(run, 'c1'); assert.equal(run.match.enemyHp, 30);
  const before = run.match.enemyHp; run = play(run, 'c2'); assert.equal(before - run.match.enemyHp, 9); assert.ok(validateSave(run));
  for (const hp of [22, 21, 20]) {
    const base = atHp(fixture(['shot']), hp), empowered = atHp(fixture(['shot'], ['nine-crest']), hp);
    assert.equal(play(base, 'c1').match.enemyHp - play(empowered, 'c1').match.enemyHp, hp <= 21 ? 3 : 0);
  }
  const burst = fixture(['shot'], ['burst-laces']); assert.equal(burst.match.momentum, 3);
  assert.equal(act(burst, { type: 'end-turn' }).match.momentum, 3, 'turn changes do not grant another starting bonus');
  assert.equal(act(play(burst, 'c1'), { type: 'end-turn' }).match.momentum, 0);
});

test('Doyun relics trigger once per turn and tempo works in either card order without exceeding energy', () => {
  let run = fixture(['dribble', 'dribble'], ['street-rhythm', 'swift-boots']);
  run = play(run, 'c1'); assert.equal(run.match.momentum, 5);
  run = play(run, 'c2'); assert.equal(run.match.momentum, 8);
  let touch = fixture(['quick-pass', 'quick-pass'], ['ankle-tape']);
  touch = play(touch, 'c1'); assert.equal(touch.match.defense, 3);
  touch = play(touch, 'c2'); assert.equal(touch.match.defense, 3);
  for (const ids of [['dribble', 'shot', 'clutch'], ['shot', 'dribble', 'clutch']]) {
    let tempo = fixture(ids, ['tempo-charm']); tempo = play(play(tempo, 'c1'), 'c2');
    assert.equal(tempo.match.energy, 2); assert.equal(tempo.match.tempoTriggered, true);
    tempo = play(tempo, 'c3'); assert.equal(tempo.match.energy, 2); assert.ok(validateSave(tempo));
    tempo = act(tempo, { type: 'end-turn' }); assert.equal(tempo.match.tempoTriggered, false); assert.equal(tempo.match.shotCardPlayed, false); assert.equal(tempo.match.dribbleCardPlayed, false);
  }
  let capped = fixture(['sprint', 'clutch', 'shot'], ['tempo-charm']); capped = play(play(capped, 'c1'), 'c2');
  assert.equal(capped.match.energy, 3); capped = play(capped, 'c3'); assert.equal(capped.match.energy, 2);
});

test('choosing tempo after a winning dribble-and-shot turn never rewrites the finished battle', () => {
  let run = atHp(fixture(['dribble', 'shot', 'shot'], [], 'elite'), 20);
  run = play(play(play(run, 'c1'), 'c2'), 'c3'); assert.equal(run.phase, 'reward');
  assert.equal(run.match.dribbleCardPlayed, true); assert.equal(run.match.shotCardPlayed, true); assert.equal(run.match.tempoTriggered, false);
  const before = copy(run.match), selected = act(run, { type: 'take-elite-relic', id: 'tempo-charm' });
  assert.deepEqual(selected.match, before); assert.ok(validateSave(selected));
  const restored = validateSave(copy(selected)); assert.deepEqual(restored, selected);
  assert.ok(validateSave(act(restored, { type: 'take-reward', id: null })));
});

test('trigger flags and relic choice saves reject impossible states and recover missing old flags', () => {
  let run = fixture(['quick-pass', 'focus', 'dribble', 'clutch'], ['maestro-touch', 'roulette-rune', 'tempo-charm']);
  for (const uid of ['c1', 'c2', 'c3', 'c4']) run = play(run, uid);
  for (const flag of ['passCardPlayed', 'tacticCardPlayed', 'shotCardPlayed', 'tempoTriggered']) {
    const broken = copy(run); broken.match[flag] = false; assert.equal(validateSave(broken), null, flag);
    broken.match[flag] = 'true'; assert.equal(validateSave(broken), null, flag);
  }
  const missing = copy(run); for (const flag of ['passCardPlayed', 'tacticCardPlayed', 'shotCardPlayed', 'tempoTriggered']) delete missing.match[flag];
  assert.deepEqual(validateSave(missing), run);
  const won = finishDuel(fixture(Array(5).fill('power-shot'), [], 'legend-zidane', true, 'power-shot'));
  for (const offers of [['maestro-touch', 'maestro-touch'], ['libero-seal'], ['maestro-touch'], ['maestro-touch', 'roulette-rune', 'playmaker-lens', 'libero-seal']]) {
    const broken = copy(won); broken.relicOffers = offers; assert.equal(validateSave(broken), null);
  }
  const wrongPhase = createRun(2); wrongPhase.relicOffers = ['libero-seal']; assert.equal(validateSave(wrongPhase), null);
  const badVersion = createRun(2); badVersion.routeVersion = 9; assert.equal(validateSave(badVersion), null);
});

test('new legend patterns telegraph manageable opening turns and distinct later pressure', () => {
  const zidane = fixture(['cover'], [], 'legend-zidane'), ronaldo = fixture(['cover'], [], 'legend-ronaldo');
  assert.equal(zidane.match.intent.attack, 8); assert.equal(zidane.match.enemyBlock, 10); assert.match(zidane.match.intent.rule, /4턴마다/);
  let next = zidane; for (let i = 0; i < 4; i++) next = act(next, { type: 'end-turn' });
  assert.equal(next.match.intent.attack, 10); assert.ok(validateSave(next));
  next = act(ronaldo, { type: 'end-turn' }); assert.equal(next.match.intent.attack, 12); assert.ok(next.match.enemyBlock <= 2);
  next = act(next, { type: 'end-turn' }); assert.equal(next.match.intent.attack, 21); assert.equal(next.match.enemyBlock, 0); assert.match(next.match.intent.rule, /페노메노/); assert.ok(validateSave(next));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, RELICS, CARD_REMOVAL_BASE_COST, getCardRemovalCost, createRun, act, availableNodes, forecast, validateSave } from '../dist/engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const remove = (run, uid) => act(run, { type: 'remove-card', uid });
function reachPhase(run, phase) {
  let steps = 0;
  while (run.phase !== phase) {
    assert.ok(++steps < 250, `legal play reaches ${phase}`);
    if (run.phase === 'map') {
      const choices = availableNodes(run);
      const node = choices.find(node => node.type === phase) ?? choices.find(node => node.type === 'rest') ?? choices.find(node => node.type === 'event') ?? choices[0];
      run = act(run, { type: 'choose-node', id: node.id });
    } else if (run.phase === 'match') {
      const before = run, incoming = forecast(run).incoming;
      const options = run.match.hand.filter(card => (card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost) <= run.match.energy)
        .map(card => act(run, { type: 'play-card', uid: card.uid })).filter(next => next.phase !== 'defeat')
        .map(next => ({ next, value: (before.match.enemyHp - next.match.enemyHp) * 2 + incoming - forecast(next).incoming + (next.match.momentum - before.match.momentum) * 0.5 }));
      options.sort((a, b) => b.value - a.value);
      run = options[0]?.next ?? act(run, { type: 'end-turn' });
    } else if (run.phase === 'reward') {
      if (run.relicOffers.length) run = act(run, { type: 'take-elite-relic', id: run.relicOffers[0] });
      run = act(run, { type: 'take-reward', id: null });
    } else if (run.phase === 'rest') run = act(run, { type: 'rest' });
    else if (run.phase === 'event') run = act(run, { type: 'event-choice', id: 'safe' });
    else if (['training', 'shop'].includes(run.phase)) run = act(run, { type: 'leave-node' });
    else assert.fail(`unexpected phase ${run.phase}`);
    assert.ok(validateSave(run), `valid ${run.phase} at stage ${run.routeIndex}`);
  }
  return run;
}
const shopFixture = reachPhase(createRun('card-removal'), 'shop');
const trainingFixture = reachPhase(createRun('card-removal'), 'training');

test('shop removes the selected card instance, including upgraded duplicates, without ending the visit', () => {
  const shop = copy(shopFixture);
  shop.gold = 200;
  const duplicates = shop.deck.filter(card => card.id === 'shot');
  assert.equal(duplicates.length, 2);
  duplicates[1].upgraded = true;
  const before = copy(shop), removed = remove(shop, duplicates[1].uid);
  assert.deepEqual(shop, before, 'the source state is untouched');
  assert.equal(removed.phase, 'shop');
  assert.equal(removed.gold, 150);
  assert.equal(removed.shopRemovalCount, 1);
  assert.deepEqual(removed.deck, before.deck.filter(card => card.uid !== duplicates[1].uid));
  assert.deepEqual(removed.activeNode, before.activeNode);
  assert.deepEqual(removed.history, before.history);
  assert.deepEqual(removed.shopOffers, before.shopOffers);
  assert.equal(remove(removed, duplicates[1].uid), removed, 'a repeated stale selection cannot spend gold');
  assert.ok(validateSave(removed));
});

test('shop removal price rises 25 each time and carries across shops until a new run', () => {
  let shop = copy(shopFixture); shop.gold = 1000;
  assert.equal(CARD_REMOVAL_BASE_COST, 50);
  for (const price of [50, 75, 100]) {
    const beforeGold = shop.gold;
    assert.equal(getCardRemovalCost(shop), price);
    shop = remove(shop, shop.deck.find(card => card.id === 'through-pass' || card.id === 'quick-pass').uid);
    assert.equal(shop.gold, beforeGold - price);
    assert.deepEqual(validateSave(copy(shop)), shop);
  }
  assert.equal(shop.shopRemovalCount, 3);
  assert.equal(getCardRemovalCost(shop), 125);
  const firstShopId = shop.activeNode.id;
  const secondShop = reachPhase(act(shop, { type: 'leave-node' }), 'shop');
  assert.notEqual(secondShop.activeNode.id, firstShopId);
  assert.equal(secondShop.shopRemovalCount, 3);
  assert.equal(getCardRemovalCost(secondShop), 125);
  const removed = remove(secondShop, secondShop.deck.find(card => card.id === 'cover').uid);
  assert.equal(removed.gold, secondShop.gold - 125);
  assert.equal(removed.shopRemovalCount, 4);
  assert.equal(getCardRemovalCost(createRun('new-journey')), 50);
});

test('invalid, unaffordable and out-of-phase removal requests are exact no-ops', () => {
  for (const count of [0, 1, 4]) {
    const poor = { ...copy(shopFixture), shopRemovalCount: count, gold: 50 + 25 * count - 1 };
    assert.equal(remove(poor, poor.deck[0].uid), poor);
    const exact = { ...poor, gold: getCardRemovalCost(poor) };
    assert.equal(remove(exact, exact.deck[0].uid).gold, 0);
  }
  for (const uid of [undefined, null, 'missing', shopFixture.deck[0].id, 1, {}, []]) assert.equal(remove(shopFixture, uid), shopFixture);
  for (const phase of ['map', 'match', 'reward', 'rest', 'event', 'victory', 'defeat']) {
    const state = { ...copy(shopFixture), phase, gold: 1000 };
    assert.equal(remove(state, state.deck[0].uid), state);
  }
});

test('shop can reduce the deck below eight but never remove the last card', () => {
  let shop = copy(shopFixture); shop.gold = 10000;
  const keeper = shop.deck.find(card => card.id === 'shot');
  for (const card of shop.deck.filter(card => card.uid !== keeper.uid)) {
    shop = remove(shop, card.uid);
    assert.deepEqual(validateSave(copy(shop)), shop, `save survives with ${shop.deck.length} cards`);
  }
  assert.deepEqual(shop.deck, [keeper]);
  assert.equal(remove(shop, keeper.uid), shop);
  const empty = copy(shop); empty.deck = [];
  assert.equal(validateSave(empty), null);
  let match = reachPhase(act(shop, { type: 'leave-node' }), 'match');
  assert.deepEqual(match.match.hand, [keeper]);
  for (let round = 0; round < 2; round++) {
    match = act(match, { type: 'play-card', uid: keeper.uid });
    assert.equal(match.match.hand.length, 0);
    assert.ok(validateSave(match));
    match = act(match, { type: 'end-turn' });
    assert.deepEqual(match.match.hand, [keeper], 'the one-card discard redraws exactly once');
    assert.equal(match.match.draw.length, 0);
    assert.ok(validateSave(match));
  }
});

test('training still offers one free removal above eight cards without raising the shop price', () => {
  const training = { ...copy(trainingFixture), shopRemovalCount: 2 }, before = copy(training);
  const removed = remove(training, training.deck[0].uid);
  assert.deepEqual(training, before);
  assert.equal(removed.phase, 'map');
  assert.equal(removed.history.at(-1).result, 'remove');
  assert.equal(removed.gold, training.gold);
  assert.equal(removed.shopRemovalCount, 2);
  assert.equal(getCardRemovalCost(removed), 100);
  assert.ok(validateSave(removed));
  for (const size of [1, 7, 8]) {
    const minimum = { ...copy(training), deck: training.deck.slice(0, size) };
    assert.equal(remove(minimum, minimum.deck[0].uid), minimum);
  }
});

test('old saves default the removal count without changing the journey, and malformed counts are rejected', () => {
  for (const schema of [2, 3]) {
    const original = createRun('legacy-removal');
    if (schema === 2) { original.schema = 2; delete original.route; }
    const legacy = copy(original); delete legacy.shopRemovalCount;
    assert.deepEqual(validateSave(legacy), original);
    assert.equal(Object.hasOwn(legacy, 'shopRemovalCount'), false);
  }
  for (const count of [-1, 1.2, '1', true, null, {}, [], 100001]) {
    const invalid = { ...copy(shopFixture), shopRemovalCount: count };
    assert.equal(validateSave(invalid), null);
  }
});

test('item purchases and leaving a shop continue to work after a card removal', () => {
  const shop = { ...copy(shopFixture), gold: 1000 };
  const removed = remove(shop, shop.deck[0].uid), id = removed.shopOffers[0];
  const bought = act(removed, { type: 'buy-relic', id });
  assert.equal(bought.gold, removed.gold - RELICS[id].price);
  assert.ok(bought.relics.includes(id));
  assert.equal(bought.shopRemovalCount, 1);
  assert.ok(validateSave(bought));
  const left = act(bought, { type: 'leave-node' });
  assert.equal(left.phase, 'map');
  assert.equal(left.history.at(-1).result, 'skip');
  assert.deepEqual(left.shopOffers, []);
  assert.deepEqual(validateSave(copy(left)), left);
});

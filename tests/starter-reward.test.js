import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, STARTER_RELICS, createRun, act, availableNodes, forecast, validateSave } from '../dist/engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const unlock = run => act(run, { type: 'complete-tutorial' });
const claim = (run, id) => act(run, { type: 'take-starter-relic', id });
function openMatch(seed = 'starter') {
  const run = createRun(seed);
  return act(run, { type: 'choose-node', id: availableNodes(run)[0].id });
}
function handFixture() {
  const run = openMatch();
  const pool = [...run.match.hand, ...run.match.draw];
  run.match.hand = ['dribble', 'shot', 'cover'].map(id => pool.find(card => card.id === id));
  const hand = new Set(run.match.hand.map(card => card.uid));
  run.match.draw = pool.filter(card => !hand.has(card.uid));
  assert.ok(validateSave(run));
  return run;
}
function playNamed(run, id) {
  return act(run, { type: 'play-card', uid: run.match.hand.find(card => card.id === id).uid });
}
function reachShop(seed) {
  let run = createRun(seed), steps = 0;
  while (run.phase !== 'shop') {
    assert.ok(++steps < 100, 'legal play reaches a shop');
    if (run.phase === 'map') {
      const choices = availableNodes(run);
      const node = choices.find(node => node.type === 'shop') ?? choices.find(node => node.type === 'rest') ?? choices[0];
      run = act(run, { type: 'choose-node', id: node.id });
    } else if (run.phase === 'match') {
      const before = run, incoming = forecast(run).incoming;
      const options = run.match.hand.filter(card => (card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost) <= run.match.energy)
        .map(card => act(run, { type: 'play-card', uid: card.uid }))
        .filter(next => next.phase !== 'defeat')
        .map(next => ({ next, value: (before.match.enemyHp - next.match.enemyHp) * 2 + incoming - forecast(next).incoming + (next.match.momentum - before.match.momentum) * 0.5 }));
      options.sort((a, b) => b.value - a.value);
      run = options[0]?.next ?? act(run, { type: 'end-turn' });
    } else if (run.phase === 'reward') run = act(run, { type: 'take-reward', id: null });
    else if (run.phase === 'rest') run = act(run, { type: 'rest' });
    else if (run.phase === 'training') run = act(run, { type: 'upgrade-card', uid: run.deck.find(card => card.id === 'shot').uid });
    else assert.fail(`unexpected phase ${run.phase}`);
  }
  assert.ok(validateSave(run));
  return run;
}

test('the frozen starter choices unlock once and do not alter the active game', () => {
  assert.deepEqual(STARTER_RELICS, ['power-cleats', 'swift-boots', 'training-kit']);
  assert.ok(Object.isFrozen(STARTER_RELICS));
  const original = openMatch(), before = copy(original);
  assert.equal(original.starterRewardUnlocked, false);
  assert.equal(original.starterRelic, null);
  assert.equal(claim(original, STARTER_RELICS[0]), original);
  const unlocked = unlock(original);
  assert.deepEqual(unlocked, { ...before, starterRewardUnlocked: true });
  assert.deepEqual(original, before);
  assert.equal(unlock(unlocked), unlocked);
  assert.ok(validateSave(unlocked));
});

test('one free claim is permanent and rejects unknown, owned and repeated rewards', () => {
  const unlocked = unlock(openMatch()), before = copy(unlocked);
  for (const id of ['energy-flask', 'libero-seal', 'missing', null, 0]) assert.equal(claim(unlocked, id), unlocked);
  const owned = copy(unlocked); owned.relics.push('swift-boots');
  assert.equal(claim(owned, 'swift-boots'), owned);
  const claimed = claim(unlocked, 'power-cleats');
  assert.deepEqual(claimed, { ...before, starterRelic: 'power-cleats', relics: ['power-cleats'] });
  assert.deepEqual(unlocked, before);
  assert.equal(unlock(claimed), claimed);
  for (const id of STARTER_RELICS) assert.equal(claim(claimed, id), claimed);
  const recovered = validateSave(copy(claimed));
  assert.deepEqual(recovered, claimed);
  assert.equal(claim(recovered, 'swift-boots'), recovered);
});

test('all three rewards affect actual card and turn resolution', () => {
  const baseline = handFixture();
  const normalShot = playNamed(baseline, 'shot');
  const powerShot = playNamed(claim(unlock(baseline), 'power-cleats'), 'shot');
  assert.equal(normalShot.match.enemyHp - powerShot.match.enemyHp, 3);
  const normalDribble = playNamed(baseline, 'dribble');
  const fastDribble = playNamed(claim(unlock(baseline), 'swift-boots'), 'dribble');
  assert.equal(fastDribble.match.momentum - normalDribble.match.momentum, 1);
  assert.equal(playNamed(normalDribble, 'shot').match.enemyHp - playNamed(fastDribble, 'shot').match.enemyHp, 1);
  const defended = claim(unlock(baseline), 'training-kit');
  assert.equal(defended.match.defense, 3);
  assert.equal(defended.match.energy, baseline.match.energy);
  const nextTurn = act(defended, { type: 'end-turn' });
  assert.equal(nextTurn.condition, 96, 'first enemy attack 7 is reduced by 3');
  assert.equal(nextTurn.match.defense, 3);
  assert.ok(validateSave(nextTurn));
  const beforeBattle = claim(unlock(createRun(1)), 'training-kit');
  const started = act(beforeBattle, { type: 'choose-node', id: availableNodes(beforeBattle)[0].id });
  assert.equal(started.match.defense, 3, 'a map claim applies once when battle begins');
});

test('training gear claimed after play or in a later turn waits until the next round', () => {
  for (const progressed of [playNamed(handFixture(), 'cover'), act(handFixture(), { type: 'end-turn' })]) {
    const unlocked = unlock(progressed), claimed = claim(unlocked, 'training-kit');
    assert.deepEqual(claimed.match, unlocked.match, 'claim cannot retroactively add block after the turn has begun');
    assert.equal(claimed.seed, unlocked.seed);
    const next = act(claimed, { type: 'end-turn' });
    assert.equal(next.match.defense, 3);
    assert.ok(validateSave(next));
  }
});

test('a late shop claim removes its stock entry without spending or changing the journey', () => {
  let shop, id;
  for (let seed = 0; seed < 8 && !id; seed++) {
    shop = reachShop(seed);
    id = shop.shopOffers.find(item => STARTER_RELICS.includes(item));
  }
  assert.ok(id, 'a deterministic shop offers a starter choice');
  const unlocked = unlock(shop), before = copy(unlocked), claimed = claim(unlocked, id);
  assert.deepEqual(claimed, { ...before, starterRelic: id, relics: [...before.relics, id], shopOffers: before.shopOffers.filter(item => item !== id) });
  assert.ok(validateSave(claimed));
  assert.equal(act(claimed, { type: 'buy-relic', id }), claimed);
  const next = act(claimed, { type: 'leave-node' });
  assert.equal(next.starterRelic, id);
  assert.equal(claim(next, STARTER_RELICS.find(item => item !== id)), next);
});

test('schema2 and schema3 saves default missing reward fields without losing progress', () => {
  for (const schema of [2, 3]) {
    let original = createRun('before-starter-rewards');
    if (schema === 2) { original.schema = 2; delete original.route; }
    original = act(original, { type: 'choose-node', id: availableNodes(original)[0].id });
    const old = copy(original); delete old.starterRewardUnlocked; delete old.starterRelic;
    const restored = validateSave(old);
    assert.deepEqual(restored, original);
    assert.ok(!Object.hasOwn(old, 'starterRewardUnlocked'));
    assert.ok(!Object.hasOwn(old, 'starterRelic'));
  }
});

test('save validation rejects malformed reward ownership and terminal actions remain blocked', () => {
  const valid = createRun('starter-save');
  for (const value of [null, 0, 1, 'true', [], {}]) {
    const bad = copy(valid); bad.starterRewardUnlocked = value; assert.equal(validateSave(bad), null);
  }
  for (const value of [false, 0, '', [], {}, 'energy-flask', 'libero-seal']) {
    const bad = copy(valid); bad.starterRelic = value; assert.equal(validateSave(bad), null);
  }
  const missingOwnership = { ...copy(valid), starterRewardUnlocked: true, starterRelic: 'power-cleats' };
  assert.equal(validateSave(missingOwnership), null);
  const lockedOwnership = { ...copy(valid), starterRelic: 'power-cleats', relics: ['power-cleats'] };
  assert.equal(validateSave(lockedOwnership), null);
  for (const phase of ['victory', 'defeat']) {
    const terminal = { ...unlock(valid), phase };
    assert.equal(unlock(terminal), terminal);
    assert.equal(claim(terminal, 'power-cleats'), terminal);
  }
});

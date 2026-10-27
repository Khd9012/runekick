import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, createRun, availableNodes, act, forecast, getEnemyAttack, cardText, validateSave } from '../dist/legacy-engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const newIds = ['read-opening', 'lure-dribble', 'unsettling-shot', 'high-press', 'checking-tackle', 'close-mark'];
const play = (run, uid) => act(run, { type: 'play-card', uid });
function fixture(ids, { relics = [], upgraded = false, seed = 17, base } = {}) {
  let run = base ? copy(base) : createRun(seed);
  run.relics = relics; run.condition = run.maxCondition = 100;
  run.deck = Array.from({ length: Math.max(12, ids.length) }, (_, i) => ({ uid: `c${i + 1}`, id: ids[i] ?? 'cover', upgraded }));
  run.nextUid = run.deck.length + 1;
  const node = availableNodes(run).find(n => n.opponentId === (base ? 'legend' : 'school'));
  assert.ok(node);
  run = act(run, { type: 'choose-node', id: node.id });
  run.match.hand = copy(run.deck.slice(0, ids.length)); run.match.draw = copy(run.deck.slice(ids.length));
  assert.ok(validateSave(run)); return run;
}
function legendaryMap() {
  let seed = 0;
  while (!createRun(seed).route[5].choices.some(n => n.opponentId === 'legend')) assert.ok(++seed < 128);
  let run = createRun(seed);
  run.deck.forEach(card => { card.id = 'power-shot'; card.upgraded = true; });
  run.relics = ['power-cleats'];
  while (run.routeIndex < 5) {
    const nodes = availableNodes(run), node = nodes.find(n => n.type === 'rest') ?? nodes.find(n => n.type === 'event') ?? nodes[0];
    run = act(run, { type: 'choose-node', id: node.id });
    if (run.phase === 'match') {
      while (run.phase === 'match') run = play(run, run.match.hand[0].uid);
      assert.equal(run.phase, 'reward'); run = act(run, { type: 'take-reward', id: null });
    } else if (run.phase === 'rest') run = act(run, { type: 'rest' });
    else run = act(run, { type: 'leave-node' });
    assert.ok(validateSave(run));
  }
  return run;
}

test('six debuff cards and their upgrades expose the promised effect, cost and type', () => {
  assert.equal(Object.keys(CARDS).length, 24);
  assert.deepEqual(newIds.map(id => CARDS[id].type), ['tactic', 'dribble', 'shot', 'tactic', 'defense', 'pass']);
  for (const id of newIds) {
    assert.equal(CARDS[id].cost, 1); assert.equal(CARDS[id].upgradedCost, 1);
    assert.equal(cardText({ id }), CARDS[id].description);
    assert.equal(cardText({ id, upgraded: true }), CARDS[id].upgradedDescription);
  }
  assert.match(cardText({ id: 'read-opening', upgraded: true }), /약점 노출 3턴/);
  assert.match(cardText({ id: 'lure-dribble', upgraded: true }), /약점 노출 2턴.*기세 \+4/);
  assert.match(cardText({ id: 'high-press', upgraded: true }), /공격 약화 3턴/);
  assert.match(cardText({ id: 'unsettling-shot' }), /공격 후 약점 노출 1턴/);
  assert.match(cardText({ id: 'close-mark' }), /공격 후 공격 약화 1턴/);
});

test('exposure multiplies final card power before block and rounds down once', () => {
  const original = fixture(['read-opening', 'through-pass']);
  let run = play(original, 'c1');
  assert.equal(run.match.enemyExposed, 2); assert.equal(run.match.enemyHp, 42);
  assert.equal(original.match.enemyExposed, 0, 'actions remain immutable');
  run = play(run, 'c2');
  assert.equal(run.match.enemyHp, 34, 'floor(7 * 1.5) - 2 block = 8 damage');
  assert.equal(run.match.enemyBlock, 0); assert.ok(validateSave(run));
});

test('lure dribble combines exposure, momentum and dribble relics before a boosted shot', () => {
  let run = fixture(['lure-dribble', 'shot'], { relics: ['swift-boots', 'power-cleats', 'libero-seal', 'street-rhythm'] });
  run = play(run, 'c1');
  assert.equal(run.match.enemyExposed, 1); assert.equal(run.match.momentum, 6);
  assert.equal(run.match.defense, 4); assert.equal(run.match.enemyHp, 42);
  run = play(run, 'c2');
  assert.equal(run.match.enemyHp, 17, '(9 + 6 momentum + 3 cleats) * 1.5 - 2 block');
  assert.equal(run.match.momentum, 0); assert.ok(validateSave(run));
  const upgraded = play(fixture(['lure-dribble'], { upgraded: true }), 'c1');
  assert.equal(upgraded.match.enemyExposed, 2); assert.equal(upgraded.match.momentum, 4);
});

test('damage-and-debuff cards apply their new status after the hit, even through block', () => {
  let run = fixture(['unsettling-shot', 'shot']);
  run = play(run, 'c1');
  assert.equal(run.match.enemyHp, 38, 'fresh exposure does not amplify its own hit');
  assert.equal(run.match.enemyExposed, 1);
  run = play(run, 'c2'); assert.equal(run.match.enemyHp, 25, 'the next shot gets floor(9 * 1.5)');
  assert.ok(validateSave(run));
  run = fixture(['read-opening', 'unsettling-shot']);
  run = play(play(run, 'c1'), 'c2');
  assert.equal(run.match.enemyHp, 35, 'pre-existing exposure does apply to a debuff hit');
  assert.equal(run.match.enemyExposed, 3, 'duration stacks after damage');
  const marked = play(fixture(['close-mark']), 'c1');
  assert.equal(marked.match.enemyHp, 39); assert.equal(marked.match.enemyWeakened, 1);
});

test('weakness reduces telegraphed attack before defense and matches actual damage and block totals', () => {
  let run = fixture(['high-press', 'cover']);
  const baseIntent = copy(run.match.intent);
  run = play(run, 'c1');
  assert.deepEqual(run.match.intent, baseIntent, 'canonical enemy intent stays unchanged');
  assert.equal(getEnemyAttack(run), 5); assert.equal(forecast(run).enemyAttack, 5);
  assert.equal(forecast(run).baseEnemyAttack, 7); assert.equal(forecast(run).incoming, 5);
  run = play(run, 'c2'); assert.equal(forecast(run).incoming, 0);
  run = act(run, { type: 'end-turn' });
  assert.equal(run.condition, 100); assert.equal(run.match.lastOutcome.blocked, 5); assert.equal(run.stats.blocks, 5);
  assert.equal(run.match.enemyWeakened, 1); assert.equal(getEnemyAttack(run), 6, 'floor(9 * .75)');
  run = act(run, { type: 'end-turn' });
  assert.equal(run.condition, 94); assert.equal(run.match.lastOutcome.damageTaken, 6);
  assert.equal(run.match.enemyWeakened, 0); assert.equal(getEnemyAttack(run), 6, 'third-turn base attack is restored');
  assert.ok(validateSave(run));
});

test('checking tackle grants defense, weakness and first-defense relic bonuses independently', () => {
  let run = fixture(['checking-tackle'], { relics: ['grip-socks', 'catenaccio-band'], upgraded: true });
  run = play(run, 'c1');
  assert.equal(run.match.defense, 13); assert.equal(run.match.enemyWeakened, 2); assert.equal(run.match.enemyHp, 42);
  assert.equal(forecast(run).incoming, 0); assert.ok(validateSave(run));
});

test('one-turn debuffs affect this player turn and this retaliation only; durations stack, not strength', () => {
  let run = fixture(['lure-dribble', 'close-mark']);
  run = play(play(run, 'c1'), 'c2');
  assert.equal(run.match.enemyExposed, 1); assert.equal(run.match.enemyWeakened, 1);
  assert.equal(run.match.enemyHp, 37, 'floor(5 * 1.5) - 2 block');
  run = act(run, { type: 'end-turn' });
  assert.equal(run.condition, 95); assert.equal(run.match.enemyExposed, 0); assert.equal(run.match.enemyWeakened, 0);
  assert.equal(getEnemyAttack(run), 9); assert.equal(run.match.momentum, 3);
  assert.ok(validateSave(run));
  run = fixture(['read-opening', 'read-opening', 'high-press', 'high-press'], { relics: ['energy-flask'] });
  for (let i = 1; i <= 4; i++) run = play(run, `c${i}`);
  assert.equal(run.match.enemyExposed, 4); assert.equal(run.match.enemyWeakened, 4);
  assert.equal(getEnemyAttack(run), 5, 'reapplying weakness does not multiply its strength');
  const stacked = play(play(play(fixture(['read-opening', 'read-opening', 'through-pass']), 'c1'), 'c2'), 'c3');
  assert.equal(stacked.match.enemyHp, 34, 'four turns of exposure still amplify by 50%, not 100%');
  run.match.enemyExposed = 98; run.match.enemyWeakened = 98;
  run = act(run, { type: 'end-turn' });
  assert.equal(run.match.enemyExposed, 97); assert.equal(run.match.enemyWeakened, 97);
  const capped = fixture(['read-opening', 'high-press']); capped.match.enemyExposed = capped.match.enemyWeakened = 98;
  const next = play(play(capped, 'c1'), 'c2');
  assert.equal(next.match.enemyExposed, 99); assert.equal(next.match.enemyWeakened, 99);
  assert.ok(validateSave(next));
});

test('old saves default missing statuses to zero, active debuffs roundtrip and malformed values are rejected', () => {
  const fresh = fixture(['read-opening', 'high-press']);
  const old = copy(fresh); delete old.match.enemyExposed; delete old.match.enemyWeakened;
  const restored = validateSave(old);
  assert.equal(restored.match.enemyExposed, 0); assert.equal(restored.match.enemyWeakened, 0);
  assert.deepEqual(restored.match.intent, fresh.match.intent); assert.deepEqual(restored.deck, fresh.deck);
  const active = play(play(fresh, 'c1'), 'c2');
  assert.deepEqual(validateSave(copy(active)), active);
  for (const key of ['enemyExposed', 'enemyWeakened']) for (const value of [-1, .5, 100, null, '2', NaN, Infinity, {}, []]) {
    const bad = copy(active); bad.match[key] = value; assert.equal(validateSave(bad), null, `${key}: ${String(value)}`);
  }
  const changedIntent = copy(active); changedIntent.match.intent.attack = getEnemyAttack(active);
  assert.equal(validateSave(changedIntent), null, 'weakness must not rewrite canonical intent');
});

test('debuffs do not reduce self-cost or reflect damage; non-damaging cards preserve Maldini counter and valid saves', () => {
  const base = legendaryMap();
  for (const id of ['read-opening', 'lure-dribble', 'high-press', 'checking-tackle']) {
    let run = fixture([id, 'shot'], { base });
    run = play(run, 'c1');
    assert.equal(run.condition, 100); assert.equal(run.match.counterReady, true, id);
    assert.ok(validateSave(run), `${id} save before counter`);
    run = play(run, 'c2');
    assert.equal(run.condition, 97, `${id} does not reduce reflection`);
    assert.equal(run.match.counterReady, false); assert.ok(validateSave(run));
  }
  let blocked = play(fixture(['unsettling-shot', 'close-mark'], { base }), 'c1');
  assert.equal(blocked.match.enemyHp, 72, 'a fully blocked hit still applies exposure');
  assert.equal(blocked.match.enemyExposed, 1); assert.equal(blocked.condition, 97);
  blocked = play(blocked, 'c2');
  assert.equal(blocked.match.enemyHp, 71); assert.equal(blocked.match.enemyWeakened, 1);
  assert.equal(blocked.condition, 97, 'the same stance reflects only once'); assert.ok(validateSave(blocked));
  let run = fixture(['high-press', 'sprint']);
  run = play(play(run, 'c1'), 'c2'); assert.equal(run.condition, 97, 'weakness never changes card self-cost');
});

test('new cards enter seeded rewards and upgraded cards save; debuffs reset for the next encounter', () => {
  const seen = new Set();
  for (let seed = 0; seed < 100; seed++) {
    let run = fixture(['power-shot', 'power-shot'], { relics: ['power-cleats'], upgraded: true, seed });
    run = play(play(run, 'c1'), 'c2'); assert.equal(run.phase, 'reward');
    run.offers.forEach(id => seen.add(id));
  }
  for (const id of newIds) assert.ok(seen.has(id), `${id} is obtainable from rewards`);
  let run = fixture(['read-opening', 'high-press', 'power-shot', 'power-shot'], { relics: ['energy-flask', 'power-cleats'], upgraded: true });
  for (let i = 1; i <= 4 && run.phase === 'match'; i++) run = play(run, `c${i}`);
  assert.equal(run.phase, 'reward'); assert.ok(run.match.enemyExposed > 0); assert.ok(run.match.enemyWeakened > 0);
  assert.ok(validateSave(run)); run = act(run, { type: 'take-reward', id: null });
  while (run.phase === 'map') {
    run = act(run, { type: 'choose-node', id: availableNodes(run)[0].id });
    if (run.phase !== 'match') run = act(run, { type: 'leave-node' });
  }
  assert.equal(run.match.enemyExposed, 0); assert.equal(run.match.enemyWeakened, 0);
  assert.ok(validateSave(run));
});

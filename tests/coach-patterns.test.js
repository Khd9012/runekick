import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, OPPONENTS, createRun, availableNodes, act, validateSave, forecast, getEnemyAttack, getBossView } from '../dist/engine.js';

const copy = value => JSON.parse(JSON.stringify(value));
const maps = new Map();
function bossMap(id) {
  if (maps.has(id)) return copy(maps.get(id));
  let seed = 0;
  while (createRun(seed).route.at(-1).choices[0].opponentId !== id) assert.ok(++seed < 128);
  let run = createRun(seed);
  run.deck.forEach(card => { card.id = 'power-shot'; card.upgraded = true; });
  run.relics = ['power-cleats'];
  for (let step = 0; run.routeIndex < 11; step++) {
    assert.ok(step < 80);
    if (run.phase === 'map') {
      const nodes = availableNodes(run), node = nodes.find(n => n.type === 'rest') ?? nodes.find(n => n.type === 'event') ?? nodes[0];
      run = act(run, { type: 'choose-node', id: node.id });
    } else if (run.phase === 'match') {
      if (run.match.energy) run = act(run, { type: 'play-card', uid: run.match.hand[0].uid });
      else run = act(run, { type: 'end-turn' });
    } else if (run.phase === 'reward') {
      if (run.relicOffers.length) run = act(run, { type: 'take-elite-relic', id: run.relicOffers[0] });
      run = act(run, { type: 'take-reward', id: null });
    } else if (run.phase === 'rest') run = act(run, { type: 'rest' });
    else run = act(run, { type: 'leave-node' });
    assert.notEqual(run.phase, 'defeat'); assert.ok(validateSave(run));
  }
  assert.equal(run.phase, 'map'); maps.set(id, copy(run)); return run;
}
function fixture(id, ids, { relics = [], upgraded = false } = {}) {
  let run = bossMap(id);
  run.relics = relics; run.condition = run.maxCondition = 100;
  run.deck = Array.from({ length: Math.max(12, ids.length) }, (_, index) => ({ uid: `c${index + 1}`, id: ids[index] ?? 'cover', upgraded }));
  run.nextUid = run.deck.length + 1;
  run = act(run, { type: 'choose-node', id: availableNodes(run).find(n => n.opponentId === id).id });
  run.match.hand = copy(run.deck.slice(0, ids.length)); run.match.draw = copy(run.deck.slice(ids.length));
  checkpoint(run); return run;
}
function checkpoint(run) {
  const loaded = validateSave(copy(run)); assert.ok(loaded, `${run.match?.opponentId} turn ${run.match?.turn} ${run.phase}`); assert.deepEqual(loaded, run); return loaded;
}
function play(run, id) {
  const card = run.match.hand.find(c => c.id === id); assert.ok(card, `${id} in hand`);
  const next = act(run, { type: 'play-card', uid: card.uid }); assert.notEqual(next, run); return checkpoint(next);
}
function end(run) {
  const anticipated = forecast(run), hp = run.condition;
  const next = act(run, { type: 'end-turn' });
  assert.equal(next.match.lastOutcome.damageTaken, Math.min(hp, anticipated.incoming));
  assert.equal(next.match.lastOutcome.blocked, Math.min(anticipated.enemyAttack, anticipated.guard));
  return checkpoint(next);
}
// Controlled draw order for a later turn; never changes cards, energy or boss state.
function hand(run, ids) {
  const next = copy(run), cards = [...next.match.hand, ...next.match.draw, ...next.match.discard];
  next.match.hand = ids.map(id => { const i = cards.findIndex(c => c.id === id); assert.ok(i >= 0); return cards.splice(i, 1)[0]; });
  next.match.draw = cards; next.match.discard = []; return checkpoint(next);
}

test('Mourinho converts only leftover preparation block into the following counter', () => {
  let untouched = fixture('coach-mourinho', ['cover']);
  assert.equal(getBossView(untouched).effect, 'wall'); assert.equal(getEnemyAttack(untouched), 8);
  untouched = end(untouched); assert.equal(getEnemyAttack(untouched), 22); assert.equal(untouched.match.boss.counterCharge, 12);
  let partial = play(fixture('coach-mourinho', ['through-pass', 'high-press']), 'through-pass');
  partial = play(partial, 'high-press'); assert.equal(getBossView(partial).progress, 5);
  partial = end(partial); assert.equal(partial.match.intent.attack, 15); assert.equal(getEnemyAttack(partial), 11);
  let broken = play(play(fixture('coach-mourinho', ['through-pass', 'through-pass']), 'through-pass'), 'through-pass');
  assert.equal(getBossView(broken).countered, true);
  broken = end(broken); assert.equal(getEnemyAttack(broken), 10); assert.equal(broken.match.boss.counterCharge, 0);
  broken = end(broken); assert.equal(getBossView(broken).effect, 'recover'); assert.equal(getEnemyAttack(broken), 7);
});

test('Guardiola builds pressure and three card categories counter it once, before weakness', () => {
  let run = fixture('coach-guardiola', ['quick-pass', 'cover', 'high-press', 'focus']);
  run = end(end(run)); assert.equal(getEnemyAttack(run), 22); assert.equal(run.match.boss.pressure, 3);
  run = hand(run, ['quick-pass', 'cover', 'high-press', 'focus']);
  run = play(play(play(run, 'quick-pass'), 'cover'), 'high-press');
  assert.equal(run.match.boss.pressure, 1); assert.equal(run.match.intent.attack, 11); assert.equal(getEnemyAttack(run), 8);
  assert.equal(getBossView(run).countered, true); assert.equal(forecast(run).incoming, 0);
  run = play(run, 'focus'); assert.equal(run.match.boss.pressure, 1, 'a fourth card cannot repeat the category counter');
  run = end(run); assert.equal(run.match.boss.pressure, 2); assert.equal(getEnemyAttack(run), 10);
});

test('Klopp charges only the first skill during pressure and recovery multiplies final damage once', () => {
  let run = fixture('coach-klopp', ['read-opening', 'high-press', 'sprint']);
  run = play(run, 'read-opening'); assert.equal(run.condition, 97);
  run = play(run, 'high-press'); assert.equal(run.condition, 97);
  run = play(run, 'sprint'); assert.equal(run.condition, 94, 'only the sprint self-cost remains');
  assert.equal(getEnemyAttack(run), 11);
  let recovery = fixture('coach-klopp', ['read-opening', 'through-pass']);
  recovery = end(end(recovery)); assert.equal(getBossView(recovery).effect, 'recover');
  recovery = hand(recovery, ['read-opening', 'through-pass']);
  const hp = recovery.condition;
  recovery = play(play(recovery, 'read-opening'), 'through-pass');
  assert.equal(recovery.condition, hp, 'skills are safe during recovery');
  assert.equal(recovery.match.enemyHp, 75, 'floor(7 * 1.5 exposure * 1.25 recovery) = 13');
});

test('Ancelotti reacts to the previous turn majority and uses attack-first deterministic ties', () => {
  for (const [ids, adaptation, attack, defense] of [
    [['quick-pass', 'through-pass'], 'attack', 10, 12],
    [['cover', 'cover'], 'defense', 19, 2],
    [['high-press', 'read-opening'], 'skill', 15, 5],
    [['quick-pass', 'cover', 'focus'], 'attack', 10, 12],
    [[], 'none', 10, 5],
  ]) {
    let run = fixture('coach-ancelotti', ids);
    for (const id of ids) { run = play(run, id); assert.equal(run.match.intent.attack, 10, 'response waits for next turn'); }
    run = end(run);
    assert.equal(run.match.boss.adaptation, adaptation); assert.equal(run.match.intent.attack, attack); assert.equal(run.match.enemyBlock, defense);
  }
});

test('Arteta counts real HP damage across two preparation turns and cancelled setpieces stay cancelled', () => {
  let run = fixture('coach-arteta', ['through-pass', 'through-pass', 'cover']);
  run = play(play(run, 'through-pass'), 'through-pass');
  assert.equal(getBossView(run).progress, 9, 'enemy block does not count toward disruption');
  run = end(run); assert.match(getBossView(run).detail, /피해 3 더/);
  run = hand(run, ['through-pass']); run = play(run, 'through-pass');
  assert.equal(getBossView(run).countered, true); assert.equal(getBossView(run).progress, 12);
  run = end(run); assert.equal(getEnemyAttack(run), 6); assert.equal(getBossView(run).effect, 'setpiece-broken');
  run = end(end(run)); assert.equal(getBossView(run).effect, 'setpiece-prepare'); assert.equal(getBossView(run).progress, 0);
  let failure = fixture('coach-arteta', ['cover']); failure = end(end(failure));
  assert.equal(getEnemyAttack(failure), 24); assert.equal(getBossView(failure).effect, 'setpiece-shot');
});

test('Wenger combo grows between turns and the third damaging card breaks it immediately', () => {
  let run = fixture('coach-wenger', ['quick-pass', 'quick-pass', 'quick-pass', 'cover']);
  run = end(end(run)); assert.equal(run.match.boss.combo, 2); assert.equal(getEnemyAttack(run), 12);
  run = hand(run, ['quick-pass', 'quick-pass', 'quick-pass']);
  run = play(play(run, 'quick-pass'), 'quick-pass'); assert.equal(getEnemyAttack(run), 12);
  run = play(run, 'quick-pass'); assert.equal(run.match.boss.combo, 0); assert.equal(getEnemyAttack(run), 8);
  assert.equal(getBossView(run).countered, true);
  run = end(run); assert.equal(run.match.boss.combo, 0); assert.equal(getBossView(run).progress, 0);
});

test('Ferguson starts overtime immediately below 30%, escalates three times, then recovers only once', () => {
  let run = fixture('coach-ferguson', ['power-shot', 'power-shot', 'power-shot'], { relics: ['power-cleats'], upgraded: true });
  run = play(play(run, 'power-shot'), 'power-shot'); assert.equal(run.match.boss.overtimeStart, 0);
  run = play(run, 'power-shot'); assert.equal(run.match.enemyHp, 24); assert.equal(run.match.boss.overtimeStart, 1);
  for (const attack of [14, 18, 24, 6]) { assert.equal(getEnemyAttack(run), attack); run = end(run); }
  assert.equal(run.match.boss.overtimeStart, 1); assert.equal(getEnemyAttack(run), 12); assert.equal(getBossView(run).effect, 'normal');
});

test('all new coach states preserve mid-turn/next-turn outcomes across save recovery', () => {
  for (const id of Object.keys(OPPONENTS).filter(id => OPPONENTS[id].coach)) {
    const initial = fixture(id, ['high-press', 'through-pass', 'cover']);
    let direct = initial, restored = initial;
    for (const name of ['high-press', 'through-pass', 'cover']) {
      direct = play(direct, name); restored = play(checkpoint(restored), name); assert.deepEqual(restored, direct);
    }
    direct = end(direct); restored = end(checkpoint(restored)); assert.deepEqual(restored, direct);
  }
});

test('malformed boss versions, unsupported fields, values and future overtime are rejected', () => {
  const run = fixture('coach-mourinho', ['cover']);
  for (const bad of [null, false, {}, { ...run.match.boss, version: 2 }, { ...run.match.boss, pressure: 1 }, { ...run.match.boss, counterCharge: 13 }, { ...run.match.boss, extra: 1 }, { ...run.match.boss, combo: .5 }]) {
    const changed = copy(run); changed.match.boss = bad; assert.equal(validateSave(changed), null);
  }
  const ferguson = fixture('coach-ferguson', ['cover']);
  for (const overtimeStart of [-1, 1, 2, 1.5, '1']) { const bad = copy(ferguson); bad.match.boss.overtimeStart = overtimeStart; assert.equal(validateSave(bad), null); }
  const tampered = copy(run); tampered.match.intent.attack++; assert.equal(validateSave(tampered), null);
});

test('old active coach saves retain classic rules and do not activate new state mid-duel', () => {
  const old = fixture('coach-mourinho', ['cover']); delete old.match.boss;
  const rule = '두 번의 단단한 수비 뒤 강력한 역습. 역습 전 방어를 준비하세요.';
  old.match.intent = { name: '낮은 블록', attack: 9, defense: 11, description: `턴 종료 시 피해 9. 이번 턴 상대 방어 11. ${rule}`, rule };
  old.match.enemyBlock = 11;
  const loaded = checkpoint(old); assert.equal(getBossView(loaded), null);
  const next = end(loaded); assert.equal(next.match.intent.attack, 11); assert.equal(next.match.enemyBlock, 9); assert.equal(Object.hasOwn(next.match, 'boss'), false);
  const regular = createRun(17); assert.equal(getBossView(regular), null);
});

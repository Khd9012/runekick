import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, availableNodes, act, validateSave } from '../dist/engine.js';
import { createTutorialState, tutorialAction } from '../dist/tutorial.js';

const copy = value => JSON.parse(JSON.stringify(value));
const start = () => tutorialAction(createTutorialState(), { type: 'start' });
function selectAndPlay(state) {
  const card = state.run.match.hand.find(item => item.id === state.stage);
  return tutorialAction(tutorialAction(state, { type: 'select', uid: card.uid }), { type: 'play' });
}
function deepFreeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
}

test('practice has a deterministic three-card hand and preserves the complete legal deck', () => {
  const intro = createTutorialState();
  assert.equal(intro.run, null);
  const practice = start();
  assert.deepEqual(practice, start());
  assert.deepEqual(practice.run.match.hand.map(card => card.id), ['dribble', 'shot', 'cover']);
  const zones = ['hand', 'draw', 'discard', 'exhaust', 'played'].flatMap(zone => practice.run.match[zone]);
  assert.equal(zones.length, 10);
  assert.equal(new Set(zones.map(card => card.uid)).size, 10);
  assert.deepEqual(zones.map(card => card.uid).sort(), practice.run.deck.map(card => card.uid).sort());
  assert.equal(practice.run.match.draw.length, 7);
  assert.ok(validateSave(practice.run));
});

test('wrong-order cards, play without selection, and duplicate inputs cannot advance practice', () => {
  const practice = start(), [dribble, shot, cover] = practice.run.match.hand;
  for (const action of [{ type: 'start' }, { type: 'play' }, { type: 'end-turn' }, { type: 'finish' }, { type: 'select', uid: shot.uid }, { type: 'select', uid: cover.uid }, { type: 'select', uid: 'missing' }, { type: 'skip-step' }]) {
    assert.equal(tutorialAction(practice, action), practice);
  }
  const selected = tutorialAction(practice, { type: 'select', uid: dribble.uid });
  assert.equal(tutorialAction(selected, { type: 'select', uid: dribble.uid }), selected);
  const played = tutorialAction(selected, { type: 'play' });
  assert.equal(played.stage, 'shot');
  assert.equal(played.selectedUid, null);
  assert.equal(tutorialAction(played, { type: 'play' }), played);
  assert.equal(tutorialAction(played, { type: 'select', uid: dribble.uid }), played);
  assert.equal(tutorialAction(played, { type: 'end-turn' }), played);
});

test('practice uses actual engine damage, momentum, block and next-turn recovery', () => {
  let state = start();
  assert.deepEqual([state.run.match.enemyHp, state.run.match.enemyBlock, state.run.match.energy], [42, 2, 3]);
  state = selectAndPlay(state);
  assert.deepEqual([state.stage, state.run.match.enemyHp, state.run.match.momentum, state.run.match.energy], ['shot', 39, 1, 2]);
  state = selectAndPlay(state);
  assert.deepEqual([state.stage, state.run.match.enemyHp, state.run.match.momentum, state.run.match.energy], ['cover', 29, 0, 1]);
  state = selectAndPlay(state);
  assert.deepEqual([state.stage, state.run.match.defense, state.run.match.energy], ['end-turn', 8, 0]);
  state = tutorialAction(state, { type: 'end-turn' });
  assert.equal(state.stage, 'complete');
  assert.deepEqual([state.run.match.enemyHp, state.run.condition, state.run.match.turn, state.run.match.energy], [29, 100, 2, 3]);
  assert.equal(state.run.match.defense, 0);
  assert.equal(state.run.match.hand.length, 5);
  assert.deepEqual([state.run.match.lastOutcome.damageDealt, state.run.match.lastOutcome.damageTaken, state.run.match.lastOutcome.blocked], [13, 0, 7]);
  assert.ok(validateSave(state.run));
  assert.equal(tutorialAction(state, { type: 'end-turn' }), state);
  assert.equal(tutorialAction(state, { type: 'play' }), state);
});

test('every transition is immutable and serializable against the real engine validator', () => {
  let state = deepFreeze(createTutorialState());
  const advance = action => {
    const before = copy(state), next = tutorialAction(state, action);
    assert.deepEqual(state, before);
    assert.deepEqual(copy(next), next);
    if (next.run) assert.ok(validateSave(next.run));
    state = deepFreeze(next);
  };
  advance({ type: 'start' });
  for (const id of ['dribble', 'shot', 'cover']) {
    advance({ type: 'select', uid: state.run.match.hand.find(card => card.id === id).uid });
    advance({ type: 'play' });
  }
  advance({ type: 'end-turn' });
  advance({ type: 'finish' });
  assert.deepEqual(state, { stage: 'closed', run: null, selectedUid: null, result: 'completed' });
  for (const type of ['start', 'play', 'end-turn', 'finish', 'skip']) assert.equal(tutorialAction(state, { type }), state);
});

test('skipping exits the entire tutorial from every stage and drops the practice run', () => {
  const states = [createTutorialState(), start()];
  for (let i = 0; i < 3; i++) states.push(selectAndPlay(states.at(-1)));
  states.push(tutorialAction(states.at(-1), { type: 'end-turn' }));
  for (const state of states) {
    const before = copy(state), skipped = tutorialAction(deepFreeze(state), { type: 'skip' });
    assert.deepEqual(skipped, { stage: 'closed', run: null, selectedUid: null, result: 'skipped' });
    assert.deepEqual(state, before);
    assert.equal(tutorialAction(skipped, { type: 'start' }), skipped);
  }
});

test('practice completion, skipping and replay leave an existing game and its save untouched', () => {
  let live = createRun('existing-save', '내 선수');
  live = act(live, { type: 'choose-node', id: availableNodes(live)[0].id });
  live = act(live, { type: 'play-card', uid: live.match.hand.find(card => card.id !== 'cover').uid });
  deepFreeze(live);
  const saved = JSON.stringify(live);
  let practice = start();
  for (let i = 0; i < 3; i++) practice = selectAndPlay(practice);
  practice = tutorialAction(practice, { type: 'end-turn' });
  assert.equal(tutorialAction(practice, { type: 'finish' }).result, 'completed');
  assert.equal(tutorialAction(start(), { type: 'skip' }).result, 'skipped');
  const replay = start();
  assert.deepEqual([replay.run.condition, replay.run.match.enemyHp, replay.run.match.energy, replay.stage], [100, 42, 3, 'dribble']);
  assert.equal(JSON.stringify(live), saved);
  assert.ok(validateSave(JSON.parse(saved)));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun, act, availableNodes} from '../dist/engine.js';
import {comboFeedback} from '../dist/striker-cards.js';
function setup() {
  let run = createRun(231);
  run.deck = ['quick-pass','double-touch','feint','one-two','cover'].map((id,i)=>({id,uid:`c${i+1}`,upgraded:false}));
  run.nextUid = 6; run.relics = ['swift-boots','grip-socks'];
  run = act(run,{type:'choose-node',id:availableNodes(run)[0].id});
  run.match.hand = structuredClone(run.deck); run.match.draw = []; run.match.enemyBlock = 0;
  return act(run,{type:'play-card',uid:'c1'});
}
test('combo preview matches extra hits and gear; first-combo effects disappear after use',()=>{
  let run = setup();
  const card = run.match.hand.find(c=>c.id==='double-touch');
  const info = comboFeedback(run,card);
  assert.ok(info.effects.includes('추가 1회 타격 · 2회 → 3회'));
  assert.ok(info.effects.includes('바람의 축구화: 총 피해 +3'));
  const next = act(run,{type:'play-card',uid:card.uid});
  assert.equal(run.match.enemyHp-next.match.enemyHp,12);
  assert.equal(next.match.defense-run.match.defense,3);
  const following = comboFeedback(next,next.match.hand.find(c=>c.id==='feint'));
  assert.deepEqual(following.effects,['방어 +4']);
});
test('upgraded card, training, insufficient energy, interruption and legacy are reflected',()=>{
  let run = setup();
  const card = run.match.hand.find(c=>c.id==='feint'); card.upgraded = true;
  run.match.training.control = 1; run.match.energy = 0;
  const info = comboFeedback(run,card);
  assert.equal(info.affordable,false);
  assert.ok(info.effects.includes('방어 +6'));
  assert.ok(info.effects.includes('볼 컨트롤 훈련: 1장 뽑기'));
  run.match.turnFlags.control = true;
  assert.ok(!comboFeedback(run,card).effects.some(s=>s.includes('훈련')));
  run.match.energy = 3;
  run = act(run,{type:'play-card',uid:'c5'});
  assert.equal(comboFeedback(run,card),null);
  assert.equal(comboFeedback({...setup(),rulesVersion:undefined},card),null);
});

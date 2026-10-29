import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun, act, availableNodes, validateSave, CARDS, RELICS, cardCost, isCombo, forecast, getEnemyAttack} from '../dist/engine.js';
import {PLAYABLE_IDS, REWARD_IDS, cardEffect, rewardPool} from '../dist/striker-cards.js';
const copy = v => JSON.parse(JSON.stringify(v));
function fixture(ids, relics = [], opponent) {
  let run = createRun(231);
  run.deck = ids.map((id,i) => ({id,uid:`c${i+1}`,upgraded:false})); run.nextUid = ids.length + 1;
  run.relics = relics;
  run = act(run,{type:'choose-node',id:availableNodes(run)[0].id});
  run.match.hand = copy(run.deck); run.match.draw = []; run.match.enemyBlock = 0;
  if (opponent) { run.match.opponentId = opponent; }
  return run;
}
const play = (run,id) => act(run,{type:'play-card',uid:run.match.hand.find(c=>c.id===id).uid});
const check = run => { assert.ok(validateSave(copy(run)), `save ${run.phase} turn ${run.match?.turn}`); return run; };
test('catalog has 39 playable cards, 3 injuries, correct rarity and training volumes',()=>{
  assert.equal(PLAYABLE_IDS.length,39); assert.equal(Object.keys(CARDS).length,42);
  assert.deepEqual(['common','uncommon','rare'].map(r=>PLAYABLE_IDS.filter(id=>CARDS[id].rarity===r).length),[17,16,6]);
  assert.equal(PLAYABLE_IDS.filter(id=>CARDS[id].type==='training').length,6);
  assert.equal(PLAYABLE_IDS.filter(id=>cardEffect({id}).volatile).length,7);
  assert.equal(REWARD_IDS.length,36); assert.equal(Object.keys(RELICS).length,21);
  assert.equal(Object.values(RELICS).filter(r=>r.shop).length,9);
  assert.equal(Object.values(RELICS).filter(r=>r.injury).length,3);
  assert.equal(createRun(1).deck.length,10);
  assert.equal(cardCost({id:'power-shot',upgraded:true}),2);
  assert.equal(cardCost({id:'abrasion'}),Infinity);
});
test('basic touch has no free draw; momentum gain is scarce and unchanged on upgraded dribble',()=>{
  let run=fixture(['quick-pass','dribble','feint','shot']);
  run=play(run,'quick-pass'); assert.equal(run.match.hand.length,3);
  run.match.hand.find(c=>c.id==='dribble').upgraded=true;
  run=play(run,'dribble'); assert.equal(run.match.momentum,1);
  run=play(run,'feint'); assert.equal(run.match.momentum,1); assert.equal(run.match.defense,4);
  run=play(run,'shot'); assert.equal(run.match.momentum,0);
});
test('combo requires different consecutive technique names and a non-technique breaks it',()=>{
  let run=fixture(['quick-pass','quick-pass','feint','cover','double-touch']);
  run=play(run,'quick-pass');
  assert.equal(isCombo(run.match,{id:'quick-pass',upgraded:true}),false);
  assert.equal(isCombo(run.match,{id:'feint'}),true);
  run=play(run,'cover'); assert.equal(isCombo(run.match,{id:'feint'}),false);
});
test('multi-hit damage and flat relic bonus apply once per card, exposure applies per hit',()=>{
  let run=fixture(['quick-pass','double-touch'],['swift-boots']);
  run=play(run,'quick-pass'); const hp=run.match.enemyHp;
  run.match.enemyExposed=1;
  run=play(run,'double-touch');
  assert.equal(hp-run.match.enemyHp,9+4+4); // (3+3)*1.5 + floor(3*1.5)*2
});
test('header spends only available defense and never momentum; gear fires only once',()=>{
  let run=fixture(['redirect-header','redirect-header'],['catenaccio-band','energy-flask','libero-seal']);
  run.match.defense=9;run.match.momentum=5;
  const hp=run.match.enemyHp;
  run=play(run,'redirect-header');assert.equal(hp-run.match.enemyHp,22);assert.equal(run.match.defense,8);assert.equal(run.match.momentum,5);
  const hp2=run.match.enemyHp;run=play(run,'redirect-header');assert.equal(hp2-run.match.enemyHp,18);assert.equal(run.match.defense,4);
  run=fixture(['redirect-header']); run.match.defense=1; run=play(run,'redirect-header');assert.equal(run.match.defense,0);assert.equal(run.match.damageDealt,8);
});
test('guard threshold and post-header defense work without spending momentum',()=>{
  let run=fixture(['suppressing-header','landing']);run.match.defense=8;run.match.momentum=3;
  run=play(run,'suppressing-header');assert.equal(run.match.damageDealt,12);assert.equal(run.match.defense,8);assert.equal(run.match.enemyWeakened,1);
  run=play(run,'landing');assert.equal(run.match.defense,20);assert.equal(run.match.momentum,3);
});
test('partial momentum shot leaves remainder; all-momentum cards preserve designed multipliers',()=>{
  let run=fixture(['controlled-shot']);run.match.momentum=5;run=play(run,'controlled-shot');assert.equal(run.match.damageDealt,11);assert.equal(run.match.momentum,3);
  run=fixture(['volley']);run.match.momentum=3;run=play(run,'volley');assert.equal(run.match.damageDealt,21);
});
test('instant training exhausts and persistent training survives, with no duplicated acceleration',()=>{
  let run=fixture(['acceleration-training','explosion-training','dribble','cover']);
  run=play(run,'acceleration-training');run=play(run,'explosion-training');assert.equal(run.match.momentum,4);
  run=play(run,'dribble');assert.equal(run.match.momentum,5);
  run=act(run,{type:'end-turn'});assert.equal(run.match.training.acceleration,1);assert.equal(run.match.exhaust.length,2);
  run=play(run,'dribble');assert.equal(run.match.momentum,7);
});
test('aerial training carries only defense left AFTER enemy attack',()=>{
  let run=fixture(['aerial-training','cover']);run=play(run,'aerial-training');run=play(run,'cover');
  run=act(run,{type:'end-turn'});assert.equal(run.match.defense,1);assert.equal(run.match.exhaust.length,1);
});
test('emergency stance reduces next energy, stacks to zero, and expires',()=>{
  let run=fixture(['emergency-stance','emergency-stance','emergency-stance','emergency-stance']);
  for(let i=0;i<4;i++)run=play(run,'emergency-stance');
  run=act(run,{type:'end-turn'});assert.equal(run.match.energy,0);
  run=act(run,{type:'end-turn'});assert.equal(run.match.energy,3);
});
test('reckless chain exposes player for the next attack only',()=>{
  let run=fixture(['reckless-chain']);run=play(run,'reckless-chain');assert.equal(getEnemyAttack(run),10);
  run=act(run,{type:'end-turn'});assert.equal(run.condition,90);assert.equal(run.match.playerExposed,0);
});
test('temporary injuries do not enter persistent deck; persistent injuries resolve before attack',()=>{
  let run=fixture(['diving-header','cover']);run=play(run,'diving-header');
  assert.equal(run.deck.length,2);assert.equal(run.match.temporaryCards.length,1);assert.equal(run.match.draw[0].temporary,true);
  run=fixture(['abrasion','abrasion','ankle-pain','cover']);run=play(run,'cover');
  const original=copy(run);assert.equal(act(run,{type:'play-card',uid:run.match.hand[0].uid}),run);assert.deepEqual(run,original);
  run=act(run,{type:'end-turn'});assert.equal(run.condition,97); // 2 abrasion + 1 unblocked attack
});
test('discard choice is mandatory, saves/restores, discarding injury avoids its end-turn penalty',()=>{
  let run=fixture(['breathing','abrasion','cover']);run.match.enemyBlock=2;
  run=play(run,'breathing');check(run);
  assert.equal(act(run,{type:'end-turn'}),run);
  assert.equal(play(run,'cover'),run);
  const uid=run.match.hand.find(c=>c.id==='abrasion').uid;
  run=act(run,{type:'choose-card',uid});assert.equal(run.match.choice,null);
  // Empty draw pile reshuffles the discarded injury, so use a nonempty pile for avoidance.
  run=fixture(['breathing','abrasion','cover','shot','shot','shot']);
  run.match.draw=run.match.hand.splice(3);run=play(run,'breathing');
  run=act(run,{type:'choose-card',uid:run.match.hand.find(c=>c.id==='abrasion').uid});
  run=play(run,'cover');run=act(run,{type:'end-turn'});assert.equal(run.condition,100);
});
test('peek takes selected cards, preserves other draw order, and restores halfway through upgraded choice',()=>{
  let run=fixture(['read-flow','cover','shot','dribble','quick-pass']);run.match.enemyBlock=2;
  run.match.hand[0].upgraded=true;run.deck[0].upgraded=true;
  run.match.draw=run.match.hand.splice(1);const order=run.match.draw.map(c=>c.uid);
  run=play(run,'read-flow');const candidates=[...run.match.choice.candidates];
  run=act(run,{type:'choose-card',uid:candidates[1]});check(run);assert.equal(run.match.choice.remaining,1);
  run=act(run,{type:'choose-card',uid:candidates[0]});check(run);
  assert.deepEqual(run.match.draw.map(c=>c.uid),order.filter(uid=>![candidates[0],candidates[1]].includes(uid)));
});
test('retrieval only targets discarded technique; discount never stacks and expires next turn',()=>{
  let run=fixture(['retrieve-ball','dribble','cover']);
  run.match.hand[0].upgraded=true;
  run.match.discard=run.match.hand.splice(1);run=play(run,'retrieve-ball');
  assert.equal(run.match.choice.candidates.length,1);
  const uid=run.match.choice.candidates[0];run=act(run,{type:'choose-card',uid});
  assert.equal(cardCost(run.match.hand[0],run.match),0);
  run=play(run,'dribble');assert.equal(run.match.damageDealt,8);
  run=act(run,{type:'end-turn'});assert.equal(run.match.discounts[uid],undefined);
});
test('new starter and every legal card sequence serializes with temporary injuries, exhaust and choices',()=>{
  for (const id of PLAYABLE_IDS) {
    let run=fixture([id,'cover','quick-pass','dribble']);run.match.enemyBlock=2;
    run=check(play(run,id));
    while(run.match.choice)run=check(act(run,{type:'choose-card',uid:run.match.choice.candidates[0]}));
    if(run.phase==='match')run=check(act(run,{type:'end-turn'}));
  }
});
test('first reward offers three build starters; ordinary pool excludes rare/basic and owned persistent training',()=>{
  let run=fixture(['shot']);run.match.momentum=50;run=play(run,'shot');
  assert.deepEqual(run.offers,['power-shot','double-touch','positioning']);
  const fresh=createRun(9);fresh.deck.push({uid:'c11',id:'control-training',upgraded:false});
  assert.ok(!rewardPool(fresh).includes('control-training'));assert.ok(!rewardPool(fresh).includes('shot'));
});
test('new saved journeys preserve rules version and reject malformed training, choices and temporary cards',()=>{
  let run=createRun(231);check(run);run=act(run,{type:'choose-node',id:availableNodes(run)[0].id});check(run);
  for(const mutate of [r=>r.match.training.aerial=999,r=>r.match.choice={kind:'peek',candidates:['c999'],remaining:1,draw:0,bonus:0},r=>r.match.temporaryCards.push({...r.deck[0],temporary:true}),r=>r.match.energyDebt=-1,r=>r.rulesVersion=99]) {
    const bad=copy(run);mutate(bad);assert.equal(validateSave(bad),null);
  }
});
test('used cards enter discard immediately; volatile cards enter exhaust and cannot be redrawn or retrieved',()=>{
  let run=fixture(['quick-pass','judgment-training','retrieve-ball']);run.match.enemyBlock=2;
  run=check(play(run,'quick-pass'));assert.equal(run.match.discard[0].id,'quick-pass');
  run=check(play(run,'retrieve-ball'));assert.equal(run.match.choice.candidates.length,1);
  run=check(act(run,{type:'choose-card',uid:run.match.choice.candidates[0]}));
  run=check(play(run,'quick-pass'));assert.equal(run.match.played.filter(c=>c.id==='quick-pass').length,2);
  run=check(play(run,'judgment-training'));assert.equal(run.match.exhaust[0].id,'judgment-training');
  assert.ok(!run.match.hand.some(c=>c.id==='judgment-training'));
});
test('forecast includes injury HP loss and defense loss in the correct order',()=>{
  let run=fixture(['abrasion','ankle-pain','cover']);run=play(run,'cover');
  const predicted=forecast(run);assert.equal(predicted.injuryDamage,1);assert.equal(predicted.guard,6);assert.equal(predicted.incoming,2);
  const hp=run.condition;run=act(run,{type:'end-turn'});assert.equal(hp-run.condition,predicted.incoming);
});
test('clean-sheet healing is capped at three real attacks and excludes no-attack turns',()=>{
  let run=fixture(['cover','cover','cover','cover','cover'],['clean-sheet-crest']);run.condition=50;
  for(let turn=0;turn<4;turn++) {
    run=play(run,'cover');run=play(run,'cover');run=act(run,{type:'end-turn'});
  }
  assert.equal(run.match.battleFlags.cleanSheet,3);assert.equal(run.condition,56);
});
test('momentum gear does not generate momentum, burst energy is once per battle',()=>{
  let run=fixture(['controlled-shot','controlled-shot','shot','shot'],['swift-boots','burst-laces','fenom-cleats','power-cleats']);
  run.match.momentum=7;run=play(run,'shot');assert.equal(run.match.energy,3);assert.equal(run.match.battleFlags.burst,true);assert.equal(run.match.momentum,0);
  run.match.momentum=3;run=play(run,'shot');assert.equal(run.match.energy,2);
});

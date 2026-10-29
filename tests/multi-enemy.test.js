import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,act,availableNodes,validateSave,getEnemyAttack,getEnemyViews,forecast} from '../dist/engine.js';
import {regularComposition,REGULAR_ENEMIES,DUO_COMPOSITIONS} from '../dist/encounters.js';
const check=r=>{assert.ok(validateSave(r),`invalid ${r.phase} stage${r.routeIndex} turn${r.match?.turn}`);return r;};
function ordinary(seed,stage=2) {
 let r=createRun(seed);r.deck.forEach(c=>{c.id='shot';c.upgraded=true;});
 for(let i=0;i<150;i++) {
  if(r.phase==='map'&&r.routeIndex===stage)return check(act(r,{type:'choose-node',id:availableNodes(r)[0].id}));
  if(r.phase==='map'){const ns=availableNodes(r);r=act(r,{type:'choose-node',id:(ns.find(n=>n.type==='rest')??ns.find(n=>n.type==='event')??ns[0]).id});}
  else if(r.phase==='match'){const card=r.match.hand.find(c=>r.match.energy>=1);r=act(r,card?{type:'play-card',uid:card.uid}:{type:'end-turn'});}
  else if(r.phase==='reward'){if(r.relicOffers.length)r=act(r,{type:'take-elite-relic',id:r.relicOffers[0]});r=act(r,{type:'take-reward',id:null});}
  else r=act(r,{type:r.phase==='rest'?'rest':'leave-node'});
  check(r);
 }
 throw Error('fixture failed');
}
const seedFor=(ids,stage=2)=>{for(let seed=0;seed<1000;seed++)if(regularComposition(seed,stage).join(',')===ids.join(','))return seed;throw Error(ids);};
function hand(r,ids) {
 const all=[...r.match.hand,...r.match.draw,...r.match.discard];
 ids.forEach((id,i)=>{const c=all[i];r.deck.find(x=>x.uid===c.uid).id=id;r.deck.find(x=>x.uid===c.uid).upgraded=false;c.id=id;c.upgraded=false;});
 r.match.hand=all.slice(0,ids.length);r.match.draw=all.slice(ids.length);r.match.discard=[];return check(r);
}
const play=(r,id,targetId)=>check(act(r,{type:'play-card',uid:r.match.hand.find(c=>c.id===id).uid,...(targetId?{targetId}:{})}));
test('curated pairs cover all roles, remain seeded, avoid duplicate pair and lower individual stats',()=>{
 const seen=new Set(), roles=new Set();
 for(let seed=0;seed<200;seed++) {
  const run=createRun(seed);assert.equal(run.encounterVersion,1);check(run);
  const early=run.route[2].choices[0].encounter,late=run.route[7].choices[0].encounter;
  assert.match(run.route[2].choices[0].description,/코인 30과/);assert.match(run.route[7].choices[0].description,/코인 35과/);
  assert.deepEqual(early,regularComposition(seed,2));assert.equal(late.length,2);
  assert.notEqual(early.join(','),late.join(','));
  for(const ids of [early,late]){seen.add(ids.join(','));ids.forEach(id=>roles.add(REGULAR_ENEMIES[id].role));if(ids.length===1)assert.notEqual(REGULAR_ENEMIES[ids[0]].role,'buffer');else assert.ok(DUO_COMPOSITIONS.some(pair=>pair.join(',')===ids.join(',')));}
 }
 assert.equal(roles.size,5);assert.ok(DUO_COMPOSITIONS.every(ids=>seen.has(ids.join(','))));
});
test('target selection persists, debuffs remain local, dead target skips actions and retargets only after card',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['read-opening','shot','double-touch']);
 r=check(act(r,{type:'select-target',targetId:'e2'}));assert.equal(r.match.targetId,'e2');
 r=play(r,'read-opening');assert.equal(r.match.enemies[1].exposed,2);assert.equal(r.match.enemies[0].exposed,0);
 r=check(act(r,{type:'select-target',targetId:'e1'}));assert.equal(r.match.enemyExposed,0);
 assert.equal(act(r,{type:'select-target',targetId:'missing'}),r);
 r=play(r,'shot','e2');assert.ok(r.match.enemies[1].hp<22);assert.equal(r.match.enemies[0].hp,28);
 r=check(act(r,{type:'end-turn'}));
 // Use several turns of ordinary attacks; target remains e2 until death.
 while(r.match.enemies[1].hp>0){if(!r.match.energy||!r.match.hand.length)r=check(act(r,{type:'end-turn'}));else r=check(act(r,{type:'play-card',uid:r.match.hand[0].uid,targetId:'e2'}));}
 assert.equal(r.phase,'match');assert.equal(r.match.targetId,'e1');assert.equal(getEnemyViews(r)[1].attack,0);
 assert.equal(act(r,{type:'select-target',targetId:'e2'}),r);
});
test('buffer and defender act for next turn; forecast matches actual damage and weakness is per enemy',()=>{
 for(const ids of [['school','support-coach'],['school','press'],['rookie','school'],['press','late-finisher']]){
  let r=ordinary(seedFor(ids,7),7);
  for(let t=0;t<4;t++){
   const before=r.condition,prediction=forecast(r),expected=Math.min(before,prediction.incoming);
   r=check(act(r,{type:'end-turn'}));assert.equal(before-r.condition,expected);
   if(r.phase==='defeat')break;
   if(t===0&&ids.includes('support-coach'))assert.equal(r.match.enemies[0].attackBuff,2);
   if(t===0&&ids.includes('press'))assert.ok(r.match.enemies.find(e=>e.opponentId!=='press').block>=4);
  }
 }
});
test('charger caps charge, loses preparation on damage, and resets after a telegraphed strike',()=>{
 let r=ordinary(seedFor(['late-finisher']));
 r=check(act(r,{type:'end-turn'}));assert.equal(r.match.enemies[0].charge,1);
 r=check(act(r,{type:'end-turn'}));assert.equal(r.match.enemies[0].charge,2);
 const attack=getEnemyAttack(r);
 r=check(act(r,{type:'play-card',uid:r.match.hand[0].uid}));
 assert.ok(r.match.enemies[0].charge<2);assert.ok(getEnemyAttack(r)<attack);
 r=check(act(r,{type:'end-turn'}));assert.equal(r.match.enemies[0].charge,0);assert.equal(getEnemyViews(r)[0].intent.name,'착지 후 빈틈');
});
test('multi-enemy save rejects forged target, health, role and aggregate fields',()=>{
 const r=ordinary(seedFor(['school','support-coach']));
 for(const mutate of [v=>v.match.targetId='bad',v=>v.match.enemies[0].hp++,v=>v.match.enemies[0].opponentId='press',v=>v.match.enemyHp++,v=>v.match.enemies[0].charge=3,v=>v.encounterVersion=2,v=>v.activeNode.encounter=['school','press']]){const bad=structuredClone(r);mutate(bad);assert.equal(validateSave(bad),null);}
});
test('all enemies must fall before one encounter reward, and dead targets never receive further multihits',()=>{
 for(const [stage,expected] of [[2,30],[7,35]]){
  let r=ordinary(seedFor(['school','support-coach'],stage),stage),gold=r.gold;
  for(let i=0;i<30&&r.phase==='match';i++)r=check(act(r,r.match.energy&&r.match.hand.length?{type:'play-card',uid:r.match.hand[0].uid}:{type:'end-turn'}));
  assert.equal(r.phase,'reward');assert.equal(r.match.enemies.filter(e=>e.hp>0).length,0);assert.equal(r.match.targetId,null);assert.equal(r.gold-gold,expected);
  const rewards=r.gold;assert.equal(act(r,{type:'end-turn'}),r);assert.equal(r.gold,rewards);
 }
});

test('a defeated support recipient cancels the announced buff without a surprise attack',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['overswing','quick-pass','shot']);
 r=play(r,'overswing','e1');assert.equal(r.match.enemies[0].hp,2);
 r=play(r,'quick-pass','e1');assert.equal(r.match.enemies[0].hp,0);
 assert.equal(getEnemyViews(r)[1].attack,0);assert.match(getEnemyViews(r)[1].intent.description,/취소/);
 r=check(act(r,{type:'end-turn'}));assert.ok(getEnemyViews(r)[1].attack>0);
});
test('preparation damage disrupts one charge per 8 HP rather than removing twice',()=>{
 let r=ordinary(seedFor(['late-finisher']));
 r=check(act(r,{type:'end-turn'}));assert.equal(r.match.enemies[0].charge,1);
 r=check(act(r,{type:'play-card',uid:r.match.hand[0].uid})); // upgraded shot13 - guard4 = HP9; one threshold
 assert.equal(r.match.enemies[0].prepDamage,9);
 r=check(act(r,{type:'end-turn'}));assert.equal(r.match.enemies[0].charge,1);
});
test('old v2 saves retain their canonical solo encounters',()=>{
 let r=createRun(17);delete r.encounterVersion;
 for(const [stage,id] of [[2,'rookie'],[7,'press']]){
  const node=r.route[stage].choices[0],previous=node.id;node.id=`path-${stage}-${id}`;node.opponentId=id;delete node.encounter;
  for(const row of r.route)for(const point of row.choices)point.next=point.next.map(next=>next===previous?node.id:next);
 }
 r=check(r);assert.equal(r.encounterVersion,undefined);
 assert.equal(r.route[2].choices[0].opponentId,'rookie');assert.equal(r.route[7].choices[0].opponentId,'press');
 r=check(act(r,{type:'choose-node',id:availableNodes(r)[0].id}));assert.equal(r.match.enemies,undefined);
});
test('duo defeat remains resumable and forecast uses aggregate attacks after local weakness',()=>{
 let r=hand(ordinary(seedFor(['rookie','school'],7),7),['checking-tackle']);
 r=play(r,'checking-tackle','e2');
 const views=getEnemyViews(r);assert.equal(views[0].weakened,0);assert.equal(views[1].weakened,1);assert.equal(getEnemyAttack(r),views.reduce((sum,e)=>sum+e.attack,0));
 for(let i=0;i<30&&r.phase==='match';i++)r=check(act(r,{type:'end-turn'}));
 assert.equal(r.phase,'defeat');assert.ok(validateSave(r));
});

test('sweeping shot hits both foes, spends momentum once and applies flat bonuses only to selected foe',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['sweeping-shot']);
 r.relics.push('power-cleats');r.match.momentum=5;r.match.nextShot=3;
 r=check(act(r,{type:'select-target',targetId:'e2'}));
 r=play(r,'sweeping-shot');
 assert.deepEqual(r.match.enemies.map(e=>e.hp),[28-9,22-15]);
 assert.equal(r.match.momentum,3);assert.equal(r.match.energy,1);assert.equal(r.match.nextShot,0);
 assert.equal(r.match.damageDealt,24);assert.equal(r.match.targetId,'e2');
});
test('clearing header spends guard once, hits both foes and grants post-header guard once',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['clearing-header']);
 r.relics.push('energy-flask','libero-seal');r.match.defense=9;r.match.momentum=6;r.match.nextHeader=2;
 r=play(r,'clearing-header','e2');
 assert.deepEqual(r.match.enemies.map(e=>e.hp),[28-8,22-14]);
 assert.equal(r.match.defense,8);assert.equal(r.match.momentum,6);assert.equal(r.match.energy,2);assert.equal(r.match.nextHeader,0);
 assert.equal(r.match.turnFlags['libero-seal'],true);
});
test('switching target preserves technique chain and split touch hits the other foe only on combo',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['quick-pass','split-touch']);
 r=play(r,'quick-pass','e1');
 const played=structuredClone(r.match.played),energy=r.match.energy;
 r=check(act(r,{type:'select-target',targetId:'e2'}));
 assert.deepEqual(r.match.played,played);assert.equal(r.match.energy,energy);
 r=play(r,'split-touch');assert.deepEqual(r.match.enemies.map(e=>e.hp),[22,18]);
 const single=play(hand(ordinary(seedFor(['school','support-coach'])),['split-touch']),'split-touch','e2');
 assert.deepEqual(single.match.enemies.map(e=>e.hp),[28,18]);
});
test('targeted exposure and combo weakness stay on chosen foes across target switches',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['quick-pass','deceptive-move','read-opening']);
 r=play(r,'quick-pass','e1');r=play(r,'deceptive-move','e2');
 assert.deepEqual(r.match.enemies.map(e=>[e.exposed,e.weakened]),[[0,0],[1,1]]);
 r=play(r,'read-opening','e1');
 assert.deepEqual(r.match.enemies.map(e=>[e.exposed,e.weakened]),[[2,0],[1,1]]);
 assert.equal(r.match.enemyExposed,2);assert.equal(r.match.enemyWeakened,0);
});
test('a normal multihit locks its original target even when first hit defeats it',()=>{
 let r=hand(ordinary(seedFor(['school','support-coach'])),['overswing','double-touch']);
 r=play(r,'overswing','e1');assert.equal(r.match.enemies[0].hp,2);
 r=play(r,'double-touch','e1');
 assert.deepEqual(r.match.enemies.map(e=>e.hp),[0,22]);
 assert.equal(r.match.damageDealt,28);assert.equal(r.match.targetId,'e2');assert.equal(r.phase,'match');
});

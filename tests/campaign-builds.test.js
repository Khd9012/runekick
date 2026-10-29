import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,act,availableNodes,validateSave,CARDS,RELICS,cardCost} from '../dist/engine.js';
import {rewardPool,cardText,comboFeedback,CAMPAIGN_CARD_ACTS} from '../dist/striker-cards.js';
import {CAMPAIGN_RELIC_ACTS} from '../dist/striker-equipment.js';
import {regularComposition} from '../dist/encounters.js';
const check=r=>{assert.ok(validateSave(r),`invalid ${r.phase}:${r.match?.turn}`);return r;};
const play=(r,id)=>check(act(r,{type:'play-card',uid:r.match.hand.find(c=>c.id===id).uid}));
function setDeck(r,ids,draw=[]) {
 r.deck=[...ids,...draw].map((id,i)=>({id,uid:`c${i+1}`,upgraded:false}));r.nextUid=r.deck.length+1;
 r.match.hand=structuredClone(r.deck.slice(0,ids.length));r.match.draw=structuredClone(r.deck.slice(ids.length));r.match.discard=[];r.match.exhaust=[];return r;
}
function solo(ids,{relics=[],draw=[],momentum=0,defense=0}={}) {
 let r=createRun(4);r.relics=relics;r=act(r,{type:'choose-node',id:availableNodes(r)[0].id});
 setDeck(r,ids,draw);r.match.enemyBlock=0;r.match.momentum=momentum;r.match.defense=defense;return check(r);
}
function duo(ids,{momentum=0,defense=0,draw=[]}={}) {
 let seed=0;while(regularComposition(seed,2).join(',')!=='school,support-coach')seed++;
 let r=createRun(seed);r.deck.forEach(c=>{c.id='shot';c.upgraded=true;});
 for(let i=0;i<60;i++) {
  if(r.phase==='map'){r=act(r,{type:'choose-node',id:(availableNodes(r).find(n=>n.type==='rest')??availableNodes(r)[0]).id});if(r.routeIndex===2)break;}
  else if(r.phase==='match'){const c=r.match.hand.find(c=>cardCost(c,r.match)<=r.match.energy);r=act(r,c?{type:'play-card',uid:c.uid}:{type:'end-turn'});}
  else if(r.phase==='reward')r=act(r,{type:'take-reward',id:null});
  else r=act(r,{type:'rest'});
 }
 assert.equal(r.match.enemies.length,2);setDeck(r,ids,draw);r.match.momentum=momentum;r.match.defense=defense;return check(r);
}
test('campaign cards and equipment unlock only at their ACT and keep old reward pools unchanged',()=>{
 for(const [id,minAct] of Object.entries(CAMPAIGN_CARD_ACTS)) {
  assert.equal(CARDS[id].minAct,minAct);
  assert.ok(!rewardPool({deck:[],encounterVersion:1,actNumber:3}).includes(id));
  assert.ok(!rewardPool({deck:[],campaignVersion:1,actNumber:minAct-1}).includes(id));
  assert.ok(rewardPool({deck:[],campaignVersion:1,actNumber:minAct}).includes(id));
 }
 assert.equal(Object.keys(CAMPAIGN_RELIC_ACTS).length,9);
 for(const [id,minAct] of Object.entries(CAMPAIGN_RELIC_ACTS)){assert.equal(RELICS[id].minAct,minAct);assert.ok(RELICS[id].shop);assert.ok(RELICS[id].price>=170);}
 assert.equal(RELICS['carbon-insole'].injury,'abrasion');assert.equal(RELICS['rebound-vest'].injury,'ankle-pain');
});
test('follow-through draws only with three momentum spent; recoil refunds just once per turn',()=>{
 let r=solo(['follow-through','follow-through'],{relics:['recoil-studs'],momentum:7,draw:['cover','cover']});
 r=play(r,'follow-through');assert.equal(r.match.momentum,5);assert.equal(r.match.hand.length,2);
 r=play(r,'follow-through');assert.equal(r.match.momentum,2);assert.equal(r.match.hand.length,2);
 r=solo(['follow-through'],{momentum:2,draw:['cover']});r=play(r,'follow-through');assert.equal(r.match.hand.length,0);
});
test('tempo switch refunds its energy only on a valid combo and exhausts',()=>{
 let r=solo(['quick-pass','tempo-switch']);r=play(r,'quick-pass');
 assert.ok(comboFeedback(r,r.match.hand[0]).effects.some(t=>t.includes('에너지 +1')));
 r=play(r,'tempo-switch');assert.equal(r.match.energy,3);assert.equal(r.match.exhaust.length,1);
 r=play(solo(['tempo-switch']),'tempo-switch');assert.equal(r.match.energy,2);
});
test('cushion header empowers the following header without buffing itself',()=>{
 let r=solo(['cushion-header','aerial-duel'],{defense:4});
 r=play(r,'cushion-header');assert.equal(r.match.damageDealt,10);assert.equal(r.match.nextHeader,6);
 r=play(r,'aerial-duel');assert.equal(r.match.damageDealt,21);assert.equal(r.match.nextHeader,0);
});
test('rare multi-target finishers consume resources once and retain their costs and penalties',()=>{
 let r=duo(['decisive-volley'],{momentum:3});r=play(r,'decisive-volley');
 assert.equal(r.match.momentum,0);assert.equal(r.match.energy,0);assert.deepEqual(r.match.enemies.map(e=>e.hp),[4,0]);
 assert.equal(r.match.exhaust[0].id,'decisive-volley');assert.equal(r.match.temporaryCards[0].id,'abrasion');
 r=duo(['tower-header'],{defense:8});r=play(r,'tower-header');
 assert.equal(r.match.defense,0);assert.equal(r.match.playerExposed,1);assert.deepEqual(r.match.enemies.map(e=>e.hp),[5,0]);assert.equal(r.match.exhaust.length,1);
});
test('one-touch break hits the other enemy and weakens both only with combo',()=>{
 let r=duo(['quick-pass','one-touch-break'],{draw:['cover']});r=play(r,'quick-pass');r=play(r,'one-touch-break');
 assert.deepEqual(r.match.enemies.map(e=>e.hp),[18,14]);assert.deepEqual(r.match.enemies.map(e=>e.weakened),[1,1]);assert.equal(r.match.hand[0].id,'cover');
 r=duo(['one-touch-break']);r=play(r,'one-touch-break');assert.deepEqual(r.match.enemies.map(e=>e.weakened),[0,0]);assert.equal(r.match.enemies[1].hp,22);
});
test('technique equipment rewards variety, removes guard and discounts the leftmost remaining technique once',()=>{
 let r=solo(['quick-pass','feint','split-touch','double-touch'],{relics:['sequence-band','pivot-socks','carbon-insole']});r.match.enemyBlock=2;
 r=play(r,'quick-pass');r=play(r,'feint');assert.equal(cardCost(r.match.hand[0],r.match),0);assert.equal(cardCost(r.match.hand[1],r.match),1);
 const before=r.match.enemyHp;r=play(r,'split-touch');assert.equal(before-r.match.enemyHp,9);assert.equal(r.match.turnFlags['sequence-band'],true);
});
test('late precision gear applies exposure after damage and exposes the player once per turn',()=>{
 let r=solo(['follow-through','follow-through'],{relics:['precision-laces'],momentum:7});
 r=play(r,'follow-through');assert.equal(r.match.damageDealt,10);assert.equal(r.match.enemyExposed,2);assert.equal(r.match.playerExposed,1);
 r=play(r,'follow-through');assert.equal(r.match.enemyExposed,2);assert.equal(r.match.playerExposed,1);
});
test('aerial gear has distinct spent-guard and preserved-guard effects, and power shirt needs stored momentum',()=>{
 let r=solo(['redirect-header','redirect-header'],{relics:['aerial-grip','rebound-vest'],defense:8,draw:['cover','cover']});
 r=play(r,'redirect-header');assert.equal(r.match.defense,6);assert.equal(r.match.hand.length,2);
 r=play(r,'redirect-header');assert.equal(r.match.defense,2);assert.equal(r.match.hand.length,1);
 r=solo(['aerial-duel'],{relics:['aerial-notebook'],defense:8});r=play(r,'aerial-duel');assert.equal(r.match.damageDealt,10);assert.equal(r.match.defense,13);
 r=solo(['cover','cover'],{relics:['pressure-shirt'],momentum:3});r=play(r,'cover');r=play(r,'cover');assert.equal(r.match.defense,20);
 assert.match(cardText({id:'cushion-header'}),/공격 후 이번 턴 다음 헤더/);
});

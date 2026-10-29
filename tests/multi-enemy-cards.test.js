import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCard} from '../dist/striker-combat.js';
import {cardText, comboFeedback, rewardPool, MULTI_ENEMY_CARD_IDS} from '../dist/striker-cards.js';

function play(id, {upgraded=false, prior=[], relics=[], momentum=0, defense=0, solo=false}={}) {
  const card = {id, uid:'c9', upgraded};
  const enemies = [{id:'e1',hp:50,maxHp:50},{id:'e2',hp:50,maxHp:50}].slice(0,solo?1:2);
  const match = {targetId:'e1',enemies,enemyHp:enemies.length*50,enemyMaxHp:enemies.length*50,enemyBlock:0,enemyExposed:0,enemyWeakened:0,
    played:[...prior.map(id=>({id})),card],damageBonuses:{},turnFlags:{},battleFlags:{},training:{},momentum,defense,energy:1,maxEnergy:3,energyDebt:0,playerExposed:0,
    nextShot:0,nextHeader:0,intent:{},hand:[],draw:[],temporaryCards:[],previousShot:true};
  const run = {rulesVersion:2,encounterVersion:1,relics,match};
  const hits=[];
  resolveCard(run,card,{damage:(amount,target='selected')=>{
    const enemy = enemies.find(e=>e.id===(target==='selected'?'e1':target==='other'?'e2':target));
    if(enemy){hits.push({target:enemy.id,amount});enemy.hp-=amount;}
  },breakBlock:()=>{},status:()=>{},draw:()=>{},shuffle:cards=>cards});
  return {run,hits};
}
test('sweeping shot consumes momentum once and flat shot equipment applies once across the encounter',()=>{
  const {run,hits}=play('sweeping-shot',{momentum:5,relics:['power-cleats']});
  assert.equal(run.match.momentum,3);
  assert.deepEqual(hits,[{target:'e1',amount:12},{target:'e2',amount:9}]);
});
test('clearing header consumes shared defense once; both enemies get resource bonus but only selected gets equipment',()=>{
  const {run,hits}=play('clearing-header',{upgraded:true,defense:7,relics:['energy-flask']});
  assert.equal(run.match.defense,3);
  assert.deepEqual(hits,[{target:'e1',amount:14},{target:'e2',amount:10}]);
});
test('cross touch needs a combo to strike another opponent and never doubles on a solo opponent',()=>{
  assert.deepEqual(play('split-touch').hits,[{target:'e1',amount:4}]);
  assert.deepEqual(play('split-touch',{upgraded:true,prior:['quick-pass'],relics:['swift-boots']}).hits,[{target:'e1',amount:9},{target:'e2',amount:6}]);
  assert.deepEqual(play('split-touch',{prior:['quick-pass'],solo:true}).hits,[{target:'e1',amount:4}]);
});
test('new cards are offered only on new encounter runs; targeting and combo preview are explicit',()=>{
  const old={deck:[]}, fresh={deck:[],encounterVersion:1};
  for(const id of MULTI_ENEMY_CARD_IDS){assert.ok(!rewardPool(old).includes(id));assert.ok(rewardPool(fresh).includes(id));}
  assert.match(cardText({id:'sweeping-shot'}),/모든 상대/);
  const {run}=play('split-touch');run.match.played=[{id:'quick-pass'}];
  assert.ok(comboFeedback(run,{id:'split-touch'}).effects.includes('다른 상대에게 피해 4'));
});

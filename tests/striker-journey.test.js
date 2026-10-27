import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,act,availableNodes,validateSave,CARDS,RELICS,getBossView,cardCost} from '../dist/engine.js';
const copy = v => JSON.parse(JSON.stringify(v));
const checkpoint = state => {const saved=validateSave(copy(state));assert.ok(saved,`${state.phase}:${state.routeIndex}:${state.match?.turn}`);assert.deepEqual(saved,state);return saved;};
function step(run,action){const next=act(run,action);assert.notEqual(next,run,JSON.stringify(action));return checkpoint(next);}
function journey(seed, target) {
  let run=createRun(seed);
  // Deterministic upgraded attackers are a fixture to reach economy/boss screens via legal transitions.
  run.deck.forEach(c=>{c.id='shot';c.upgraded=true;});
  for(let i=0;i<200;i++) {
    if(target(run))return run;
    assert.ok(!['victory','defeat'].includes(run.phase),`unable to reach target: ${run.phase}`);
    if(run.phase==='map') {
      const nodes=availableNodes(run),node=nodes.find(n=>n.type==='rest') ?? nodes.find(n=>n.type==='shop') ?? nodes.find(n=>n.type==='match') ?? nodes[0];
      run=step(run,{type:'choose-node',id:node.id});
    } else if(run.phase==='match') {
      const card=run.match.hand.find(c=>cardCost(c,run.match)<=run.match.energy);
      run=step(run,card?{type:'play-card',uid:card.uid}:{type:'end-turn'});
    } else if(run.phase==='reward') {
      if(run.relicOffers.length)run=step(run,{type:'take-elite-relic',id:run.relicOffers[0]});
      run=step(run,{type:'take-reward',id:null});
    } else run=step(run,{type:run.phase==='rest'?'rest':'leave-node'});
  }
  assert.fail('journey did not converge');
}
const cache = new Map();
function bossFixture(id,ids) {
  if(!cache.has(id)) {
    let seed=0;while(createRun(seed).route.at(-1).choices[0].opponentId!==id)assert.ok(++seed<128);
    cache.set(id,journey(seed,r=>r.phase==='map'&&r.routeIndex===11));
  }
  let run=copy(cache.get(id));run.condition=100;run.deck=Array.from({length:Math.max(ids.length,10)},(_,i)=>({uid:`c${i+1}`,id:ids[i]||'cover',upgraded:false}));run.nextUid=run.deck.length+1;
  run=step(run,{type:'choose-node',id:availableNodes(run)[0].id});
  run.match.hand=copy(run.deck.slice(0,ids.length));run.match.draw=copy(run.deck.slice(ids.length));return checkpoint(run);
}
const play=(run,id)=>step(run,{type:'play-card',uid:run.match.hand.find(c=>c.id===id).uid});
test('each coach accepts new categories, training, volatile and multi-hit state with strict save validation',()=>{
  for(const id of ['coach-mourinho','coach-ancelotti','coach-guardiola','coach-arteta','coach-wenger','coach-ferguson','coach-klopp']) {
    let run=bossFixture(id,['quick-pass','double-touch','aerial-training','cover']);
    run=play(run,'quick-pass');run=play(run,'double-touch');run=play(run,'aerial-training');run=play(run,'cover');
    run=step(run,{type:'end-turn'});assert.equal(run.match.exhaust.length,1);assert.ok(getBossView(run));
  }
});
test('Wenger counts damage cards, not individual hits, while training is a skill for Guardiola',()=>{
  let run=bossFixture('coach-wenger',['quick-pass','double-touch','judgment-training']);
  run=play(run,'quick-pass');run=play(run,'double-touch');
  assert.equal(getBossView(run).countered,false);
  run=play(run,'judgment-training');assert.equal(getBossView(run).countered,false);
  run=bossFixture('coach-guardiola',['quick-pass','cover','explosion-training']);
  run=play(run,'quick-pass');run=play(run,'cover');run=play(run,'explosion-training');assert.equal(getBossView(run).countered,true);
});
test('Klopp charges first training only; Ancelotti counts training as skill',()=>{
  let run=bossFixture('coach-klopp',['judgment-training','explosion-training']);
  run=play(run,'judgment-training');assert.equal(run.condition,97);run=play(run,'explosion-training');assert.equal(run.condition,97);
  run=bossFixture('coach-ancelotti',['judgment-training','explosion-training']);
  run=play(run,'judgment-training');run=play(run,'explosion-training');run=step(run,{type:'end-turn'});assert.equal(run.match.boss.adaptation,'skill');
});
test('shop sells 70/150/320 cards, buys once, persists, and removal prices rise by 25',()=>{
  let run=journey(4,r=>r.phase==='shop');
  assert.deepEqual(run.shopCards.map(id=>CARDS[id].rarity),['common','uncommon','rare']);
  const rare=run.shopCards[2];assert.equal(act(run,{type:'buy-card',id:rare}),run,'first-shop money cannot afford rare');
  run.gold=500;const n=run.deck.length;run=step(run,{type:'buy-card',id:rare});assert.equal(run.gold,180);assert.equal(run.deck.length,n+1);
  assert.equal(act(run,{type:'buy-card',id:rare}),run);
  run=step(run,{type:'remove-card',uid:run.deck[0].uid});assert.equal(run.gold,130);
  run=step(run,{type:'remove-card',uid:run.deck[0].uid});assert.equal(run.gold,55);
  run=step(run,{type:'leave-node'});assert.deepEqual(run.shopCards,[]);
});
test('shop persistent training can never be offered twice or bought after owned',()=>{
  let run=journey(4,r=>r.phase==='shop');run.gold=500;
  run.shopCards=['control-training'];run=step(run,{type:'buy-card',id:'control-training'});
  assert.equal(run.deck.filter(c=>c.id==='control-training').length,1);
  assert.equal(act(run,{type:'buy-card',id:'control-training'}),run);
});
test('treatment replaces rest once per ACT; ordinary removal and upgrades reject injuries',()=>{
  let run=journey(4,r=>r.phase==='rest');
  const uid=`c${run.nextUid++}`;run.deck.push({uid,id:'abrasion',upgraded:false});run.relics.push('roulette-rune');checkpoint(run);
  const hp=run.condition;run=step(run,{type:'treat-injury',uid});assert.equal(run.condition,hp);assert.deepEqual(run.treatedActs,[1]);assert.ok(run.relics.includes('roulette-rune'));
  run=journey(4,r=>r.phase==='shop');run.gold=100;
  run.deck.push({uid:`c${run.nextUid++}`,id:'abrasion',upgraded:false});checkpoint(run);
  assert.equal(act(run,{type:'remove-card',uid:run.deck.at(-1).uid}),run);
});
test('elite equipment acquisition adds its persistent injury exactly once, even at playable deck cap',()=>{
  let seed=0,base;
  while(seed<50){const fresh=createRun(seed);if(fresh.route.some(s=>s.choices.some(n=>n.type==='elite'&&n.opponentId!=='elite'))){base=fresh;break;}seed++;}
  // Reuse a real reachable map, choose elites whenever possible.
  let run=base;while(run.deck.length<40)run.deck.push({uid:`c${run.nextUid++}`,id:'shot',upgraded:true});run.deck.forEach(c=>{c.id='shot';c.upgraded=true;});
  for(let i=0;i<180 && !(run.phase==='reward'&&run.activeNode.type==='elite');i++) {
    if(run.phase==='map'){const nodes=availableNodes(run);run=step(run,{type:'choose-node',id:(nodes.find(n=>n.type==='elite')??nodes.find(n=>n.type==='rest')??nodes[0]).id});}
    else if(run.phase==='match'){const c=run.match.hand.find(c=>cardCost(c,run.match)<=run.match.energy);run=step(run,c?{type:'play-card',uid:c.uid}:{type:'end-turn'});}
    else if(run.phase==='reward')run=step(run,{type:'take-reward',id:null});
    else run=step(run,{type:run.phase==='rest'?'rest':'leave-node'});
  }
  if (!run.relicOffers.some(id=>RELICS[id].injury)) {
    // Choose the later legend encounter; the street rival intentionally has no cursed relic.
    run=step(run,{type:'take-elite-relic',id:run.relicOffers[0]});run=step(run,{type:'take-reward',id:null});
    for(let i=0;i<80 && !(run.phase==='reward'&&run.activeNode.type==='elite');i++) {
      if(run.phase==='map'){const nodes=availableNodes(run);run=step(run,{type:'choose-node',id:(nodes.find(n=>n.type==='elite')??nodes.find(n=>n.type==='rest')??nodes[0]).id});}
      else if(run.phase==='match'){const c=run.match.hand.find(c=>cardCost(c,run.match)<=run.match.energy);run=step(run,c?{type:'play-card',uid:c.uid}:{type:'end-turn'});}
      else if(run.phase==='reward')run=step(run,{type:'take-reward',id:null});
      else run=step(run,{type:run.phase==='rest'?'rest':'leave-node'});
    }
  }
  const id=run.relicOffers.find(id=>RELICS[id].injury);assert.ok(id);
  const injury=RELICS[id].injury;const count=run.deck.length;
  run=step(run,{type:'take-elite-relic',id});assert.equal(run.deck.length,count+1);assert.equal(run.deck.at(-1).id,injury);
  assert.equal(act(run,{type:'take-elite-relic',id}),run);
  // Reward save retains the completed battle's original deck, excluding the just-acquired injury.
  checkpoint(run);run=step(run,{type:'take-reward',id:null});
  assert.equal(run.deck.filter(c=>c.id===injury).length,1);
});

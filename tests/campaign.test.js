import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRun,createCampaignRun,act,availableNodes,validateSave,getActView,getEnemyViews,getEnemyAttack,getBossView,forecast,cardCost,CARDS,RELICS,OPPONENTS} from '../dist/engine.js';
import {ACTS,CAMPAIGN_BOSSES,campaignActAt,scaledOpponentHp} from '../dist/campaign.js';
import {REGULAR_ENEMIES,ACT_ENEMIES,makeEnemies,startEnemyRound,finishEnemyRound,regularIntent,regularAttack} from '../dist/encounters.js';

const checkpoint=r=>{const restored=validateSave(JSON.parse(JSON.stringify(r)));assert.ok(restored,`invalid ${r.phase}:${r.routeIndex}:${r.match?.turn}`);assert.deepEqual(restored,r);return restored;};
const step=(r,a)=>{const next=act(r,a);assert.notEqual(next,r,`rejected ${JSON.stringify(a)} in ${r.phase}`);return checkpoint(next);};
function fixture(seed=4,options={}) {
 const r=createCampaignRun(seed,'테스트 선수',options);
 // Deliberately strong fixture deck isolates route/state correctness from difficulty.
 r.deck.forEach(c=>{c.id='suppressing-header';c.upgraded=true;});
 r.relics=['captain-band','golden-whistle'];r.maxCondition=r.condition=115;
 return checkpoint(r);
}
function advance(r,options={}) {
 if(r.phase==='map') {
  const ns=availableNodes(r),prefer=options.visitElite?'elite':options.visitShop?'shop':null;
  const towardPreferred=prefer?ns.find(n=>n.next.some(id=>r.route[r.routeIndex+1]?.choices.some(c=>c.id===id&&c.type===prefer))):null;
  const node=ns.find(n=>n.type===prefer)??towardPreferred??ns.find(n=>n.type==='rest')??ns.find(n=>n.type==='event')??ns[0];
  return step(r,{type:'choose-node',id:node.id});
 }
 if(r.phase==='match') {
  if(r.match.choice)return step(r,{type:'choose-card',uid:r.match.choice.candidates[0]});
  const card=r.match.hand.find(c=>cardCost(c,r.match)<=r.match.energy);
  return step(r,card?{type:'play-card',uid:card.uid}:{type:'end-turn'});
 }
 if(r.phase==='reward')return step(r,r.relicOffers.length?{type:'take-elite-relic',id:r.relicOffers.find(id=>!RELICS[id].injury)??r.relicOffers[0]}:{type:'take-reward',id:null});
 if(r.phase==='act-clear')return step(r,{type:'continue-act'});
 if(r.phase==='rest')return step(r,{type:'rest'});
 if(r.phase==='event')return step(r,{type:'event-choice',id:'safe'});
 return step(r,{type:'leave-node'});
}
function reach(seed,predicate,options={}) {
 let r=fixture(seed,options);
 for(let i=0;i<650;i++){if(predicate(r))return r;assert.ok(!['victory','defeat'].includes(r.phase),`cannot reach target: ${r.phase} at${r.routeIndex}`);r=advance(r,options);}
 assert.fail('campaign did not converge');
}

test('campaign has 36 connected stages, distinct boss pools and fair nonrepeating later encounters',()=>{
 const bosses=new Set(),seen={2:new Set(),3:new Set()};
 for(let seed=0;seed<80;seed++) {
  const r=checkpoint(createCampaignRun(seed));assert.equal(r.route.length,36);assert.equal(ACTS.length,3);
  assert.equal(new Set(r.route.flatMap(s=>s.choices.map(n=>n.id))).size,r.route.flatMap(s=>s.choices).length);
  for(let i=0;i<35;i++)for(const n of r.route[i].choices){assert.ok(n.next.length);assert.ok(n.next.every(id=>r.route[i+1].choices.some(c=>c.id===id)));}
  for(let number=1;number<=3;number++) {
   const boss=r.route[number*12-1].choices[0].opponentId;assert.ok(CAMPAIGN_BOSSES[number-1].includes(boss));bosses.add(boss);
   if(number===1)continue;
   const combinations=[];
   for(const local of [0,2,7]) {
    const ids=r.route[(number-1)*12+local].choices[0].encounter;combinations.push(ids.join(','));
    ids.forEach(id=>{assert.ok(ACT_ENEMIES[number].includes(id));seen[number].add(id);});
    const roles=ids.map(id=>REGULAR_ENEMIES[id].role);assert.ok(ids.length===1||ids.length===2);
    if(ids.length===1)assert.notEqual(roles[0],'buffer');else{assert.equal(new Set(roles).size,2);assert.ok(!roles.includes('buffer')||roles.includes('attacker'));}
   }
   assert.equal(new Set(combinations).size,3);assert.equal(r.route[(number-1)*12].choices[0].encounter.length,1);
  }
 }
 assert.equal(bosses.size,9);assert.equal(seen[2].size,5);assert.equal(seen[3].size,5);
});

test('three-ACT legal journey preserves save at every action, rewards once and heals only on continue',()=>{
 let r=fixture(4),boundaries=0,shops=0;const seenPhases=new Set();
 for(let i=0;i<650&&!['victory','defeat'].includes(r.phase);i++) {
  seenPhases.add(r.phase);
  if(r.phase==='shop'){shops++;assert.equal(r.shopCards.length,3);assert.ok(r.shopOffers.length<=3);assert.equal(new Set(r.seenShopRelics).size,r.seenShopRelics.length);}
  if(r.phase==='act-clear') {
   boundaries++;const before=structuredClone(r),view=getActView(r),rewardGold=r.gold;
   assert.equal(view.completed,boundaries);assert.equal(view.number,boundaries+1);assert.equal(view.localIndex,0);assert.equal(r.match,null);assert.equal(r.activeNode,null);
   assert.equal(act(r,{type:'take-reward',id:null}),r);assert.equal(act(r,{type:'choose-node',id:r.route[r.routeIndex].choices[0].id}),r);
   r=step(r,{type:'continue-act'});assert.equal(r.condition,Math.min(before.maxCondition,before.condition+30));assert.equal(r.gold,rewardGold);
   for(const field of ['deck','relics','shopRemovalCount','seenShopRelics','treatedActs','history'])assert.deepEqual(r[field],before[field]);
   assert.equal(act(r,{type:'continue-act'}),r);continue;
  }
  if(r.phase==='reward'&&r.activeNode.type==='match'&&r.actNumber>1){assert.equal(new Set(r.offers).size,3);if(r.actNumber===3||r.routeIndex%12===7)assert.ok(r.offers.some(id=>CARDS[id].rarity==='rare'));}
  r=advance(r,{visitShop:true});
 }
 assert.equal(r.phase,'victory');assert.equal(r.routeIndex,36);assert.equal(r.history.length,36);assert.equal(boundaries,2);assert.equal(shops,6);assert.equal(r.actNumber,3);
 assert.ok(['map','match','reward','shop','rest','event','act-clear'].every(phase=>seenPhases.has(phase)));
 assert.equal(act(r,{type:'continue-act'}),r);checkpoint(r);
});

test('later elites and bosses use canonical scaled health and boss intent survives saves',()=>{
 let r=fixture(7),eliteActs=new Set(),bossActs=new Set(),eliteIds=[];
 for(let i=0;i<700&&!['victory','defeat'].includes(r.phase);i++) {
  if(r.phase==='match'&&['elite','boss'].includes(r.activeNode.type)) {
   const expected=scaledOpponentHp(OPPONENTS[r.match.opponentId].maxHp,r.actNumber,r.challengeVersion);assert.equal(r.match.enemyMaxHp,expected);
   assert.equal(getEnemyViews(r)[0].actNumber,r.actNumber);(r.activeNode.type==='elite'?eliteActs:bossActs).add(r.actNumber);
   const bad=structuredClone(r);bad.match.campaignAct=1+(r.actNumber%3);assert.equal(validateSave(bad),null);
  }
  if(r.phase==='reward'&&r.activeNode.type==='elite'&&r.relicOffers.length)eliteIds.push(r.match.opponentId);
  r=advance(r,{visitElite:true});
 }
 assert.equal(r.phase,'victory');assert.deepEqual([...eliteActs],[1,2]);assert.deepEqual([...bossActs],[1,2,3]);assert.equal(eliteIds.length,4);assert.equal(new Set(eliteIds).size,4);
});

test('shop stock is at most three, displayed equipment never returns even without purchase',()=>{
 let r=fixture(9),seen=new Set(),shopCount=0;
 for(let i=0;i<650&&!['victory','defeat'].includes(r.phase);i++) {
  if(r.phase==='shop'){
   shopCount++;assert.ok(r.shopOffers.length<=3);
   const currentCandidates=Object.keys(RELICS).filter(id=>RELICS[id].minAct===r.actNumber&&!seen.has(id)&&!r.relics.includes(id));
   if(currentCandidates.length)assert.ok(r.shopOffers.some(id=>currentCandidates.includes(id)),'current ACT equipment must appear while available');
   for(const id of r.shopOffers){assert.ok(!seen.has(id),`repeated ${id}`);seen.add(id);assert.ok(!RELICS[id].minAct||RELICS[id].minAct<=r.actNumber);}
   assert.deepEqual(new Set(r.seenShopRelics),seen);assert.deepEqual(checkpoint(r).shopOffers,r.shopOffers);
  }
  r=advance(r,{visitShop:true});
 }
 assert.equal(r.phase,'victory');assert.equal(shopCount,6);
});

test('one injury treatment per ACT carries through boundaries and becomes available next ACT',()=>{
 let r=fixture(4);for(let i=0;i<3;i++)r.deck.push({uid:`c${r.nextUid++}`,id:'stiff-muscle',upgraded:false});checkpoint(r);
 for(let i=0;i<700&&!['victory','defeat'].includes(r.phase);i++){
  if(r.phase==='rest'&&!r.treatedActs.includes(r.actNumber)) {
   const number=r.actNumber,hp=r.condition,injury=r.deck.find(c=>c.id==='stiff-muscle');assert.ok(injury);
   r=step(r,{type:'treat-injury',uid:injury.uid});assert.equal(r.condition,hp);assert.ok(r.treatedActs.includes(number));
  } else {if(r.phase==='rest'&&r.deck.some(c=>c.id==='stiff-muscle'))assert.equal(act(r,{type:'treat-injury',uid:r.deck.find(c=>c.id==='stiff-muscle').uid}),r);r=advance(r);}
 }
 assert.equal(r.phase,'victory');assert.deepEqual(r.treatedActs,[1,2,3]);assert.ok(!r.deck.some(c=>c.id==='stiff-muscle'));
});

test('death in every ACT and at a risky event remains terminal and resumable',()=>{
 for(const number of [1,2,3]){
  let r=reach(4,r=>r.phase==='match'&&r.actNumber===number);r.condition=1;checkpoint(r);
  r=step(r,{type:'end-turn'});assert.equal(r.phase,'defeat');assert.equal(r.actNumber,number);assert.equal(act(r,{type:'continue-act'}),r);assert.equal(act(r,{type:'end-turn'}),r);
 }
 let r=reach(4,r=>r.phase==='event'&&r.actNumber===2);r.condition=1;r=step(r,{type:'event-choice',id:'risk'});assert.equal(r.phase,'defeat');assert.equal(r.match,null);
});

test('campaign validation rejects invalid boundaries, routing, chapter identity and seen equipment',()=>{
 const r=reach(4,r=>r.phase==='act-clear');
 for(const mutate of [x=>x.campaignVersion=2,x=>x.actNumber=1,x=>x.routeIndex=13,x=>x.route[12].choices[0].next=[],x=>x.route[23].choices[0].opponentId='coach-wenger',x=>x.seenShopRelics=['libero-seal'],x=>x.seenShopRelics=['lucky-coin','lucky-coin'],x=>x.treatedActs=[1]]) {const bad=structuredClone(r);mutate(bad);assert.equal(validateSave(bad),null);}
 const old=createRun(4);old.phase='act-clear';assert.equal(validateSave(old),null);
});

test('existing factory stays one ACT and old saves never acquire campaign fields',()=>{
 const old=checkpoint(createRun(4));assert.equal(old.route.length,12);assert.equal(old.campaignVersion,undefined);assert.equal(old.seenShopRelics,undefined);assert.equal(getActView(old).totalActs,1);
 assert.equal(act(old,{type:'continue-act'}),old);
 const fresh=createCampaignRun(4);assert.deepEqual(fresh.route.slice(0,11).map(s=>s.choices.map(n=>n.type)),old.route.slice(0,11).map(s=>s.choices.map(n=>n.type)));
});

test('new role patterns change behavior, support is delayed and heavy attacks expose recovery',()=>{
 for(const number of [2,3]) {
  const [attacker,technique,defender,buffer,charger]=ACT_ENEMIES[number];
  const m={enemies:makeEnemies([attacker,buffer]),targetId:'e1',turn:1,playerExposed:0};startEnemyRound(m);
  assert.equal(m.enemies[0].attackBuff,0);assert.equal(regularIntent(m,m.enemies[1]).buff,3);
  finishEnemyRound(m);m.turn++;startEnemyRound(m);assert.equal(m.enemies[0].attackBuff,3);assert.ok(regularIntent(m,m.enemies[1]).shield>=5);
  finishEnemyRound(m);m.turn++;startEnemyRound(m);assert.ok(m.enemies[0].block>=5);assert.ok(m.enemies[0].exposed>0);
  const c={enemies:makeEnemies([defender,charger]),targetId:'e1',turn:1,playerExposed:0};startEnemyRound(c);assert.equal(regularIntent(c,c.enemies[0]).shield,number===2?6:7);
  for(let t=0;t<2;t++){finishEnemyRound(c);c.turn++;startEnemyRound(c);}
  assert.equal(c.enemies[1].charge,2);assert.equal(regularIntent(c,c.enemies[1]).attack,number===2?14:17);
  finishEnemyRound(c);c.turn++;startEnemyRound(c);assert.equal(c.enemies[1].charge,0);assert.equal(c.enemies[1].exposed,2);
  const solo={enemies:makeEnemies([technique]),targetId:'e1',turn:1,playerExposed:0};startEnemyRound(solo);assert.equal(!!regularIntent(solo,solo.enemies[0]).expose,number===3);
 }
});

test('later encounter forecasts match actual turn damage including exposed turns and delayed support',()=>{
 for(const index of [14,19,26,31]){
  let r=reach(4,r=>r.phase==='match'&&r.routeIndex===index);
  for(let t=0;t<6&&r.phase==='match';t++){
   const hp=r.condition,predicted=forecast(r).incoming,views=getEnemyViews(r);
   assert.equal(getEnemyAttack(r),views.reduce((sum,e)=>sum+e.attack,0));assert.ok(views.every(e=>e.actNumber===campaignActAt(index)));
   r=step(r,{type:'end-turn'});assert.equal(hp-r.condition,Math.min(hp,predicted));
  }
 }
});

test('boss details disclose ACT and long-battle attack additions without changing legacy intent text',()=>{
 for(const [number,id] of [[2,'coach-mourinho'],[3,'coach-ferguson'],[3,'coach-guardiola'],[3,'coach-ancelotti']]) {
  let seed=0;while(createCampaignRun(seed).route[number*12-1].choices[0].opponentId!==id)assert.ok(++seed<80);
  let r=reach(seed,r=>r.phase==='map'&&r.routeIndex===number*12-1);
  r.deck.forEach(c=>{c.id='cover';c.upgraded=true;});r=step(r,{type:'choose-node',id:availableNodes(r)[0].id});
  const suffix=`+ ACT ${number===2?'II':'III'} 압박 ${(number-1)*2} = ${getEnemyAttack(r)}.`;
  assert.ok(getBossView(r).detail.startsWith('기본 패턴: '));assert.ok(getBossView(r).detail.endsWith(suffix));assert.equal(r.match.intent.rule,getBossView(r).detail);assert.ok(r.match.intent.description.includes(`피해 ${getEnemyAttack(r)}.`));
  if(id==='coach-mourinho') {
   while(r.match.turn<13)r=advance(r);
   assert.ok(getBossView(r).detail.endsWith(`+ ACT II 압박 2 + 장기전 압박 2 = ${getEnemyAttack(r)}.`));
   const hp=r.condition,predicted=forecast(r).incoming;r=step(r,{type:'end-turn'});assert.equal(hp-r.condition,Math.min(hp,predicted));
  }
 }
 const legacy=createRun(4);legacy.match={opponentId:'coach-mourinho',turn:13,enemyHp:92,enemyMaxHp:92,enemyBlock:12,played:[],boss:{version:1,counterCharge:0,pressure:0,adaptation:'none',combo:0,overtimeStart:0}};
 assert.ok(!getBossView(legacy).detail.includes('추가 압박'));assert.ok(!getBossView(legacy).detail.includes('장기전 압박'));
});

const bossMaps=new Map();
function coachBattle(id,ids,options={}) {
 const key=`${id}:${options.challengeVersion??2}`;
 if(!bossMaps.has(key)){
  let seed=0,index;for(;seed<200;seed++){index=createCampaignRun(seed,'테스트 선수',options).route.findIndex(s=>s.choices.some(n=>n.type==='boss'&&n.opponentId===id));if(index>=0)break;}assert.ok(seed<200);
  bossMaps.set(key,reach(seed,r=>r.phase==='map'&&r.routeIndex===index,options));
 }
 let r=structuredClone(bossMaps.get(key));r.condition=r.maxCondition;
 r.deck=Array.from({length:Math.max(12,ids.length)},(_,i)=>({uid:`c${i+1}`,id:ids[i]??'cover',upgraded:false}));r.nextUid=r.deck.length+1;
 r=step(r,{type:'choose-node',id:availableNodes(r)[0].id});r.match.hand=structuredClone(r.deck.slice(0,ids.length));r.match.draw=structuredClone(r.deck.slice(ids.length));return checkpoint(r);
}
const use=(r,id)=>step(r,{type:'play-card',uid:r.match.hand.find(c=>c.id===id).uid});
function arrange(r,ids) {
 const all=[...r.match.hand,...r.match.draw,...r.match.discard];r.match.hand=ids.map(id=>{const i=all.findIndex(c=>c.id===id);assert.ok(i>=0);return all.splice(i,1)[0];});r.match.draw=all;r.match.discard=[];return checkpoint(r);
}
function lowerBoss(r,hp) {
 const delta=r.match.enemyHp-hp;r.match.enemyHp=hp;r.match.damageDealt+=delta;r.match.chance+=delta;r.stats.damage+=delta;r.match.enemyBlock=0;return checkpoint(r);
}
function enemyTurn(r) {const before=r.condition,prediction=forecast(r);const next=step(r,{type:'end-turn'});assert.equal(before-next.condition,Math.min(before,prediction.incoming));return next;}

test('old single and campaign route snapshots remain byte-identical and active old bosses resume unchanged',()=>{
 const snapshots={2:['4496c4c6fd8ce67f3390894a9004a65c28f075d5cedd5e4d90c678f2056e7846','7b06f599f63a0123bba15abad7baba28aa6eefa88fd2eaac8feb9a74233dd628'],4:['57f6651391dbc54929c727bc8542c1e4a0b12a924ffdc1738421ccb0d8237fd2','6192cfd039faf0c0d8a8976f09a16f9121ba9e9d32ba03b35fb83bc172d979e4'],9:['ff603fbce2b0e112b5236812ae54ff0e5f9b1cb808ff71f1ba3b648ebf66d3e6','fd1e89ca5b44d84fcf1dcddc1009b37abb292beeb336c8006ee73512ce1b48df']};
 for(const [seed,hashes] of Object.entries(snapshots))for(const [i,r] of [createRun(+seed),createCampaignRun(+seed,'루키',{challengeVersion:1})].entries()){checkpoint(r);assert.equal(createHash('sha256').update(JSON.stringify(r.route)).digest('hex'),hashes[i]);assert.equal(r.challengeVersion,undefined);}
 let r=coachBattle('coach-mourinho',['cover'],{challengeVersion:1});assert.equal(r.match.enemyMaxHp,110);assert.equal(r.match.enemyBlock,12);
 r=enemyTurn(r);assert.equal(r.match.intent.attack,24);r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');assert.equal(r.match.challengeVersion,undefined);
 const changed=structuredClone(r);changed.challengeVersion=2;assert.equal(validateSave(changed),null);
});

test('Simeone reacts once per successful card, preserves broken guard and resets after the enemy action',()=>{
 let r=coachBattle('coach-simeone',['double-touch','quick-pass','cover','breathing','judgment-training','stiff-muscle']);
 assert.equal(getBossView(r).restrictedCategory,'attack');assert.equal(getBossView(r).nextRestrictedCategory,'defense');assert.equal(getEnemyAttack(r),8);
 const injury=r.match.hand.find(c=>c.id==='stiff-muscle');assert.equal(act(r,{type:'play-card',uid:injury.uid}),r);
 const hp=r.match.enemyHp;r=use(r,'double-touch');assert.equal(hp-r.match.enemyHp,2);assert.equal(r.match.enemyBlock,8);assert.equal(getEnemyAttack(r),14);assert.equal(getBossView(r).restrictionTriggers,1);
 r=use(r,'quick-pass');assert.equal(r.match.enemyBlock,14);assert.equal(getEnemyAttack(r),20);assert.equal(getBossView(r).restrictionTriggers,2);
 r=use(r,'cover');assert.equal(r.match.enemyBlock,14);const restored=checkpoint(r);assert.deepEqual(restored,r);
 r=enemyTurn(r);assert.equal(getBossView(r).restrictedCategory,'defense');assert.equal(r.match.enemyBlock,4);assert.equal(getEnemyAttack(r),8);
 r=arrange(r,['cover','breathing','judgment-training']);r=use(r,'cover');assert.equal(r.match.enemyBlock,12);assert.equal(getEnemyAttack(r),14);
 r=use(r,'breathing');assert.ok(r.match.choice);const attack=getEnemyAttack(r),block=r.match.enemyBlock;r=step(r,{type:'choose-card',uid:r.match.choice.candidates[0]});assert.equal(getEnemyAttack(r),attack);assert.equal(r.match.enemyBlock,block);
 r=enemyTurn(r);assert.equal(getBossView(r).restrictedCategory,'skill');r=arrange(r,['judgment-training']);r=use(r,'judgment-training');assert.equal(getBossView(r).restrictionTriggers,1);assert.equal(r.match.enemyBlock,12);assert.equal(getEnemyAttack(r),14);
});

test('Simeone skips guard reaction on lethal cards and fatal enemy turns still save',()=>{
 let r=lowerBoss(coachBattle('coach-simeone',['quick-pass']),1);r=use(r,'quick-pass');assert.equal(r.phase,'reward');assert.equal(r.match.enemyBlock,0);checkpoint(r);
 r=coachBattle('coach-simeone',['quick-pass']);r=use(r,'quick-pass');r.condition=1;r=enemyTurn(r);assert.equal(r.phase,'defeat');checkpoint(r);
});

test('De Zerbi counts mixed answers once per buildup turn and resets each cycle',()=>{
 let r=coachBattle('coach-dezerbi',['quick-pass','cover','judgment-training']);
 r=use(r,'quick-pass');assert.equal(getBossView(r).progress,0);r=use(r,'cover');assert.equal(getBossView(r).progress,1);assert.equal(r.match.boss.buildUpBreaks,0);
 r=enemyTurn(r);assert.equal(r.match.boss.buildUpBreaks,1);r=arrange(r,['quick-pass','judgment-training']);r=use(r,'quick-pass');r=use(r,'judgment-training');assert.equal(getBossView(r).progress,2);
 r=enemyTurn(r);assert.equal(getEnemyAttack(r),10);assert.equal(r.match.boss.buildUpBreaks,2);r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');r=enemyTurn(r);assert.equal(r.match.boss.buildUpBreaks,0);
 let ignored=coachBattle('coach-dezerbi',['quick-pass']);ignored=use(ignored,'quick-pass');ignored=enemyTurn(ignored);ignored=enemyTurn(ignored);assert.equal(getEnemyAttack(ignored),22);
 const bad=structuredClone(r);bad.match.boss.buildUpBreaks=3;assert.equal(validateSave(bad),null);
});

test('later boss upgrades change attack cycles, pressure and second-half tactics',()=>{
 let r=coachBattle('coach-mourinho',[]);assert.equal(r.match.enemyBlock,14);r=enemyTurn(r);assert.equal(getEnemyAttack(r),26);r=enemyTurn(r);assert.equal(getBossView(r).effect,'press');r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');assert.equal(r.match.enemyBlock,0);
 r=coachBattle('coach-klopp',['power-shot']);for(let i=0;i<3;i++)r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');r=arrange(r,['power-shot']);let hp=r.match.enemyHp;r=use(r,'power-shot');assert.equal(hp-r.match.enemyHp,22);
 r=coachBattle('coach-guardiola',['power-shot']);r=enemyTurn(r);assert.equal(r.match.boss.pressure,3);r=enemyTurn(r);assert.equal(r.match.boss.pressure,4);r=enemyTurn(r);assert.equal(r.match.boss.pressure,0);assert.equal(getBossView(r).effect,'recover');r=arrange(r,['power-shot']);hp=r.match.enemyHp;r=use(r,'power-shot');assert.equal(hp-r.match.enemyHp,20);
 r=coachBattle('coach-ancelotti',['quick-pass']);r=lowerBoss(r,Math.floor(r.match.enemyMaxHp/2));r=use(r,'quick-pass');r=enemyTurn(r);assert.equal(getBossView(r).phase,2);assert.equal(r.match.enemyBlock,17);r=enemyTurn(r);r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');assert.equal(r.match.enemyBlock,0);
 r=coachBattle('coach-ferguson',['quick-pass']);r=lowerBoss(r,Math.floor(r.match.enemyMaxHp*.4)+1);r=use(r,'quick-pass');assert.equal(r.match.boss.overtimeStart,1);assert.equal(getEnemyAttack(r),22);r=enemyTurn(r);assert.equal(getEnemyAttack(r),26);r=enemyTurn(r);assert.equal(getEnemyAttack(r),32);r=enemyTurn(r);assert.equal(getBossView(r).effect,'recover');
});

test('elite draft follows actual visits, leaves skipped elites available and handles exhausted pools',()=>{
 for(const seed of [2,4,9]) {
  let r=fixture(seed),met=new Set(),exhausted=false;
  for(let i=0;i<700&&!['victory','defeat'].includes(r.phase);i++){
   if(r.phase==='match'&&r.activeNode.type==='elite'&&r.match.turn===1&&r.match.played.length===0){assert.ok(!met.has(r.match.opponentId));met.add(r.match.opponentId);}
   if(r.phase==='map'&&met.size===4){exhausted=true;assert.ok(r.route.slice(r.routeIndex).every(row=>row.choices.every(n=>n.type!=='elite')));}
   r=advance(r,{visitElite:true});
  }
  assert.equal(r.phase,'victory');assert.equal(met.size,4);assert.ok(exhausted);
 }
 const skipped=reach(4,r=>r.phase==='map'&&r.routeIndex===12);assert.equal(skipped.history.filter(h=>h.type==='elite').length,0);assert.ok(skipped.route.slice(12).some(row=>row.choices.some(n=>n.type==='elite')));
});

test('second-phase labels require real phase changes and Guardiola strengthens two-category pressure',()=>{
 for(const id of ['coach-dezerbi','coach-simeone','coach-mourinho','coach-klopp','coach-arteta','coach-wenger']){
  const r=coachBattle(id,[]);r.match.enemyHp=r.match.intentHp=Math.floor(r.match.enemyMaxHp*.45);assert.equal(getBossView(r).phase,1,id);
 }
 let r=coachBattle('coach-ferguson',['quick-pass']);r=lowerBoss(r,Math.floor(r.match.enemyMaxHp*.45));r=enemyTurn(r);assert.equal(getBossView(r).phase,1);r=lowerBoss(r,Math.floor(r.match.enemyMaxHp*.4)+1);r=arrange(r,['quick-pass']);r=use(r,'quick-pass');assert.equal(getBossView(r).phase,2);
 r=coachBattle('coach-guardiola',['quick-pass','cover']);r=lowerBoss(r,Math.floor(r.match.enemyMaxHp*.5));r=use(r,'quick-pass');r=use(r,'cover');r=enemyTurn(r);
 assert.equal(getBossView(r).phase,2);assert.equal(r.match.enemyBlock,8);assert.equal(r.match.boss.pressure,2);
 r=arrange(r,['quick-pass','cover']);r=use(r,'quick-pass');r=use(r,'cover');assert.match(getBossView(r).detail,/2종 → 다음 압박 \+2/);r=enemyTurn(r);assert.equal(r.match.boss.pressure,4);
});

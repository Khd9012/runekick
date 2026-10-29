// ACT I encounters: fixed, readable role patterns and curated pairs.
export const ENEMY_ROLES = Object.freeze({attacker:'공격형',buffer:'버퍼형',technique:'기술형',defender:'방어형',charger:'축적형'});
export const REGULAR_ENEMIES = Object.freeze({
  school:{id:'school',name:'민준',role:'attacker',color:'#e29a74',maxHp:42,duoHp:28,mechanic:'빠른 공격 뒤 숨을 고릅니다. 먼저 쓰러뜨리면 매 턴 받는 공격이 줄어듭니다.'},
  rookie:{id:'rookie',name:'하준',role:'technique',color:'#bca1df',maxHp:44,duoHp:26,mechanic:'3턴마다 다음 턴에 적용되는 약점 노출을 부여합니다. 동료의 다음 공격에 대비하세요.'},
  press:{id:'press',name:'태오',role:'defender',color:'#83bce0',maxHp:48,duoHp:32,mechanic:'자신을 지키며 동료에게 다음 턴 방어를 제공합니다. 공격 대상은 자유롭게 고를 수 있습니다.'},
  'support-coach':{id:'support-coach',name:'지훈 코치',role:'buffer',color:'#8fc8a9',maxHp:22,duoHp:22,mechanic:'동료의 다음 턴 공격을 2 강화합니다. 중첩되지 않으며 혼자 남으면 약하게 공격합니다.'},
  'late-finisher':{id:'late-finisher',name:'건우',role:'charger',color:'#dfbd6e',maxHp:48,duoHp:30,mechanic:'충전 최대 2 후 강공합니다. 준비·강공 턴에 체력 피해 8마다 충전 1을 방해할 수 있습니다. 강공 뒤에는 빈틈이 열립니다.'},
});
export const DUO_COMPOSITIONS = Object.freeze([
  ['school','support-coach'],['school','press'],['rookie','school'],['press','late-finisher'],['school','late-finisher'],
].map(ids=>Object.freeze(ids)));
export function regularComposition(seed, stage) {
  // Separate deterministic encounter seed: rewards and combat draws cannot reroll opponents.
  let n = ((Math.imul(seed ^ 0x85ebca6b, 1664525) + stage * 1013904223) >>> 0);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); n = (n ^ (n >>> 16)) >>> 0;
  if (stage === 2) return [['school','support-coach'],['school','press'],['rookie'],['late-finisher']][n % 4].slice();
  const early = regularComposition(seed,2).join(',');
  const pool = DUO_COMPOSITIONS.filter(ids=>ids.join(',')!==early);
  return pool[n % pool.length].slice();
}
export function encounterMaxHp(ids) { return ids.reduce((sum,id)=>sum+(ids.length>1?REGULAR_ENEMIES[id].duoHp:REGULAR_ENEMIES[id].maxHp),0); }
export function makeEnemies(ids) {
  return ids.map((opponentId,i)=>({id:`e${i+1}`,opponentId,hp:ids.length>1?REGULAR_ENEMIES[opponentId].duoHp:REGULAR_ENEMIES[opponentId].maxHp,maxHp:ids.length>1?REGULAR_ENEMIES[opponentId].duoHp:REGULAR_ENEMIES[opponentId].maxHp,block:0,blockCap:0,exposed:0,weakened:0,charge:0,prepDamage:0,attackBuff:0,nextAttackBuff:0,nextBlock:0,supportTargetId:null}));
}
const alive = m => m.enemies.filter(e=>e.hp>0);
export const selectedEnemy = m => m.enemies?.find(e=>e.id===m.targetId);
function allyFor(m,e) { return alive(m).find(other=>other.id!==e.id); }
export function regularIntent(m,e) {
  const def = REGULAR_ENEMIES[e.opponentId], duo=m.enemies.length>1, phase=(m.turn-1)%3, pressure=Math.max(0,m.turn-12)*(duo?1:2);
  if(e.hp<=0)return {name:'퇴장',attack:0,defense:0,description:'쓰러진 상대는 행동하지 않습니다.'};
  let result;
  if(def.role==='attacker') result=[{name:'빠른 돌파',attack:duo?5:8,defense:0},{name:'전력 슈팅',attack:duo?7:11,defense:0},{name:'숨 고르기',attack:duo?3:5,defense:2}][phase];
  if(def.role==='technique') result=[{name:'속임 동작',attack:duo?3:5,defense:1,expose:1,description:'공격 후 약점 노출 1턴. 다음 턴 상대 공격 피해 +50%.'},{name:'기술적인 돌파',attack:duo?5:8,defense:0},{name:'간격 유지',attack:duo?3:5,defense:3}][phase];
  if(def.role==='defender') result=[{name:'동료 엄호',attack:duo?2:4,defense:duo?5:7,shield:4},{name:'몸싸움',attack:duo?4:7,defense:2},{name:'자리 재정비',attack:duo?3:5,defense:duo?4:6}][phase];
  if(def.role==='buffer') result=phase===1?{name:'짧은 견제',attack:2,defense:2}:{name:'전술 지시',attack:0,defense:0,buff:2};
  if(def.role==='charger') {
    const p=(m.turn-1)%4;
    result=p<2?{name:p?'충전 · 힘 모으기':'충전 · 몸싸움 준비',attack:duo?2:3,defense:p?4:3,charging:true,description:`충전 ${e.charge}/2 → 다음 턴 ${Math.max(0,Math.min(2,e.charge+1)-Math.floor(e.prepDamage/8))}/2 · 체력 피해 8마다 충전 1 방해.`}:p===2?{name:'결정적 헤더',attack:(duo?5:8)+e.charge*3,defense:0,strike:true,description:`강공 ${e.charge}/2 · 체력 피해 8마다 충전 1 감소. 다음 턴 빈틈.`}:{name:'착지 후 빈틈',attack:duo?2:3,defense:0,recovery:true,description:'강공 후 충전 초기화. 방어 없이 재정비합니다.'};
  }
  result={...result,attack:result.attack+pressure};
  const ally=allyFor(m,e);
  if(result.buff) {
    const planned=m.enemies.find(other=>other.id===e.supportTargetId);
    if(planned) result.description=planned.hp>0?`${REGULAR_ENEMIES[planned.opponentId].name}의 다음 턴 공격 +2 · 중첩 불가`:'지원 대상 퇴장 · 이번 전술 지시 취소';
    else {result={name:'홀로 남은 코치',attack:3+pressure,defense:0,description:'지원할 동료가 없어 약하게 공격합니다.'};}
  }
  if(result.shield) result.description=ally?`${REGULAR_ENEMIES[ally.opponentId].name}에게 다음 턴 방어 +4`:'자신의 방어를 유지하며 견제합니다.';
  return {...result,description:result.description||`공격 ${result.attack+e.attackBuff}${result.defense?` · 방어 ${result.defense}`:''}`,attack:result.attack+e.attackBuff};
}
export function regularAttack(m,e) { return e.hp>0?Math.floor(regularIntent(m,e).attack*(e.weakened>0?.75:1)*(m.playerExposed>0?1.5:1)):0; }
export function syncEnemies(m, retarget=false) {
  if(!m.enemies)return;
  if(retarget && (!selectedEnemy(m)||selectedEnemy(m).hp<=0))m.targetId=alive(m)[0]?.id??null;
  const target=selectedEnemy(m);
  m.enemyHp=m.enemies.reduce((sum,e)=>sum+e.hp,0);
  m.enemyMaxHp=m.enemies.reduce((sum,e)=>sum+e.maxHp,0);
  m.enemyBlock=target?.block??0;m.enemyExposed=target?.exposed??0;m.enemyWeakened=target?.weakened??0;
  m.intent={name:m.enemies.length>1?'합동 대결':regularIntent(m,m.enemies[0]).name,attack:alive(m).reduce((sum,e)=>sum+regularIntent(m,e).attack,0),defense:target?.blockCap??0,rule:'상대를 선택해 공격하세요. 쓰러진 상대는 행동하지 않습니다.'};
}
export function startEnemyRound(m) {
  for(const e of m.enemies) {
    e.supportTargetId=allyFor(m,e)?.id??null;
    e.attackBuff=e.nextAttackBuff;e.nextAttackBuff=0;e.prepDamage=0;
    e.blockCap=e.hp>0?regularIntent(m,e).defense+e.nextBlock:0;e.block=e.blockCap;e.nextBlock=0;
  }
  syncEnemies(m,true);
}
export function finishEnemyRound(m) {
  const intents=m.enemies.map(e=>({e,intent:regularIntent(m,e)}));
  for(const e of m.enemies){e.exposed=Math.max(0,e.exposed-1);e.weakened=Math.max(0,e.weakened-1);}
  for(const {e,intent} of intents) {
    if(e.hp<=0)continue;
    const ally=allyFor(m,e);
    if(intent.buff && ally)ally.nextAttackBuff=Math.max(ally.nextAttackBuff,2);
    if(intent.shield && ally)ally.nextBlock=Math.max(ally.nextBlock,4);
    if(intent.expose)m.playerExposed=Math.max(m.playerExposed,1);
    if(intent.charging)e.charge=Math.max(0,Math.min(2,e.charge+1)-Math.floor(e.prepDamage/8));
    if(intent.strike)e.charge=0;
    if(intent.strike)e.exposed=Math.max(e.exposed,1);
  }
}
export function damageEnemy(run,e,power) {
  if(!e || e.hp<=0)return 0;
  const m=run.match;
  const amount=Math.floor(power*(e.exposed>0?1.5:1)), absorbed=Math.min(e.block,amount);
  e.block-=absorbed;
  const damage=Math.min(e.hp,amount-absorbed), before=e.prepDamage;
  e.hp-=damage;e.prepDamage+=damage;
  if(REGULAR_ENEMIES[e.opponentId].role==='charger' && (m.turn-1)%4===2) e.charge=Math.max(0,e.charge-(Math.floor(e.prepDamage/8)-Math.floor(before/8)));
  m.chance+=damage;m.damageDealt+=damage;run.stats.damage+=damage;
  syncEnemies(m);
  return damage;
}
export function enemyViews(m) {
  return m.enemies.map(e=>({...e,...REGULAR_ENEMIES[e.opponentId],id:e.id,maxHp:e.maxHp,roleLabel:ENEMY_ROLES[REGULAR_ENEMIES[e.opponentId].role],attack:regularAttack(m,e),intent:regularIntent(m,e),selected:e.id===m.targetId}));
}
export function validEnemyState(m, ids) {
  if(!Array.isArray(m.enemies)||m.enemies.length!==ids.length)return false;
  const initial=makeEnemies(ids), int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  for(let i=0;i<initial.length;i++) {
    const e=m.enemies[i], expected=initial[i];
    if(!e||e.id!==expected.id||e.opponentId!==expected.opponentId||e.maxHp!==expected.maxHp||!int(e.hp,0,e.maxHp))return false;
    if(!int(e.block,0,e.blockCap)||!int(e.blockCap,0,20)||!int(e.exposed,0,99)||!int(e.weakened,0,99)||!int(e.charge,0,2)||!int(e.prepDamage,0,e.maxHp)||!int(e.attackBuff,0,2)||e.nextAttackBuff!==0||e.nextBlock!==0)return false;
    if(REGULAR_ENEMIES[e.opponentId].role!=='charger'&&e.charge!==0)return false;
    if(e.supportTargetId!==null&&!m.enemies.some(other=>other.id===e.supportTargetId&&other.id!==e.id))return false;
  }
  const living=alive(m);
  if(living.length?!living.some(e=>e.id===m.targetId):m.targetId!==null)return false;
  const copy=JSON.parse(JSON.stringify(m));syncEnemies(copy);
  return ['enemyHp','enemyMaxHp','enemyBlock','enemyExposed','enemyWeakened'].every(key=>m[key]===copy[key])&&JSON.stringify(m.intent)===JSON.stringify(copy.intent);
}

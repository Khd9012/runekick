// Fixed, readable role patterns and curated pairs, with separate ACT identities.
export const ENEMY_ROLES = Object.freeze({attacker:'공격형',buffer:'버퍼형',technique:'기술형',defender:'방어형',charger:'축적형'});
export const REGULAR_ENEMIES = Object.freeze({
  school:{id:'school',name:'민준',role:'attacker',color:'#e29a74',maxHp:42,duoHp:28,mechanic:'빠른 공격 뒤 숨을 고릅니다. 먼저 쓰러뜨리면 매 턴 받는 공격이 줄어듭니다.'},
  rookie:{id:'rookie',name:'하준',role:'technique',color:'#bca1df',maxHp:44,duoHp:26,mechanic:'3턴마다 다음 턴에 적용되는 약점 노출을 부여합니다. 동료의 다음 공격에 대비하세요.'},
  press:{id:'press',name:'태오',role:'defender',color:'#83bce0',maxHp:48,duoHp:32,mechanic:'자신을 지키며 동료에게 다음 턴 방어를 제공합니다. 공격 대상은 자유롭게 고를 수 있습니다.'},
  'support-coach':{id:'support-coach',name:'지훈 코치',role:'buffer',color:'#8fc8a9',maxHp:22,duoHp:22,mechanic:'동료의 다음 턴 공격을 2 강화합니다. 중첩되지 않으며 혼자 남으면 약하게 공격합니다.'},
  'late-finisher':{id:'late-finisher',name:'건우',role:'charger',color:'#dfbd6e',maxHp:48,duoHp:30,mechanic:'충전 최대 2 후 강공합니다. 준비·강공 턴에 체력 피해 8마다 충전 1을 방해할 수 있습니다. 강공 뒤에는 빈틈이 열립니다.'},
  'pro-winger':{id:'pro-winger',actNumber:2,name:'서준 · 측면 돌파수',role:'attacker',color:'#db986d',maxHp:60,duoHp:37,mechanic:'4턴 주기의 강한 돌파 뒤 약점 노출 1턴. 숨을 고르는 순간을 노리세요.'},
  'pro-playmaker':{id:'pro-playmaker',actNumber:2,name:'유진 · 볼 배급자',role:'technique',color:'#ad9bd8',maxHp:58,duoHp:35,mechanic:'2번째 턴에 약점을 노출시키고 다음 턴 침투합니다. 4번째 턴에는 간격을 벌립니다.'},
  'pro-anchor':{id:'pro-anchor',actNumber:2,name:'도현 · 중원 지킴이',role:'defender',color:'#76accf',maxHp:64,duoHp:43,mechanic:'첫 턴 동료에게 다음 턴 방어 6. 강한 몸싸움 뒤에는 자신의 방어가 열립니다.'},
  'pro-coach':{id:'pro-coach',actNumber:2,name:'민석 · 전술 코치',role:'buffer',color:'#87b9a0',maxHp:34,duoHp:34,mechanic:'다음 턴 공격 +3과 다음 턴 방어 +5를 번갈아 지시합니다. 공격 강화는 중첩되지 않습니다.'},
  'pro-target':{id:'pro-target',actNumber:2,name:'태준 · 타깃맨',role:'charger',color:'#d0b066',maxHp:64,duoHp:40,disrupt:10,chargePower:4,mechanic:'충전당 헤더 피해 +4. 체력 피해 10마다 충전 1 방해. 강공 뒤 약점 노출 2턴.'},
  'euro-forward':{id:'euro-forward',actNumber:3,name:'레온 · 박스 침투수',role:'attacker',color:'#dda180',maxHp:73,duoHp:46,mechanic:'고속 침투와 마무리를 이어갑니다. 강한 마무리 뒤 약점 노출 2턴의 빈틈이 생깁니다.'},
  'euro-maestro':{id:'euro-maestro',actNumber:3,name:'루카 · 템포 설계자',role:'technique',color:'#b6a5df',maxHp:70,duoHp:42,mechanic:'첫 턴 약점 노출, 두 번째 턴 침투 뒤 재정비. 4번째 턴 동료의 다음 공격을 2 강화합니다.'},
  'euro-libero':{id:'euro-libero',actNumber:3,name:'마테오 · 스위퍼',role:'defender',color:'#8bb8d4',maxHp:78,duoHp:52,mechanic:'동료에게 다음 턴 방어 7을 제공하고 두 번째 턴 전진합니다. 재정비 턴에는 방어가 낮습니다.'},
  'euro-analyst':{id:'euro-analyst',actNumber:3,name:'니코 · 경기 분석관',role:'buffer',color:'#99baa9',maxHp:42,duoHp:42,mechanic:'공격 +3, 방어 +7, 약한 견제 순으로 지시합니다. 지원은 다음 턴에 적용되어 먼저 끊을 수 있습니다.'},
  'euro-aerial':{id:'euro-aerial',actNumber:3,name:'빅토르 · 공중 지배자',role:'charger',color:'#dfbf78',maxHp:76,duoHp:49,disrupt:12,chargePower:5,mechanic:'충전당 헤더 피해 +5. 체력 피해 12마다 충전 1 방해. 강공 뒤 약점 노출 2턴.'},
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
export const ACT_ENEMIES = Object.freeze({2:['pro-winger','pro-playmaker','pro-anchor','pro-coach','pro-target'],3:['euro-forward','euro-maestro','euro-libero','euro-analyst','euro-aerial']});
export function campaignComposition(seed,act,stage) {
  const [attack,technique,defender,buffer,charger]=ACT_ENEMIES[act];
  const pools={0:[[attack],[technique],[charger]],2:[[attack,buffer],[attack,defender],[technique,attack],[charger]],7:[[attack,buffer],[attack,defender],[technique,attack],[defender,charger],[attack,charger]]};
  const used=stage===0?[]:[campaignComposition(seed,act,0).join(','),...(stage===7?[campaignComposition(seed,act,2).join(',')]:[])];
  const pool=pools[stage].filter(ids=>!used.includes(ids.join(',')));
  let n=Math.imul(seed^(act*0x85ebca6b)^stage,0x7feb352d);n=Math.imul(n^(n>>>16),0x846ca68b);n=(n^(n>>>16))>>>0;
  return pool[n%pool.length].slice();
}
const enemyMaxHp=(id,duo,version)=>Math.round((duo?REGULAR_ENEMIES[id].duoHp:REGULAR_ENEMIES[id].maxHp)*(version===2?(REGULAR_ENEMIES[id].actNumber===3?1.1:REGULAR_ENEMIES[id].actNumber===2?1.06:1):1));
export function encounterMaxHp(ids,version) { return ids.reduce((sum,id)=>sum+enemyMaxHp(id,ids.length>1,version),0); }
export function makeEnemies(ids,version) {
  return ids.map((opponentId,i)=>({id:`e${i+1}`,opponentId,hp:enemyMaxHp(opponentId,ids.length>1,version),maxHp:enemyMaxHp(opponentId,ids.length>1,version),block:0,blockCap:0,exposed:0,weakened:0,charge:0,prepDamage:0,attackBuff:0,nextAttackBuff:0,nextBlock:0,supportTargetId:null}));
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
    const tier=(def.actNumber??1)-1,threshold=def.disrupt??8;
    result=p<2?{name:p?'충전 · 힘 모으기':'충전 · 몸싸움 준비',attack:(duo?2:3)+tier,defense:(p?4:3)+tier,charging:true,description:`충전 ${e.charge}/2 → 다음 턴 ${Math.max(0,Math.min(2,e.charge+1)-Math.floor(e.prepDamage/threshold))}/2 · 체력 피해 ${threshold}마다 충전 1 방해.`}:p===2?{name:'결정적 헤더',attack:(duo?5:8)+tier+e.charge*(def.chargePower??3),defense:0,strike:true,description:`강공 ${e.charge}/2 · 체력 피해 ${threshold}마다 충전 1 감소. 다음 턴 빈틈.`}:{name:'착지 후 빈틈',attack:duo?2:3,defense:0,recovery:true,description:'강공 후 충전 초기화. 방어 없이 재정비합니다.'};
  }
  if(def.actNumber>1 && def.role!=='charger') {
    const euro=def.actNumber===3,p=(m.turn-1)%4,extra=duo?0:3;
    if(def.role==='attacker')result=[{name:'측면 침투',attack:(euro?8:6)+extra,defense:0},{name:'과감한 마무리',attack:(euro?11:9)+extra,defense:0,selfExpose:euro?2:1,description:`공격 뒤 자신의 약점 노출 ${euro?2:1}턴. 다음 턴 반격할 기회입니다.`},{name:'돌파 후 숨 고르기',attack:3+extra,defense:1},{name:'재차 침투',attack:(euro?8:6)+extra,defense:0}][p];
    if(def.role==='technique')result=euro?[{name:'시야 흔들기',attack:4+extra,defense:2,expose:1},{name:'공간 침투',attack:7+extra,defense:0},{name:'템포 재정비',attack:3+extra,defense:3},{name:'결정적 패스',attack:3+extra,defense:0,buff:2}][p]:[{name:'볼 배급',attack:4+extra,defense:2},{name:'시선 유도',attack:3+extra,defense:1,expose:1},{name:'빈 공간 침투',attack:6+extra,defense:0},{name:'간격 벌리기',attack:2+extra,defense:4}][p];
    if(def.role==='defender')result=[{name:'수비 라인 엄호',attack:euro?4:3,defense:euro?8:7,shield:euro?7:6},{name:'전진 몸싸움',attack:euro?7:6,defense:2},{name:'수비 위치 복귀',attack:3,defense:2},{name:'단단한 대형',attack:euro?5:4,defense:euro?7:6}][p];
    if(def.role==='buffer')result=[{name:'공격 전술 지시',attack:0,defense:0,buff:3},{name:'수비 전술 지시',attack:0,defense:2,shield:euro?7:5},{name:'짧은 견제',attack:euro?4:3,defense:2},{name:'동료 격려',attack:0,defense:0,buff:euro?3:2}][p];
    if(result.expose)result.description='공격 후 약점 노출 1턴. 다음 턴 상대 공격 피해 +50%.';
  }
  result={...result,attack:result.attack+pressure+(m.challengeVersion===2&&result.attack>0?Math.max(0,(def.actNumber??1)-1):0)};
  const ally=allyFor(m,e);
  if(result.buff) {
    const planned=m.enemies.find(other=>other.id===e.supportTargetId);
    if(planned) result.description=planned.hp>0?`${REGULAR_ENEMIES[planned.opponentId].name}의 다음 턴 공격 +${result.buff} · 중첩 불가`:'지원 대상 퇴장 · 이번 전술 지시 취소';
    else {result={name:def.actNumber>1?'단독 견제':'홀로 남은 코치',attack:3+pressure+(def.actNumber??1)-1,defense:0,description:'지원할 동료가 없어 약하게 공격합니다.'};}
  }
  if(result.shield) result.description=ally?`${REGULAR_ENEMIES[ally.opponentId].name}에게 다음 턴 방어 +${result.shield}`:'자신의 방어를 유지하며 견제합니다.';
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
    if(intent.buff && ally)ally.nextAttackBuff=Math.max(ally.nextAttackBuff,intent.buff);
    if(intent.shield && ally)ally.nextBlock=Math.max(ally.nextBlock,intent.shield);
    if(intent.expose)m.playerExposed=Math.max(m.playerExposed,1);
    if(intent.selfExpose)e.exposed=Math.max(e.exposed,intent.selfExpose);
    if(intent.charging)e.charge=Math.max(0,Math.min(2,e.charge+1)-Math.floor(e.prepDamage/(REGULAR_ENEMIES[e.opponentId].disrupt??8)));
    if(intent.strike)e.charge=0;
    if(intent.strike)e.exposed=Math.max(e.exposed,REGULAR_ENEMIES[e.opponentId].actNumber>1?2:1);
  }
}
export function damageEnemy(run,e,power) {
  if(!e || e.hp<=0)return 0;
  const m=run.match;
  const amount=Math.floor(power*(e.exposed>0?1.5:1)), absorbed=Math.min(e.block,amount);
  e.block-=absorbed;
  const damage=Math.min(e.hp,amount-absorbed), before=e.prepDamage;
  e.hp-=damage;e.prepDamage+=damage;
  const threshold=REGULAR_ENEMIES[e.opponentId].disrupt??8;
  if(REGULAR_ENEMIES[e.opponentId].role==='charger' && (m.turn-1)%4===2) e.charge=Math.max(0,e.charge-(Math.floor(e.prepDamage/threshold)-Math.floor(before/threshold)));
  m.chance+=damage;m.damageDealt+=damage;run.stats.damage+=damage;
  syncEnemies(m);
  return damage;
}
export function enemyViews(m) {
  return m.enemies.map(e=>({...e,...REGULAR_ENEMIES[e.opponentId],id:e.id,maxHp:e.maxHp,roleLabel:ENEMY_ROLES[REGULAR_ENEMIES[e.opponentId].role],attack:regularAttack(m,e),intent:regularIntent(m,e),selected:e.id===m.targetId}));
}
export function validEnemyState(m, ids) {
  if(!Array.isArray(m.enemies)||m.enemies.length!==ids.length)return false;
  const initial=makeEnemies(ids,m.challengeVersion), int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
  for(let i=0;i<initial.length;i++) {
    const e=m.enemies[i], expected=initial[i];
    if(!e||e.id!==expected.id||e.opponentId!==expected.opponentId||e.maxHp!==expected.maxHp||!int(e.hp,0,e.maxHp))return false;
    if(!int(e.block,0,e.blockCap)||!int(e.blockCap,0,20)||!int(e.exposed,0,99)||!int(e.weakened,0,99)||!int(e.charge,0,2)||!int(e.prepDamage,0,e.maxHp)||!int(e.attackBuff,0,REGULAR_ENEMIES[e.opponentId].actNumber>1?3:2)||e.nextAttackBuff!==0||e.nextBlock!==0)return false;
    if(REGULAR_ENEMIES[e.opponentId].role!=='charger'&&e.charge!==0)return false;
    if(e.supportTargetId!==null&&!m.enemies.some(other=>other.id===e.supportTargetId&&other.id!==e.id))return false;
  }
  const living=alive(m);
  if(living.length?!living.some(e=>e.id===m.targetId):m.targetId!==null)return false;
  const copy=JSON.parse(JSON.stringify(m));syncEnemies(copy);
  return ['enemyHp','enemyMaxHp','enemyBlock','enemyExposed','enemyWeakened'].every(key=>m[key]===copy[key])&&JSON.stringify(m.intent)===JSON.stringify(copy.intent);
}

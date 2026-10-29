// Campaign progression is opt-in: old runs retain their original one-ACT route.
export const ACTS = Object.freeze([
  {number:1,roman:'I',name:'유소년',subtitle:'작은 훈련장에서 나만의 플레이를 완성하세요.'},
  {number:2,roman:'II',name:'프로리그',subtitle:'프로의 압박과 조직적인 협력에 맞서세요.'},
  {number:3,roman:'III',name:'유럽대항전',subtitle:'유럽의 강호를 넘어 마지막 트로피에 도전하세요.'},
].map(Object.freeze));
export const ACT_STAGE_COUNT = 12;
export const LEGACY_CAMPAIGN_BOSSES = Object.freeze([
  Object.freeze(['coach-wenger','coach-arteta']),
  Object.freeze(['coach-mourinho','coach-klopp','coach-ferguson']),
  Object.freeze(['coach-guardiola','coach-ancelotti']),
]);
export const CAMPAIGN_BOSSES = Object.freeze([
  Object.freeze(['coach-wenger','coach-arteta','coach-dezerbi']),
  Object.freeze(['coach-mourinho','coach-klopp','coach-simeone']),
  Object.freeze(['coach-ferguson','coach-guardiola','coach-ancelotti']),
]);
export const LEGACY_COACH_IDS = Object.freeze(['coach-mourinho','coach-ancelotti','coach-guardiola','coach-arteta','coach-wenger','coach-ferguson','coach-klopp']);
export function campaignActAt(index) { return Math.min(3,Math.floor(index/ACT_STAGE_COUNT)+1); }
export function getActView(run) {
  const campaign=run?.campaignVersion===1,number=campaign?campaignActAt(run.routeIndex):1;
  const startIndex=campaign?(number-1)*ACT_STAGE_COUNT:0;
  const stageCount=campaign?ACT_STAGE_COUNT:(run?.route?.length??ACT_STAGE_COUNT);
  return {...ACTS[number-1],startIndex,endIndex:startIndex+stageCount,
    localIndex:Math.min(stageCount,(run?.routeIndex??0)-startIndex),stageCount,totalActs:campaign?3:1,
    completed:run?.phase==='act-clear'?number-1:run?.phase==='victory'?number:null};
}
export function campaignSeed(seed,act) { return act===1?seed:(Math.imul(seed ^ (act*0x9e3779b9),1664525)+1013904223)>>>0; }
export function scaledOpponentHp(base,act=1,challengeVersion) { return Math.round(base*((challengeVersion===2?[1,1.3,1.65]:[1,1.2,1.45])[act-1]??1)); }
export function campaignReward(stage,type,base) {
  const act=campaignActAt(stage),local=stage%ACT_STAGE_COUNT;
  if(type==='match')return (local===0?25:local===7?35:30)+(act-1)*10;
  return base+(act-1)*(type==='boss'?20:15);
}

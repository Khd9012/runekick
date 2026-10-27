// Version 2 striker rules. Data is shared by card text, execution and previews.
const rows = [
  ['shot','정확한 슈팅','shot',1,'common','shared',{damage:9,momentum:'all',ratio:1},{damage:13}],
  ['cover','안정된 자세','defense',1,'common','shared',{block:8},{block:12}],
  ['quick-pass','가벼운 터치','pass',0,'common','shared',{damage:2},{damage:4}],
  ['read-opening','빈틈 포착','tactic',1,'common','shared',{exposed:2},{exposed:3}],
  ['checking-tackle','견제 태클','defense',1,'common','shared',{block:5,weakened:1},{block:8,weakened:2}],
  ['breathing','호흡 정리','tactic',1,'common','shared',{choice:'discard',draw:2},{draw:3}],
  ['judgment-training','순간 판단 훈련','training',0,'uncommon','shared',{draw:2,volatile:true},{draw:3}],
  ['read-flow','흐름 읽기','tactic',1,'uncommon','shared',{choice:'peek',choose:1},{choose:2}],
  ['emergency-stance','비상 자세','defense',0,'uncommon','shared',{block:12,energyDebt:1},{block:16}],
  ['dribble','전진 드리블','dribble',1,'common','power',{damage:5,gainMomentum:1},{damage:8}],
  ['power-shot','파워 슈팅','shot',2,'common','power',{damage:16,momentum:'all',ratio:1},{damage:21}],
  ['controlled-shot','힘 조절 슈팅','shot',1,'common','power',{damage:7,momentum:2,ratio:2},{damage:10}],
  ['explosion-training','폭발력 훈련','training',0,'uncommon','power',{gainMomentum:3,volatile:true},{gainMomentum:4}],
  ['acceleration-training','순간 가속 훈련','training',1,'uncommon','power',{persistent:'acceleration',volatile:true},{cost:0}],
  ['plant-foot','디딤발 고정','defense',1,'uncommon','power',{block:6,nextShot:5},{block:9,nextShot:7}],
  ['overswing','오버스윙','shot',2,'uncommon','power',{damage:26,momentum:'all',ratio:1,injury:'abrasion'},{damage:32}],
  ['volley','발리 슈팅','shot',2,'rare','power',{damage:12,momentum:'all',ratio:3},{damage:16}],
  ['knuckle-shot','무회전 슈팅','shot',2,'rare','power',{damage:14,momentum:'all',ratio:1,breakBlock:8},{damage:18,breakBlock:12}],
  ['feint','바디 페인트','dribble',1,'common','technique',{damage:5,comboBlock:4},{damage:7,comboBlock:6}],
  ['double-touch','더블 터치','pass',1,'common','technique',{damage:3,hits:2,comboHits:1},{damage:4}],
  ['one-two','리듬 체인지','pass',1,'common','technique',{damage:6,comboDraw:1},{damage:8}],
  ['retrieve-ball','볼 끌어오기','tactic',1,'uncommon','technique',{choice:'retrieve'},{retrievedDamage:3}],
  ['control-training','볼 컨트롤 훈련','training',1,'uncommon','technique',{persistent:'control',volatile:true},{cost:0}],
  ['deceptive-move','속임 동작','dribble',1,'uncommon','technique',{damage:4,exposed:1,comboWeakened:1},{damage:6,comboWeakened:2}],
  ['reckless-chain','무리한 연속기','pass',2,'uncommon','technique',{damage:5,hits:5,selfExposed:1},{damage:6}],
  ['marseille-turn','마르세유 턴','dribble',2,'rare','technique',{damage:5,hits:3,comboHits:1},{damage:6}],
  ['elastico','엘라스티코','dribble',1,'rare','technique',{damage:6,distinctBonus:4,volatile:true},{damage:8,distinctBonus:5}],
  ['positioning','자리 선점','defense',1,'common','aerial',{block:7,nextHeader:3},{block:10,nextHeader:4}],
  ['aerial-duel','공중볼 경합','header',1,'common','aerial',{damage:5,block:5},{damage:7,block:7}],
  ['redirect-header','방향을 바꾸는 헤더','header',1,'common','aerial',{damage:6,spendBlock:4,blockRatio:2},{damage:9}],
  ['duel-training','경합 훈련','training',1,'uncommon','aerial',{block:14,volatile:true},{block:18}],
  ['aerial-training','제공권 훈련','training',1,'uncommon','aerial',{persistent:'aerial',carry:4,volatile:true},{carry:6}],
  ['landing','착지 정비','defense',1,'uncommon','aerial',{block:7,afterHeader:5},{block:10,afterHeader:6}],
  ['diving-header','다이빙 헤더','header',1,'uncommon','aerial',{damage:12,spendBlock:6,blockRatio:2,injury:'ankle-pain'},{damage:16}],
  ['power-header','찍어 누르는 헤더','header',2,'rare','aerial',{damage:10,spendBlock:10,blockRatio:3},{damage:14}],
  ['suppressing-header','제압 헤더','header',1,'rare','aerial',{damage:8,weakened:1,guardThreshold:8,guardBonus:4},{damage:11,weakened:2}],
];
export const INJURIES = Object.freeze({
  'stiff-muscle': {name:'근육 뭉침',text:'사용 불가. 손패 한 자리를 차지합니다.'},
  abrasion: {name:'찰과상',text:'사용 불가. 턴 종료 시 손에 있으면 체력 1 소모. 방어 무시.'},
  'ankle-pain': {name:'발목 통증',text:'사용 불가. 턴 종료 시 손에 있으면 방어 2 감소. 상대 행동 전에 적용.'},
});
export function cardEffect(card) {
  const def = CARDS[card?.id];
  return def ? {...def.effect, ...(card.upgraded ? def.upgrade : {})} : {};
}
export function cardCost(card, match) {
  const def = CARDS[card?.id];
  if (!def || def.type === 'injury') return Infinity;
  const base = card.upgraded ? def.upgradedCost : def.cost;
  return Math.max(0, base - (match?.discounts?.[card.uid] ? 1 : 0));
}
export const isTechnique = card => ['pass','dribble'].includes(CARDS[card?.id]?.type);
export function isCombo(match, card) {
  const previous = match.played.at(-1);
  return isTechnique(card) && isTechnique(previous) && previous.id !== card.id;
}
export function cardText(card) {
  if (INJURIES[card?.id]) return INJURIES[card.id].text;
  const e = cardEffect(card), lines = [];
  if (!CARDS[card?.id]) return '알 수 없는 카드';
  if (e.damage) lines.push(`피해 ${e.damage}${e.hits ? ` × ${e.hits}회` : ''}.`);
  if (e.momentum) lines.push(`기세 ${e.momentum === 'all' ? '모두' : `최대 ${e.momentum}`} 소모, 1당 피해 +${e.ratio}.`);
  if (e.spendBlock) lines.push(`공격 전에 방어 최대 ${e.spendBlock} 소모, 1당 피해 +${e.blockRatio}.`);
  if (e.block) lines.push(`${CARDS[card.id].type === 'header' ? '공격 후 ' : ''}이번 턴 방어 +${e.block}.`);
  if (e.gainMomentum) lines.push(`기세 +${e.gainMomentum}. 턴이 끝나도 유지.`);
  if (e.exposed) lines.push(`${e.damage ? '공격 후 ' : ''}약점 노출 ${e.exposed}턴 (받는 피해 +50%).`);
  if (e.weakened) lines.push(`공격 약화 ${e.weakened}턴 (공격 피해 −25%).`);
  if (e.choice === 'discard') lines.push(`다른 손패 1장 버리고 ${e.draw}장 뽑기. 다른 손패가 없으면 바로 뽑기.`);
  else if (e.draw) lines.push(`카드 ${e.draw}장 뽑기.`);
  if (e.choice === 'peek') lines.push(`뽑을 더미 위 3장 중 ${e.choose}장 선택. 나머지는 기존 순서로 되돌리기.`);
  if (e.choice === 'retrieve') lines.push(`버린 터치·드리블 1장을 손으로. 이번 턴 비용 −1 (중복 감소 불가)${e.retrievedDamage ? `, 피해 +${e.retrievedDamage}` : ''}.`);
  if (e.energyDebt) lines.push('다음 턴 에너지 −1 (최소 0).');
  if (e.persistent === 'acceleration') lines.push('이번 전투 동안 매 턴 처음 기세를 얻는 카드의 기세 +1. 중첩 불가.');
  if (e.persistent === 'control') lines.push('이번 전투 동안 매 턴 첫 연계 시 카드 1장 뽑기. 중첩 불가.');
  if (e.persistent === 'aerial') lines.push(`이번 전투 동안 상대 행동 후 남은 방어를 최대 ${e.carry}까지 다음 턴으로 유지. 중첩 불가.`);
  if (e.nextShot) lines.push(`이번 턴 다음 슈팅 피해 +${e.nextShot}.`);
  if (e.nextHeader) lines.push(`이번 턴 다음 헤더 피해 +${e.nextHeader}.`);
  if (e.breakBlock) lines.push(`기세 3 이상 소모 시 공격 전에 상대 방어 ${e.breakBlock} 제거.`);
  if (e.comboBlock) lines.push(`연계: 방어 +${e.comboBlock}.`);
  if (e.comboHits) lines.push(`연계: ${e.comboHits}회 추가 타격.`);
  if (e.comboDraw) lines.push(`연계: 카드 ${e.comboDraw}장 뽑기.`);
  if (e.comboWeakened) lines.push(`연계: 공격 약화 ${e.comboWeakened}턴 추가.`);
  if (e.selfExposed) lines.push('내 약점 노출 1턴. 다음 상대 공격 피해 +50%.');
  if (e.distinctBonus) lines.push(`이번 턴 앞서 사용한 서로 다른 터치·드리블 이름당 피해 +${e.distinctBonus} (최대 4종).`);
  if (e.afterHeader) lines.push(`이번 턴 헤더를 썼다면 방어 +${e.afterHeader}.`);
  if (e.guardThreshold) lines.push(`방어 ${e.guardThreshold} 이상이면 피해 +${e.guardBonus}. 방어 소모 없음.`);
  if (e.injury) lines.push(`이번 전투의 뽑을 더미에 ${INJURIES[e.injury].name} 1장 추가.`);
  if (e.volatile) lines.push('휘발성: 사용 후 이번 전투에서 소멸.');
  return lines.join(' ');
}
const catalog = Object.fromEntries(rows.map(([id,name,type,cost,rarity,style,effect,upgrade]) => [id,{id,name,type,cost,rarity,style,effect:Object.freeze(effect),upgrade:Object.freeze(upgrade),upgradedCost:upgrade.cost ?? cost}]));
for (const [id, injury] of Object.entries(INJURIES)) catalog[id] = {id,name:injury.name,type:'injury',cost:null,upgradedCost:null,rarity:'injury',style:'injury',effect:{},upgrade:{}};
export const CARDS = Object.freeze(catalog);
for (const def of Object.values(catalog)) { def.description = cardText({id:def.id}); def.upgradedDescription = cardText({id:def.id,upgraded:true}); Object.freeze(def); }
export const PLAYABLE_IDS = Object.freeze(rows.map(row => row[0]));
export const REWARD_IDS = Object.freeze(PLAYABLE_IDS.filter(id => !['shot','cover','quick-pass'].includes(id)));
export const STARTER_DECK = Object.freeze(['shot','shot','shot','cover','cover','cover','quick-pass','quick-pass','dribble','redirect-header']);
export const CARD_PRICES = Object.freeze({common:70,uncommon:150,rare:320});
export function rewardPool(run, rarity) {
  return REWARD_IDS.filter(id => (!rarity || CARDS[id].rarity === rarity) && !(CARDS[id].effect.persistent && run.deck.some(card => card.id === id)));
}

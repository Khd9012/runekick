// Deterministic personal duels. Player HP persists through the journey.
const definitions = [
  ['through-pass', '빈틈 파고들기', 'pass', 1, 'common', [7, 10]],
  ['quick-pass', '가벼운 터치', 'pass', 0, 'common', [2, 4]],
  ['one-two', '리듬 체인지', 'pass', 1, 'uncommon', [5, 8]],
  ['dribble', '전진 드리블', 'dribble', 1, 'common', [4, 6]],
  ['feint', '바디 페인트', 'dribble', 1, 'common', [3, 5]],
  ['sprint', '전력 질주', 'dribble', 0, 'uncommon', [3, 5]],
  ['shot', '정확한 슈팅', 'shot', 1, 'common', [9, 13]],
  ['power-shot', '파워 슈팅', 'shot', 2, 'uncommon', [16, 21]],
  ['volley', '발리 슈팅', 'shot', 2, 'rare', [11, 15]],
  ['cover', '안정된 자세', 'defense', 1, 'common', [8, 12]],
  ['intercept', '흐름 끊기', 'defense', 1, 'common', [5, 8]],
  ['tackle', '슬라이딩 태클', 'defense', 2, 'uncommon', [15, 20]],
  ['focus', '집중의 순간', 'tactic', 0, 'uncommon', [1, 2]],
  ['switch', '균형 잡기', 'tactic', 1, 'common', [5, 8]],
  ['captain', '승부욕', 'tactic', 2, 'rare', [9, 13]],
  ['clutch', '마지막 한 발', 'shot', 0, 'uncommon', [4, 7]],
  ['wall-pass', '발끝 컨트롤', 'pass', 1, 'uncommon', [6, 8]],
  ['long-pass', '폭발적인 돌파', 'pass', 2, 'rare', [13, 16]],
  ['read-opening', '빈틈 포착', 'tactic', 1, 'common', [2, 3]],
  ['lure-dribble', '유인 드리블', 'dribble', 1, 'uncommon', [3, 4]],
  ['unsettling-shot', '흔드는 슈팅', 'shot', 1, 'common', [6, 9]],
  ['high-press', '전방 압박', 'tactic', 1, 'common', [2, 3]],
  ['checking-tackle', '견제 태클', 'defense', 1, 'uncommon', [5, 8]],
  ['close-mark', '집요한 마크', 'pass', 1, 'uncommon', [5, 8]],
];
const numbers = Object.fromEntries(definitions.map(([id, , , , , values]) => [id, values]));
const amount = card => numbers[card.id]?.[card.upgraded ? 1 : 0] ?? 0;
const cost = card => card.id === 'power-shot' && card.upgraded ? 1 : CARDS[card.id]?.cost;
const shotText = ' 기세를 모두 소모하여 그만큼 추가 피해.';
export function cardText(card) {
  if (!card || !numbers[card.id]) return '알 수 없는 카드';
  const n = amount(card), up = !!card.upgraded;
  switch (card.id) {
    case 'through-pass': return `피해 ${n}.`;
    case 'quick-pass': case 'one-two': case 'long-pass': return `피해 ${n}. 카드 1장 뽑기.`;
    case 'dribble': return `피해 ${n}. 기세 +${up ? 3 : 2}. 기세는 턴이 끝나도 유지.`;
    case 'feint': return `피해 ${n}. 기세 +${up ? 6 : 4}. 기세는 턴이 끝나도 유지.`;
    case 'sprint': return `피해 ${n}. 기세 +2. 내 체력 ${up ? 1 : 3} 소모.`;
    case 'shot': return `피해 ${n}.` + shotText;
    case 'power-shot': return `피해 ${n}.` + shotText + (up ? ' 비용 1로 감소.' : '');
    case 'volley': return `피해 ${n}. 기세를 모두 소모하여 기세의 2배만큼 추가 피해.`;
    case 'cover': return `이번 턴 방어 +${n}.`;
    case 'intercept': return `이번 턴 방어 +${n}. 피해 3.`;
    case 'tackle': return `이번 턴 방어 +${n}. 카드 1장 뽑기.`;
    case 'focus': return `에너지 +${n} (최대 에너지까지). 이번 대결에서 소진.`;
    case 'switch': case 'captain': return `피해 ${n}. 이번 턴 방어 +${n}.`;
    case 'clutch': return `피해 ${n}. 5턴부터 피해 +${up ? 9 : 6}.` + shotText;
    case 'wall-pass': return `피해 ${n}. 기세 +${up ? 3 : 2}.`;
    case 'read-opening': return `약점 노출 ${n}턴. 상대가 받는 카드 피해 +50%.`;
    case 'lure-dribble': return `약점 노출 ${up ? 2 : 1}턴. 기세 +${n}. 기세는 턴이 끝나도 유지.`;
    case 'unsettling-shot': return `피해 ${n}. 공격 후 약점 노출 ${up ? 2 : 1}턴.` + shotText;
    case 'high-press': return `공격 약화 ${n}턴. 상대 공격 피해 −25%.`;
    case 'checking-tackle': return `이번 턴 방어 +${n}. 공격 약화 ${up ? 2 : 1}턴.`;
    case 'close-mark': return `피해 ${n}. 공격 후 공격 약화 ${up ? 2 : 1}턴.`;
    default: return '';
  }
}
export const CARDS = Object.freeze(Object.fromEntries(definitions.map(([id, name, type, energy, rarity]) =>
  [id, Object.freeze({ id, name, type, cost: energy, rarity, description: cardText({ id }), upgradedCost: id === 'power-shot' ? 1 : energy, upgradedDescription: cardText({ id, upgraded: true }) })]
)));
export const RELICS = Object.freeze({
  'swift-boots': { id: 'swift-boots', name: '바람의 축구화', category: 'boots', rarity: 'uncommon', description: '드리블 카드를 낼 때마다 기세 +1.', price: 45 },
  'power-cleats': { id: 'power-cleats', name: '번개 스터드', category: 'boots', rarity: 'rare', description: '슈팅 카드의 피해 +3.', price: 60 },
  'training-kit': { id: 'training-kit', name: '익숙한 훈련복', category: 'uniform', rarity: 'common', description: '매 턴 방어 3으로 시작.', price: 40 },
  'captain-band': { id: 'captain-band', name: '불굴의 손목 밴드', category: 'band', rarity: 'rare', description: '최대 체력 +15. 구매 즉시 체력 15 회복.', price: 60 },
  'grip-socks': { id: 'grip-socks', name: '단단한 그립 양말', category: 'socks', rarity: 'common', description: '매 턴 처음 사용하는 방어 카드의 방어 +2.', price: 35 },
  'scouting-bag': { id: 'scouting-bag', name: '오래된 축구 가방', category: 'bag', rarity: 'uncommon', description: '매 턴 카드를 1장 더 뽑기.', price: 55 },
  'energy-flask': { id: 'energy-flask', name: '회복 보틀', category: 'bottle', rarity: 'rare', description: '최대 에너지 +1. 매 턴 전부 회복.', price: 75 },
  'lucky-coin': { id: 'lucky-coin', name: '행운의 첫 동전', category: 'charm', rarity: 'common', description: '대결 승리 보상 코인 +10.', price: 35 },
  'golden-whistle': { id: 'golden-whistle', name: '스카우트의 호루라기', category: 'whistle', rarity: 'uncommon', description: '대결에서 승리할 때마다 내 체력 5 회복.', price: 45 },
  'libero-seal': { id: 'libero-seal', name: '리베로의 증표', category: 'medal', rarity: 'legendary', shop: false, description: '매 턴 첫 드리블 카드 사용 시 방어 +4. 전설의 수비수를 꺾어 획득.', price: 0 },
  'catenaccio-band': { id: 'catenaccio-band', name: '카테나치오 밴드', category: 'band', rarity: 'legendary', shop: false, description: '매 턴 첫 수비 카드의 방어 +3.', price: 0 },
  'clean-sheet-crest': { id: 'clean-sheet-crest', name: '무실점의 문장', category: 'medal', rarity: 'legendary', shop: false, description: '턴 종료 시 상대에게 받은 피해가 0이면 내 체력 2 회복.', price: 0 },
  'maestro-touch': { id: 'maestro-touch', name: '마에스트로의 터치', category: 'charm', rarity: 'legendary', shop: false, description: '매 턴 첫 터치 카드 사용 시 기세 +2.', price: 0 },
  'roulette-rune': { id: 'roulette-rune', name: '룰렛의 룬', category: 'charm', rarity: 'legendary', shop: false, description: '매 턴 첫 전술 카드 사용 시 카드 1장 뽑기.', price: 0 },
  'playmaker-lens': { id: 'playmaker-lens', name: '플레이메이커의 시선', category: 'charm', rarity: 'legendary', shop: false, description: '매 턴 첫 슈팅을 쓸 때 기세가 3 이상이면 피해 +4.', price: 0 },
  'fenom-cleats': { id: 'fenom-cleats', name: '페노메노의 스터드', category: 'boots', rarity: 'legendary', shop: false, description: '매 턴 첫 슈팅 카드의 피해 +5.', price: 0 },
  'nine-crest': { id: 'nine-crest', name: '넘버 나인의 문장', category: 'medal', rarity: 'legendary', shop: false, description: '카드를 쓰기 전 상대 체력이 절반 이하라면 슈팅 피해 +3.', price: 0 },
  'burst-laces': { id: 'burst-laces', name: '폭발적인 가속의 끈', category: 'socks', rarity: 'legendary', shop: false, description: '매 대결을 기세 3으로 시작합니다.', price: 0 },
  'street-rhythm': { id: 'street-rhythm', name: '거리의 리듬', category: 'charm', rarity: 'legendary', shop: false, description: '매 턴 첫 드리블 카드 사용 시 기세 +2.', price: 0 },
  'ankle-tape': { id: 'ankle-tape', name: '흔들리지 않는 발목', category: 'socks', rarity: 'legendary', shop: false, description: '매 턴 첫 터치 카드 사용 시 방어 +3.', price: 0 },
  'tempo-charm': { id: 'tempo-charm', name: '템포의 부적', category: 'charm', rarity: 'legendary', shop: false, description: '한 턴에 드리블과 슈팅을 모두 쓰면 한 번만 에너지 +1. 최대 에너지까지 회복.', price: 0 },
});
export const STARTER_RELICS = Object.freeze(['power-cleats', 'swift-boots', 'training-kit']);
export const CARD_REMOVAL_BASE_COST = 50;
export function getCardRemovalCost(run) { return CARD_REMOVAL_BASE_COST + 25 * (run?.shopRemovalCount ?? 0); }
export const ELITE_RELICS = Object.freeze({
  legend: Object.freeze(['libero-seal', 'catenaccio-band', 'clean-sheet-crest']),
  'legend-zidane': Object.freeze(['maestro-touch', 'roulette-rune', 'playmaker-lens']),
  'legend-ronaldo': Object.freeze(['fenom-cleats', 'nine-crest', 'burst-laces']),
  elite: Object.freeze(['street-rhythm', 'ankle-tape', 'tempo-charm']),
});
export const OPPONENTS = Object.freeze({
  school: { id: 'school', name: '민준', subtitle: '재빠른 윙어 · 첫 번째 라이벌', color: '#70c9e8', maxHp: 42, reward: 25,
    patterns: [['가벼운 견제', 7, 2], ['빠른 발놀림', 9, 0], ['거리 재기', 6, 4], ['전력 돌파', 11, 0]] },
  rookie: { id: 'rookie', name: '하준', subtitle: '성실한 유소년 · 두 번째 도전자', color: '#a6c786', maxHp: 46, reward: 30,
    patterns: [['기본기 대결', 8, 2], ['과감한 도전', 10, 0], ['숨 고르기', 5, 4], ['마지막 스퍼트', 11, 1]] },
  press: { id: 'press', name: '태오', subtitle: '끈질긴 수비수 · 골목의 벽', color: '#f1ac59', maxHp: 52, reward: 35,
    patterns: [['바짝 붙기', 10, 4], ['압박 전진', 12, 2], ['단단한 자세', 8, 7], ['거친 돌진', 13, 3]] },
  elite: { id: 'elite', name: '도윤', subtitle: '거리의 드리블러 · 특별 평가전', color: '#f07d72', maxHp: 66, reward: 45, eliteRelics: ELITE_RELICS.elite,
    patterns: [['현란한 스텝', 13, 4], ['순간 가속', 15, 2], ['빈틈 봉쇄', 10, 8], ['날카로운 돌파', 16, 3]] },
  legend: { id: 'legend', name: '파올로 말디니', subtitle: '레전드 수비수 · 완벽한 위치 선정', legend: true, color: '#b5c7de', maxHp: 72, reward: 65, eliteRelics: ELITE_RELICS.legend,
    patterns: [['철벽의 태세', 6, 12], ['읽어낸 역습', 18, 4], ['잠깐의 빈틈', 7, 0]] },
  'legend-zidane': { id: 'legend-zidane', name: '지네딘 지단', subtitle: '레전드 플레이메이커 · 읽어내는 연계', legend: true, color: '#c7b9ed', maxHp: 70, reward: 65, eliteRelics: ELITE_RELICS['legend-zidane'],
    mechanic: '높은 방어 뒤 연계 공격을 준비합니다. 4턴마다 연계 공격 +2. 방어가 열린 호흡 고르기를 노리세요.',
    patterns: [['경기 읽기', 8, 10], ['루렛 연계', 12, 6], ['완성된 연계', 16, 2], ['호흡 고르기', 7, 0]] },
  'legend-ronaldo': { id: 'legend-ronaldo', name: '호나우두', subtitle: '레전드 스트라이커 · 폭발적인 가속', legend: true, color: '#ead07b', maxHp: 68, reward: 65, eliteRelics: ELITE_RELICS['legend-ronaldo'],
    mechanic: '가속 페인트 다음에는 강력한 페노메노 돌파가 옵니다. 낮은 방어를 노리고 강공을 대비하세요.',
    patterns: [['폭발을 준비', 9, 2], ['가속 페인트', 12, 1], ['페노메노 돌파', 21, 0], ['숨 고르기', 6, 0]] },
  champion: { id: 'champion', name: '서진', subtitle: '유소년 에이스 · 최종 선발전', color: '#d5b573', maxHp: 85, reward: 60,
    patterns: [['에이스의 견제', 15, 5], ['폭발적인 가속', 18, 2], ['완벽한 자세', 11, 9], ['결정적인 한 발', 20, 3]] },
  'coach-mourinho': { id: 'coach-mourinho', name: '무리뉴', subtitle: '감독 보스 · 철벽과 역습', coach: true, color: '#7f99ba', maxHp: 92, reward: 60,
    intro: '빈틈 하나면 충분하지.', mechanic: '두 번의 단단한 수비 뒤 강력한 역습. 역습 전 방어를 준비하세요.',
    patterns: [['낮은 블록', 9, 11], ['두 겹 수비', 11, 9], ['빠른 역습', 21, 2], ['재정비', 8, 5]] },
  'coach-ancelotti': { id: 'coach-ancelotti', name: '안첼로티', subtitle: '감독 보스 · 노련한 전환', coach: true, color: '#c3b39a', maxHp: 90, reward: 60,
    intro: '상황에 맞는 답은 언제나 있지.', mechanic: '전술 완성도가 절반 이하가 되면 다음 턴부터 역습 패턴으로 전환합니다.',
    patterns: [['차분한 운영', 12, 6], ['균형 유지', 14, 5], ['조직 수비', 10, 8]],
    secondPatterns: [['자유로운 전환', 17, 4], ['결정적 역습', 20, 2], ['노련한 관리', 11, 8]] },
  'coach-guardiola': { id: 'coach-guardiola', name: '펩 과르디올라', subtitle: '감독 보스 · 압박과 통제', coach: true, color: '#8ebabc', maxHp: 90, reward: 60,
    intro: '공간을 읽고, 다음 수를 준비하게.', mechanic: '강한 압박과 높은 방어를 번갈아 사용합니다.',
    patterns: [['전방 압박', 19, 2], ['공간 통제', 10, 10], ['빠른 연결', 16, 4], ['위치 재정렬', 10, 6]] },
  'coach-arteta': { id: 'coach-arteta', name: '아르테타', subtitle: '감독 보스 · 준비된 한 수', coach: true, color: '#c99d83', maxHp: 88, reward: 60,
    intro: '준비한 장면을 완성할 시간이다.', mechanic: '준비 턴 다음에 세트피스 강타가 옵니다. 공격 예고를 놓치지 마세요.',
    patterns: [['세트피스 준비', 8, 9], ['세트피스 강타', 23, 2], ['대형 회복', 10, 5]] },
  'coach-wenger': { id: 'coach-wenger', name: '벵거', subtitle: '감독 보스 · 이어지는 연계', coach: true, color: '#9db796', maxHp: 86, reward: 60,
    intro: '너만의 창의적인 해답을 보여주게.', mechanic: '두 턴마다 연계 공격이 2씩 강해집니다.',
    patterns: [['유기적인 연결', 10, 4], ['공간 침투', 12, 3], ['기술적인 정비', 8, 7]] },
  'coach-ferguson': { id: 'coach-ferguson', name: '퍼거슨', subtitle: '감독 보스 · 끝까지 몰아붙이는 힘', coach: true, color: '#c18b8a', maxHp: 92, reward: 60,
    intro: '끝났다고 생각한 순간이 시작이지.', mechanic: '5턴부터 모든 공격이 4 강해집니다.',
    patterns: [['주도권 싸움', 13, 4], ['직선적인 전진', 15, 3], ['집중력 유지', 10, 7]] },
  'coach-klopp': { id: 'coach-klopp', name: '클롭', subtitle: '감독 보스 · 폭발적인 압박', coach: true, color: '#d7ad72', maxHp: 88, reward: 60,
    intro: '멈추지 마. 다음 움직임으로 답해!', mechanic: '초반 두 턴의 강공 뒤 방어가 열린 틈을 노리세요.',
    patterns: [['전면 압박', 21, 1], ['연속 압박', 18, 2], ['숨 고르는 틈', 7, 0], ['다시 정렬', 9, 4]] },
});
export const ROUTE = Object.freeze([
  { id: 'opening', name: '첫 번째 도전', choices: [{ id: 'opening-match', type: 'match', name: '민준과의 일대일', description: '빠른 발을 가진 민준과 첫 대결을 펼칩니다.', opponentId: 'school' }] },
  { id: 'prepare', name: '나만의 플레이', choices: [
    { id: 'first-training', type: 'training', name: '훈련장', description: '개인 훈련으로 카드 1장을 강화하거나 덱에서 제거합니다.' },
    { id: 'first-rest', type: 'rest', name: '라커룸', description: '잠시 쉬어 내 체력을 30 회복합니다.' }] },
  { id: 'qualifier', name: '벽을 넘어서', choices: [{ id: 'press-match', type: 'match', name: '태오의 도전장', description: '끈질긴 수비수 태오의 방어를 무너뜨리세요.', opponentId: 'press' }] },
  { id: 'crossroads', name: '길 위의 선택', choices: [
    { id: 'market', type: 'shop', name: '동네 스포츠점', description: '이 갈림길에서만 들를 수 있는 상점. 모은 코인으로 유물을 구매합니다.' },
    { id: 'scout-event', type: 'event', name: '뜻밖의 스카우트', description: '안전한 휴식 또는 체력을 쓰는 추가 테스트를 선택합니다.' }] },
  { id: 'semifinal', name: '나를 증명할 시간', choices: [
    { id: 'elite-match', type: 'elite', name: '도윤과의 특별 대결', description: '강력한 드리블러를 꺾고 희귀 카드 보상을 노립니다.', opponentId: 'elite' },
    { id: 'semifinal-rest', type: 'rest', name: '라커룸', description: '특별 대결 대신 쉬어 내 체력을 30 회복합니다.' }] },
  { id: 'last-preparation', name: '경기 전날', choices: [
    { id: 'final-training', type: 'training', name: '훈련장', description: '마지막 개인 훈련으로 카드 1장을 강화하거나 덱에서 제거합니다.' },
    { id: 'final-rest', type: 'rest', name: '라커룸', description: '최종 대결 전에 쉬어 내 체력을 30 회복합니다.' }] },
  { id: 'final', name: '에이스를 향한 한 발', choices: [{ id: 'championship', type: 'boss', name: '서진과의 최종 대결', description: '유소년 에이스 서진을 넘고 나의 가능성을 증명하세요.', opponentId: 'champion' }] },
]);
const clone = value => JSON.parse(JSON.stringify(value));
const has = (run, id) => run.relics.includes(id);
const combat = type => ['match', 'elite', 'boss'].includes(type);
const phases = ['map', 'match', 'reward', 'training', 'rest', 'shop', 'event', 'victory', 'defeat'];
// Retired nodes are accepted only while recovering their original schema2 saves.
// They never enter ROUTE, so new runs cannot select or revisit them.
const LEGACY_SHOPS = Object.freeze({
  1: { id: 'early-shop', type: 'shop', name: '동네 스포츠점', description: '첫 보상 코인으로 나에게 맞는 유물을 찾아보세요.' },
  5: { id: 'final-shop', type: 'shop', name: '백화점 스포츠관', description: '남은 코인으로 마지막 유물을 준비합니다.' },
});
const legacyShop = (stage, id) => LEGACY_SHOPS[stage]?.id === id ? LEGACY_SHOPS[stage] : null;
const LEGACY_ROUTE_LINKED = ROUTE.map((stage, i) => ({ ...stage, choices: stage.choices.map((node, j) => ({
  ...node, lane: stage.choices.length === 1 ? 1 : j * 2, next: ROUTE[i + 1]?.choices.map(next => next.id) ?? [],
})) }));
function seedNumber(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  let hash = 2166136261;
  for (const char of String(seed ?? Date.now())) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}
function random(run) {
  run.seed = (run.seed + 0x6D2B79F5) >>> 0;
  let n = Math.imul(run.seed ^ (run.seed >>> 15), run.seed | 1);
  n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
  return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
}
function shuffle(run, values) {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random(run) * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function addCard(run, id) { run.deck.push({ uid: `c${run.nextUid++}`, id, upgraded: false }); }
function generateRoute(initialSeed, version = 2) {
  // Map randomness never consumes the draw/reward RNG, so combat cannot change the map.
  const rng = { seed: (initialSeed ^ 0x9e3779b9) >>> 0 };
  const coachIds = Object.keys(OPPONENTS).filter(id => OPPONENTS[id].coach);
  const coachId = coachIds[Math.floor(random(rng) * coachIds.length)], coach = OPPONENTS[coachId];
  const regular = (opponentId, name) => ({ type: 'match', opponentId, name, description: `${OPPONENTS[opponentId].name}과 일대일로 실력을 겨룹니다. 승리하면 코인 ${OPPONENTS[opponentId].reward}과 카드 보상을 얻습니다.` });
  const rest = name => ({ type: 'rest', name, description: '내 체력을 30 회복하고 다음 대결을 준비합니다.' });
  const training = name => ({ type: 'training', name, description: '개인 훈련으로 카드 1장을 강화하거나 덱에서 제거합니다.' });
  const event = name => ({ type: 'event', name, description: '안전한 회복과 코인, 또는 체력을 쓰는 희귀 카드 테스트를 선택합니다.' });
  const shop = name => ({ type: 'shop', name, description: '지정된 상점 포인트. 대결로 모은 코인으로 유물을 구매합니다.' });
  const cityShop = ['시내 스포츠점', '시내 쇼핑센터', '백화점 스포츠관'][initialSeed % 3];
  const elite = id => ({ type: 'elite', opponentId: id, name: OPPONENTS[id].name, description: `${OPPONENTS[id].subtitle}. 승리 시 코인 ${OPPONENTS[id].reward}, 희귀 카드와 전용 유물 선택 보상을 얻습니다.` });
  // Version 1 must consume exactly the original map RNG sequence for existing saves.
  const eliteIds = version === 1 ? ['legend', 'legend', 'elite'] : shuffle(rng, Object.keys(ELITE_RELICS));
  const layout = [
    ['시작의 킥', [regular('school', '민준과의 첫 대결')]],
    ['첫 갈림길', [rest('라커룸'), training('훈련장')]],
    ['두 번째 도전', [regular('rookie', '하준의 도전장')]],
    ['모은 코인의 쓰임', [shop('동네 스포츠점'), event('스카우트와의 만남')]],
    ['중반을 위한 준비', [rest('라커룸'), training('훈련장')]],
    ['첫 번째 강적', [elite(eliteIds[0]), event('강적을 피해 돌아가는 길')]],
    ['마지막 장비 보급', [shop(cityShop), event('입단 테스트 제의')]],
    ['끈질긴 벽', [regular('press', '태오와의 본선 대결')]],
    ['나만의 준비', [rest('라커룸'), training('훈련장')]],
    ['마지막 도전의 갈림길', [elite(eliteIds[1]), elite(eliteIds[2]), event('안전한 우회로')]],
    ['에이스를 만나기 전에', [rest('라커룸'), training('훈련장')]],
    ['전설의 감독을 넘어서', [{ type: 'boss', opponentId: coachId, name: `${coach.name}의 최종 시험`, description: coach.mechanic }]],
  ];
  const route = layout.map(([name, choices], i) => {
    const lanes = choices.length === 1 ? [1] : shuffle(rng, [0, 1, 2]).slice(0, choices.length);
    return { id: `stage-${i}`, name, choices: choices.map((node, j) => ({ ...node, id: `path-${i}-${node.opponentId ?? node.type}`, lane: lanes[j], next: [] })) };
  });
  for (let i = 0; i < route.length - 1; i++) {
    const parents = route[i].choices, children = route[i + 1].choices;
    for (const parent of parents) {
      let selected = children.filter(child => Math.abs(child.lane - parent.lane) <= 1);
      if (!selected.length) selected = [children.slice().sort((a, b) => Math.abs(a.lane - parent.lane) - Math.abs(b.lane - parent.lane))[0]];
      for (const child of children) if (!selected.includes(child) && random(rng) < 0.25) selected.push(child);
      // Optional risks and shops always have an available bypass; the final preparation offers both choices.
      if (children.some(node => node.type === 'elite' || node.type === 'shop')) {
        for (const child of children.filter(node => node.type === 'event')) if (!selected.includes(child)) selected.push(child);
        if (children.some(node => node.type === 'elite') && !selected.some(node => node.type === 'elite')) selected.push(children.find(node => node.type === 'elite'));
      }
      if (i + 1 === 10) selected = children;
      parent.next = children.filter(child => selected.includes(child)).map(child => child.id);
    }
    for (const child of children) {
      if (!parents.some(parent => parent.next.includes(child.id))) {
        const nearest = parents.slice().sort((a, b) => Math.abs(a.lane - child.lane) - Math.abs(b.lane - child.lane))[0];
        nearest.next.push(child.id);
      }
    }
  }
  return route;
}
export function routeFor(run) { return run?.schema === 3 ? run.route : LEGACY_ROUTE_LINKED; }
export function availableNodes(run) {
  if (!run || run.phase !== 'map') return [];
  const route = routeFor(run), choices = route?.[run.routeIndex]?.choices ?? [];
  if (run.schema !== 3 || run.routeIndex === 0) return choices;
  const previous = route[run.routeIndex - 1]?.choices.find(node => node.id === run.history.at(-1)?.nodeId);
  return choices.filter(node => previous?.next.includes(node.id));
}
function normalizedName(value) {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\p{Cc}/gu, '').trim().replace(/\s+/gu, ' ');
  return name && [...name].length <= 12 ? name : null;
}
export function createRun(seed, playerName = '루키') {
  const initialSeed = seedNumber(seed), run = { schema: 3, routeVersion: 2, route: generateRoute(initialSeed), phase: 'map', routeIndex: 0, history: [], condition: 100, maxCondition: 100, gold: 40,
    playerName: normalizedName(playerName) ?? '루키', starterRewardUnlocked: false, starterRelic: null,
    deck: [], relics: [], offers: [], relicOffers: [], shopOffers: [], shopRemovalCount: 0, seed: initialSeed, initialSeed, nextUid: 1,
    stats: { wins: 0, damage: 0, blocks: 0, goals: 0 }, match: null, activeNode: null, rewardRelic: null, message: '나만의 플레이로 유소년 에이스에 도전하세요.' };
  ['through-pass', 'through-pass', 'quick-pass', 'dribble', 'dribble', 'feint', 'shot', 'shot', 'cover', 'cover', 'intercept', 'switch'].forEach(id => addCard(run, id));
  return run;
}
function intentFor(opponentId, turn, hp = OPPONENTS[opponentId].maxHp) {
  const opponent = OPPONENTS[opponentId], secondPhase = !!opponent.secondPatterns && hp <= opponent.maxHp / 2;
  const patterns = secondPhase ? opponent.secondPatterns : opponent.patterns, [name, base, defense] = patterns[(turn - 1) % patterns.length];
  const pressure = Math.max(0, turn - 12) * 2;
  const coachBonus = opponentId === 'coach-wenger' ? Math.floor((turn - 1) / 2) * 2 : opponentId === 'coach-ferguson' && turn >= 5 ? 4 : 0;
  const attack = base + pressure + coachBonus + (opponentId === 'legend-zidane' ? Math.floor((turn - 1) / 4) * 2 : 0);
  const counterDamage = opponentId === 'legend' && (turn - 1) % 3 === 0 ? 3 : 0;
  const rule = opponentId === 'legend' ? `${counterDamage ? '첫 공격에 체력 3 반사(방어 무시) · ' : ''}드리블로 상대 방어 6 파괴`
    : opponent.coach ? (secondPhase ? '후반 역습 태세 · ' : '') + opponent.mechanic : opponent.mechanic ?? '';
  return { name: name + (pressure ? ' · 고조' : ''), attack, defense,
    description: `턴 종료 시 피해 ${attack}. 이번 턴 상대 방어 ${defense}.${pressure ? ` 장기전으로 공격 +${pressure}.` : ''}${rule ? ` ${rule}` : ''}`,
    ...(rule ? { rule } : {}), ...(opponentId === 'legend' ? { counterDamage, dribbleBreak: 6 } : {}) };
}
function drawCards(run, count) {
  const m = run.match;
  for (let i = 0; i < count; i++) {
    if (!m.draw.length && m.discard.length) { m.draw = shuffle(run, m.discard); m.discard = []; }
    if (!m.draw.length) break;
    m.hand.push(m.draw.pop());
  }
}
function nextRound(run) {
  const m = run.match;
  m.discard.push(...m.hand);
  for (const card of m.played) (card.id === 'focus' ? m.exhaust : m.discard).push(card);
  m.hand = []; m.played = []; m.energy = m.maxEnergy; m.chance = 0;
  m.defense = has(run, 'training-kit') ? 3 : 0; m.defenseCardPlayed = false; m.dribbleCardPlayed = false;
  m.passCardPlayed = false; m.tacticCardPlayed = false; m.shotCardPlayed = false; m.tempoTriggered = false;
  m.intentHp = m.enemyHp; m.intent = intentFor(m.opponentId, m.turn, m.intentHp); m.enemyBlock = m.intent.defense;
  m.counterReady = (m.intent.counterDamage ?? 0) > 0;
  drawCards(run, has(run, 'scouting-bag') ? 6 : 5);
}
function startMatch(run, opponentId) {
  const maxEnergy = has(run, 'energy-flask') ? 4 : 3, enemyMaxHp = OPPONENTS[opponentId].maxHp;
  run.phase = 'match'; run.relicOffers = [];
  run.match = { opponentId, turn: 1, energy: maxEnergy, maxEnergy, chance: 0, defense: 0, momentum: has(run, 'burst-laces') ? 3 : 0,
    enemyExposed: 0, enemyWeakened: 0,
    enemyHp: enemyMaxHp, enemyMaxHp, enemyBlock: 0, damageDealt: 0, blocks: 0, defenseCardPlayed: false, dribbleCardPlayed: false, counterReady: false, intentHp: enemyMaxHp,
    hand: [], draw: shuffle(run, clone(run.deck)), discard: [], exhaust: [], played: [], intent: null,
    lastOutcome: null, history: [], status: 'playing' };
  nextRound(run);
}
export function getEnemyAttack(run) {
  const m = run?.match;
  if (!m) return 0;
  return Math.floor(m.intent.attack * ((m.enemyWeakened ?? 0) > 0 ? .75 : 1));
}
export function forecast(run) {
  const m = run?.match;
  if (!m) return { attack: 0, target: 0, incoming: 0, guard: 0, homeGoal: false, awayGoal: false, enemyAttack: 0, baseEnemyAttack: 0 };
  const enemyAttack = getEnemyAttack(run), incoming = Math.max(0, enemyAttack - m.defense);
  return { attack: m.chance, target: m.enemyHp, incoming, guard: m.defense, homeGoal: false, awayGoal: incoming > 0, enemyBlock: m.enemyBlock, momentum: m.momentum, enemyAttack, baseEnemyAttack: m.intent.attack };
}
function nodeRecord(run, result) {
  const node = run.activeNode;
  return { stageIndex: run.routeIndex, nodeId: node.id, type: node.type, name: node.name, result,
    ...(run.match ? { damageDealt: run.match.damageDealt, blocks: run.match.blocks, turns: run.match.turn, remainingHp: run.condition } : {}) };
}
function finishNode(run, result) {
  run.history.push(nodeRecord(run, result));
  run.activeNode = null; run.match = null; run.offers = []; run.relicOffers = []; run.shopOffers = []; run.rewardRelic = null; run.routeIndex++;
  run.phase = run.routeIndex >= routeFor(run).length ? 'victory' : 'map';
}
function failRun(run, reason) {
  run.phase = 'defeat'; run.message = reason; run.relicOffers = [];
  if (run.match) run.match.status = 'lost';
  run.history.push(nodeRecord(run, 'defeat')); run.activeNode = null;
}
function outcome(run, damageTaken, blocked, summary) {
  const m = run.match;
  m.lastOutcome = { turn: m.turn, damageDealt: m.chance, damageTaken, blocked, heroHp: run.condition, enemyHp: m.enemyHp, summary };
  m.history.push(clone(m.lastOutcome)); run.message = summary;
}
function winDuel(run) {
  const m = run.match, opponent = OPPONENTS[m.opponentId];
  m.status = 'won'; run.stats.wins++;
  const reward = opponent.reward + (has(run, 'lucky-coin') ? 10 : 0);
  run.gold += reward; run.phase = 'reward';
  run.rewardRelic = null;
  run.relicOffers = run.activeNode.type === 'elite' ? (opponent.eliteRelics ?? []).filter(id => !has(run, id)) : [];
  if (has(run, 'golden-whistle')) run.condition = Math.min(run.maxCondition, run.condition + 5);
  const pool = shuffle(run, Object.keys(CARDS)); run.offers = pool.slice(0, 3);
  if (run.activeNode.type === 'elite' && !run.offers.some(id => CARDS[id].rarity === 'rare')) run.offers[0] = pool.find(id => CARDS[id].rarity === 'rare');
  run.message = `${opponent.name}에게 승리했습니다! 코인 +${reward}${has(run, 'golden-whistle') ? ', 체력 +5' : ''}. ${run.relicOffers.length ? '전용 유물 1개를 먼저 고른 뒤 ' : ''}카드 1장을 선택하거나 건너뛰세요.`;
}
function dealDamage(run, power) {
  const m = run.match;
  power = Math.floor(power * ((m.enemyExposed ?? 0) > 0 ? 1.5 : 1));
  const absorbed = Math.min(m.enemyBlock, power);
  m.enemyBlock -= absorbed;
  const damage = Math.min(m.enemyHp, power - absorbed);
  m.enemyHp -= damage; m.chance += damage; m.damageDealt += damage; run.stats.damage += damage;
}
function playCard(run, uid) {
  const m = run.match, index = m.hand.findIndex(card => card.uid === uid);
  if (index < 0) return false;
  const card = m.hand[index];
  if (cost(card) > m.energy) return false;
  m.energy -= cost(card); m.hand.splice(index, 1); m.played.push(card);
  const n = amount(card), up = card.upgraded;
  let damage = 0, reflectedDamage = 0, exposed = 0, weakened = 0;
  switch (card.id) {
    case 'through-pass': case 'shot': case 'power-shot': case 'volley': damage = n; break;
    case 'quick-pass': case 'one-two': case 'long-pass': damage = n; drawCards(run, 1); break;
    case 'dribble': damage = n; m.momentum += up ? 3 : 2; break;
    case 'feint': damage = n; m.momentum += up ? 6 : 4; break;
    case 'sprint': damage = n; m.momentum += 2; run.condition = Math.max(0, run.condition - (up ? 1 : 3)); break;
    case 'cover': m.defense += n; break;
    case 'intercept': m.defense += n; damage = 3; break;
    case 'tackle': m.defense += n; drawCards(run, 1); break;
    case 'focus': m.energy = Math.min(m.maxEnergy, m.energy + n); break;
    case 'switch': case 'captain': damage = n; m.defense += n; break;
    case 'clutch': damage = n + (m.turn >= 5 ? (up ? 9 : 6) : 0); break;
    case 'wall-pass': damage = n; m.momentum += up ? 3 : 2; break;
    case 'read-opening': exposed = n; break;
    case 'lure-dribble': exposed = up ? 2 : 1; m.momentum += n; break;
    case 'unsettling-shot': damage = n; exposed = up ? 2 : 1; break;
    case 'high-press': weakened = n; break;
    case 'checking-tackle': m.defense += n; weakened = up ? 2 : 1; break;
    case 'close-mark': damage = n; weakened = up ? 2 : 1; break;
  }
  if (CARDS[card.id].type === 'dribble') {
    if (has(run, 'swift-boots')) m.momentum++;
    if (!m.dribbleCardPlayed && has(run, 'libero-seal')) m.defense += 4;
    if (!m.dribbleCardPlayed && has(run, 'street-rhythm')) m.momentum += 2;
    m.dribbleCardPlayed = true;
    m.enemyBlock = Math.max(0, m.enemyBlock - (m.intent.dribbleBreak ?? 0));
  }
  if (CARDS[card.id].type === 'pass') {
    if (!m.passCardPlayed && has(run, 'maestro-touch')) m.momentum += 2;
    if (!m.passCardPlayed && has(run, 'ankle-tape')) m.defense += 3;
    m.passCardPlayed = true;
  }
  if (CARDS[card.id].type === 'tactic') {
    if (!m.tacticCardPlayed && has(run, 'roulette-rune')) drawCards(run, 1);
    m.tacticCardPlayed = true;
  }
  if (CARDS[card.id].type === 'shot') {
    if (!m.shotCardPlayed && has(run, 'fenom-cleats')) damage += 5;
    if (!m.shotCardPlayed && has(run, 'playmaker-lens') && m.momentum >= 3) damage += 4;
    if (has(run, 'nine-crest') && m.enemyHp <= m.enemyMaxHp / 2) damage += 3;
    damage += m.momentum * (card.id === 'volley' ? 2 : 1) + (has(run, 'power-cleats') ? 3 : 0);
    m.momentum = 0; m.shotCardPlayed = true;
  }
  if (CARDS[card.id].type === 'defense') {
    if (!m.defenseCardPlayed && has(run, 'grip-socks')) m.defense += 2;
    if (!m.defenseCardPlayed && has(run, 'catenaccio-band')) m.defense += 3;
    m.defenseCardPlayed = true;
  }
  if (has(run, 'tempo-charm') && m.dribbleCardPlayed && m.shotCardPlayed && !m.tempoTriggered) {
    m.energy = Math.min(m.maxEnergy, m.energy + 1); m.tempoTriggered = true;
  }
  if (damage > 0) {
    if (m.counterReady) { reflectedDamage = Math.min(run.condition, m.intent.counterDamage); run.condition -= reflectedDamage; m.counterReady = false; }
    dealDamage(run, damage);
  }
  // A hit benefits from the status already present, then applies its own debuff.
  m.enemyExposed = Math.min(99, (m.enemyExposed ?? 0) + exposed);
  m.enemyWeakened = Math.min(99, (m.enemyWeakened ?? 0) + weakened);
  if (run.condition <= 0) {
    const reason = reflectedDamage > 0 ? '레전드의 예고된 반격으로 체력을 모두 소모했습니다.' : '무리한 기술로 내 체력을 모두 소모했습니다. 다음 도전에서는 휴식도 챙겨 주세요.';
    outcome(run, 0, 0, reason); failRun(run, reason);
  } else if (m.enemyHp <= 0) {
    outcome(run, 0, 0, `${OPPONENTS[m.opponentId].name}의 체력을 모두 깎았습니다. 반격 전에 승리!`); winDuel(run);
  }
  return true;
}
function endTurn(run) {
  const m = run.match, incoming = forecast(run).incoming, blocked = Math.min(getEnemyAttack(run), m.defense), damageTaken = Math.min(run.condition, incoming);
  run.condition -= damageTaken; run.stats.blocks += blocked; m.blocks += blocked;
  if (run.condition > 0 && damageTaken === 0 && has(run, 'clean-sheet-crest')) run.condition = Math.min(run.maxCondition, run.condition + 2);
  outcome(run, damageTaken, blocked, `내가 준 피해 ${m.chance}. ${OPPONENTS[m.opponentId].name}의 반격 ${damageTaken}${blocked ? ` · 방어 ${blocked}` : ''}.`);
  m.enemyExposed = Math.max(0, (m.enemyExposed ?? 0) - 1);
  m.enemyWeakened = Math.max(0, (m.enemyWeakened ?? 0) - 1);
  if (run.condition <= 0) return failRun(run, '체력이 모두 소진되었습니다. 나만의 덱을 다시 다듬고 도전해 보세요.');
  m.turn++; nextRound(run);
}
export function act(run, action) {
  if (!run || !action || typeof action.type !== 'string' || (['victory', 'defeat'].includes(run.phase) && action.type !== 'rename-player')) return run;
  const next = clone(run);
  switch (action.type) {
    case 'complete-tutorial':
      if (run.starterRewardUnlocked) return run;
      next.starterRewardUnlocked = true; return next;
    case 'take-starter-relic': {
      if (!run.starterRewardUnlocked || run.starterRelic !== null || !STARTER_RELICS.includes(action.id) || has(run, action.id)) return run;
      next.relics.push(action.id); next.starterRelic = action.id;
      next.shopOffers = next.shopOffers.filter(id => id !== action.id);
      if (action.id === 'training-kit' && next.phase === 'match' && next.match.turn === 1 && !next.match.played.length) next.match.defense += 3;
      return next;
    }
    case 'rename-player': {
      const name = normalizedName(action.name);
      if (!name || name === run.playerName) return run;
      next.playerName = name; return next;
    }
    case 'choose-node': {
      if (run.phase !== 'map' || run.condition <= 0) return run;
      const node = availableNodes(run).find(choice => choice.id === action.id);
      if (!node) return run;
      next.activeNode = clone(node); next.message = node.description;
      if (combat(node.type)) startMatch(next, node.opponentId);
      else { next.phase = node.type; if (node.type === 'shop') next.shopOffers = shuffle(next, Object.keys(RELICS).filter(id => RELICS[id].shop !== false && !has(next, id))).slice(0, 4); }
      return next;
    }
    case 'play-card': if (run.phase !== 'match' || !playCard(next, action.uid)) return run; return next;
    case 'end-turn': if (run.phase !== 'match') return run; endTurn(next); return next;
    case 'take-elite-relic':
      if (run.phase !== 'reward' || run.activeNode?.type !== 'elite' || !run.relicOffers.includes(action.id) || !OPPONENTS[run.match.opponentId].eliteRelics?.includes(action.id) || has(run, action.id)) return run;
      next.relics.push(action.id); next.rewardRelic = action.id; next.relicOffers = [];
      next.message = `${RELICS[action.id].name} 획득! 카드 1장을 선택하거나 건너뛰세요.`;
      return next;
    case 'take-reward':
      if (run.phase !== 'reward' || run.relicOffers.length || (action.id !== null && (!run.offers.includes(action.id) || run.deck.length >= 40))) return run;
      if (action.id !== null) addCard(next, action.id);
      next.message = action.id === null ? '보상을 건너뛰고 다음 길로 향합니다.' : `${CARDS[action.id].name} 카드를 덱에 추가했습니다.`;
      finishNode(next, 'win'); return next;
    case 'upgrade-card': {
      if (run.phase !== 'training') return run;
      const card = next.deck.find(item => item.uid === action.uid);
      if (!card || card.upgraded) return run;
      card.upgraded = true; next.message = `${CARDS[card.id].name} 강화 완료. ${cardText(card)}`; finishNode(next, 'upgrade'); return next;
    }
    case 'remove-card': {
      const shop = run.phase === 'shop', price = getCardRemovalCost(run);
      if (shop ? run.deck.length <= 1 || run.gold < price : run.phase !== 'training' || run.deck.length <= 8) return run;
      const index = next.deck.findIndex(card => card.uid === action.uid);
      if (index < 0) return run;
      next.message = `${CARDS[next.deck[index].id].name} 카드를 덱에서 제거했습니다.${shop ? ` 골드 −${price}.` : ''}`;
      next.deck.splice(index, 1);
      if (shop) { next.gold -= price; next.shopRemovalCount = (run.shopRemovalCount ?? 0) + 1; }
      else finishNode(next, 'remove');
      return next;
    }
    case 'rest':
      if (run.phase !== 'rest') return run;
      next.condition = Math.min(next.maxCondition, next.condition + 30); next.message = `휴식 완료. 내 체력 ${next.condition}/${next.maxCondition}.`; finishNode(next, 'rest'); return next;
    case 'buy-relic': {
      const relic = RELICS[action.id];
      if (run.phase !== 'shop' || !relic || relic.shop === false || !run.shopOffers.includes(action.id) || has(run, action.id) || run.gold < relic.price) return run;
      next.gold -= relic.price; next.relics.push(action.id); next.shopOffers = next.shopOffers.filter(id => id !== action.id);
      if (action.id === 'captain-band') { next.maxCondition += 15; next.condition += 15; }
      next.message = `${relic.name} 구입 완료.`; return next;
    }
    case 'event-choice':
      if (run.phase !== 'event' || !['risk', 'safe'].includes(action.id)) return run;
      if (action.id === 'risk') {
        next.condition = Math.max(0, next.condition - 12);
        if (next.condition <= 0) { failRun(next, '추가 테스트에서 내 체력을 모두 소모했습니다.'); return next; }
        next.gold += 35;
        const rare = shuffle(next, Object.keys(CARDS).filter(id => CARDS[id].rarity === 'rare'))[0], room = next.deck.length < 40;
        if (room) addCard(next, rare);
        next.message = `추가 테스트 성공. 내 체력 −12, 코인 +35${room ? `, ${CARDS[rare].name} 획득` : ''}.`;
      } else { next.gold += 15; next.condition = Math.min(next.maxCondition, next.condition + 5); next.message = '스카우트와 이야기를 나눴습니다. 코인 +15, 내 체력 +5.'; }
      finishNode(next, action.id); return next;
    case 'leave-node':
      if (!['shop', 'event', 'training', 'rest'].includes(run.phase)) return run;
      next.message = '다음 길로 향합니다.'; finishNode(next, 'skip'); return next;
    default: return run;
  }
}
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
const shortText = value => typeof value === 'string' && value.length <= 1000;
const uniqueKnown = (value, known, max) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(id => typeof id === 'string' && Object.hasOwn(known, id));
const routeShape = route => route.map(stage => ({ id: stage.id, choices: stage.choices.map(node => ({ id: node.id, type: node.type, opponentId: node.opponentId ?? null, lane: node.lane, next: node.next })) }));
export function validateSave(value) {
  try {
    if (!record(value)) return null;
    const encoded = JSON.stringify(value);
    if (encoded.length > 500000) return null;
    const run = JSON.parse(encoded);
    if (![2, 3].includes(run.schema) || !phases.includes(run.phase) || !integer(run.routeIndex, 0, run.schema === 3 ? 12 : ROUTE.length)) return null;
    if (!Object.hasOwn(run, 'routeVersion')) run.routeVersion = 1;
    if (![1, 2].includes(run.routeVersion)) return null;
    if (!Object.hasOwn(run, 'relicOffers')) run.relicOffers = [];
    if (!Object.hasOwn(run, 'shopRemovalCount')) run.shopRemovalCount = 0;
    if (!integer(run.shopRemovalCount, 0, 100000)) return null;
    if (!Object.hasOwn(run, 'playerName')) run.playerName = '루키';
    else { const name = normalizedName(run.playerName); if (!name) return null; run.playerName = name; }
    if (!uniqueKnown(run.relics, RELICS, Object.keys(RELICS).length) || !uniqueKnown(run.offers, CARDS, 3) || !uniqueKnown(run.shopOffers, RELICS, 4) || run.shopOffers.some(id => run.relics.includes(id) || RELICS[id].shop === false)) return null;
    if (!uniqueKnown(run.relicOffers, RELICS, 3) || run.relicOffers.some(id => has(run, id))) return null;
    if (!Object.hasOwn(run, 'starterRewardUnlocked')) run.starterRewardUnlocked = false;
    if (!Object.hasOwn(run, 'starterRelic')) run.starterRelic = null;
    if (typeof run.starterRewardUnlocked !== 'boolean' || (run.starterRelic !== null && (!STARTER_RELICS.includes(run.starterRelic) || !run.starterRewardUnlocked || !has(run, run.starterRelic)))) return null;
    if (run.maxCondition !== 100 + (has(run, 'captain-band') ? 15 : 0) || !integer(run.condition, 0, run.maxCondition) || !integer(run.gold, 0, 100000)) return null;
    if (!integer(run.seed, 0, 0xffffffff) || !integer(run.initialSeed, 0, 0xffffffff) || !integer(run.nextUid, 1, 100000)) return null;
    if (run.schema === 3) {
      const canonical = generateRoute(run.initialSeed, run.routeVersion);
      if (!Array.isArray(run.route) || JSON.stringify(routeShape(run.route)) !== JSON.stringify(routeShape(canonical))) return null;
      run.route = canonical;
    }
    const route = routeFor(run);
    if (!Object.hasOwn(run, 'rewardRelic') && run.schema === 2) run.rewardRelic = null;
    const elitePool = OPPONENTS[run.match?.opponentId]?.eliteRelics ?? [];
    if (run.rewardRelic !== null && !(run.phase === 'reward' && run.activeNode?.type === 'elite' && elitePool.includes(run.rewardRelic) && has(run, run.rewardRelic) && !run.relicOffers.length)) return null;
    if (run.relicOffers.length && !(run.phase === 'reward' && run.activeNode?.type === 'elite' && run.rewardRelic === null && JSON.stringify(run.relicOffers) === JSON.stringify(elitePool.filter(id => !has(run, id))))) return null;
    if (!shortText(run.message) || !record(run.stats) || !integer(run.stats.wins, 0, run.schema === 3 ? 6 : 4) || !integer(run.stats.damage, 0, 1000) || !integer(run.stats.blocks, 0, 100000) || run.stats.goals !== 0) return null;
    if (!Array.isArray(run.deck) || !integer(run.deck.length, 1, 40)) return null;
    const cards = new Map();
    for (const card of run.deck) {
      if (!record(card) || typeof card.uid !== 'string' || !/^c[1-9]\d*$/.test(card.uid) || typeof card.id !== 'string' || !Object.hasOwn(CARDS, card.id) || typeof card.upgraded !== 'boolean') return null;
      if (cards.has(card.uid) || Number(card.uid.slice(1)) >= run.nextUid) return null;
      cards.set(card.uid, card);
    }
    if (!Array.isArray(run.history) || run.history.length > route.length) return null;
    const retiredVisit = run.schema === 2 ? legacyShop(run.routeIndex, run.activeNode?.id) : null;
    if (retiredVisit) {
      if (run.phase !== 'shop' || run.activeNode.type !== 'shop' || run.activeNode.opponentId !== undefined || run.match !== null || run.offers.length || run.history.length !== run.routeIndex) return null;
      run.history.push({ stageIndex: run.routeIndex, nodeId: retiredVisit.id, type: retiredVisit.type, name: retiredVisit.name, description: retiredVisit.description, result: 'skip' });
      run.routeIndex++;
      run.phase = 'map'; run.activeNode = null; run.shopOffers = [];
      run.message = '방문했던 장비 가게를 떠나 다음 길로 향합니다. 구매한 아이템과 진행 상황은 그대로 유지됩니다.';
    }
    for (let i = 0; i < run.history.length; i++) {
      const item = run.history[i], node = route[i]?.choices.find(choice => choice.id === item?.nodeId) ?? (run.schema === 2 ? legacyShop(i, item?.nodeId) : null);
      if (!record(item) || item.stageIndex !== i || !node || item.type !== node.type) return null;
      if (run.schema === 3 && i > 0 && !route[i - 1].choices.find(previous => previous.id === run.history[i - 1]?.nodeId)?.next.includes(item.nodeId)) return null;
      if (Object.hasOwn(item, 'opponentId') && item.opponentId !== node.opponentId) return null;
      // Labels are presentation data, so copy updates must not invalidate a valid journey.
      item.name = node.name;
      if (Object.hasOwn(item, 'description')) item.description = node.description;
      if (item.result === 'defeat' && (run.phase !== 'defeat' || i !== run.history.length - 1)) return null;
      if (combat(node.type)) {
        const opponent = OPPONENTS[node.opponentId];
        if (!['win', 'defeat'].includes(item.result) || !integer(item.damageDealt, 0, opponent.maxHp) || !integer(item.blocks, 0, 100000) || !integer(item.turns, 1, 1000) || !integer(item.remainingHp, 0, run.maxCondition)) return null;
        if (item.result === 'win' && (item.damageDealt !== opponent.maxHp || item.remainingHp <= 0)) return null;
        if (item.result === 'defeat' && item.remainingHp !== 0) return null;
      } else {
        const allowed = { training: ['upgrade', 'remove', 'skip'], rest: ['rest', 'skip'], shop: ['skip'], event: ['risk', 'safe', 'skip', 'defeat'] };
        if (!allowed[node.type].includes(item.result)) return null;
      }
    }
    if (run.history.length !== run.routeIndex + Number(run.phase === 'defeat')) return null;
    if (run.phase === 'victory' ? run.routeIndex !== route.length : run.routeIndex >= route.length) return null;
    if ((run.condition === 0) !== (run.phase === 'defeat')) return null;
    if (['map', 'victory', 'defeat'].includes(run.phase)) { if (run.activeNode !== null) return null; }
    else {
      const node = route[run.routeIndex]?.choices.find(choice => choice.id === run.activeNode?.id);
      if (!node || node.type !== run.activeNode.type || node.opponentId !== run.activeNode.opponentId) return null;
      if (run.schema === 3 && run.routeIndex > 0 && !route[run.routeIndex - 1].choices.find(previous => previous.id === run.history.at(-1)?.nodeId)?.next.includes(node.id)) return null;
      if (combat(node.type) ? !['match', 'reward'].includes(run.phase) : run.phase !== node.type) return null;
      run.activeNode.name = node.name;
      run.activeNode.description = node.description;
    }
    if (run.phase === 'reward' ? run.offers.length !== 3 : run.offers.length !== 0) return null;
    if (run.phase !== 'shop' && run.shopOffers.length) return null;
    if (run.stats.wins !== run.history.filter(item => item.result === 'win').length + Number(run.phase === 'reward')) return null;
    for (const [stat, field] of [['damage', 'damageDealt'], ['blocks', 'blocks']]) {
      const completed = run.history.reduce((total, item) => total + (item[field] ?? 0), 0);
      if (run.stats[stat] !== completed + (['match', 'reward'].includes(run.phase) ? (run.match?.[field] ?? 0) : 0)) return null;
    }
    if (run.match === null) { if (['match', 'reward'].includes(run.phase)) return null; return run; }
    if (!['match', 'reward', 'defeat'].includes(run.phase)) return null;
    const m = run.match, opponent = OPPONENTS[m?.opponentId];
    if (!record(m) || !opponent || m.enemyMaxHp !== opponent.maxHp || !integer(m.enemyHp, 0, m.enemyMaxHp) || !integer(m.turn, 1, 1000)) return null;
    for (const status of ['enemyExposed', 'enemyWeakened']) {
      if (!Object.hasOwn(m, status)) m[status] = 0;
      if (!integer(m[status], 0, 99)) return null;
    }
    const sourceNode = run.activeNode ?? route[run.routeIndex]?.choices.find(choice => choice.id === run.history.at(-1)?.nodeId);
    if (sourceNode?.opponentId !== m.opponentId) return null;
    if (m.maxEnergy !== (has(run, 'energy-flask') ? 4 : 3) || !integer(m.energy, 0, m.maxEnergy)) return null;
    if (run.schema === 2) {
      if (!Object.hasOwn(m, 'dribbleCardPlayed')) m.dribbleCardPlayed = Array.isArray(m.played) && m.played.some(card => CARDS[card.id]?.type === 'dribble');
      if (!Object.hasOwn(m, 'counterReady')) m.counterReady = false;
      if (!Object.hasOwn(m, 'intentHp')) m.intentHp = m.history?.[m.turn - 2]?.enemyHp ?? m.enemyMaxHp;
    }
    for (const [flag, type] of [['passCardPlayed', 'pass'], ['tacticCardPlayed', 'tactic'], ['shotCardPlayed', 'shot']]) {
      if (!Object.hasOwn(m, flag)) m[flag] = Array.isArray(m.played) && m.played.some(card => CARDS[card.id]?.type === type);
      if (typeof m[flag] !== 'boolean') return null;
    }
    // A relic chosen after victory must not retroactively activate the finished turn.
    const tempoOwnedDuringDuel = has(run, 'tempo-charm') && run.rewardRelic !== 'tempo-charm';
    if (!Object.hasOwn(m, 'tempoTriggered')) m.tempoTriggered = tempoOwnedDuringDuel && m.dribbleCardPlayed && m.shotCardPlayed;
    if (typeof m.tempoTriggered !== 'boolean') return null;
    if (![m.chance, m.defense, m.momentum].every(n => integer(n, 0, 10000)) || typeof m.defenseCardPlayed !== 'boolean' || typeof m.dribbleCardPlayed !== 'boolean' || typeof m.counterReady !== 'boolean') return null;
    if (!integer(m.intentHp, m.enemyHp, m.enemyMaxHp) || m.intentHp !== (m.history?.[m.turn - 2]?.enemyHp ?? m.enemyMaxHp)) return null;
    if (!integer(m.enemyBlock, 0, m.intent?.defense ?? -1) || m.damageDealt !== m.enemyMaxHp - m.enemyHp || !integer(m.blocks, 0, 100000)) return null;
    const intent = intentFor(m.opponentId, m.turn, m.intentHp);
    if (!record(m.intent) || Object.keys(intent).some(key => m.intent[key] !== intent[key])) return null;
    const expectedStatus = run.phase === 'match' ? 'playing' : run.phase === 'reward' ? 'won' : 'lost';
    if (m.status !== expectedStatus || (m.status === 'won' && m.enemyHp !== 0) || (m.status === 'playing' && m.enemyHp <= 0)) return null;
    const used = new Set();
    for (const zone of ['hand', 'draw', 'discard', 'exhaust', 'played']) {
      if (!Array.isArray(m[zone]) || m[zone].length > run.deck.length) return null;
      for (const card of m[zone]) {
        const original = cards.get(card?.uid);
        if (!original || card.id !== original.id || card.upgraded !== original.upgraded || used.has(card.uid) || (zone === 'exhaust' && card.id !== 'focus')) return null;
        used.add(card.uid);
      }
    }
    for (const [flag, type] of [['dribbleCardPlayed', 'dribble'], ['defenseCardPlayed', 'defense'], ['passCardPlayed', 'pass'], ['tacticCardPlayed', 'tactic'], ['shotCardPlayed', 'shot']]) {
      if (m[flag] !== m.played.some(card => CARDS[card.id].type === type)) return null;
    }
    if (m.tempoTriggered !== (tempoOwnedDuringDuel && m.dribbleCardPlayed && m.shotCardPlayed)) return null;
    if (m.counterReady !== ((intent.counterDamage ?? 0) > 0 && !m.played.some(card => !['cover', 'tackle', 'focus', 'read-opening', 'lure-dribble', 'high-press', 'checking-tackle'].includes(card.id)))) return null;
    if (used.size !== cards.size || !Array.isArray(m.history) || m.history.length !== m.turn - Number(m.status === 'playing')) return null;
    let dealt = 0, blocked = 0;
    for (let i = 0; i < m.history.length; i++) {
      const result = m.history[i];
      if (!record(result) || result.turn !== i + 1 || !shortText(result.summary)) return null;
      if (!integer(result.damageDealt, 0, m.enemyMaxHp) || !integer(result.damageTaken, 0, run.maxCondition) || !integer(result.blocked, 0, 10000) || !integer(result.heroHp, 0, run.maxCondition) || !integer(result.enemyHp, 0, m.enemyMaxHp)) return null;
      dealt += result.damageDealt; blocked += result.blocked;
      if (result.enemyHp !== m.enemyMaxHp - dealt) return null;
    }
    if (m.damageDealt !== dealt + (m.status === 'playing' ? m.chance : 0) || m.blocks !== blocked) return null;
    if (JSON.stringify(m.lastOutcome) !== JSON.stringify(m.history.at(-1) ?? null)) return null;
    return run;
  } catch { return null; }
}

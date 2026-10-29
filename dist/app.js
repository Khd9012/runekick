import * as Current from './engine.js';
import { comboFeedback } from './striker-cards.js';
import * as Legacy from './legacy-engine.js';
const rulesFor = state => state?.rulesVersion === 2 ? Current : Legacy;
const { STARTER_RELICS, OPPONENTS, createRun, routeFor, availableNodes, getCardRemovalCost } = Current;
let CARDS = Current.CARDS, RELICS = Current.RELICS;
const act = (state, action) => rulesFor(state).act(state, action);
const forecast = state => rulesFor(state).forecast(state);
const getEnemyAttack = state => rulesFor(state).getEnemyAttack(state);
const getBossView = state => rulesFor(state).getBossView(state);
const validateSave = value => value?.rulesVersion === undefined ? Legacy.validateSave(value) : Current.validateSave(value);
const cardText = (card, modern = false) => (modern ? Current : rulesFor(run)).cardText(card);
import { drawPitch, drawCardArt, drawItemArt, initArt } from './art.js';
import { createTutorial } from './tutorial.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE_KEY = 'runekick-personal-v2';
const SOUND_KEY = 'runekick-sound-v1';
const TUTORIAL_KEY = 'runekick-tutorial-v1';
const CARD_CATEGORIES = {
  attack: { name: '공격', icon: '<path d="m5 19 3-3m-3-3 6 6m-3-7 9-9 4-1-1 4-9 9"/>' },
  defense: { name: '수비', icon: '<path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z"/><path d="m8 11 3 3 5-6"/>' },
  skill: { name: '기술', icon: '<path d="m13 2-8 12h6l-1 8 9-13h-7l1-7Z"/>' },
};
const CARD_SUBTYPES = { shot: '슈팅', pass: '터치', dribble: '드리블', tactic: '전술', header: '헤더', training: '훈련', injury: '부상' };
const NODE_ICONS = { match: '⚽', elite: '◇', boss: '♛', training: '↗', rest: '☾', shop: '▣', event: '✧' };
const NODE_NAMES = { match: '대결', elite: '엘리트', boss: '감독 보스', training: '훈련장', rest: '라커룸', shop: '상점', event: '이벤트' };
const RARITY_NAMES = {common:'일반', uncommon:'특별', rare:'희귀', legendary:'전설', injury:'부상'};
const NODE_HINTS = { match:'카드 · 골드', elite:'전용 유물 · 희귀 카드', boss:'최종 시험', training:'강화 / 덱 정리', rest:'체력 +30', shop:'골드로 아이템 구매', event:'선택형 이벤트' };
let combatChoiceKey = null, combatSelection = null;
let selected = null, rewardSelection = null, eliteRelicSelection = null, busy = false, animation = null, audio = null, sound = false, toastTimer, announcementTimer, saveError = false, pitchDirty = true;
let changedElsewhere = false, previousSaveBackedUp = false;
let rewardDialogSeen = null, rewardDialogTimer;
let run = load();
const firstVisit = !run;
if (!run) run = startRun();
try { sound = localStorage.getItem(SOUND_KEY) === 'true'; } catch { /* Browser storage may be disabled. */ }
let tutorialStatus = '';
try { tutorialStatus = localStorage.getItem(TUTORIAL_KEY) || ''; } catch { /* Learning also works without storage. */ }
let tutorialWelcomePending = firstVisit && !['completed', 'skipped'].includes(tutorialStatus);
const tutorial = createTutorial({
  renderCard: (card, context) => cardHTML(card, 'tutorial', 0, context),
  paintCards,
  rewardAvailable: canEarnStarterReward,
  completionLabel: () => canEarnStarterReward() ? '시작 장비 고르기 →' : '경기로 돌아가기',
  onClose: result => {
    tutorialStatus = result;
    try { localStorage.setItem(TUTORIAL_KEY, result); } catch { /* Optional preference. */ }
    if (result === 'completed' && canEarnStarterReward()) {
      if (changedElsewhere) return toast('다른 창의 진행이 변경됐어요. 새로고침 후 튜토리얼을 다시 완료해 주세요.');
      run = act(run, { type: 'complete-tutorial' });
      save(); render();
      return showStarterReward();
    }
    toast(result === 'completed' ? '연습 완료! 이제 나만의 경기를 시작하세요.' : '튜토리얼을 건너뛰었어요. 메뉴에서 다시 볼 수 있어요.');
    syncRewardDialog();
  renderStrikerStatus();
  syncCombatChoice();
  },
});
function showTutorial() {
  if (busy || tutorial.active) return;
  tutorialWelcomePending = false;
  $('dialog').close(); $('route-dialog').close(); $('reward-dialog').close();
  tutorialStatus = 'active';
  try { localStorage.setItem(TUTORIAL_KEY, tutorialStatus); } catch { /* Optional preference. */ }
  tutorial.open();
}

function startRun(playerName = '루키') {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const initial = createRun(seed, playerName);
  return act(initial, { type: 'choose-node', id: availableNodes(initial)[0].id });
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = validateSave(JSON.parse(raw));
    if (!parsed) { saveError = true; localStorage.setItem(`${SAVE_KEY}-previous-version`, raw); previousSaveBackedUp = true; }
    return parsed;
  } catch { saveError = true; return null; }
}
function save() {
  if (changedElsewhere) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); $('save-status').textContent = '진행 자동 저장'; }
  catch { $('save-status').textContent = '저장 불가 · 현재 창 유지'; toast('브라우저 저장이 차단되어 있어요. 현재 창을 유지해 주세요.'); }
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2800);
}
function playTone(kind, impact = {}) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    if ((impact.damage || impact.blocked || impact.defenseGain) && !['goal', 'boss'].includes(kind)) {
      const strength = impact.intensity || 0, time = audio.currentTime;
      const shield = !impact.damage && (impact.blocked || impact.defenseGain);
      for (const [index, frequency] of (shield ? [620, 930] : [150 + strength * 70, 780 + strength * 280]).entries()) {
        const osc = audio.createOscillator(), gain = audio.createGain(), duration = shield ? .16 : .1 + strength * .08;
        osc.type = shield ? 'sine' : index ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequency, time);
        osc.frequency.exponentialRampToValueAtTime(shield ? frequency * .72 : index ? 120 : 44, time + duration);
        gain.gain.setValueAtTime((index ? .018 : .045) + strength * .022, time);
        gain.gain.exponentialRampToValueAtTime(.001, time + duration);
        osc.connect(gain); gain.connect(audio.destination); osc.start(time); osc.stop(time + duration);
      }
      return;
    }
    const notes = kind === 'goal' ? [523, 659, 784, 1046] : kind === 'boss' ? [220, 330, 440] : kind === 'defense' ? [294, 392] : kind === 'concede' ? [294, 220] : [440, 554];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + i * .09;
      osc.type = 'triangle'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.045, time); gain.gain.exponentialRampToValueAtTime(.001, time + .17);
      osc.connect(gain); gain.connect(audio.destination); osc.start(time); osc.stop(time + .18);
    });
  } catch { /* Audio is optional. */ }
}
function announce(message, boss = false) {
  const banner = $('pitch-announcement');
  banner.classList.toggle('boss-callout', boss); banner.textContent = message;
  clearTimeout(announcementTimer);
  announcementTimer = setTimeout(() => { banner.textContent = ''; banner.classList.remove('boss-callout'); }, boss ? 1000 : 1200);
}
function animate(type, message, impact = {}) {
  animation = { type, started: performance.now(), duration: ['goal', 'concede'].includes(type) ? 850 : type === 'boss' ? 800 : 620, ...impact };
  pitchDirty = true;
  if (message) announce(message, type === 'boss' || !!impact.bossCountered);
  playTone(type, impact);
}
function floatCombat(target, kind, value, heavy = false, enemyId = '') {
  const layer = $('combat-feedback');
  // Keep rapid card use responsive without piling old numbers over the latest hit.
  layer.querySelectorAll(`[data-target="${target}"][data-kind="${kind}"][data-enemy-id="${CSS.escape(enemyId)}"]`).forEach(node => node.remove());
  const label = document.createElement('span');
  label.className = `combat-float ${kind}${heavy ? ' heavy' : ''}`;
  label.dataset.target = target; label.dataset.kind = kind; label.dataset.enemyId = enemyId;
  if (target==='enemy' && run.match?.enemies?.length===2 && enemyId) {
    const index = enemyViews(run).findIndex(e=>e.id===enemyId);
    if (index>=0) label.style.left = `${index===0?56:83}%`;
  }
  if (kind === 'damage') label.innerHTML = `<strong>−${value}</strong>${heavy ? '<small>강타</small>' : ''}`;
  else if (kind === 'block' || kind === 'perfect-block') label.innerHTML = `<strong>막음 ${value}</strong>${kind === 'perfect-block' ? '<small>완전 방어</small>' : ''}`;
  else if (kind === 'shield') label.innerHTML = `<strong>방어 +${value}</strong>`;
  else if (kind === 'armor') label.innerHTML = `<strong>방어 −${value}</strong>`;
  else label.textContent = value;
  layer.append(label);
  while (layer.children.length > 6) layer.firstElementChild.remove();
  setTimeout(() => label.remove(), 900);
}
function bossImpact(view, countered = false) {
  return view ? { bossId: view.id, bossEffect: view.effect, bossCountered: countered } : {};
}
function combatFeedback(before, next, action, card) {
  const previousBoss = getBossView(before), boss = getBossView(next);
  const interrupted = !!boss?.countered && (!previousBoss?.countered || previousBoss.effect !== boss.effect);
  if (action.type === 'end-turn' && before.match) {
    const result = next.match?.lastOutcome;
    // The outcome preserves damage even when a relic heals the player afterwards.
    const damage = result?.damageTaken ?? Math.max(0, before.condition - next.condition), blocked = result?.blocked ?? 0;
    const impact = { damage, blocked, defenseGain: 0, target: 'hero', intensity: Math.min(1, damage / 30), ...bossImpact(previousBoss, !!previousBoss?.countered) };
    animate(damage ? 'concede' : 'defense', next.phase === 'defeat' ? '다음 도전을 향해.' : null, impact);
    if (damage) floatCombat('hero', 'damage', damage, damage >= 20);
    if (blocked) floatCombat('hero', damage ? 'block' : 'perfect-block', blocked);
    if (previousBoss && boss && (previousBoss.effect !== boss.effect || previousBoss.title !== boss.title)) announce(boss.title, true);
    return;
  }
  if (card && before.match && next.match) {
    const beforeEnemies = before.match.enemies ? enemyViews(before) : [], afterEnemies = next.match.enemies ? enemyViews(next) : [];
    const changes = beforeEnemies.map(enemy=>({before:enemy, after:afterEnemies.find(e=>e.id===enemy.id)})).filter(e=>e.after);
    const damage = Math.max(0, before.match.enemyHp - next.match.enemyHp);
    const blocked = changes.length ? changes.reduce((total,e)=>total+Math.max(0,e.before.block-e.after.block),0) : Math.max(0, before.match.enemyBlock - next.match.enemyBlock);
    const defenseGain = Math.max(0, next.match.defense - before.match.defense);
    const selfDamage = Math.max(0, before.condition - next.condition);
    const attackCard = /(?:^|\.\s*)피해 \d+/.test(cardText(card));
    const debuffs = changes.length ? [...new Set(changes.flatMap(e=>[e.after.exposed>e.before.exposed&&'약점 노출',e.after.weakened>e.before.weakened&&'공격 약화'].filter(Boolean)))] : [['enemyExposed', '약점 노출'], ['enemyWeakened', '공격 약화']].filter(([key]) => (next.match[key] || 0) > (before.match[key] || 0)).map(([, label]) => label);
    const type = next.phase === 'reward' ? 'goal' : attackCard ? (CARDS[card.id].type === 'tactic' ? 'pass' : CARDS[card.id].type) : defenseGain ? 'defense' : debuffs.length ? 'debuff' : 'pass';
    animate(type, next.phase === 'reward' ? 'DUEL WON' : next.phase === 'defeat' ? '다음 도전을 향해.' : interrupted ? '전술 파훼!' : null,
      { damage, blocked, defenseGain, intensity: Math.min(1, damage / 30), target: attackCard || debuffs.length || blocked ? 'enemy' : 'hero', targetId:action.targetId || before.match.targetId, targetIds:changes.filter(e=>e.before.hp>e.after.hp||e.before.block>e.after.block||e.before.exposed<e.after.exposed||e.before.weakened<e.after.weakened).map(e=>e.before.id), ...bossImpact(boss || previousBoss, interrupted) });
    if (changes.length) {
      for (const e of changes) {
        const dealt = e.before.hp-e.after.hp, absorbed = e.before.block-e.after.block;
        if (dealt>0) floatCombat('enemy','damage',dealt,dealt>=20,e.before.id);
        else if (absorbed>0) floatCombat('enemy','armor',absorbed,false,e.before.id);
        const inflicted = [e.after.exposed>e.before.exposed&&'약점 노출',e.after.weakened>e.before.weakened&&'공격 약화'].filter(Boolean);
        if (inflicted.length) floatCombat('enemy','debuff',inflicted.join(' · '),false,e.before.id);
      }
    } else if (damage) floatCombat('enemy', 'damage', damage, damage >= 20);
    else if (blocked) floatCombat('enemy', 'armor', blocked);
    if (defenseGain) floatCombat('hero', 'shield', defenseGain);
    if (debuffs.length && !changes.length) floatCombat('enemy', 'debuff', debuffs.join(' · '));
    if (selfDamage) floatCombat('hero', 'damage', selfDamage, selfDamage >= 20);
    return;
  }
  if (action.type === 'choose-node' && next.phase === 'match' && boss) animate('boss', boss.title, { target: 'enemy', intensity: .35, ...bossImpact(boss) });
  else if (next.phase === 'defeat') animate('concede', '다음 도전을 향해.');
  else { playTone('pass'); if (action.type !== 'choose-node' && next.message) toast(next.message); }
}
function dispatch(action) {
  if (changedElsewhere) return toast('다른 창에서 진행이 변경됐어요. 새로고침하면 이어할 수 있어요.');
  if (busy) return;
  const before = run, card = action.type === 'play-card' ? run.match?.hand.find(c => c.uid === action.uid) : null;
  const next = act(run, action);
  if (action.type === 'select-target') {
    if (next === before) return;
    run = next; save(); render(); return;
  }
  if (next === before) return toast('지금은 사용할 수 없는 선택이에요.');
  run = next; selected = null; rewardSelection = null; eliteRelicSelection = null;
  combatFeedback(before, run, action, card);
  if (action.type === 'end-turn' && run.phase === 'match') {
    busy = true;
    setTimeout(() => { busy = false; render(); }, 500);
  }
  save(); render();
  if (before.phase !== run.phase) {
    const destination = run.phase === 'map' ? $('phase-panel').querySelector('.map-point.available') : run.phase === 'match' ? document.querySelector('.topbar') : $('phase-panel');
    const scroll = () => { if (run === next && !cardRewardKey()) destination?.scrollIntoView({block:run.phase === 'map' ? 'center' : 'start', behavior:motion.matches ? 'auto' : 'smooth'}); };
    if (card && ['reward', 'defeat'].includes(run.phase) && !motion.matches) setTimeout(scroll, 650);
    else scroll();
  }
}
function playableDeckSize() { return run.deck.filter(c => CARDS[c.id].type !== 'injury').length; }
function costOf(card) { return run.rulesVersion === 2 ? Current.cardCost(card, run.match) : card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost; }
const ENEMY_ROLES = {attacker:'공격형',buffer:'버퍼형',technique:'기술형',defender:'방어형',charger:'축적형'};
const enemyViews = state => state?.rulesVersion === 2 && Current.getEnemyViews ? Current.getEnemyViews(state) : [];
function targetScope(card) {
  const e = CARDS[card?.id]?.effect;
  if (!card || !(e?.damage || e?.exposed || e?.weakened)) return 'self';
  return e.target === 'all' ? 'all' : e.comboSplash && Current.isCombo(run.match,card) ? 'split' : 'single';
}
function enemyChangeText(before, after) {
  if (!after) return '';
  const damage = Math.max(0,before.hp-after.hp), block = Math.max(0,before.block-after.block);
  return [damage && `피해 ${damage}`, block && `방어 −${block}`, after.exposed>before.exposed && `약점 +${after.exposed-before.exposed}턴`, after.weakened>before.weakened && `약화 +${after.weakened-before.weakened}턴`, before.hp>0 && after.hp===0 && '격파'].filter(Boolean).join(' · ');
}
function renderEnemyTargets(chosen, preview, prediction) {
  const enabled = run.phase === 'match' && run.encounterVersion === 1 && run.activeNode?.type === 'match', views = enabled ? enemyViews(run) : [];
  const duo = views.length === 2, selectedId = run.match?.targetId ?? views[0]?.id, target = views.find(e=>e.id===selectedId), scope = targetScope(chosen);
  document.body.dataset.enemyCount = enabled ? views.length : 1;
  document.body.dataset.targetScope = enabled && chosen ? scope : 'none';
  $('enemy-target-panel').hidden = !enabled; $('enemy-stage-targets').hidden = !duo;
  $('mobile-targets').hidden = !duo;
  if (!enabled) return;
  const after = preview ? enemyViews(preview) : [], all = scope==='all';
  const targetLabel = !chosen ? '상대를 눌러 상태 확인 · 카드 선택 후 사용' : scope==='self' ? '자신에게 적용 · 상대 선택 불필요' : all ? `전체 공격 · 주 대상: ${target?.name || '선택하세요'}` : scope==='split' ? `주 대상: ${target?.name || '선택하세요'} · 연계로 다른 상대도 타격` : `공격 대상: ${target?.name || '선택하세요'}`;
  $('enemy-target-instruction').textContent = targetLabel;
  $('enemy-target-list').innerHTML = views.map((enemy,index)=>{
    const dead = enemy.hp<=0, selectedTarget = enemy.id===selectedId, highlighted = !dead && (all || selectedTarget);
    const change = enemyChangeText(enemy,after.find(e=>e.id===enemy.id));
    const status = [`방어 ${enemy.block}`,enemy.exposed&&`약점 ${enemy.exposed}턴`,enemy.weakened&&`약화 ${enemy.weakened}턴`,enemy.charge&&`충전 ${enemy.charge}`,enemy.attackBuff&&`공격 강화 +${enemy.attackBuff}`].filter(Boolean);
    const label = `${enemy.name}, ${enemy.roleLabel || ENEMY_ROLES[enemy.role] || '상대'}, 체력 ${enemy.hp}/${enemy.maxHp}, ${status.join(', ')}, ${dead?'격파':`다음 행동 ${enemy.intent.name}, 공격 ${enemy.attack}. ${enemy.intent.description || ''}`}${change?`, 사용 시 ${change}`:''}`;
    return `<button type="button" class="enemy-target role-${esc(enemy.role)}${highlighted?' selected':''}${dead?' defeated':''}" data-enemy-target="${esc(enemy.id)}" aria-pressed="${highlighted}" aria-label="${esc(label)}" ${dead||busy||run.match.choice?'disabled':''}><span class="enemy-target-top"><strong>${esc(enemy.name)}</strong><small>${esc(enemy.roleLabel || ENEMY_ROLES[enemy.role] || '상대')}</small></span><span class="enemy-target-health"><i style="width:${Math.max(0,enemy.hp)/enemy.maxHp*100}%"></i><b>체력 ${enemy.hp} / ${enemy.maxHp}</b></span><span class="enemy-target-stats">${status.map((s,i)=>`<span class="${i===0?'target-block':''}">${esc(s)}</span>`).join('')}</span><span class="enemy-target-intent"><b>${dead?'✓ 격파':enemy.attack?`⚔ ${enemy.attack}`:'지원'}</b><span>${dead?'행동하지 않음':esc(enemy.intent.name)}</span></span>${!dead&&enemy.intent.description?`<span class="enemy-target-detail">${esc(enemy.intent.description)}</span>`:''}<span class="enemy-target-preview">${change?esc(change):dead?'':all?selectedTarget?'전체 대상 · ◎ 주 대상':'전체 대상':selectedTarget?'✓ 선택한 상대':'눌러서 대상 선택'}</span></button>`;
  }).join('');
  $('enemy-stage-targets').innerHTML = views.map((enemy,index)=>`<button type="button" class="enemy-stage-target${enemy.id===selectedId?' selected':''}${enemy.hp<=0?' defeated':''}" style="--enemy-x:${index===0?56:83}%" data-enemy-target="${esc(enemy.id)}" data-target-position="stage" aria-label="${esc(enemy.name)} ${enemy.hp<=0?'격파됨':'공격 대상으로 선택'}" aria-pressed="${enemy.id===selectedId}" ${enemy.hp<=0||busy||run.match.choice?'disabled':''}><strong>${esc(enemy.name)}</strong><small>${enemy.hp<=0?'격파':enemy.roleLabel || ENEMY_ROLES[enemy.role] || ''}</small></button>`).join('');
  $('mobile-targets').innerHTML = `<span>${scope==='self'&&chosen?'자신에게 적용':all?'주 대상':'공격 대상'}</span>${views.map(enemy=>`<button type="button" class="mobile-target${!enemy.hp?' defeated':''}" data-enemy-target="${esc(enemy.id)}" data-target-position="dock" aria-pressed="${enemy.hp>0&&(all||enemy.id===selectedId)}" aria-label="${esc(enemy.name)} 대상으로 선택, 체력 ${enemy.hp}, 다음 공격 ${enemy.attack}" ${enemy.hp<=0||busy||run.match.choice||scope==='self'&&chosen?'disabled':''}>${enemy.hp<=0?'✓ ':enemy.id===selectedId?'◎ ':''}${esc(enemy.name)}<small>${enemy.hp<=0?'격파':`♥ ${enemy.hp}`}</small></button>`).join('')}`;
  const attacks = views.filter(e=>e.hp>0&&e.attack>0).map(e=>`${e.name} ${e.attack}`).join(' + ') || '이번 턴 공격 없음';
  $('encounter-forecast').innerHTML = `<span>${esc(attacks)}<small>내 방어 ${prediction.guard}${prediction.injuryBlockLoss?` · 부상으로 방어 −${prediction.injuryBlockLoss}`:''}${prediction.injuryDamage?` · 부상 피해 ${prediction.injuryDamage}`:''}</small></span><strong class="${prediction.incoming?'danger':'good'}">예상 체력 피해 ${prediction.incoming}</strong>`;
}
function cardEffectHTML(card, modern = false) {
  const [first, ...sentences] = cardText(card, modern).split(/\.\s*/).filter(Boolean);
  const highlight = text => esc(text).replace(/(약점 노출)/g, '<b class="card-debuff-exposed">$1</b>').replace(/(공격 약화)/g, '<b class="card-debuff-weakened">$1</b>').replace(/(\+?\d+)/g, '<b class="card-rule-number">$1</b>');
  const effect = first.match(/^(피해|이번 턴 방어|에너지|약점 노출|공격 약화|기세) (\+?\d+)(.*)$/);
  if (!effect) return `<span class="card-rules">${highlight(cardText(card, modern))}</span>`;
  const label = effect[1] === '이번 턴 방어' ? '방어' : effect[1];
  const timed = ['약점 노출', '공격 약화'].includes(label);
  const notes = [effect[1] === '이번 턴 방어' ? '이번 턴 동안 유지.' : '', (timed ? effect[3].replace(/^턴/, '') : effect[3]).trim(), ...sentences.map(sentence => `${sentence}.`)].filter(Boolean);
  const rules = notes.map(highlight).join(' ');
  return `<span class="card-stat${timed ? ' card-status-stat' : ''}"><span>${label}</span><strong class="card-effect-number">${effect[2]}</strong>${timed ? '<small>턴</small>' : ''}</span>${rules ? `<span class="card-rules">${rules}</span>` : ''}`;
}
function cardHTML(card, mode = 'view', index = 0, context = {}) {
  const def = (mode === 'tutorial' ? Current.CARDS : CARDS)[card.id]; if (!def) return '';
  const category = def.type === 'defense' ? 'defense' : (mode === 'tutorial' || run.rulesVersion === 2 ? ['shot','pass','dribble','header'] : ['shot','pass']).includes(def.type) ? 'attack' : 'skill';
  const categoryInfo = CARD_CATEGORIES[category];
  const practice = mode === 'tutorial';
  const unaffordable = def.type === 'injury' || (mode === 'hand' && costOf(card) > run.match.energy) || (practice && Current.cardCost(card) > context.energy);
  const isSelected = mode === 'choice' ? combatSelection === card.uid : practice ? context.selectedUid === card.uid : mode === 'hand' ? selected === card.uid : mode === 'reward' && rewardSelection === card.id;
  const expected = practice && context.allowedCardId === card.id;
  const tag = mode === 'view' ? 'article' : 'button';
  const displayCost = def.type === 'injury' ? '—' : practice ? Current.cardCost(card) : costOf(card);
  const combo = mode === 'hand' && run.rulesVersion === 2 && Current.isCombo(run.match, card);
  const data = mode === 'choice' ? `data-combat-preview="${esc(card.uid)}"` : practice ? `data-tutorial-hand="${esc(card.uid)}"` : mode === 'hand' ? `data-hand="${esc(card.uid)}"` : mode === 'reward' ? `data-reward="${esc(card.id)}"` : mode === 'upgrade' ? `data-upgrade="${esc(card.uid)}"` : mode === 'remove' ? `data-preview-remove="${esc(card.uid)}"` : '';
  return `<${tag} class="card ${def.type}${combo ? ' combo-ready' : ''} category-${category} rarity-${def.rarity}${card.upgraded ? ' upgraded' : ''}${isSelected ? ' selected' : ''}${unaffordable ? ' unaffordable' : ''}${expected ? ' tutorial-card-target' : ''}" ${data} ${practice && !expected ? 'disabled' : ''} ${mode !== 'view' ? `aria-label="${esc(def.name)}${card.upgraded ? ' 강화' : ''}, ${categoryInfo.name}, 에너지 ${displayCost}, ${esc(cardText(card, practice))}${def.type === 'injury' ? ' 사용 불가.' : unaffordable ? ' 에너지 부족.' : ''}${mode === 'upgrade' ? ' 강화 전후 비교' : mode === 'remove' ? ' 상점에서 제거' : ''}"${['hand','reward','tutorial','choice'].includes(mode) ? ` aria-pressed="${isSelected}"` : ''}` : ''}>
    <span class="card-top"><span class="card-cost">${displayCost}</span><span class="card-title">${esc(def.name)}${card.upgraded ? '<span class="upmark"> +</span>' : ''}</span></span>
    ${combo ? `<span class="combo-badge">${unaffordable ? '연계 · 에너지 부족' : '↗ 연계 가능'}</span>` : ''}
    <canvas class="card-art" data-art="${def.type}" data-card-id="${def.id}" data-upgraded="${!!card.upgraded}" width="384" height="240" aria-hidden="true"></canvas>
    <span class="card-type"><span><svg class="card-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${categoryInfo.icon}</svg>${def.type === 'training' ? '훈련' : def.type === 'injury' ? '부상' : categoryInfo.name}${CARD_SUBTYPES[def.type] && !['training','injury'].includes(def.type) ? `<small class="card-subtype">· ${CARD_SUBTYPES[def.type]}</small>` : ''}</span><span class="card-rarity">${RARITY_NAMES[def.rarity]}</span></span>
    <span class="card-description">${cardEffectHTML(card, practice)}${def.type === 'injury' ? `<small class="injury-scope">${card.temporary ? '이번 전투 한정' : '덱 부상 · 라커룸에서 치료'}</small>` : ''}</span>${mode === 'hand' ? `<span class="card-key">${def.type === 'injury' ? '사용 불가' : unaffordable ? '에너지 부족' : index + 1}</span>` : ''}
  </${tag}>`;
}
function paintCards(container = document) {
  container.querySelectorAll('canvas[data-art]').forEach(canvas => drawCardArt(canvas.getContext('2d'), canvas.dataset.art, {width:canvas.width,height:canvas.height,id:canvas.dataset.cardId,upgraded:canvas.dataset.upgraded === 'true'}));
  container.querySelectorAll('canvas[data-item]').forEach(canvas => drawItemArt(canvas.getContext('2d'), canvas.dataset.item, {width:canvas.width,height:canvas.height,id:canvas.dataset.itemId,modern:run.rulesVersion === 2}));
}
function itemCanvas(item) { return `<canvas data-item="${esc(item.category)}" data-item-id="${esc(item.id)}" width="240" height="192" aria-hidden="true"></canvas>`; }
function routeMap(interactive = false) {
  const route = routeFor(run), allowed = new Set(availableNodes(run).map(n => n.id));
  const points = route.map((stage, i) => {
    const past = run.history.find(h => h.stageIndex === i);
    const choices = past && !stage.choices.some(c => c.id === past.nodeId) ? [{id:past.nodeId,type:past.type,name:past.name,lane:1,next:route[i+1]?.choices.map(c=>c.id)||[]}] : stage.choices;
    return choices.map(choice => ({...choice, stage:i, x:18+(choice.lane??1)*32, y:93-i*85/(route.length-1)}));
  });
  const chosenAt = i => run.history.find(h => h.stageIndex === i)?.nodeId || (i === run.routeIndex ? run.activeNode?.id : null);
  const edges = points.slice(0, -1).flatMap((row, i) => row.flatMap(from => points[i + 1].filter(to => run.schema !== 3 || !from.next || from.next.includes(to.id)).map(to => {
    const walked = chosenAt(i) === from.id && chosenAt(i + 1) === to.id;
    const available = run.phase === 'map' && allowed.has(to.id) && chosenAt(i) === from.id;
    const mid = (from.y + to.y) / 2;
    return `<path class="map-edge${walked ? ' walked' : available ? ' available' : ''}" d="M${from.x},${from.y-2} C${from.x},${mid} ${to.x},${mid} ${to.x},${to.y+2}"/>`;
  }))).join('');
  const nodes = points.flatMap(row => row.map(point => {
    const visited = chosenAt(point.stage) === point.id;
    const available = interactive && allowed.has(point.id);
    const current = point.stage === run.routeIndex && run.activeNode?.id === point.id;
    const state = visited ? current ? '현재 위치' : '지나온 길' : allowed.has(point.id) ? '이동 가능' : point.stage <= run.routeIndex ? '선택하지 않은 길' : '아직 도착하지 않음';
    const tag = available ? 'button' : 'div';
    const hint = NODE_HINTS[point.type];
    return `<${tag} class="map-point ${point.type}${visited ? ' visited' : ''}${available ? ' available' : ''}${current ? ' current' : ''}" style="--x:${point.x}%;--y:${point.y}%" ${available ? `data-node="${esc(point.id)}"` : ''} title="${esc(point.description||hint)}" aria-label="${esc(point.name)} · ${NODE_NAMES[point.type]} · ${state} · ${esc(hint)}" ${current ? 'aria-current="location"' : ''}><span class="map-point-icon">${visited && !current ? '✓' : NODE_ICONS[point.type]}</span><strong>${esc(point.name)}</strong><small>${visited&&!current?'완료':hint}</small>${available?'<em>선택해서 이동</em>':''}</${tag}>`;
  })).join('');
  const boss = route.at(-1).choices[0], coach = OPPONENTS[boss.opponentId];
  const encounterNotice = run.rulesVersion === 2 && !run.encounterVersion ? '<div class="legacy-notice">이어 하던 도전은 기존 상대 구성으로 진행합니다. 2인전·다섯 역할·새 카드는 새 도전부터 적용됩니다.<button class="button" data-action="restart-confirm">새 도전 시작</button></div>' : '';
  const intro = run.schema === 3
    ? `<div class="route-brief"><span>12개 지점 · 연결된 길을 따라 이동</span><strong>레전드는 선택, 마지막 정비는 확실하게.</strong><p>초반 훈련 → 장비와 도전 → 보스 전 휴식·강화</p></div><div class="boss-preview"><span>FINAL COACH</span><strong>${esc(coach.name)}</strong><p>${esc(coach.mechanic)}</p></div>`
    : '<div class="legacy-notice">이어하던 7지점 경로입니다. 새 도전부터 12지점 지도와 감독 보스가 적용됩니다.<button class="button" data-action="restart-confirm">새 지도 시작하기</button></div>';
  return `${run.rulesVersion !== 2 ? '<div class="legacy-notice">이어 하던 도전은 기존 카드 규칙으로 진행합니다. 새 공격수 카드·장비는 새 도전부터 적용됩니다.<button class="button" data-action="restart-confirm">새 규칙으로 시작</button></div>' : ''}${encounterNotice}${intro}<div class="tactics-board" style="--board-height:${Math.max(720,route.length*112)}px" aria-label="갈림길 전술 지도"><div class="board-pitch" aria-hidden="true"><i></i><b></b></div><span class="board-label">YOUTH / YOUR OWN PATH</span><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>${nodes}<span class="board-start">KICK OFF ↑</span></div><div class="map-legend"><span>⚽ 대결</span><span>◇ 엘리트</span><span>↗ 훈련장</span><span>☾ 라커룸</span><span>▣ 상점</span><span>✧ 이벤트</span><span>♛ 최종 시험</span></div>`;
}
function render() {
  ({CARDS, RELICS} = rulesFor(run));
  pitchDirty = true;
  document.body.dataset.phase = run.phase;
  const focusHand = document.activeElement?.dataset?.hand, focusHandTab = document.activeElement?.classList.contains('mobile-hand-tab'), focusReward = document.activeElement?.dataset?.reward;
  const focusTarget = document.activeElement?.dataset?.enemyTarget, focusTargetPosition = document.activeElement?.dataset?.targetPosition;
  const match = run.match, active = run.phase === 'match', prediction = forecast(run), route = routeFor(run);
  const hand = $('hand'), roundKey = active ? `${run.initialSeed}:${run.routeIndex}:${match.turn}` : '';
  const handScrollLeft = hand.dataset.roundKey === roundKey ? hand.scrollLeft : 0;
  const handKey = active ? JSON.stringify([roundKey, match.energy, match.hand.map(card => [card.uid, card.id, card.upgraded]), match.played.at(-1)?.id, match.discounts]) : '';
  const replaceHand = active && hand.dataset.renderKey !== handKey;
  const opponent = OPPONENTS[match?.opponentId] || OPPONENTS.school;
  const enemies = active && run.encounterVersion===1 && run.activeNode?.type==='match' ? enemyViews(run) : [], currentEnemy = enemies.find(e=>e.id===match.targetId) || enemies[0];
  let selectedPreview = null;
  $('condition-value').innerHTML = `${run.condition} <small>/ ${run.maxCondition}</small>`;
  $('condition-bar').style.width = `${100 * run.condition / run.maxCondition}%`;
  $('condition-bar').style.background = run.condition < 30 ? '#f26757' : '#db846d';
  $('gold-value').textContent = run.gold; $('deck-count').textContent = run.deck.length;
  $('route-progress').textContent = `${Math.min(run.routeIndex + 1, route.length)} / ${route.length}`;
  $('route-list').innerHTML = routeMap(run.phase === 'map');
  $('relic-count').textContent = run.relics.length;
  $('relic-list').innerHTML = run.relics.length ? run.relics.map(id=>`<button class="relic-token" data-relic="${id}" title="${esc(RELICS[id].name)}" aria-label="${esc(RELICS[id].name)} 설명">${itemCanvas(RELICS[id])}</button>`).join('') : '<span class="relic-empty">골드를 모아 지도 속 상점에서 아이템을 만나보세요.</span>';
  $('hero-name').textContent = run.playerName || '루키';
  $('round-label').textContent = run.activeNode?.type === 'boss' ? 'FINAL TRIAL' : `${Math.min(run.routeIndex+1,route.length)} / ${route.length}번째 여정`;
  $('match-title').textContent = active ? opponent.coach ? '감독의 전술을 돌파하라.' : opponent.legend ? '레전드의 벽을 넘어라.' : match.opponentId === 'school' ? '너의 플레이를 증명해.' : match.opponentId === 'champion' ? '다음 에이스는, 나다.' : '내 앞의 벽을 넘어서.' : run.phase === 'victory' ? '내 이름으로 쓴 첫 번째 전설.' : run.phase === 'defeat' ? '다시 일어날 이유는 충분해.' : '나를 완성하는 또 하나의 선택.';
  $('match-subtitle').textContent = active ? enemies.length>1 ? `${enemies.map(e=>e.name).join(' · ')} · 누구부터 공략할까요?` : opponent.subtitle : '내 기술, 내 장비, 나만의 플레이.';
  $('turn-counter').hidden = !active; $('turn-number').textContent = String(match?.turn||1).padStart(2,'0');
  $('home-score').textContent = run.condition; $('hero-max-hp').textContent = run.maxCondition;
  $('hero-hp-bar').style.width = `${run.condition/run.maxCondition*100}%`;
  $('opponent-name').textContent = currentEnemy?.name || opponent.name; $('enemy-role').textContent = currentEnemy?.roleLabel || ENEMY_ROLES[currentEnemy?.role] || (opponent.coach?'THE COACH':opponent.legend?'THE LEGEND':run.activeNode?.type==='boss'?'THE ACE':'THE RIVAL');
  $('pitch').setAttribute('aria-label', `${run.playerName||'루키'}와 ${enemies.length?enemies.map(e=>e.name).join(', '):opponent.name}의 대결`);
  const boss = active ? getBossView(run) : null, rule = $('combat-rule');
  rule.hidden = !active || !!enemies.length || !(boss || match.intent.rule || opponent.mechanic);
  rule.classList.toggle('boss-rule', !!boss); rule.classList.toggle('countered', !!boss?.countered);
  if (boss) {
    const progress = Math.max(0, Math.min(boss.max || 0, boss.progress || 0));
    rule.dataset.effect = boss.effect;
    rule.innerHTML = `<div class="boss-rule-heading"><strong>${esc(boss.title)}</strong>${boss.countered ? '<span class="boss-success">✓ 대응 성공</span>' : ''}${boss.max > 0 ? `<span class="boss-counter">${progress} / ${boss.max}</span>` : ''}</div><p>${esc(boss.detail)}</p>${boss.max > 0 ? `<div class="boss-rule-meter" role="progressbar" aria-label="${esc(boss.title)}" aria-valuemin="0" aria-valuemax="${boss.max}" aria-valuenow="${progress}" aria-valuetext="${esc(boss.detail)}"><i style="width:${100 * progress / boss.max}%"></i></div>` : ''}`;
  } else { delete rule.dataset.effect; rule.textContent = active ? (match.intent.rule || opponent.mechanic || '').replace('첫 공격에', '처음 피해를 주는 카드에') : ''; }
  document.body.dataset.encounter = opponent.coach ? 'coach' : opponent.legend ? 'legend' : 'rival';
  $('away-score').textContent = match?.enemyHp ?? opponent.maxHp; $('enemy-max-hp').textContent = match?.enemyMaxHp || opponent.maxHp;
  $('enemy-hp-bar').style.width = `${100*(match?.enemyHp??opponent.maxHp)/(match?.enemyMaxHp||opponent.maxHp)}%`;
  $('enemy-block-value').textContent = match?.enemyBlock||0; $('guard-value').textContent = match?.defense||0;
  $('combat-status').hidden = !active;
  $('enemy-combat-status').hidden = !active;
  const momentum = match?.momentum || 0, defense = match?.defense || 0;
  $('momentum-value').textContent = momentum;
  $('momentum-badge').setAttribute('aria-label', `기세 ${momentum} · 효과 설명 보기`);
  $('defense-status').setAttribute('aria-label', `방어 ${defense} · 효과 설명 보기`);
  $('enemy-defense-status').setAttribute('aria-label', `상대 방어 ${match?.enemyBlock || 0} · 효과 설명 보기`);
  $('momentum-badge').classList.toggle('charged', momentum > 0);
  $('defense-status').classList.toggle('charged', defense > 0);
  $('enemy-defense-status').classList.toggle('charged', (match?.enemyBlock || 0) > 0);
  for (const [kind, turns] of [['exposed', match?.enemyExposed || 0], ['weakened', match?.enemyWeakened || 0]]) {
    const label = kind === 'exposed' ? '약점 노출' : '공격 약화', button = $(`enemy-${kind}-status`);
    button.hidden = !active || turns === 0;
    $(`enemy-${kind}-value`).textContent = turns;
    button.setAttribute('aria-label', `${label} ${turns}턴 · 효과 설명 보기`);
    button.title = `${label} · ${turns}턴`;
  }
  const enemyAttack = active ? getEnemyAttack(run) : 0;
  $('incoming-value').textContent = enemyAttack; $('intent-name').textContent = active ? match.intent.name : '대결 종료';
  $('attack-modifier').hidden = !active || !match.enemyWeakened;
  $('attack-modifier').textContent = active && match.enemyWeakened ? `공격 약화 ${prediction.baseEnemyAttack} → ${enemyAttack}` : '';
  $('intent-description').textContent = active ? `공격 ${enemyAttack} − 방어 ${prediction.guard}${prediction.injuryDamage ? ` + 부상 피해 ${prediction.injuryDamage}` : ''}${prediction.injuryBlockLoss ? ` (부상으로 방어 −${prediction.injuryBlockLoss})` : ''} = 체력 피해 ${prediction.incoming}` : '';
  $('danger-badge').textContent = active ? prediction.incoming ? `예상 피해 ${prediction.incoming}` : '모두 방어' : '대결 종료';
  $('danger-badge').className = `outcome-badge${active&&prediction.incoming?' danger':' good'}`;
  $('hand-section').hidden = !active; $('phase-panel').hidden = active;
  if (active) {
    // Selecting a card must preserve its DOM node and the mobile scroll anchor.
    if (replaceHand) {
      hand.innerHTML = match.hand.length ? match.hand.map((card,i)=>cardHTML(card,'hand',i)).join('') : '<div class="hand-empty">손패를 모두 사용했어요.<br>턴을 종료하고 다음 기술을 준비하세요.</div>';
      const rows = Math.max(1, Math.ceil(match.hand.length / 6));
      hand.style.setProperty('--hand-rows', rows);
      hand.querySelectorAll('[data-hand]').forEach((button, index) => {
        const row = Math.floor(index / 6), count = Math.min(6, match.hand.length - row * 6), position = count > 1 ? (index % 6) / (count - 1) : .5;
        button.style.setProperty('--hand-index', index);
        button.style.setProperty('--hand-row', row);
        button.style.setProperty('--hand-position', position);
        button.style.setProperty('--hand-angle', `${(position - .5) * 12}deg`);
      });
      $('mobile-hand-tabs').style.setProperty('--hand-columns', Math.max(1, Math.min(6, match.hand.length)));
      $('mobile-hand-tabs').dataset.count = match.hand.length;
      $('mobile-hand-tabs').innerHTML = match.hand.map(card => `<button class="mobile-hand-tab ${CARDS[card.id].type}${costOf(card) > match.energy ? ' unaffordable' : ''}" data-hand="${esc(card.uid)}" aria-label="${esc(CARDS[card.id].name)}${card.upgraded ? ' 강화' : ''} 선택${CARDS[card.id].type === 'injury' ? ', 부상 · 사용 불가' : costOf(card) > match.energy ? ', 에너지 부족' : ''}" aria-pressed="${selected === card.uid}"><span class="mobile-hand-cost">${CARDS[card.id].type === 'injury' ? '—' : costOf(card)}</span><span class="mobile-hand-name">${esc(CARDS[card.id].name)}${card.upgraded ? '+' : ''}</span></button>`).join('');
      hand.dataset.renderKey = handKey; hand.dataset.roundKey = roundKey;
    } else {
      for (const button of $('hand-section').querySelectorAll('[data-hand]')) {
        const isSelected = button.dataset.hand === selected;
        button.classList.toggle('selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));
      }
    }
    hand.classList.toggle('has-selection', !!selected);
    $('draw-pile').innerHTML = `▤ <b>${match.draw.length}</b><small>뽑기</small>`;
    $('discard-pile').innerHTML = `▤ <b>${match.discard.length}</b><small>버림</small>`;
    $('energy-value').textContent = match.energy; $('energy-cap').textContent = `/ ${match.maxEnergy} 에너지`;
    const chosen=match.hand.find(c=>c.uid===selected), affordable=chosen&&costOf(chosen)<=match.energy;
    $('selected-info').innerHTML = chosen ? `<strong>${esc(CARDS[chosen.id].name)}${chosen.upgraded?' +':''}</strong><span>${esc(cardText(chosen))}</span>` : '<strong>이번 턴의 플레이를 골라보세요.</strong><span>카드 선택 → 사용. 공격은 즉시, 상대 행동은 턴 종료 후.</span>';
    const combo = comboFeedback(run, chosen);
    let comboPanel = $('combo-preview');
    if (!comboPanel) {
      comboPanel = document.createElement('div'); comboPanel.id = 'combo-preview'; comboPanel.className = 'combo-preview';
      comboPanel.setAttribute('role', 'status'); comboPanel.setAttribute('aria-live', 'polite');
      document.querySelector('.hand-heading').after(comboPanel);
    }
    comboPanel.hidden = !combo;
    comboPanel.classList.toggle('pending', !!combo && !combo.affordable);
    comboPanel.innerHTML = combo ? `<strong>${combo.affordable ? '↗ 연계 발동 예정' : '연계 조건 충족 · 에너지 부족'}</strong><small>${esc(combo.previous)} → ${esc(CARDS[chosen.id].name)}</small><span>${combo.effects.length ? combo.effects.map(effect => `<b>${esc(effect)}</b>`).join('') : '<b>연계 연결 · 카드 자체 추가 효과 없음</b>'}</span>` : '';
    for (const button of $('mobile-hand-tabs').querySelectorAll('[data-hand]')) {
      const feedback = comboFeedback(run, match.hand.find(c => c.uid === button.dataset.hand));
      button.classList.toggle('combo-ready', !!feedback && feedback.affordable);
      button.classList.toggle('combo-pending', !!feedback && !feedback.affordable);
      button.querySelector('.mobile-combo-badge')?.remove();
      if (feedback) {
        const badge = document.createElement('span'); badge.className = 'mobile-combo-badge'; badge.textContent = '↗ 연계'; button.prepend(badge);
        button.setAttribute('aria-label', `${CARDS[match.hand.find(c => c.uid === button.dataset.hand).id].name}, 연계 조건 충족${feedback.affordable ? '' : ', 에너지 부족'}`);
      }
    }
    if (chosen&&affordable) {
      const preview=act(run,{type:'play-card',uid:chosen.uid,targetId:match.targetId});
      selectedPreview = preview;
      const damage=Math.max(0,match.enemyHp-(preview.match?.enemyHp??match.enemyHp)), block=Math.max(0,(preview.match?.defense||0)-match.defense);
      const healthCost=Math.max(0,run.condition-preview.condition), broken=Math.max(0,match.enemyBlock-(preview.match?.enemyBlock??match.enemyBlock));
      const momentumGain=Math.max(0,(preview.match?.momentum??match.momentum)-match.momentum);
      const exposedGain=Math.max(0,(preview.match?.enemyExposed||0)-(match.enemyExposed||0)), weakenedGain=Math.max(0,(preview.match?.enemyWeakened||0)-(match.enemyWeakened||0));
      const remainingBlock = preview.match?.defense ?? match.defense;
      const previewEffects = [CARDS[chosen.id].type === 'header' && `사용 후 방어 ${remainingBlock}`, damage&&`피해 ${damage}`, block&&`방어 +${block}`, broken&&`상대 방어 −${broken}`, momentumGain&&`기세 +${momentumGain}`, exposedGain&&`약점 노출 +${exposedGain}턴`, weakenedGain&&`공격 약화 +${weakenedGain}턴`, weakenedGain&&getEnemyAttack(preview)!==enemyAttack&&`상대 공격 ${enemyAttack} → ${getEnemyAttack(preview)}`, healthCost&&`내 체력 −${healthCost}`].filter(Boolean);
      const perTarget = enemies.length ? enemies.filter(e=>e.hp>0).map(enemy=>{
        const change = enemyChangeText(enemy,enemyViews(preview).find(e=>e.id===enemy.id));
        return change && `${enemy.name}: ${change}`;
      }).filter(Boolean) : [];
      const summary = perTarget.length ? [...perTarget, block&&`내 방어 +${block}`, CARDS[chosen.id].type==='header'&&`남는 방어 ${remainingBlock}`,momentumGain&&`기세 +${momentumGain}`,healthCost&&`내 체력 −${healthCost}`].filter(Boolean).join(' · ') : previewEffects.join(' · ');
      $('damage-preview').textContent = (combo ? '연계 포함 · ' : '') + (summary||'카드 효과 적용');
    } else $('damage-preview').textContent=chosen ? CARDS[chosen.id].type === 'injury' ? '부상은 사용할 수 없어요 · 턴 종료 효과를 확인하세요' : '에너지가 부족해요' : run.rulesVersion === 2 ? '기세 · 연계 · 제공권' : '드리블 → 기세 → 강화된 슛';
    $('play-card-button').disabled=busy||!affordable||!!match.choice; $('play-card-button').textContent=chosen&&CARDS[chosen.id].type === 'injury'?'사용 불가':chosen&&!affordable?'에너지 부족':'카드 사용';
    if (chosen && affordable && enemies.length>1) { const scope=targetScope(chosen); $('play-card-button').textContent=scope==='all'?'전체 공격':scope==='self'?'카드 사용':`${currentEnemy?.name || '상대'}에게 사용`; }
    $('end-turn').disabled=busy||!!match.choice; $('end-turn').textContent=busy?'상대 행동…':'턴 종료 →';
  } else { delete hand.dataset.renderKey; delete hand.dataset.roundKey; renderPhase(); }
  renderEnemyTargets(active ? match.hand.find(c=>c.uid===selected) : null, selectedPreview, prediction);
  $('commentary').textContent=(run.message||'기세를 모아 슛에 싣고, 상대의 다음 공격을 읽으세요.').replaceAll('헬스장','훈련장').replaceAll('휴식처','라커룸');
  $('sound-button').setAttribute('aria-pressed',String(sound)); $('sound-button').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기'); $('sound-button').style.color=sound?'var(--mint)':'';
  paintCards();
  if(focusHand) document.querySelector(`${focusHandTab ? '.mobile-hand-tab' : '#hand .card'}[data-hand="${CSS.escape(focusHand)}"]`)?.focus({preventScroll:true});
  if(focusReward) document.querySelector(`[data-reward="${CSS.escape(focusReward)}"]`)?.focus({preventScroll:true});
  if(focusTarget) document.querySelector(`${focusTargetPosition==='dock'?'#mobile-targets':focusTargetPosition==='stage'?'#enemy-stage-targets':'#enemy-target-list'} [data-enemy-target="${CSS.escape(focusTarget)}"]:not(:disabled)`)?.focus({preventScroll:true});
  if (replaceHand) hand.scrollLeft = handScrollLeft;
  syncRewardDialog();
  renderStrikerStatus();
  syncCombatChoice();
}
function choiceButton(choice) {
  return `<button class="choice-button" data-node="${choice.id}"><span class="choice-icon">${NODE_ICONS[choice.type]}</span><strong>${esc(choice.name)}</strong><small>${esc(choice.description)}</small><em>선택하고 이동 →</em></button>`;
}
function renderPhase() {
  const panel = $('phase-panel'), name = run.activeNode?.name || '';
  const heading = (eyebrow, title, description) => `<span class="phase-eyebrow">${eyebrow}</span><h3>${title}</h3><p>${description}</p>`;
  if (run.phase === 'map') panel.innerHTML = heading('YOUR GAME PLAN', '전설은, 내가 선택한 길 위에.', '밝게 표시된 지점을 선택하세요. 한 갈래를 고르면 되돌아갈 수 없어요. 회복·강화·구매는 해당 장소에 도착했을 때만 가능합니다.') + routeMap(true);
  if (run.phase === 'reward') {
    const opponent = OPPONENTS[run.match?.opponentId];
    if (run.relicOffers?.length) {
      if (!run.relicOffers.includes(eliteRelicSelection)) eliteRelicSelection = null;
      panel.innerHTML = heading('ELITE VICTORY / EXCLUSIVE RELIC', `${esc(opponent.name)} 격파 · 전용 유물`, `유물 ${run.relicOffers.length}개 중 하나를 고르세요. 유물을 받은 뒤 카드 보상을 선택합니다.`) + `<section class="elite-reward"><div class="elite-relic-grid">${run.relicOffers.map(id => {
        const relic = RELICS[id], chosen = eliteRelicSelection === id;
        return `<button class="elite-relic-option${chosen ? ' selected' : ''}" data-elite-relic="${id}" aria-label="${esc(relic.name)}: ${esc(relic.description)}" aria-pressed="${chosen}"><span class="item-tag">${esc(opponent.name)} 전용</span>${itemCanvas(relic)}<strong>${esc(relic.name)}</strong><p>${esc(relic.description)}</p><span class="elite-relic-select">${chosen ? '선택됨' : '선택'}</span></button>`;
      }).join('')}</div><div class="phase-actions"><button class="button primary" data-action="take-elite-relic"${eliteRelicSelection ? '' : ' disabled'}>이 유물 받기 →</button></div></section>`;
      return;
    }
    const relic = RELICS[run.rewardRelic];
    const rewardTitle = opponent?.legend ? '레전드를 넘었다. 새로운 기술을 골라라.' : '한계를 넘었다. 다음 기술을 골라라.';
    const earned = relic ? `<div class="relic-earned">${itemCanvas(relic)}<div><span>전용 유물 획득 · 효과 적용</span><strong>${esc(relic.name)}</strong><p>${esc(relic.description)}</p></div></div>` : '';
    panel.innerHTML = heading('TRIAL COMPLETE / NEW TECHNIQUE', rewardTitle, esc(run.message)) + earned + '<div class="reward-pending"><p>카드 보상이 기다리고 있어요. 선택 창에서 세 장을 한눈에 비교하세요.</p><button class="button primary" data-action="open-reward">카드 보상 고르기 →</button></div>';
  }
  if (run.phase === 'training') panel.innerHTML = heading('TRAINING DAY', esc(name), '카드를 눌러 강화 전후를 비교하세요. 한 장을 강화하거나 무료로 제거하면 훈련을 마칩니다. 무료 제거는 덱이 9장 이상일 때 가능합니다.') + `<div class="deck-choice-grid">${run.deck.filter(c => CARDS[c.id].type !== 'injury').map(c => `<section class="deck-choice">${cardHTML(c, c.upgraded ? 'view' : 'upgrade')}<div class="deck-choice-actions"><button class="button" data-upgrade="${esc(c.uid)}" aria-label="${esc(CARDS[c.id].name)} ${c.upgraded ? '강화 완료' : '강화 전후 비교'}" ${c.upgraded ? 'disabled' : ''}>${c.upgraded ? '강화 완료' : '강화 비교'}</button><button class="button" data-remove="${esc(c.uid)}" aria-label="${esc(CARDS[c.id].name)} 무료 제거" ${playableDeckSize() <= 8 ? 'disabled' : ''}>무료 제거</button></div></section>`).join('')}</div><div class="phase-actions"><button class="button" data-action="leave">훈련 건너뛰기 →</button></div>`;
  if (run.phase === 'rest') panel.innerHTML = heading('TAKE A BREATH', esc(name), '잠시 멈추는 것도 앞으로 나아가는 방법입니다. 체력을 30 회복하고 다음 여정을 준비하세요.') + `<div class="stats-row"><span><b>${run.condition}</b>현재 체력</span><span><b>→</b></span><span><b>${Math.min(run.maxCondition, run.condition + 30)}</b>휴식 후 체력</span></div><div class="phase-actions"><button class="button primary" data-action="rest">충분히 쉬기 →</button></div>`;
  if (run.phase === 'rest' && run.rulesVersion === 2) {
    const injuries = run.deck.filter(c => CARDS[c.id].type === 'injury');
    panel.insertAdjacentHTML('beforeend', `<section class="injury-treatment"><h4>부상 치료 · ACT당 1회</h4><p>체력 회복 대신 덱 부상 한 장을 제거합니다. 장비는 유지됩니다.</p>${run.treatedActs.includes(run.actNumber) ? '<p>이번 ACT의 치료를 이미 사용했어요.</p>' : injuries.length ? `<div class="phase-actions">${injuries.map(c => `<button class="button" data-treat="${esc(c.uid)}">${esc(CARDS[c.id].name)} 치료</button>`).join('')}</div>` : '<p>치료할 덱 부상이 없어요.</p>'}</section>`);
  }
  if (run.phase === 'shop') {
    const merchantLine = run.shopOffers.length ? '좋은 선수는 좋은 선택에 투자하지. 필요한 장비부터 골라봐.' : '오늘 준비한 장비는 전부 나갔군. 떠나기 전에 덱도 한 번 살펴보게.';
    panel.innerHTML = `<section class="shop-hero" aria-labelledby="shop-title"><div class="shop-portrait"><img src="./assets/merchant-levy.png" alt="다니엘 레비를 모티브로 한 도트 상인이 축구 장비 카운터에서 맞이합니다." width="512" height="512" decoding="async" draggable="false"></div><div class="shop-welcome"><span class="phase-eyebrow">SPORTS SHOP</span><h3 id="shop-title">${esc(name)}</h3><div class="merchant-identity"><strong>다니엘 레비</strong><span>스포츠 상점 주인</span></div><p class="merchant-dialogue">${merchantLine}</p><p class="shop-promise">장착 제한 없이 효과 누적 · 이번 도전 동안 유지</p></div></section><div class="shop-balance"><strong>보유 골드 ● ${run.gold}</strong><span>장비는 구입 즉시 적용</span></div><div class="shop-grid">${run.shopOffers.map(id=>{const r=RELICS[id]; return `<article class="shop-item"><span class="item-tag">${RARITY_NAMES[r.rarity]||'특별'} 아이템</span>${itemCanvas(r)}<h4>${esc(r.name)}</h4><p>${esc(r.description)}</p><button data-buy="${id}" ${run.gold<r.price?'disabled':''}>● ${r.price} · ${run.gold<r.price?'골드 부족':'구매'}</button></article>`;}).join('')||'<p class="dialog-copy shop-empty">진열된 장비를 모두 구입했어요. 카드 제거 서비스를 이용하거나 다음 여정으로 떠날 수 있습니다.</p>'}</div><div class="phase-actions"><button class="button" data-action="equipment">내 아이템 확인</button><button class="button primary" data-action="leave">다음 여정으로 →</button></div>`;
    if (run.rulesVersion === 2) panel.querySelector('.phase-actions').insertAdjacentHTML('beforebegin', `<section class="shop-card-section"><h4>기술 카드</h4><p class="shop-card-help">일반 70 · 특별 150 · 희귀 320골드<br>구매한 카드는 내 덱에 추가됩니다.</p><div class="shop-card-grid">${run.shopCards.map(id => {
      const price = Current.CARD_PRICES[CARDS[id].rarity], reason = playableDeckSize() >= 40 ? '덱 가득 참' : run.gold < price ? '골드 부족' : '구매';
      return `<section class="shop-card-offer">${cardHTML({id,upgraded:false})}<button class="button" data-buy-card="${id}" aria-label="${esc(CARDS[id].name)} · ${price}골드 · ${reason}" ${reason !== '구매' ? 'disabled' : ''}><span>● ${price}골드</span><strong>${reason}</strong></button></section>`;
    }).join('') || '<p class="shop-empty">진열된 기술 카드를 모두 구입했어요.</p>'}</div></section>`);
    const price = getCardRemovalCost(run), blocked = playableDeckSize() <= 1 || run.gold < price;
    panel.querySelector('.shop-grid').insertAdjacentHTML('beforebegin', `<section class="shop-removal"><div><span class="phase-eyebrow">DECK SERVICE</span><h4>카드 제거 <strong>● ${price}</strong></h4><p>내 덱에서 한 장을 고릅니다. 제거할 때마다 25골드씩 오르며 다음 상점에도 이어집니다.</p></div><button class="button" data-action="shop-remove" ${blocked ? 'disabled' : ''}>${playableDeckSize() <= 1 ? '마지막 카드는 유지' : run.gold < price ? '골드 부족' : '제거할 카드 고르기'}</button></section>`);
  }
  if (run.phase === 'event') panel.innerHTML = heading('A CHANCE ENCOUNTER', '관중석의 낯선 시선.', '“방금 그 움직임, 한 번 더 보여줄 수 있겠니?” 경기가 끝난 뒤 스카우트가 당신을 불러 세웠습니다.') + `<div class="choice-grid"><button class="choice-button" data-event="risk"><span class="choice-icon">✧</span><strong>추가 테스트에 도전한다</strong><small>체력 12 소모 · 자금 35와 ${run.rulesVersion === 2 ? '특별' : '희귀'} 카드 1장 획득.</small><em>오늘의 땀이 내일의 기회로</em></button><button class="choice-button" data-event="safe"><span class="choice-icon">☾</span><strong>다음 기회를 기약한다</strong><small>체력 5 회복 · 자금 15 획득.</small><em>내 페이스를 지키는 선택</em></button></div>`;
  if (run.phase === 'victory' || run.phase === 'defeat') {
    const won = run.phase === 'victory';
    panel.innerHTML = heading(won ? 'THE NEXT ACE' : 'EVERY LEGEND STARTS AGAIN', won ? `${esc(run.playerName||'루키')}, 다음 에이스가 되다.` : '다음 휘슬을 기다리며.', won ? '마지막 시험을 넘어, 내 가능성을 증명했습니다. 프로 리그와 새로운 포지션의 이야기는 다음 버전에서 이어집니다.' : esc(run.message || '오늘의 경험이 다음 도전의 힘이 됩니다. 새로운 덱으로 다시 시작해 보세요.')) + `<div class="stats-row"><span><b>${run.stats.wins}</b>승리한 대결</span><span><b>${run.stats.damage}</b>누적 피해</span><span><b>${run.stats.blocks}</b>피해 방어</span></div><div class="phase-actions"><button class="button" data-action="deck">완성한 덱 보기</button><button class="button primary" data-action="restart-confirm">새로운 도전 →</button></div>`;
  }
}
function cardRewardKey() {
  return run.phase === 'reward' && !run.relicOffers?.length && run.offers?.length
    ? `${run.initialSeed}:${run.routeIndex}:${run.offers.join(',')}` : null;
}
function syncRewardDialog() {
  clearTimeout(rewardDialogTimer);
  const key = cardRewardKey();
  if (!key) {
    rewardDialogSeen = null;
    $('reward-dialog').close();
    return;
  }
  if ($('reward-dialog').open) return updateRewardSelection();
  if (rewardDialogSeen === key) return;
  // Let the final hit finish, then bring the choice to the player without scrolling.
  rewardDialogTimer = setTimeout(() => {
    if (cardRewardKey() === key && !$('dialog').open && !$('route-dialog').open && !tutorial.active) showRewardDialog();
  }, animation?.type === 'goal' && !motion.matches ? 650 : 0);
}
function showRewardDialog() {
  const key = cardRewardKey();
  if (!key) return;
  clearTimeout(rewardDialogTimer);
  if (!run.offers.includes(rewardSelection)) rewardSelection = null;
  $('reward-options').innerHTML = run.offers.map(id => cardHTML({ id, upgraded: false }, 'reward')).join('');
  $('reward-subtitle').textContent = playableDeckSize() >= 40 ? '사용 가능한 카드가 40장으로 가득 찼어요. 카드를 받지 않고 계속할 수 있어요.' : `카드 ${run.offers.length}장 중 하나를 골라 효과를 확인하세요.`;
  rewardDialogSeen = key;
  updateRewardSelection();
  if (!$('reward-dialog').open) $('reward-dialog').showModal();
  paintCards($('reward-dialog'));
  $('reward-title').focus({ preventScroll: true });
}
function updateRewardSelection() {
  const chosen = cardRewardKey() && run.offers.includes(rewardSelection), card = chosen ? { id: rewardSelection, upgraded: false } : null;
  for (const button of $('reward-options').querySelectorAll('[data-reward]')) {
    const active = chosen && button.dataset.reward === rewardSelection;
    button.classList.toggle('selected', !!active);
    button.setAttribute('aria-pressed', String(!!active));
  }
  const detail = $('reward-detail'), confirm = $('reward-confirm');
  if (card) {
    const def = CARDS[card.id], category = def.type === 'defense' ? 'defense' : (run.rulesVersion === 2 ? ['shot','pass','dribble','header'] : ['shot','pass']).includes(def.type) ? 'attack' : 'skill';
    detail.dataset.category = category;
    detail.innerHTML = `<div class="reward-detail-meta"><span>${CARD_CATEGORIES[category].name}${CARD_SUBTYPES[def.type] && !['training','injury'].includes(def.type) ? ` · ${CARD_SUBTYPES[def.type]}` : ''}</span><span>에너지 ${costOf(card)} · ${RARITY_NAMES[def.rarity]}</span></div><h3>${esc(def.name)}</h3><p>${esc(cardText(card))}</p>`;
  } else {
    delete detail.dataset.category;
    detail.innerHTML = '<h3>배우고 싶은 기술을 골라보세요.</h3><p>카드를 누르면 자세한 효과가 여기에 표시돼요. 받기 버튼으로 선택을 확정하세요.</p>';
  }
  confirm.disabled = !chosen || playableDeckSize() >= 40;
  confirm.textContent = playableDeckSize() >= 40 ? '덱이 가득 찼어요' : chosen ? '이 카드 받기 →' : '카드를 선택하세요';
}
function takeCardReward(skip = false) {
  if (!cardRewardKey() || (!skip && (!run.offers.includes(rewardSelection) || playableDeckSize() >= 40))) return;
  dispatch({ type: 'take-reward', id: skip ? null : rewardSelection });
}
function openDialog(title, content) { $('dialog').classList.remove('combat-choice-dialog'); $('dialog-title').textContent = title; $('dialog-body').innerHTML = content; if (!$('dialog').open) $('dialog').showModal(); paintCards($('dialog')); }
function showDeck(cards = run.deck, title = `나의 덱 · ${run.deck.length}장`) {
  openDialog(title, cards.length ? `<div class="dialog-cards">${cards.map(c => cardHTML(c)).join('')}</div>` : '<p class="dialog-copy">아직 카드가 없어요.</p>');
}
function showCombatStat(kind) {
  if (run.phase !== 'match' || !run.match) return;
  const enemy = kind === 'enemy-defense', shield = enemy || kind === 'defense';
  const momentum = run.match.momentum, defense = enemy ? run.match.enemyBlock : run.match.defense;
  const icon = $(enemy ? 'enemy-defense-status' : shield ? 'defense-status' : 'momentum-badge').querySelector('svg').outerHTML;
  let details = enemy
    ? `<p>내 카드가 주는 피해를 <strong>상대 체력보다 먼저</strong> 막아요.</p><div class="rule-note">현재 상대 방어 <strong>${defense}</strong><br>방어가 막은 만큼 줄어들고,<br><strong>남은 피해만 상대 체력에 적용</strong>돼요.</div><p>다음 내 턴이 시작되면 상대의 새 행동에 맞춰 방어가 다시 정해져요. 이전 턴의 남은 방어에 더해지지는 않아요.</p>${run.match.intent.dribbleBreak ? `<p>현재 상대는 드리블 카드를 사용하면 방어가 <strong>${run.match.intent.dribbleBreak} 추가로 감소</strong>해요.</p>` : ''}`
    : shield
    ? `<p>턴 종료 시 상대 공격 피해를 <strong>최대 ${defense}까지</strong> 막아요.</p><div class="rule-note">${run.match.enemyWeakened ? `공격 약화: ${forecast(run).baseEnemyAttack} → ${getEnemyAttack(run)}<br>` : ''}상대 공격 ${getEnemyAttack(run)} − 내 방어 ${defense}<br><strong>예상 체력 피해 ${forecast(run).incoming}</strong></div><p>방어 카드를 사용해 쌓을 수 있어요. 남은 방어는 <strong>다음 내 턴 시작 시 초기화</strong>되고, 장비로 얻는 턴 시작 방어는 다시 적용돼요.</p><p>반사 피해와 카드의 체력 소모는 막지 못해요.</p>`
    : `<p>드리블과 카드·장비 효과로 쌓는 공격 보너스예요.</p><div class="rule-note">현재 기세로 얻는 추가 피해<br>일반 슛: <strong>+${momentum}</strong><br>발리 슈팅: <strong>+${momentum * 2}</strong></div><p>기세는 <strong>턴이 지나도 유지</strong>돼요. 슛 카드를 사용하면 현재 기세를 <strong>전부 소모</strong>해 피해를 더합니다. 상대 방어에 막혀도 소모돼요. 기세가 높을수록 선수 주변의 금빛 기운도 강해져요.</p>`;
  if (run.rulesVersion === 2 && !enemy) details = shield
    ? `<p>상대 공격을 체력보다 먼저 막습니다. 헤더는 공격 전에 방어 일부를 소모할 수 있어요.</p><p>제공권 훈련이 있으면 상대 행동 후 남은 방어를 최대 <strong>${run.match.training.aerial || 0}</strong> 유지하고, 그 외에는 다음 턴에 초기화됩니다.</p><p>손에 남은 발목 통증 한 장당 방어가 2 감소한 후 상대가 공격합니다. 찰과상과 체력 소모는 방어로 막을 수 없어요.</p><div class="rule-note">부상까지 반영한 예상 체력 피해 ${forecast(run).incoming}</div>`
    : `<p>전진 드리블과 폭발력 훈련으로 모읍니다. 기세는 다음 턴까지 유지되고 전투가 끝나면 사라져요.</p><div class="rule-note">일반 슛 추가 피해 +${momentum}<br>발리 슈팅 추가 피해 +${momentum * 3}<br>힘 조절 슈팅: 최대 2만 소모, 1당 피해 +2</div><p>각 카드에 적힌 만큼 소모합니다. 헤더는 기세를 사용하지 않습니다. 장비는 슛의 피해를 강화하며 기세를 자동 생성하지 않아요.</p>`;
  openDialog(enemy ? '상대 방어 · 내 공격을 막는 힘' : shield ? '방어 · 상대 공격을 막는 힘' : '기세 · 다음 슛의 추가 피해', `<section class="combat-stat-help ${shield ? 'shield-help' : 'momentum-help'}"><div class="stat-help-value">${icon}<strong>${shield ? defense : momentum}</strong></div><div class="dialog-copy">${details}</div><div class="phase-actions"><button class="button primary" data-action="close">확인</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function showEnemyDebuff(kind) {
  if (run.phase !== 'match' || !run.match) return;
  const exposed = kind === 'exposed', turns = exposed ? run.match.enemyExposed : run.match.enemyWeakened;
  if (!turns) return;
  const title = exposed ? '약점 노출' : '공격 약화';
  const icon = $(`enemy-${kind}-status`).querySelector('svg').outerHTML;
  const effect = exposed
    ? '<p>내 카드가 주는 피해가 <strong>50% 증가</strong>해요. 기세와 장비 보너스를 더한 뒤 계산하며, 소수점은 버리고 상대 방어를 적용합니다.</p><div class="rule-note">예: 카드 피해 10 → <strong>15</strong><br>상대 방어가 4라면 실제 체력 피해 <strong>11</strong></div><p>공격과 함께 약점을 거는 카드는 <strong>피해를 먼저 준 뒤</strong> 새 약점을 적용해요.</p>'
    : `<p>턴 종료 시 상대가 주는 공격 피해가 <strong>25% 감소</strong>해요. 소수점을 버린 뒤 내 방어로 한 번 더 막습니다.</p><div class="rule-note">현재 상대 공격 ${forecast(run).baseEnemyAttack} → <strong>${getEnemyAttack(run)}</strong><br>내 방어 ${run.match.defense} 적용 후 예상 체력 피해 <strong>${forecast(run).incoming}</strong></div><p>반사 피해와 카드의 체력 소모에는 적용되지 않아요.</p>`;
  openDialog(`${title} · ${turns}턴 남음`, `<section class="combat-stat-help ${exposed ? 'exposed-help' : 'weakened-help'}"><div class="stat-help-value">${icon}<strong>${turns}</strong><span>턴</span></div><div class="dialog-copy">${effect}<p>숫자는 <strong>지금 내 턴을 포함한 남은 턴</strong>이에요. 상대 행동이 끝날 때마다 1씩 줄고, 0이 되면 사라집니다.</p><p>같은 효과를 다시 걸면 <strong>남은 턴만 더해져요</strong>. 최대 99턴이며 피해 비율은 중첩되지 않습니다.</p></div><div class="phase-actions"><button class="button primary" data-action="close">확인</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function showShopRemoval() {
  const price = getCardRemovalCost(run);
  if (busy || run.phase !== 'shop' || playableDeckSize() <= 1 || run.gold < price) return;
  openDialog(`카드 제거 · ${price}골드`, `<section class="removal-picker"><p class="dialog-copy">제거할 카드를 고르면 마지막으로 확인합니다. 보유 ${run.gold}골드 · 제거 후 ${run.gold - price}골드</p><div class="deck-choice-grid">${run.deck.filter(c => CARDS[c.id].type !== 'injury').map(c => cardHTML(c, 'remove')).join('')}</div></section>`);
  $('dialog').scrollTop = 0;
}
function showRemovalPreview(uid) {
  const card = run.deck.find(c => c.uid === uid), price = getCardRemovalCost(run);
  if (busy || run.phase !== 'shop' || !card || playableDeckSize() <= 1 || run.gold < price) return;
  openDialog('이 카드를 덱에서 제거할까요?', `<section class="removal-preview">${cardHTML(card)}<p>이번 도전의 덱에서 이 카드 <strong>1장</strong>을 제거합니다.</p><div class="removal-price"><strong>● ${price}골드</strong><span>보유 ${run.gold} → ${run.gold - price}골드</span><small>다음 제거 비용: ${price + 25}골드</small></div><div class="phase-actions"><button class="button" data-action="shop-remove">다시 고르기</button><button class="button primary" data-confirm-remove="${esc(uid)}">${price}골드로 제거</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function confirmShopRemoval(uid) {
  if (changedElsewhere) return toast('다른 창의 진행을 먼저 새로고침해 주세요.');
  if (busy || run.phase !== 'shop' || playableDeckSize() <= 1 || run.gold < getCardRemovalCost(run) || !run.deck.some(c => c.uid === uid)) return;
  $('dialog').close();
  dispatch({ type: 'remove-card', uid });
}
function upgradeComparisonRows(card) {
  const upgraded = { ...card, upgraded: true }, before = cardText(card), after = cardText(upgraded);
  const rows = [{ label: '사용 에너지', before: costOf(card), after: costOf(upgraded) }];
  // Read the same descriptions as the cards so preview values follow the engine.
  const metrics = [
    ['피해', /(?:^|\.\s*)피해 (\d+)/],
    ['방어', /이번 턴 방어 \+(\d+)/],
    ['기세 획득', /기세 \+(\d+)/],
    ['약점 노출 (턴)', /약점 노출 (\d+)턴/],
    ['공격 약화 (턴)', /공격 약화 (\d+)턴/],
    ['에너지 회복', /^에너지 \+(\d+)/],
    ['내 체력 소모', /내 체력 (\d+) 소모/],
    ['5턴부터 추가 피해', /5턴부터 피해 \+(\d+)/],
    ['카드 뽑기', /카드 (\d+)장 뽑기/],
  ];
  for (const [label, pattern] of metrics) {
    const current = before.match(pattern), next = after.match(pattern);
    if (current && next) rows.push({ label, before: Number(current[1]), after: Number(next[1]) });
  }
  return rows.map(row => `<tr><th scope="row">${row.label}</th><td>${row.before}</td><td${row.before !== row.after ? ' class="improved"' : ''}>${row.after}</td></tr>`).join('');
}
function showUpgradePreview(uid) {
  const card = run.deck.find(c => c.uid === uid);
  if (run.phase !== 'training' || !card || card.upgraded || busy) return;
  openDialog(`카드 강화 · ${CARDS[card.id].name}`, `<section class="upgrade-preview"><p class="dialog-copy">전후 수치를 확인하고 강화할 카드를 확정하세요. 이번 훈련에서는 한 장만 강화할 수 있습니다.</p><div class="upgrade-comparison"><section class="upgrade-card-side"><h3>강화 전</h3>${cardHTML(card)}</section><section class="upgrade-card-side"><h3>강화 후</h3>${cardHTML({ ...card, upgraded: true })}</section></div><table class="upgrade-changes"><caption>능력치 비교</caption><thead><tr><th scope="col">항목</th><th scope="col">강화 전</th><th scope="col">강화 후</th></tr></thead><tbody>${upgradeComparisonRows(card)}</tbody></table><p class="upgrade-note">카드 기본 수치 기준입니다. 보유 장비의 추가 효과는 그대로 적용됩니다.</p><div class="upgrade-actions"><button class="button" data-action="close">돌아가기</button><button class="button primary" data-confirm-upgrade="${esc(uid)}">이 카드 강화 →</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function confirmUpgrade(uid) {
  if (changedElsewhere) return toast('다른 창의 진행을 먼저 새로고침해 주세요.');
  const card = run.deck.find(c => c.uid === uid);
  if (busy || run.phase !== 'training' || !card || card.upgraded) return;
  $('dialog').close();
  dispatch({ type: 'upgrade-card', uid });
}
function showHelp() {
  openDialog('플레이북 · 나만의 선수로 싸우는 법', `<div class="dialog-copy"><strong>한 선수, 나만의 기술 덱.</strong><ol>
    <li>상대 선수의 체력을 0으로 만들면 승리합니다. 내 체력은 다음 대결까지 이어지며, 0이 되면 도전이 끝납니다.</li>
    <li>매 턴 카드 5장과 에너지 3을 받습니다. 카드 선택 후 <strong>카드 사용</strong>을 누르면 즉시 효과가 적용됩니다.</li>
    <li><strong>드리블로 기세를 쌓고 슛으로 소비</strong>하세요. 기세는 턴이 지나도 유지되고, 슛 카드가 모인 기세를 추가 피해로 바꿉니다.</li>
    <li><strong>약점 노출</strong>은 내 카드 피해를 50% 늘리고, <strong>공격 약화</strong>는 상대 공격 피해를 25% 줄입니다. 소수점은 버리고 방어를 적용합니다. 공격과 함께 거는 디버프는 그 공격이 끝난 뒤 적용됩니다.</li>
    <li>상대 아래 디버프 아이콘의 숫자는 <strong>지금 내 턴을 포함한 남은 턴</strong>입니다. 상대 행동 후 1씩 줄어들며, 다시 걸면 기간만 늘어납니다. 아이콘을 누르면 자세한 설명을 볼 수 있습니다.</li>
    <li>감독전에서는 구장 위의 <strong>전술 조건과 진행 수치</strong>를 읽으세요. 수비벽 돌파, 카드 종류 조합, 세트피스 방해, 연계 끊기처럼 감독마다 대응법이 다릅니다. 대응에 성공하면 다음 공격 예고와 전술 연출도 바뀝니다.</li>
    <li>큰 피해에는 더 강한 타격 연출, 방어에는 방패 충돌이 표시됩니다. 소리는 메뉴에서 켤 수 있고, 기기의 <strong>동작 줄이기</strong> 설정을 사용하면 흔들림과 움직임을 줄입니다.</li>
    <li>상대 머리 위의 공격 예고를 보고 방어를 준비하세요. 턴 종료 시 상대가 공격하고, 남은 방어는 다음 턴에 사라집니다${run.rulesVersion === 2 ? ' (제공권 훈련은 일부 유지)' : ''}.</li>
    <li>승리 후 카드와 골드를 얻습니다. <strong>상점에서 산 아이템 효과는 부위 제한 없이 누적</strong>됩니다. 아이템은 이번 도전 동안 유지됩니다.</li>
    <li>카드를 고른 뒤 전술 지도로 돌아옵니다. 훈련장에 도착하면 카드 강화·정리를, 라커룸에서는 체력 회복${run.rulesVersion === 2 ? ' 또는 ACT당 한 번 부상 치료' : ''}를 할 수 있습니다. 상점은 지도 중간의 지정 지점에서만 방문합니다. 상점 카드 제거는 50골드부터 시작하고 제거할 때마다 25골드씩 오릅니다.</li>
    ${run.rulesVersion === 2 ? '<li><strong>테크닉 연계</strong>: 서로 다른 터치·드리블을 연달아 쓰면 발동. 다른 종류는 연계를 끊습니다.</li><li><strong>제공권 헤더</strong>: 방어 일부를 먼저 소모해 공격합니다. 기세는 유지됩니다.</li><li><strong>훈련과 휘발성</strong>: 훈련은 즉시 효과 또는 전투 동안 지속되는 효과를 줍니다. 휘발성 카드는 사용 후 이번 전투에서 소멸합니다.</li><li><strong>부상</strong>: 덱 부상은 라커룸에서 ACT당 1회, 한 장 치료할 수 있습니다. 카드 효과로 생긴 전투 한정 부상은 전투 후 사라집니다. 일반 카드 제거로는 치료할 수 없습니다.</li>' : ''}
    </ol><div class="rule-note">PC: 숫자 1~9 카드 선택 · Enter 사용 · Space 턴 종료.<br>모바일: 겹친 손패 또는 아래 카드 이름 터치 → 카드 사용. 선택한 카드가 크게 표시됩니다.<br>공격수 1명 · 기술 ${Object.values(CARDS).filter(c => c.type !== 'injury').length}종${run.rulesVersion === 2 ? ' · 부상 3종' : ''} · 아이템 ${Object.keys(RELICS).length}종 · 엘리트 4명 · 감독 보스 7명.<br>새 도전은 12지점 경로입니다. 엘리트는 선택해서 도전하며, 승리하면 선수별 전용 유물 3개 중 하나를 고른 뒤 희귀 카드가 포함된 보상을 받습니다.<br>감독 보스의 게이지는 전술 완성도입니다. 0으로 만들면 전술 시험을 통과합니다.</div><div class="phase-actions"><button class="button" data-action="tutorial">튜토리얼로 직접 배우기</button><button class="button primary" data-action="close">경기로 돌아가기 →</button></div></div>`);
}
function showMenu() {
  const previous = previousJourney();
  openDialog('라커룸', `<div class="dialog-copy"><strong>${esc(run.playerName||'루키')}의 이야기는 저장되어 있어요.</strong><p>언제든 돌아와 지금의 카드와 대결 상황으로 이어할 수 있습니다.</p><div class="choice-grid">${starterRewardPending() ? '<button class="choice-button" data-action="starter-reward"><strong>시작 장비 받기</strong><small>완료한 튜토리얼의 장비 1개 선택</small></button>' : ''}<button class="choice-button" data-action="rename"><strong>선수 이름 변경</strong><small>덱과 진행 상황은 그대로 유지</small></button><button class="choice-button" data-action="deck"><strong>나의 덱</strong><small>카드와 강화 상태 확인</small></button><button class="choice-button" data-action="tutorial"><strong>튜토리얼</strong><small>직접 연습하기 · 언제든 전체 건너뛰기</small></button><button class="choice-button" data-action="help"><strong>플레이 방법</strong><small>피해, 방어와 카드의 규칙</small></button><button class="choice-button" data-action="equipment"><strong>내 아이템</strong><small>보유한 아이템 효과 확인</small></button><button class="choice-button" data-action="log"><strong>대결 기록</strong><small>지난 턴의 피해와 카드 효과 확인</small></button><button class="choice-button" data-action="sound"><strong>소리 ${sound ? '끄기' : '켜기'}</strong><small>경기 효과음 ${sound ? '켜짐' : '꺼짐'}</small></button><button class="choice-button" data-action="credits"><strong>아트 크레딧</strong><small>에셋 제작 및 출처</small></button>${previous ? `<button class="choice-button" data-action="restore-previous"><strong>이전 지도에서 하던 도전</strong><small>체력 ${previous.condition} · 골드 ${previous.gold} · 아이템 ${previous.relics.length}개를 되살려 이어하기</small></button>` : ''}<button class="choice-button" data-action="restart-confirm"><strong>새로운 도전</strong><small>현재 도전을 끝내고 다시 시작</small></button></div></div>`);
}
function previousJourney() {
  try { const raw=JSON.parse(localStorage.getItem(`${SAVE_KEY}-previous-version`)); return raw && (['early-shop','final-shop'].includes(raw.activeNode?.id) || raw.history?.some(h=>['early-shop','final-shop'].includes(h.nodeId))) ? validateSave(raw) : null; } catch { return null; }
}
function toggleSound() { sound = !sound; try { localStorage.setItem(SOUND_KEY, sound); } catch {} playTone('pass'); render(); toast(sound ? '경기 사운드 켜짐' : '경기 사운드 꺼짐'); }
function restartConfirm() { showNameForm('new'); }
function showNameForm(mode = 'rename') {
  $('route-dialog').close();
  const fresh = mode === 'new', welcome = mode === 'welcome';
  openDialog(fresh ? '새로운 도전' : welcome ? '어떤 이름으로 기억될까?' : '선수 이름 변경', `<form id="player-name-form" data-mode="${mode}" class="name-form"><span class="phase-eyebrow">YOUR NAME. YOUR LEGEND.</span><p>${fresh?'현재 도전을 마치고 새 지도에서 시작합니다.':welcome?'이 구장에 남길 이름을 정해주세요.':'지금까지의 덱과 여정은 그대로 이어집니다.'}</p><label for="player-name-input">선수 이름</label><input id="player-name-input" name="playerName" value="${esc(run.playerName||'루키')}" maxlength="24" autocomplete="off" placeholder="선수 이름을 입력하세요" required aria-describedby="name-help name-error"><small id="name-help">한글·영문·숫자·기호 1~12자</small><p id="name-error" class="form-error" role="alert"></p><div class="phase-actions"><button type="button" class="button" data-action="close">${welcome?'루키로 시작':'돌아가기'}</button><button type="submit" class="button primary">${fresh?'이 이름으로 새 도전':welcome?'경기장으로 →':'이름 저장'}</button></div></form>`);
  $('player-name-input').select();
}
function showEquipment() {
  openDialog('나의 아이템 · 효과 누적', run.relics.length ? run.relics.map(id=>`<div class="equipped-item">${itemCanvas(RELICS[id])}<div><strong>${esc(RELICS[id].name)}</strong><p>${esc(RELICS[id].description)}</p></div></div>`).join('') : '<p class="dialog-copy">아직 아이템이 없어요. 상대를 이겨 골드를 모은 뒤 지도 중간의 상점 지점을 선택해 나만의 조합을 만들어보세요.</p>');
}

function canEarnStarterReward() {
  return !run.starterRelic && !['victory', 'defeat'].includes(run.phase) && STARTER_RELICS.some(id => !run.relics.includes(id));
}
function starterRewardPending() { return run.starterRewardUnlocked && canEarnStarterReward(); }
function showStarterReward() {
  if (!starterRewardPending()) return;
  const roles = run.rulesVersion === 2 ? ['기세·강슛형','테크닉형','제공권형'] : ['공격 강화', '기세 강화', '방어 강화'];
  openDialog('튜토리얼 완료 · 시작 장비', `<section class="starter-reward"><span class="phase-eyebrow">YOUR FIRST GEAR</span><h3>나만의 플레이를 골라보세요.</h3><p>장비 3개 중 하나를 무료로 받습니다. 선택 즉시 적용되며 이번 도전 동안 유지됩니다.</p><div class="starter-reward-grid">${STARTER_RELICS.map((id, i) => {
    const relic = RELICS[id], owned = run.relics.includes(id);
    return `<article class="shop-item"><span class="item-tag">${roles[i]}</span>${itemCanvas(relic)}<h4>${esc(relic.name)}</h4><p>${esc(relic.description)}</p><button data-starter-relic="${id}" aria-label="${esc(relic.name)} 선택"${owned ? ' disabled' : ''}>${owned ? '이미 보유한 장비' : '이 장비로 시작 →'}</button></article>`;
  }).join('')}</div><p>한 도전에서 한 번만 받을 수 있어요. 창을 닫아도 메뉴의 ‘시작 장비 받기’에서 이어서 선택할 수 있습니다.</p></section>`);
}
function takeStarterReward(id) {
  if (changedElsewhere) return toast('다른 창의 진행을 먼저 새로고침해 주세요.');
  const next = act(run, { type: 'take-starter-relic', id });
  if (next === run) return;
  run = next; save(); render(); $('dialog').close();
  toast(`${RELICS[id].name} 획득! 나만의 플레이를 시작하세요.`);
}
function selectEliteRelic(id) {
  if (run.phase !== 'reward' || !run.relicOffers?.includes(id)) return;
  eliteRelicSelection = id;
  for (const button of document.querySelectorAll('[data-elite-relic]')) {
    const chosen = button.dataset.eliteRelic === id;
    button.classList.toggle('selected', chosen);
    button.setAttribute('aria-pressed', String(chosen));
    button.querySelector('.elite-relic-select').textContent = chosen ? '선택됨' : '선택';
  }
  document.querySelector('[data-action="take-elite-relic"]').disabled = false;
}
function revealMobileCard() {
  if (!matchMedia('(max-width:800px), (max-width:1100px) and (max-height:520px)').matches) return;
  const card = $('hand').querySelector('.selected');
  if (!card) return;
  const bounds = card.getBoundingClientRect(), bottom = document.querySelector('.battle-controls').getBoundingClientRect().top - 8;
  // Only correct vertical clipping; selecting a card never pans the hand sideways.
  const delta = bounds.top < 8 ? bounds.top - 8 : bounds.bottom > bottom ? Math.min(bounds.bottom - bottom, bounds.top - 8) : 0;
  if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'instant' });
}

document.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button || button.disabled) return;
  const d = button.dataset;
  if (d.starterRelic) return takeStarterReward(d.starterRelic);
  if (d.eliteRelic) return selectEliteRelic(d.eliteRelic);
  if (d.hand) { selected = d.hand; render(); revealMobileCard(); return; }
  if (d.enemyTarget) return dispatch({type:'select-target',targetId:d.enemyTarget});
  if (d.reward && cardRewardKey() && run.offers.includes(d.reward)) { rewardSelection = d.reward; updateRewardSelection(); return; }
  if (d.node) { $('route-dialog').close(); return dispatch({ type: 'choose-node', id: d.node }); }
  if (d.upgrade) return showUpgradePreview(d.upgrade);
  if (d.confirmUpgrade) return confirmUpgrade(d.confirmUpgrade);
  if (d.previewRemove) return showRemovalPreview(d.previewRemove);
  if (d.confirmRemove) return confirmShopRemoval(d.confirmRemove);
  if (d.remove) return dispatch({ type: 'remove-card', uid: d.remove });
  if (d.combatPreview) { combatSelection = d.combatPreview; return syncCombatChoice(true); }
  if (d.combatChoice) { $('dialog').close(); return dispatch({type:'choose-card',uid:d.combatChoice}); }
  if (d.treat) return dispatch({type:'treat-injury',uid:d.treat});
  if (d.buyCard) return dispatch({type:'buy-card',id:d.buyCard});
  if (d.buy) return dispatch({ type: 'buy-relic', id: d.buy });
  if (d.event) return dispatch({ type: 'event-choice', id: d.event });
  if (d.relic) return openDialog(RELICS[d.relic].name, `<div class="equipped-item">${itemCanvas(RELICS[d.relic])}<p class="dialog-copy">${esc(RELICS[d.relic].description)}</p></div>`);
  switch (d.action) {
    case 'encounter-help': return openDialog('상대 역할과 대상 선택', `<div class="dialog-copy"><p>카드를 고른 뒤 상대를 누르고 <strong>카드 사용</strong>을 눌러 확정하세요. 대상만 바꾸면 에너지와 연계는 그대로입니다.</p><p><strong>공격형</strong>은 꾸준히 공격하고, <strong>버퍼형</strong>은 다른 상대의 다음 턴 공격을 강화합니다. <strong>기술형</strong>은 공격에 약점 노출을 섞고, <strong>방어형</strong>은 동료를 보호합니다. <strong>축적형</strong>은 힘을 모아 강공한 뒤 빈틈을 보입니다.</p><p>행동 예고에는 버프와 약점 효과가 반영됩니다. 상대별 방어·약점 노출·공격 약화는 따로 적용됩니다. 쓰러진 상대는 행동하지 않습니다.</p>${enemyViews(run).filter(e=>e.hp>0).map(e=>`<p><strong>${esc(e.name)} · ${esc(e.roleLabel || ENEMY_ROLES[e.role] || '')}</strong><br>${esc(e.mechanic || e.intent.description || '')}</p>`).join('')}</div>`);
    case 'open-reward': return showRewardDialog();
    case 'skip-reward': return takeCardReward(true);
    case 'take-reward': return takeCardReward();
    case 'take-elite-relic': return dispatch({ type: 'take-elite-relic', id: eliteRelicSelection });
    case 'striker-info': return showStrikerInfo();
    case 'open-combat-choice': return syncCombatChoice(true);
    case 'rest': return dispatch({ type: 'rest' });
    case 'leave': return dispatch({ type: 'leave-node' });
    case 'deck': return showDeck();
    case 'help': return showHelp();
    case 'tutorial': return showTutorial();
    case 'starter-reward': return showStarterReward();
    case 'equipment': return showEquipment();
    case 'shop-remove': return showShopRemoval();
    case 'defense-info': return showCombatStat('defense');
    case 'enemy-defense-info': return showCombatStat('enemy-defense');
    case 'enemy-exposed-info': return showEnemyDebuff('exposed');
    case 'enemy-weakened-info': return showEnemyDebuff('weakened');
    case 'momentum-info': return showCombatStat('momentum');
    case 'log': return showLog();
    case 'sound': toggleSound(); return showMenu();
    case 'credits': return openDialog('아트 크레딧', '<div class="dialog-copy"><p>선수·감독·장비·유소년 경기장: RUNEKICK을 위해 이미지 생성 도구로 제작한 전용 도트 스타일 아트.</p><p>전술 지도·카드 프레임·이펙트: 게임 코드로 제작. 감독의 대사와 전투 패턴은 게임을 위한 창작입니다.</p><p>Soccorpia 등 무료 축구 에셋을 검토했으며, 현재 큰 캐릭터 구도에 맞춰 전용 아트를 사용합니다.</p></div>');
    case 'restore-previous': {
      if (changedElsewhere) return toast('다른 창의 진행을 먼저 새로고침해 주세요.');
      const previous=previousJourney(); if(!previous) return toast('복원할 기록이 없어요.');
      try { localStorage.setItem(`${SAVE_KEY}-before-restore`,JSON.stringify(run)); } catch { return toast('현재 도전을 보관할 수 없어 복원을 멈췄어요.'); }
      run=previous; selected=null; rewardSelection=null; eliteRelicSelection=null; busy=false; animation=null;
      $('dialog').close(); save(); render(); toast('이전 아이템과 덱을 그대로 이어합니다.'); return;
    }
    case 'rename': return showNameForm();
    case 'restart-confirm': return restartConfirm();
    case 'close': return $('dialog').close();
    case 'new-run': return restartConfirm();
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'player-name-form') return;
  e.preventDefault();
  if (changedElsewhere) { $('name-error').textContent='다른 창의 진행이 변경됐어요. 먼저 새로고침해 주세요.'; return; }
  const name = $('player-name-input').value.replace(/\p{Cc}/gu,'').trim().replace(/\s+/gu,' ');
  if (!name || [...name].length > 12) { $('name-error').textContent='이름을 1~12자로 입력해주세요.'; return; }
  if (e.target.dataset.mode === 'new') {
    run = startRun(name); selected=null; rewardSelection=null; eliteRelicSelection=null; busy=false; animation=null;
    $('route-dialog').close();
  } else {
    const renamed=act(run,{type:'rename-player',name});
    if(renamed===run && run.playerName!==name){ $('name-error').textContent='지금은 이름을 변경할 수 없어요.'; return; }
    run=renamed;
  }
  $('dialog').close(); save(); render(); toast(`${name}, 당신의 전설을 시작하세요.`);
});
$('play-card-button').addEventListener('click', () => { if (selected) dispatch({ type: 'play-card', uid: selected, targetId:run.match?.targetId }); });
$('end-turn').addEventListener('click', () => dispatch({ type: 'end-turn' }));
$('map-button').addEventListener('click', () => { $('route-dialog').showModal(); $('route-list').querySelector('.map-point.available, .map-point.current')?.scrollIntoView({block:'center'}); }); $('close-route').addEventListener('click', () => $('route-dialog').close());
$('help-button').addEventListener('click', showHelp); $('menu-button').addEventListener('click', showMenu); $('deck-button').addEventListener('click', () => showDeck());
$('draw-pile').addEventListener('click', () => showDeck([...run.match.draw].sort((a, b) => a.id.localeCompare(b.id)), '뽑을 카드 · 순서는 비공개'));
$('discard-pile').addEventListener('click', () => showDeck(run.match.discard, '버린 카드'));
$('close-dialog').addEventListener('click', () => $('dialog').close());
$('close-reward').addEventListener('click', () => $('reward-dialog').close());
$('reward-dialog').addEventListener('close', () => {
  if (cardRewardKey()) document.querySelector('[data-action="open-reward"]')?.focus({ preventScroll: true });
});
$('dialog').addEventListener('close', () => {
  if (tutorialWelcomePending) showTutorial();
  else syncRewardDialog();
});
$('route-dialog').addEventListener('close', syncRewardDialog);
$('dialog').addEventListener('click', e => { if (e.target === $('dialog')) { const r = $('dialog').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('dialog').close(); } });
$('sound-button').addEventListener('click', toggleSound);
function showLog() { openDialog('대결 기록', run.match?.history.length ? run.match.history.map(out => `<div class="log-row"><strong>TURN ${out.turn}</strong><br>${esc(out.summary)}</div>`).join('') : '<p class="dialog-copy">첫 플레이가 기록될 차례입니다.</p>'); }
$('log-button').addEventListener('click', showLog);
document.addEventListener('keydown', e => {
  if (tutorial.active || $('dialog').open || $('route-dialog').open || $('reward-dialog').open || run.phase !== 'match' || busy || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { const card = run.match.hand[Number(e.key) - 1]; if (card) { selected = card.uid; render(); const button = $('hand').querySelector(`[data-hand="${CSS.escape(selected)}"]`); button?.focus({preventScroll:true}); button?.scrollIntoView({block:'nearest',inline:'nearest'}); } }
  else if (e.code === 'Space' && !['BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); dispatch({ type: 'end-turn' }); }
  else if (e.key === 'Enter' && selected && (document.activeElement.matches('[data-hand]') || !['BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))) { e.preventDefault(); dispatch({ type: 'play-card', uid: selected, targetId:run.match?.targetId }); }
});
window.addEventListener('storage', e => { if (e.key === SAVE_KEY && e.newValue && e.newValue !== JSON.stringify(run)) { changedElsewhere = true; $('save-status').textContent = '다른 창에서 진행 중'; toast('다른 창의 진행이 저장됐어요. 이 창은 새로고침 후 이어해 주세요.'); } });

const pitch = $('pitch'), context = pitch.getContext('2d'), motion = matchMedia('(prefers-reduced-motion: reduce)');
function fitPitch() {
  const box = pitch.parentElement.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const width = Math.round(box.width), height = Math.round(box.height);
  if (pitch.width !== width || pitch.height !== height) { pitch.width = width; pitch.height = height; pitchDirty = true; }
}
new ResizeObserver(fitPitch).observe(pitch.parentElement);
fitPitch();
let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const idle = !motion.matches && run.phase === 'match' && !tutorial.active;
  if (document.hidden || (!animation && !pitchDirty && !idle) || now - lastFrame < 1000 / (animation ? 30 : 15)) return;
  lastFrame = now;
  let current = null;
  if (animation) { const progress = Math.min(1, (now - animation.started) / animation.duration); if (progress < 1) current = { ...animation, progress, reducedMotion: motion.matches }; if (progress === 1) animation = null; }
  drawPitch(context, { width: pitch.width, height: pitch.height, time: motion.matches ? 0 : now, reducedMotion: motion.matches, boss: getBossView(run), opponentId: run.match?.opponentId, opponentColor: OPPONENTS[run.match?.opponentId]?.color, enemies:run.match?.enemies ? enemyViews(run) : undefined,targetId:run.match?.targetId,targetIds:run.phase==='match'&&targetScope(run.match.hand.find(c=>c.uid===selected))==='all'?enemyViews(run).filter(e=>e.hp>0).map(e=>e.id):[run.match?.targetId], phase: run.phase, heroHp:run.condition,heroMomentum:run.phase === 'match' ? run.match?.momentum || 0 : 0,enemyHp:run.match?.enemyHp||0, animation: current });
  pitchDirty = false;
}
render(); save(); requestAnimationFrame(frame);
initArt().then(() => { pitchDirty = true; paintCards(); });
if (firstVisit) showNameForm('welcome');
else if (tutorialStatus === 'active') showTutorial();
else if (starterRewardPending()) showStarterReward();
if (saveError) toast(previousSaveBackedUp ? '변경된 지도에 맞춰 새 도전을 시작했어요. 이전 저장 원본은 보관했습니다.' : '이전 저장을 읽지 못해 새 도전을 시작했어요.');
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => { $('offline-status').textContent = '● 오프라인 플레이 준비 완료'; }).catch(() => { $('offline-status').textContent = '온라인 플레이 · 오프라인 준비 실패'; });
} else $('offline-status').textContent = '온라인 플레이';

function syncCombatChoice(force = false) {
  const choice = run.rulesVersion === 2 && run.phase === 'match' ? run.match.choice : null;
  if (!choice) { combatChoiceKey = null; return; }
  const key = `${run.match.turn}:${choice.kind}:${choice.candidates.join(',')}`;
  if (!force && combatChoiceKey === key) return;
  if (combatChoiceKey !== key) combatSelection = null;
  combatChoiceKey = key;
  const m = run.match, source = choice.kind === 'discard' ? m.hand : choice.kind === 'retrieve' ? m.discard : m.draw;
  const cards = choice.candidates.map(uid => source.find(c => c.uid === uid));
  const title = choice.kind === 'discard' ? '버릴 손패 1장 선택' : choice.kind === 'retrieve' ? '되가져올 터치·드리블 선택' : `손으로 가져올 카드 선택 · ${choice.remaining}장 남음`;
  const selectedCard = cards.find(c => c.uid === combatSelection);
  openDialog(title, `<div class="combat-choice-grid">${cards.map(c => cardHTML(c,'choice')).join('')}</div><section class="combat-choice-detail" aria-live="polite">${selectedCard ? `<strong>${esc(CARDS[selectedCard.id].name)}</strong><p>${esc(cardText(selectedCard))}</p>` : '<p>카드를 누르면 전체 효과를 확인할 수 있어요.</p>'}</section><div class="phase-actions"><button class="button primary" data-combat-choice="${esc(selectedCard?.uid || '')}" ${selectedCard ? '' : 'disabled'}>선택 확정${choice.remaining > 1 ? ` · ${choice.remaining}장 남음` : ''}</button></div>`);
  $('dialog').classList.add('combat-choice-dialog');
  if (selectedCard) $('dialog').querySelector(`[data-combat-preview="${CSS.escape(selectedCard.uid)}"]`)?.focus({preventScroll:true});

}
function renderStrikerStatus() {
  const element = $('striker-status');
  if (!element) return;
  element.hidden = run.rulesVersion !== 2 || run.phase !== 'match';
  if (element.hidden) return;
  const m = run.match, labels = {acceleration:'가속',control:'볼 컨트롤',aerial:'제공권'};
  element.innerHTML = Object.entries(m.training).map(([key,n]) => `<button class="striker-effect" data-action="striker-info">↗ ${labels[key]}${key === 'aerial' ? ` ${n}` : ''}</button>`).join('') + (m.playerExposed ? `<button class="striker-effect exposed" data-action="striker-info">◎ 노출 ${m.playerExposed}</button>` : '') + (m.energyDebt ? `<button class="striker-effect exposed" data-action="striker-info">다음 에너지 −${m.energyDebt}</button>` : '') + `<button class="striker-effect" data-action="striker-info">휘발 ${m.exhaust.length}</button>` + (m.choice ? '<button class="striker-effect" data-action="open-combat-choice">카드 선택 계속하기</button>' : '');
}
function showStrikerInfo() {
  const m = run.match;
  if (run.rulesVersion !== 2 || !m) return;
  openDialog('연계 · 훈련 · 부상', `<div class="dialog-copy"><p><strong>연계</strong>: 직전 카드와 현재 카드가 서로 다른 터치·드리블이면 발동합니다. 다른 종류를 사용하면 끊깁니다.</p><p><strong>헤더</strong>: 기세 대신 카드에 적힌 만큼 방어를 소모합니다. 카드 선택 시 남을 방어를 확인하세요.</p><p><strong>훈련</strong>: 카드에 적힌 즉시 효과 또는 전투 동안 유지되는 효과를 얻습니다. 지속 효과는 중첩되지 않습니다.</p>${Object.entries(m.training).map(([key,n]) => `<p>${key === 'acceleration' ? '순간 가속: 매 턴 첫 기세 획득 카드의 기세 +1' : key === 'control' ? '볼 컨트롤: 매 턴 첫 연계 시 1장 뽑기' : `제공권: 상대 행동 후 남은 방어 최대 ${n} 유지`}</p>`).join('')}<p><strong>내 약점 노출 ${m.playerExposed}턴</strong>: 상대 공격 피해 +50%. 방어 적용 전 계산합니다.</p><p><strong>부상</strong>: 사용 불가. 손에 남은 찰과상은 체력 −1, 발목 통증은 상대 행동 전 방어 −2. 버리면 이번 턴 효과를 피할 수 있습니다.</p><p>덱 부상은 라커룸에서 ACT당 한 장 치료합니다. 전투 한정 부상과 휘발로 소멸한 카드는 전투가 끝나면 정리됩니다.</p></div><div class="dialog-cards">${m.exhaust.map(c => cardHTML(c)).join('')}</div>`);
}

import { CARDS, RELICS, STARTER_RELICS, OPPONENTS, createRun, act, forecast, cardText, validateSave, routeFor, availableNodes, getCardRemovalCost } from './engine.js';
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
const CARD_SUBTYPES = { shot: '슈팅', pass: '터치', dribble: '드리블', tactic: '전술' };
const NODE_ICONS = { match: '⚽', elite: '◇', boss: '♛', training: '↗', rest: '☾', shop: '▣', event: '✧' };
const NODE_NAMES = { match: '대결', elite: '엘리트', boss: '감독 보스', training: '훈련장', rest: '라커룸', shop: '상점', event: '이벤트' };
const RARITY_NAMES = {common:'기본', uncommon:'특별', rare:'희귀', legendary:'전설'};
const NODE_HINTS = { match:'카드 · 골드', elite:'전용 유물 · 희귀 카드', boss:'최종 시험', training:'강화 / 덱 정리', rest:'체력 +30', shop:'골드로 아이템 구매', event:'선택형 이벤트' };
let selected = null, rewardSelection = null, eliteRelicSelection = null, busy = false, animation = null, audio = null, sound = false, toastTimer, announcementTimer, saveError = false, pitchDirty = true;
let changedElsewhere = false, previousSaveBackedUp = false;
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
  },
});
function showTutorial() {
  if (busy || tutorial.active) return;
  tutorialWelcomePending = false;
  $('dialog').close(); $('route-dialog').close();
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
function playTone(kind) {
  if (!sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes = kind === 'goal' ? [523, 659, 784, 1046] : kind === 'defense' ? [294, 392] : kind === 'concede' ? [294, 220] : [440, 554];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain(), time = audio.currentTime + i * .09;
      osc.type = 'triangle'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.045, time); gain.gain.exponentialRampToValueAtTime(.001, time + .17);
      osc.connect(gain); gain.connect(audio.destination); osc.start(time); osc.stop(time + .18);
    });
  } catch { /* Audio is optional. */ }
}
function animate(type, message) {
  animation = { type, started: performance.now(), duration: type === 'goal' || type === 'concede' ? 1200 : 480 };
  if (message) {
    $('pitch-announcement').textContent = message;
    clearTimeout(announcementTimer); announcementTimer = setTimeout(() => { $('pitch-announcement').textContent = ''; }, 1300);
  }
  playTone(type);
}
function dispatch(action) {
  if (changedElsewhere) return toast('다른 창에서 진행이 변경됐어요. 새로고침하면 이어할 수 있어요.');
  if (busy) return;
  const before = run, card = action.type === 'play-card' ? run.match?.hand.find(c => c.uid === action.uid) : null;
  const next = act(run, action);
  if (next === before) return toast('지금은 사용할 수 없는 선택이에요.');
  run = next; selected = null; rewardSelection = null; eliteRelicSelection = null;
  if (run.phase === 'reward' && before.phase !== 'reward') animate('goal', 'DUEL WON');
  else if (run.phase === 'defeat') animate('concede', '다음 도전을 향해.');
  else if (action.type === 'end-turn') {
    busy = true;
    const damage = before.condition - run.condition;
    animate(damage > 0 ? 'concede' : 'defense', damage > 0 ? `−${damage} HP` : 'BLOCKED');
    setTimeout(() => { busy = false; render(); }, 500);
  } else if (card) {
    const damage = (before.match?.enemyHp || 0) - (run.match?.enemyHp || 0);
    animate(CARDS[card.id].type === 'tactic' ? 'pass' : CARDS[card.id].type, damage > 0 ? `−${damage}` : undefined);
  } else { playTone('pass'); if (action.type !== 'choose-node' && run.message) toast(run.message); }
  save(); render();
  if (before.phase !== run.phase) {
    const destination = run.phase === 'map' ? $('phase-panel').querySelector('.map-point.available') : run.phase === 'match' ? document.querySelector('.topbar') : $('phase-panel');
    destination?.scrollIntoView({block:run.phase === 'map' ? 'center' : 'start', behavior:motion.matches ? 'auto' : 'smooth'});
  }
}
function costOf(card) { return card.upgraded ? CARDS[card.id].upgradedCost : CARDS[card.id].cost; }
function cardEffectHTML(card) {
  const [first, ...sentences] = cardText(card).split(/\.\s*/).filter(Boolean);
  const effect = first.match(/^(피해|이번 턴 방어|에너지) (\+?\d+)(.*)$/);
  if (!effect) return `<span class="card-rules">${esc(cardText(card))}</span>`;
  const label = effect[1] === '이번 턴 방어' ? '방어' : effect[1];
  const notes = [effect[1] === '이번 턴 방어' ? '이번 턴 동안 유지.' : '', effect[3].trim(), ...sentences.map(sentence => `${sentence}.`)].filter(Boolean);
  const rules = notes.map(note => esc(note).replace(/(\+?\d+)/g, '<b class="card-rule-number">$1</b>')).join(' ');
  return `<span class="card-stat"><span>${label}</span><strong class="card-effect-number">${effect[2]}</strong></span>${rules ? `<span class="card-rules">${rules}</span>` : ''}`;
}
function cardHTML(card, mode = 'view', index = 0, context = {}) {
  const def = CARDS[card.id]; if (!def) return '';
  const category = def.type === 'defense' ? 'defense' : ['shot', 'pass'].includes(def.type) ? 'attack' : 'skill';
  const categoryInfo = CARD_CATEGORIES[category];
  const practice = mode === 'tutorial';
  const unaffordable = (mode === 'hand' && costOf(card) > run.match.energy) || (practice && costOf(card) > context.energy);
  const isSelected = practice ? context.selectedUid === card.uid : mode === 'hand' ? selected === card.uid : mode === 'reward' && rewardSelection === card.id;
  const expected = practice && context.allowedCardId === card.id;
  const tag = mode === 'view' ? 'article' : 'button';
  const data = practice ? `data-tutorial-hand="${esc(card.uid)}"` : mode === 'hand' ? `data-hand="${esc(card.uid)}"` : mode === 'reward' ? `data-reward="${esc(card.id)}"` : mode === 'upgrade' ? `data-upgrade="${esc(card.uid)}"` : mode === 'remove' ? `data-preview-remove="${esc(card.uid)}"` : '';
  return `<${tag} class="card ${def.type} category-${category} rarity-${def.rarity}${card.upgraded ? ' upgraded' : ''}${isSelected ? ' selected' : ''}${unaffordable ? ' unaffordable' : ''}${expected ? ' tutorial-card-target' : ''}" ${data} ${practice && !expected ? 'disabled' : ''} ${mode !== 'view' ? `aria-label="${esc(def.name)}${card.upgraded ? ' 강화' : ''}, ${categoryInfo.name}, 에너지 ${costOf(card)}, ${esc(cardText(card))}${unaffordable ? ' 에너지 부족.' : ''}${mode === 'upgrade' ? ' 강화 전후 비교' : mode === 'remove' ? ' 상점에서 제거' : ''}"${['hand','reward','tutorial'].includes(mode) ? ` aria-pressed="${isSelected}"` : ''}` : ''}>
    <span class="card-top"><span class="card-cost">${costOf(card)}</span><span class="card-title">${esc(def.name)}${card.upgraded ? '<span class="upmark"> +</span>' : ''}</span></span>
    <canvas class="card-art" data-art="${def.type}" data-card-id="${def.id}" data-upgraded="${!!card.upgraded}" width="384" height="240" aria-hidden="true"></canvas>
    <span class="card-type"><span><svg class="card-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${categoryInfo.icon}</svg>${categoryInfo.name}${CARD_SUBTYPES[def.type] ? `<small class="card-subtype">· ${CARD_SUBTYPES[def.type]}</small>` : ''}</span><span class="card-rarity">${RARITY_NAMES[def.rarity]}</span></span>
    <span class="card-description">${cardEffectHTML(card)}</span>${mode === 'hand' ? `<span class="card-key">${unaffordable ? '에너지 부족' : index + 1}</span>` : ''}
  </${tag}>`;
}
function paintCards(container = document) {
  container.querySelectorAll('canvas[data-art]').forEach(canvas => drawCardArt(canvas.getContext('2d'), canvas.dataset.art, {width:canvas.width,height:canvas.height,id:canvas.dataset.cardId,upgraded:canvas.dataset.upgraded === 'true'}));
  container.querySelectorAll('canvas[data-item]').forEach(canvas => drawItemArt(canvas.getContext('2d'), canvas.dataset.item, {width:canvas.width,height:canvas.height,id:canvas.dataset.itemId}));
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
  const intro = run.schema === 3
    ? `<div class="route-brief"><span>12개 지점 · 연결된 길을 따라 이동</span><strong>레전드는 선택, 마지막 정비는 확실하게.</strong><p>초반 훈련 → 장비와 도전 → 보스 전 휴식·강화</p></div><div class="boss-preview"><span>FINAL COACH</span><strong>${esc(coach.name)}</strong><p>${esc(coach.mechanic)}</p></div>`
    : '<div class="legacy-notice">이어하던 7지점 경로입니다. 새 도전부터 12지점 지도와 감독 보스가 적용됩니다.<button class="button" data-action="restart-confirm">새 지도 시작하기</button></div>';
  return `${intro}<div class="tactics-board" style="--board-height:${Math.max(720,route.length*112)}px" aria-label="갈림길 전술 지도"><div class="board-pitch" aria-hidden="true"><i></i><b></b></div><span class="board-label">YOUTH / YOUR OWN PATH</span><svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>${nodes}<span class="board-start">KICK OFF ↑</span></div><div class="map-legend"><span>⚽ 대결</span><span>◇ 엘리트</span><span>↗ 훈련장</span><span>☾ 라커룸</span><span>▣ 상점</span><span>✧ 이벤트</span><span>♛ 최종 시험</span></div>`;
}
function render() {
  pitchDirty = true;
  document.body.dataset.phase = run.phase;
  const focusHand = document.activeElement?.dataset?.hand, focusHandTab = document.activeElement?.classList.contains('mobile-hand-tab'), focusReward = document.activeElement?.dataset?.reward;
  const match = run.match, active = run.phase === 'match', prediction = forecast(run), route = routeFor(run);
  const hand = $('hand'), roundKey = active ? `${run.initialSeed}:${run.routeIndex}:${match.turn}` : '';
  const handScrollLeft = hand.dataset.roundKey === roundKey ? hand.scrollLeft : 0;
  const handKey = active ? JSON.stringify([roundKey, match.energy, match.hand.map(card => [card.uid, card.id, card.upgraded])]) : '';
  const replaceHand = active && hand.dataset.renderKey !== handKey;
  const opponent = OPPONENTS[match?.opponentId] || OPPONENTS.school;
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
  $('match-subtitle').textContent = active ? opponent.subtitle : '내 기술, 내 장비, 나만의 플레이.';
  $('turn-counter').hidden = !active; $('turn-number').textContent = String(match?.turn||1).padStart(2,'0');
  $('home-score').textContent = run.condition; $('hero-max-hp').textContent = run.maxCondition;
  $('hero-hp-bar').style.width = `${run.condition/run.maxCondition*100}%`;
  $('opponent-name').textContent = opponent.name; $('enemy-role').textContent = opponent.coach?'THE COACH':opponent.legend?'THE LEGEND':run.activeNode?.type==='boss'?'THE ACE':'THE RIVAL';
  $('pitch').setAttribute('aria-label', `${run.playerName||'루키'}와 ${opponent.name}의 개인 대결`);
  $('combat-rule').hidden = !active || !(match.intent.rule || opponent.mechanic);
  $('combat-rule').textContent = active ? (match.intent.rule || opponent.mechanic || '').replace('첫 공격에', '처음 피해를 주는 카드에') : '';
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
  $('incoming-value').textContent = active ? match.intent.attack : 0; $('intent-name').textContent = active ? match.intent.name : '대결 종료';
  $('intent-description').textContent = active ? `공격 ${match.intent.attack} − 내 방어 ${match.defense} = 체력 피해 ${prediction.incoming}` : '';
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
      $('mobile-hand-tabs').innerHTML = match.hand.map(card => `<button class="mobile-hand-tab ${CARDS[card.id].type}${costOf(card) > match.energy ? ' unaffordable' : ''}" data-hand="${esc(card.uid)}" aria-label="${esc(CARDS[card.id].name)}${card.upgraded ? ' 강화' : ''} 선택${costOf(card) > match.energy ? ', 에너지 부족' : ''}" aria-pressed="${selected === card.uid}"><span class="mobile-hand-cost">${costOf(card)}</span><span class="mobile-hand-name">${esc(CARDS[card.id].name)}${card.upgraded ? '+' : ''}</span></button>`).join('');
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
    if (chosen&&affordable) {
      const preview=act(run,{type:'play-card',uid:chosen.uid});
      const damage=Math.max(0,match.enemyHp-(preview.match?.enemyHp??match.enemyHp)), block=Math.max(0,(preview.match?.defense||0)-match.defense);
      const healthCost=Math.max(0,run.condition-preview.condition), broken=Math.max(0,match.enemyBlock-(preview.match?.enemyBlock??match.enemyBlock));
      $('damage-preview').textContent = [damage&&`피해 ${damage}`, block&&`방어 +${block}`, broken&&`상대 방어 −${broken}`, healthCost&&`내 체력 −${healthCost}`].filter(Boolean).join(' · ')||'카드 효과 적용';
    } else $('damage-preview').textContent=chosen?'에너지가 부족해요':'드리블 → 기세 → 강화된 슛';
    $('play-card-button').disabled=busy||!affordable; $('play-card-button').textContent=chosen&&!affordable?'에너지 부족':'카드 사용';
    $('end-turn').disabled=busy; $('end-turn').textContent=busy?'상대 행동…':'턴 종료 →';
  } else { delete hand.dataset.renderKey; delete hand.dataset.roundKey; renderPhase(); }
  $('commentary').textContent=(run.message||'기세를 모아 슛에 싣고, 상대의 다음 공격을 읽으세요.').replaceAll('헬스장','훈련장').replaceAll('휴식처','라커룸');
  $('sound-button').setAttribute('aria-pressed',String(sound)); $('sound-button').setAttribute('aria-label',sound?'소리 끄기':'소리 켜기'); $('sound-button').style.color=sound?'var(--mint)':'';
  paintCards();
  if(focusHand) document.querySelector(`${focusHandTab ? '.mobile-hand-tab' : '#hand .card'}[data-hand="${CSS.escape(focusHand)}"]`)?.focus({preventScroll:true});
  if(focusReward) document.querySelector(`[data-reward="${CSS.escape(focusReward)}"]`)?.focus({preventScroll:true});
  if (replaceHand) hand.scrollLeft = handScrollLeft;
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
    panel.innerHTML = heading('TRIAL COMPLETE / NEW TECHNIQUE', rewardTitle, esc(run.message)) + earned + `<div class="reward-grid">${run.offers.map(id => cardHTML({ id, upgraded: false }, 'reward')).join('')}</div><div class="phase-actions"><button class="button" data-action="skip-reward">카드 없이 계속</button><button class="button primary" data-action="take-reward" ${rewardSelection ? '' : 'disabled'}>${run.activeNode?.type==='boss'?'카드를 받고 도전 마무리':'카드를 받고 지도로'} →</button></div>`;
  }
  if (run.phase === 'training') panel.innerHTML = heading('TRAINING DAY', esc(name), '카드를 눌러 강화 전후를 비교하세요. 한 장을 강화하거나 무료로 제거하면 훈련을 마칩니다. 무료 제거는 덱이 9장 이상일 때 가능합니다.') + `<div class="deck-choice-grid">${run.deck.map(c => `<section class="deck-choice">${cardHTML(c, c.upgraded ? 'view' : 'upgrade')}<div class="deck-choice-actions"><button class="button" data-upgrade="${esc(c.uid)}" aria-label="${esc(CARDS[c.id].name)} ${c.upgraded ? '강화 완료' : '강화 전후 비교'}" ${c.upgraded ? 'disabled' : ''}>${c.upgraded ? '강화 완료' : '강화 비교'}</button><button class="button" data-remove="${esc(c.uid)}" aria-label="${esc(CARDS[c.id].name)} 무료 제거" ${run.deck.length <= 8 ? 'disabled' : ''}>무료 제거</button></div></section>`).join('')}</div><div class="phase-actions"><button class="button" data-action="leave">훈련 건너뛰기 →</button></div>`;
  if (run.phase === 'rest') panel.innerHTML = heading('TAKE A BREATH', esc(name), '잠시 멈추는 것도 앞으로 나아가는 방법입니다. 체력을 30 회복하고 다음 여정을 준비하세요.') + `<div class="stats-row"><span><b>${run.condition}</b>현재 체력</span><span><b>→</b></span><span><b>${Math.min(run.maxCondition, run.condition + 30)}</b>휴식 후 체력</span></div><div class="phase-actions"><button class="button primary" data-action="rest">충분히 쉬기 →</button></div>`;
  if (run.phase === 'shop') {
    const merchantLine = run.shopOffers.length ? '좋은 선수는 좋은 선택에 투자하지. 필요한 장비부터 골라봐.' : '오늘 준비한 장비는 전부 나갔군. 떠나기 전에 덱도 한 번 살펴보게.';
    panel.innerHTML = `<section class="shop-hero" aria-labelledby="shop-title"><div class="shop-portrait"><img src="./assets/merchant-levy.png" alt="다니엘 레비를 모티브로 한 도트 상인이 축구 장비 카운터에서 맞이합니다." width="512" height="512" decoding="async" draggable="false"></div><div class="shop-welcome"><span class="phase-eyebrow">SPORTS SHOP</span><h3 id="shop-title">${esc(name)}</h3><div class="merchant-identity"><strong>다니엘 레비</strong><span>스포츠 상점 주인</span></div><p class="merchant-dialogue">${merchantLine}</p><p class="shop-promise">장착 제한 없이 효과 누적 · 이번 도전 동안 유지</p></div></section><div class="shop-balance"><strong>보유 골드 ● ${run.gold}</strong><span>장비는 구입 즉시 적용</span></div><div class="shop-grid">${run.shopOffers.map(id=>{const r=RELICS[id]; return `<article class="shop-item"><span class="item-tag">${RARITY_NAMES[r.rarity]||'특별'} 아이템</span>${itemCanvas(r)}<h4>${esc(r.name)}</h4><p>${esc(r.description)}</p><button data-buy="${id}" ${run.gold<r.price?'disabled':''}>● ${r.price} · ${run.gold<r.price?'골드 부족':'구매'}</button></article>`;}).join('')||'<p class="dialog-copy shop-empty">진열된 장비를 모두 구입했어요. 카드 제거 서비스를 이용하거나 다음 여정으로 떠날 수 있습니다.</p>'}</div><div class="phase-actions"><button class="button" data-action="equipment">내 아이템 확인</button><button class="button primary" data-action="leave">다음 여정으로 →</button></div>`;
    const price = getCardRemovalCost(run), blocked = run.deck.length <= 1 || run.gold < price;
    panel.querySelector('.shop-grid').insertAdjacentHTML('beforebegin', `<section class="shop-removal"><div><span class="phase-eyebrow">DECK SERVICE</span><h4>카드 제거 <strong>● ${price}</strong></h4><p>내 덱에서 한 장을 고릅니다. 제거할 때마다 25골드씩 오르며 다음 상점에도 이어집니다.</p></div><button class="button" data-action="shop-remove" ${blocked ? 'disabled' : ''}>${run.deck.length <= 1 ? '마지막 카드는 유지' : run.gold < price ? '골드 부족' : '제거할 카드 고르기'}</button></section>`);
  }
  if (run.phase === 'event') panel.innerHTML = heading('A CHANCE ENCOUNTER', '관중석의 낯선 시선.', '“방금 그 움직임, 한 번 더 보여줄 수 있겠니?” 경기가 끝난 뒤 스카우트가 당신을 불러 세웠습니다.') + '<div class="choice-grid"><button class="choice-button" data-event="risk"><span class="choice-icon">✧</span><strong>추가 테스트에 도전한다</strong><small>체력 12 소모 · 자금 35와 희귀 카드 1장 획득.</small><em>오늘의 땀이 내일의 기회로</em></button><button class="choice-button" data-event="safe"><span class="choice-icon">☾</span><strong>다음 기회를 기약한다</strong><small>체력 5 회복 · 자금 15 획득.</small><em>내 페이스를 지키는 선택</em></button></div>';
  if (run.phase === 'victory' || run.phase === 'defeat') {
    const won = run.phase === 'victory';
    panel.innerHTML = heading(won ? 'THE NEXT ACE' : 'EVERY LEGEND STARTS AGAIN', won ? `${esc(run.playerName||'루키')}, 다음 에이스가 되다.` : '다음 휘슬을 기다리며.', won ? '마지막 시험을 넘어, 내 가능성을 증명했습니다. 프로 리그와 새로운 포지션의 이야기는 다음 버전에서 이어집니다.' : esc(run.message || '오늘의 경험이 다음 도전의 힘이 됩니다. 새로운 덱으로 다시 시작해 보세요.')) + `<div class="stats-row"><span><b>${run.stats.wins}</b>승리한 대결</span><span><b>${run.stats.damage}</b>누적 피해</span><span><b>${run.stats.blocks}</b>피해 방어</span></div><div class="phase-actions"><button class="button" data-action="deck">완성한 덱 보기</button><button class="button primary" data-action="restart-confirm">새로운 도전 →</button></div>`;
  }
}
function openDialog(title, content) { $('dialog-title').textContent = title; $('dialog-body').innerHTML = content; if (!$('dialog').open) $('dialog').showModal(); paintCards($('dialog')); }
function showDeck(cards = run.deck, title = `나의 덱 · ${run.deck.length}장`) {
  openDialog(title, cards.length ? `<div class="dialog-cards">${cards.map(c => cardHTML(c)).join('')}</div>` : '<p class="dialog-copy">아직 카드가 없어요.</p>');
}
function showCombatStat(kind) {
  if (run.phase !== 'match' || !run.match) return;
  const enemy = kind === 'enemy-defense', shield = enemy || kind === 'defense';
  const momentum = run.match.momentum, defense = enemy ? run.match.enemyBlock : run.match.defense;
  const icon = $(enemy ? 'enemy-defense-status' : shield ? 'defense-status' : 'momentum-badge').querySelector('svg').outerHTML;
  const details = enemy
    ? `<p>내 카드가 주는 피해를 <strong>상대 체력보다 먼저</strong> 막아요.</p><div class="rule-note">현재 상대 방어 <strong>${defense}</strong><br>방어가 막은 만큼 줄어들고,<br><strong>남은 피해만 상대 체력에 적용</strong>돼요.</div><p>다음 내 턴이 시작되면 상대의 새 행동에 맞춰 방어가 다시 정해져요. 이전 턴의 남은 방어에 더해지지는 않아요.</p>${run.match.intent.dribbleBreak ? `<p>현재 상대는 드리블 카드를 사용하면 방어가 <strong>${run.match.intent.dribbleBreak} 추가로 감소</strong>해요.</p>` : ''}`
    : shield
    ? `<p>턴 종료 시 상대 공격 피해를 <strong>최대 ${defense}까지</strong> 막아요.</p><div class="rule-note">상대 공격 ${run.match.intent.attack} − 내 방어 ${defense}<br><strong>예상 체력 피해 ${forecast(run).incoming}</strong></div><p>방어 카드를 사용해 쌓을 수 있어요. 남은 방어는 <strong>다음 내 턴 시작 시 초기화</strong>되고, 장비로 얻는 턴 시작 방어는 다시 적용돼요.</p><p>반사 피해와 카드의 체력 소모는 막지 못해요.</p>`
    : `<p>드리블과 카드·장비 효과로 쌓는 공격 보너스예요.</p><div class="rule-note">현재 기세로 얻는 추가 피해<br>일반 슛: <strong>+${momentum}</strong><br>발리 슈팅: <strong>+${momentum * 2}</strong></div><p>기세는 <strong>턴이 지나도 유지</strong>돼요. 슛 카드를 사용하면 현재 기세를 <strong>전부 소모</strong>해 피해를 더합니다. 상대 방어에 막혀도 소모돼요. 기세가 높을수록 선수 주변의 금빛 기운도 강해져요.</p>`;
  openDialog(enemy ? '상대 방어 · 내 공격을 막는 힘' : shield ? '방어 · 상대 공격을 막는 힘' : '기세 · 다음 슛의 추가 피해', `<section class="combat-stat-help ${shield ? 'shield-help' : 'momentum-help'}"><div class="stat-help-value">${icon}<strong>${shield ? defense : momentum}</strong></div><div class="dialog-copy">${details}</div><div class="phase-actions"><button class="button primary" data-action="close">확인</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function showShopRemoval() {
  const price = getCardRemovalCost(run);
  if (busy || run.phase !== 'shop' || run.deck.length <= 1 || run.gold < price) return;
  openDialog(`카드 제거 · ${price}골드`, `<section class="removal-picker"><p class="dialog-copy">제거할 카드를 고르면 마지막으로 확인합니다. 보유 ${run.gold}골드 · 제거 후 ${run.gold - price}골드</p><div class="deck-choice-grid">${run.deck.map(c => cardHTML(c, 'remove')).join('')}</div></section>`);
  $('dialog').scrollTop = 0;
}
function showRemovalPreview(uid) {
  const card = run.deck.find(c => c.uid === uid), price = getCardRemovalCost(run);
  if (busy || run.phase !== 'shop' || !card || run.deck.length <= 1 || run.gold < price) return;
  openDialog('이 카드를 덱에서 제거할까요?', `<section class="removal-preview">${cardHTML(card)}<p>이번 도전의 덱에서 이 카드 <strong>1장</strong>을 제거합니다.</p><div class="removal-price"><strong>● ${price}골드</strong><span>보유 ${run.gold} → ${run.gold - price}골드</span><small>다음 제거 비용: ${price + 25}골드</small></div><div class="phase-actions"><button class="button" data-action="shop-remove">다시 고르기</button><button class="button primary" data-confirm-remove="${esc(uid)}">${price}골드로 제거</button></div></section>`);
  $('dialog').scrollTop = 0;
}
function confirmShopRemoval(uid) {
  if (changedElsewhere) return toast('다른 창의 진행을 먼저 새로고침해 주세요.');
  if (busy || run.phase !== 'shop' || run.deck.length <= 1 || run.gold < getCardRemovalCost(run) || !run.deck.some(c => c.uid === uid)) return;
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
  openDialog('플레이북 · 나만의 선수로 싸우는 법', '<div class="dialog-copy"><strong>한 선수, 나만의 기술 덱.</strong><ol><li>상대 선수의 체력을 0으로 만들면 승리합니다. 내 체력은 다음 대결까지 이어지며, 0이 되면 도전이 끝납니다.</li><li>매 턴 카드 5장과 에너지 3을 받습니다. 카드 선택 후 <strong>카드 사용</strong>을 누르면 즉시 효과가 적용됩니다.</li><li><strong>드리블로 기세를 쌓고 슛으로 소비</strong>하세요. 기세는 턴이 지나도 유지되고, 슛 카드가 모인 기세를 추가 피해로 바꿉니다.</li><li>상대 머리 위의 공격 예고를 보고 방어를 준비하세요. 턴 종료 시 상대가 공격하고, 남은 방어는 다음 턴에 사라집니다.</li><li>승리 후 카드와 골드를 얻습니다. <strong>상점에서 산 아이템 효과는 부위 제한 없이 누적</strong>됩니다. 아이템은 이번 도전 동안 유지됩니다.</li><li>카드를 고른 뒤 전술 지도로 돌아옵니다. 훈련장에 도착하면 카드 강화·정리를, 라커룸에서는 체력 회복을 할 수 있습니다. 상점은 지도 중간의 지정 지점에서만 방문합니다. 상점 카드 제거는 50골드부터 시작하고 제거할 때마다 25골드씩 오릅니다.</li></ol><div class="rule-note">PC: 숫자 1~9 카드 선택 · Enter 사용 · Space 턴 종료.<br>모바일: 겹친 손패 또는 아래 카드 이름 터치 → 카드 사용. 선택한 카드가 크게 표시됩니다.<br>공격수 1명 · 기술 18종 · 아이템 21종 · 엘리트 4명 · 감독 보스 7명.<br>새 도전은 12지점 경로입니다. 엘리트는 선택해서 도전하며, 승리하면 선수별 전용 유물 3개 중 하나를 고른 뒤 희귀 카드가 포함된 보상을 받습니다.<br>감독 보스의 게이지는 전술 완성도입니다. 0으로 만들면 전술 시험을 통과합니다.</div><div class="phase-actions"><button class="button" data-action="tutorial">튜토리얼로 직접 배우기</button><button class="button primary" data-action="close">경기로 돌아가기 →</button></div></div>');
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
  const roles = ['공격 강화', '기세 강화', '방어 강화'];
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
  if (d.reward) { rewardSelection = d.reward; render(); return; }
  if (d.node) { $('route-dialog').close(); return dispatch({ type: 'choose-node', id: d.node }); }
  if (d.upgrade) return showUpgradePreview(d.upgrade);
  if (d.confirmUpgrade) return confirmUpgrade(d.confirmUpgrade);
  if (d.previewRemove) return showRemovalPreview(d.previewRemove);
  if (d.confirmRemove) return confirmShopRemoval(d.confirmRemove);
  if (d.remove) return dispatch({ type: 'remove-card', uid: d.remove });
  if (d.buy) return dispatch({ type: 'buy-relic', id: d.buy });
  if (d.event) return dispatch({ type: 'event-choice', id: d.event });
  if (d.relic) return openDialog(RELICS[d.relic].name, `<div class="equipped-item">${itemCanvas(RELICS[d.relic])}<p class="dialog-copy">${esc(RELICS[d.relic].description)}</p></div>`);
  switch (d.action) {
    case 'skip-reward': return dispatch({ type: 'take-reward', id: null });
    case 'take-reward': return dispatch({ type: 'take-reward', id: rewardSelection });
    case 'take-elite-relic': return dispatch({ type: 'take-elite-relic', id: eliteRelicSelection });
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
$('play-card-button').addEventListener('click', () => { if (selected) dispatch({ type: 'play-card', uid: selected }); });
$('end-turn').addEventListener('click', () => dispatch({ type: 'end-turn' }));
$('map-button').addEventListener('click', () => { $('route-dialog').showModal(); $('route-list').querySelector('.map-point.available, .map-point.current')?.scrollIntoView({block:'center'}); }); $('close-route').addEventListener('click', () => $('route-dialog').close());
$('help-button').addEventListener('click', showHelp); $('menu-button').addEventListener('click', showMenu); $('deck-button').addEventListener('click', () => showDeck());
$('draw-pile').addEventListener('click', () => showDeck([...run.match.draw].sort((a, b) => a.id.localeCompare(b.id)), '뽑을 카드 · 순서는 비공개'));
$('discard-pile').addEventListener('click', () => showDeck(run.match.discard, '버린 카드'));
$('close-dialog').addEventListener('click', () => $('dialog').close());
$('dialog').addEventListener('close', () => {
  if (tutorialWelcomePending) showTutorial();
});
$('dialog').addEventListener('click', e => { if (e.target === $('dialog')) { const r = $('dialog').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('dialog').close(); } });
$('sound-button').addEventListener('click', toggleSound);
function showLog() { openDialog('대결 기록', run.match?.history.length ? run.match.history.map(out => `<div class="log-row"><strong>TURN ${out.turn}</strong><br>${esc(out.summary)}</div>`).join('') : '<p class="dialog-copy">첫 플레이가 기록될 차례입니다.</p>'); }
$('log-button').addEventListener('click', showLog);
document.addEventListener('keydown', e => {
  if (tutorial.active || $('dialog').open || $('route-dialog').open || run.phase !== 'match' || busy || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { const card = run.match.hand[Number(e.key) - 1]; if (card) { selected = card.uid; render(); const button = $('hand').querySelector(`[data-hand="${CSS.escape(selected)}"]`); button?.focus({preventScroll:true}); button?.scrollIntoView({block:'nearest',inline:'nearest'}); } }
  else if (e.code === 'Space' && !['BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); dispatch({ type: 'end-turn' }); }
  else if (e.key === 'Enter' && selected && (document.activeElement.matches('[data-hand]') || !['BUTTON', 'INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))) { e.preventDefault(); dispatch({ type: 'play-card', uid: selected }); }
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
  if (animation) { const progress = Math.min(1, (now - animation.started) / animation.duration); if (!motion.matches && progress < 1) current = { type: animation.type, progress }; if (progress === 1) animation = null; }
  drawPitch(context, { width: pitch.width, height: pitch.height, time: motion.matches ? 0 : now, opponentId: run.match?.opponentId, opponentColor: OPPONENTS[run.match?.opponentId]?.color, phase: run.phase, heroHp:run.condition,heroMomentum:run.phase === 'match' ? run.match?.momentum || 0 : 0,enemyHp:run.match?.enemyHp||0, animation: current });
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

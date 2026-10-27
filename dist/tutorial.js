import { CARDS, createRun, availableNodes, act, forecast } from './engine.js';

const PRACTICE_SEED = 20261026;
const CARD_ORDER = ['dribble', 'shot', 'cover'];
const STAGES = ['dribble', 'shot', 'cover', 'end-turn'];
const STEP_LABELS = ['기세 쌓기', '슛 사용', '방어 준비', '턴 종료'];
const NEXT_STAGE = { dribble: 'shot', shot: 'cover', cover: 'end-turn' };
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function createTutorialState() {
  return { stage: 'intro', run: null, selectedUid: null, result: null };
}

function createPracticeRun() {
  const fresh = createRun(PRACTICE_SEED, '연습 선수');
  const practice = act(fresh, { type: 'choose-node', id: availableNodes(fresh)[0].id });
  const match = practice.match;
  const cards = [...match.hand, ...match.draw];
  match.hand = CARD_ORDER.map(id => cards.find(card => card.id === id));
  const selected = new Set(match.hand.map(card => card.uid));
  match.draw = cards.filter(card => !selected.has(card.uid));
  return practice;
}

// This reducer never accepts the live game's run and never reads or writes storage.
export function tutorialAction(state, action) {
  if (!state || !action || state.result) return state;
  if (action.type === 'skip') return { stage: 'closed', run: null, selectedUid: null, result: 'skipped' };
  if (action.type === 'start') {
    if (state.stage !== 'intro') return state;
    return { ...state, stage: 'dribble', run: createPracticeRun() };
  }
  if (action.type === 'finish') {
    return state.stage === 'complete'
      ? { stage: 'closed', run: null, selectedUid: null, result: 'completed' }
      : state;
  }
  if (action.type === 'select') {
    const card = state.run?.match.hand.find(item => item.uid === action.uid);
    if (!CARD_ORDER.includes(state.stage) || card?.id !== state.stage || state.selectedUid === card.uid) return state;
    return { ...state, selectedUid: card.uid };
  }
  if (action.type === 'play') {
    const card = state.run?.match.hand.find(item => item.uid === state.selectedUid);
    if (!CARD_ORDER.includes(state.stage) || card?.id !== state.stage) return state;
    const next = act(state.run, { type: 'play-card', uid: card.uid });
    if (next === state.run) return state;
    return { ...state, run: next, stage: NEXT_STAGE[state.stage], selectedUid: null };
  }
  if (action.type === 'end-turn' && state.stage === 'end-turn') {
    const next = act(state.run, { type: 'end-turn' });
    if (next === state.run) return state;
    return { ...state, run: next, stage: 'complete', selectedUid: null };
  }
  return state;
}

function legendHTML() {
  return `<div class="tutorial-legend" aria-label="카드 세 종류">
    <div class="category-attack"><strong>공격 · 빨강</strong><span>슛·터치·드리블·헤더로 피해를 줍니다.</span></div>
    <div class="category-defense"><strong>수비 · 파랑</strong><span>상대의 다음 공격을 막을 방어를 쌓습니다.</span></div>
    <div class="category-skill"><strong>기술 · 초록</strong><span>전술과 훈련으로 다양한 효과를 얻습니다.</span></div>
  </div>`;
}

function progressHTML(stage) {
  const index = stage === 'complete' ? STAGES.length : STAGES.indexOf(stage);
  return `<div class="tutorial-progress"><span>${stage === 'complete' ? '연습 완료' : `${index + 1} / ${STAGES.length} 단계`}</span><ol>${STEP_LABELS.map((label, i) => `<li class="${i < index ? 'completed' : i === index ? 'current' : ''}"${i === index ? ' aria-current="step"' : ''}><span aria-hidden="true">${i < index ? '✓' : i + 1}</span> ${label}</li>`).join('')}</ol></div>`;
}

function scoreboardHTML(run) {
  return `<div class="tutorial-scoreboard" aria-label="연습 대결 현황">
    <div><span>내 체력</span><strong>${run.condition}</strong></div>
    <div><span>상대 체력</span><strong>${run.match.enemyHp}</strong></div>
    <div><span>기세</span><strong>${run.match.momentum}</strong></div>
  </div>`;
}

function instructionFor(state) {
  const match = state.run.match;
  switch (state.stage) {
    case 'dribble': return ['먼저 드리블로 기세를 쌓아요.', '전진 드리블 카드를 선택한 뒤 카드 사용을 눌러 보세요. 상대 방어 2를 뚫고 피해 3을 주면서 기세 1을 얻습니다.'];
    case 'shot': return ['모은 기세를 슛에 실어 보세요.', `기세를 ${match.momentum} 모았어요. 정확한 슈팅을 선택하고 사용하면 기본 피해 9에 기세를 더해 피해 10을 줍니다. 슛을 쓰면 기세는 모두 소모됩니다.`];
    case 'cover': return ['이제 상대의 공격을 준비해요.', '슛으로 피해 10을 주고 기세를 모두 썼어요. 안정된 자세 카드를 선택하고 사용해 이번 턴 방어 8을 얻으세요.'];
    default: return ['방어를 준비했으니 턴을 끝내요.', `상대는 턴 종료 후 공격 ${match.intent.attack}을 합니다. 내 방어 ${match.defense}로 모두 막을 수 있어요. 턴 종료를 눌러 결과를 확인하세요.`];
  }
}

export function createTutorial({ renderCard, paintCards = () => {}, onClose = () => {}, completionLabel = () => '경기로 돌아가기', rewardAvailable = () => false }) {
  if (typeof renderCard !== 'function') throw new TypeError('createTutorial requires renderCard');
  const dialog = document.createElement('dialog');
  dialog.id = 'tutorial-dialog';
  dialog.className = 'tutorial-dialog';
  dialog.setAttribute('aria-labelledby', 'tutorial-title');
  dialog.innerHTML = `<header class="tutorial-header"><div><p class="eyebrow">FIRST TOUCH · 직접 배우기</p><h2 id="tutorial-title">한 턴이면 충분해요.</h2></div><button type="button" class="tutorial-skip" data-tutorial-action="skip">튜토리얼 건너뛰기</button></header><div class="tutorial-body"></div>`;
  document.body.append(dialog);
  const body = dialog.querySelector('.tutorial-body');
  let state = createTutorialState(), isOpen = false, previousFocus = null, pendingCloseEvents = 0;

  function render({ selected = false } = {}) {
    const scrollTop = body.scrollTop;
    const handScroll = body.querySelector('.tutorial-hand')?.scrollLeft ?? 0;
    const rewardNotice = rewardAvailable() ? '<p class="dialog-copy tutorial-reward-note">완료하면 시작 장비 3개 중 1개를 고릅니다. 건너뛰면 보상 없이 시작합니다.</p>' : '';
    if (state.stage === 'intro') {
      body.innerHTML = `<section class="tutorial-coach"><h3 id="tutorial-step-title" tabindex="-1">카드 세 장으로 첫 플레이를 배워요.</h3><p>별도의 연습 대결에서 카드를 직접 선택하고 사용합니다. 연습 경기의 체력·카드는 실제 도전에 영향을 주지 않습니다.</p></section>${legendHTML()}<p class="dialog-copy">드리블 → 슛 → 방어 → 턴 종료를 차례로 연습해요. 언제든 위의 버튼으로 튜토리얼 전체를 건너뛸 수 있습니다.</p>${rewardNotice}<div class="tutorial-actions"><span>준비되면 직접 해 보세요.</span><button type="button" class="button primary" data-tutorial-action="start">직접 연습 시작</button></div>`;
    } else if (state.stage === 'complete') {
      const match = state.run.match;
      body.innerHTML = `${progressHTML(state.stage)}<section class="tutorial-coach"><h3 id="tutorial-step-title" tabindex="-1">좋아요. 첫 한 턴을 직접 해냈어요!</h3><p>내 체력을 지키며 상대 체력을 ${match.enemyHp}까지 줄였습니다. 이제 ${match.turn}턴, 에너지도 ${match.energy}으로 돌아왔어요.</p></section>${scoreboardHTML(state.run)}<div class="tutorial-summary"><ul><li><strong>드리블 → 기세 → 슛</strong><span>기세 1을 모아 슛에 추가 피해 1을 실었습니다. 남은 기세는 턴이 끝나도 유지돼요.</span></li><li><strong>예고를 보고 방어</strong><span>방어 8로 상대 공격 ${match.lastOutcome.blocked}을 막아 내 체력은 100 그대로입니다. 남은 방어는 다음 턴에 사라져요.</span></li><li><strong>새 턴, 새 선택</strong><span>매 턴 에너지가 최대치까지 회복되고 새 카드를 뽑습니다. 사용한 카드는 다시 섞여 돌아와요.</span></li></ul></div><section class="tutorial-route"><h3>실전에서는 이렇게 이어집니다.</h3><ol><li><strong>승리 후 카드 보상</strong><span>상대 체력을 0으로 만들면 골드를 얻고 카드 1장을 고르거나 건너뜁니다.</span></li><li><strong>연결된 지도로 이동</strong><span>보상 선택을 마치면 지도에서 다음 지점을 선택합니다.</span></li><li><strong>내 선수에게 필요한 준비</strong><span>훈련장에서는 카드 강화·정리, 라커룸에서는 체력 회복, 지정된 상점에서는 골드로 아이템을 구매합니다.</span></li></ol></section>${rewardNotice}<div class="tutorial-actions"><span>연습 경기의 체력·카드는 실제 도전에 영향을 주지 않습니다.</span><button type="button" class="button primary" data-tutorial-action="finish">${escapeHTML(completionLabel())}</button></div>`;
    } else {
      const [title, instruction] = instructionFor(state), match = state.run.match;
      const allowedCardId = CARD_ORDER.includes(state.stage) ? state.stage : null;
      const context = { selectedUid: state.selectedUid, energy: match.energy, allowedCardId };
      const chosen = match.hand.find(card => card.uid === state.selectedUid);
      body.innerHTML = `${progressHTML(state.stage)}<section class="tutorial-coach"><h3 id="tutorial-step-title" tabindex="-1">${title}</h3><p>${instruction}</p></section>${scoreboardHTML(state.run)}<div class="tutorial-intent"><strong>상대 예고: 턴 종료 시 공격 ${match.intent.attack} · 상대 방어 ${match.enemyBlock}</strong><span>내 방어 ${match.defense} → 예상 체력 피해 ${forecast(state.run).incoming}</span></div><div class="tutorial-hand" aria-label="연습용 카드">${match.hand.map(card => renderCard(card, context)).join('')}</div><div class="tutorial-actions"><div class="tutorial-energy"><span>에너지</span><strong>${match.energy} / ${match.maxEnergy}</strong></div>${state.stage === 'end-turn' ? '<button type="button" class="button primary" data-tutorial-action="end-turn">턴 종료 →</button>' : `<button type="button" class="button primary" data-tutorial-action="play"${chosen ? '' : ' disabled'}>${chosen ? `${CARDS[chosen.id].name} · 카드 사용` : '표시된 카드를 먼저 선택하세요'}</button>`}</div>`;
      for (const button of body.querySelectorAll('button[data-tutorial-hand]')) {
        const card = match.hand.find(item => item.uid === button.dataset.tutorialHand);
        button.disabled = card?.id !== allowedCardId;
        button.classList.toggle('tutorial-card-target', card?.id === allowedCardId);
      }
    }
    paintCards(dialog);
    body.scrollTop = selected ? scrollTop : 0;
    const hand = body.querySelector('.tutorial-hand');
    if (hand) hand.scrollLeft = selected ? handScroll : 0;
    const target = selected
      ? body.querySelector(`button[data-tutorial-hand="${state.selectedUid}"]`)
      : body.querySelector('#tutorial-step-title');
    target?.focus({ preventScroll: true });
  }

  function restoreFocus() {
    const hiddenDialog = previousFocus?.closest?.('dialog:not([open])');
    const target = previousFocus?.isConnected && !hiddenDialog ? previousFocus : document.getElementById('menu-button');
    target?.focus({ preventScroll: true });
    previousFocus = null;
  }

  function finish(result) {
    if (!isOpen) return;
    isOpen = false;
    state = createTutorialState();
    body.replaceChildren();
    if (dialog.open) { pendingCloseEvents++; dialog.close(); }
    restoreFocus();
    onClose(result);
  }

  function dispatch(action) {
    if (!isOpen) return;
    const next = tutorialAction(state, action);
    if (next === state) return;
    state = next;
    if (state.result) finish(state.result);
    else render({ selected: action.type === 'select' });
  }

  dialog.addEventListener('click', event => {
    event.stopPropagation();
    if (event.detail > 1) return;
    const button = event.target.closest?.('button');
    if (!button || !dialog.contains(button) || button.disabled) return;
    if (button.dataset.tutorialHand) dispatch({ type: 'select', uid: button.dataset.tutorialHand });
    else if (button.dataset.tutorialAction) dispatch({ type: button.dataset.tutorialAction });
  });
  // Keep the main game's delegated keyboard shortcuts outside this modal.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('cancel', event => { event.preventDefault(); dispatch({ type: 'skip' }); });
  dialog.addEventListener('close', () => {
    if (pendingCloseEvents) { pendingCloseEvents--; return; }
    dispatch({ type: 'skip' });
  });

  return {
    open() {
      if (isOpen) return;
      previousFocus = document.activeElement;
      state = createTutorialState();
      isOpen = true;
      render();
      dialog.showModal();
      body.querySelector('[data-tutorial-action="start"]')?.focus({ preventScroll: true });
    },
    get active() { return isOpen; },
  };
}

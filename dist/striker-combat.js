import { CARDS, cardEffect, isTechnique, isCombo } from './striker-cards.js';

// Hooks keep seeded shuffling, damage accounting and encounter outcomes in the engine.
export function resolveCard(run, card, hooks) {
  const m = run.match, e = cardEffect(card), type = CARDS[card.id].type;
  const prior = m.played.slice(0, -1), combo = isCombo({...m, played:prior}, card);
  const has = id => run.relics.includes(id);
  const selectedEnemy = m.enemies?.find(enemy => enemy.id === m.targetId);
  const breakBlock = amount => hooks.breakBlock ? hooks.breakBlock(amount) : (m.enemyBlock = Math.max(0, m.enemyBlock - amount));
  const once = key => { if (m.turnFlags[key]) return false; m.turnFlags[key] = true; return true; };
  const energy = () => { m.energy = Math.min(m.maxEnergy, m.energy + 1); };
  const names = new Set(prior.filter(isTechnique).map(c => c.id));
  const spentBlock = Math.min(m.defense, e.spendBlock || 0);
  const spentMomentum = e.momentum === 'all' ? m.momentum : Math.min(m.momentum, e.momentum || 0);
  let damage = e.damage || 0, bonus = m.damageBonuses[card.uid] || 0;
  let block = (e.block || 0) + (combo ? e.comboBlock || 0 : 0);
  const hits = (e.hits || 1) + (combo ? e.comboHits || 0 : 0);
  if (e.guardThreshold && m.defense >= e.guardThreshold) bonus += e.guardBonus;
  m.defense -= spentBlock; m.momentum -= spentMomentum;
  bonus += spentBlock * (e.blockRatio || 0) + spentMomentum * (e.ratio || 0);
  if (e.distinctBonus) bonus += Math.min(4, names.size) * e.distinctBonus;
  if (e.afterHeader && prior.some(c => CARDS[c.id].type === 'header')) block += e.afterHeader;
  if (e.gainMomentum) m.momentum += e.gainMomentum + (m.training.acceleration && once('acceleration') ? 1 : 0);
  if (e.persistent) m.training[e.persistent] = Math.max(m.training[e.persistent] || 0, e.carry || 1);
  m.energyDebt += e.energyDebt || 0;
  m.playerExposed = Math.min(99, m.playerExposed + (e.selfExposed || 0));
  if (e.nextShot) m.nextShot += e.nextShot;
  if (e.nextHeader) m.nextHeader += e.nextHeader;
  if (combo && once('combo')) {
    if (has('swift-boots')) bonus += 3;
    if (has('grip-socks')) block += 3;
    if (has('roulette-rune')) { energy(); hooks.draw(1); }
    if (has('street-rhythm')) m.nextShot += 4;
  }
  if (combo && m.training.control && once('control')) hooks.draw(1);
  if (combo && e.comboDraw) hooks.draw(e.comboDraw);
  if (type === 'shot') {
    bonus += m.nextShot; m.nextShot = 0;
    if (has('scouting-bag') && !m.previousShot && !m.shotCardPlayed) bonus += 5;
    if (spentMomentum && has('power-cleats') && once('power-cleats')) bonus += 3;
    if (spentMomentum && has('fenom-cleats')) bonus += Math.min(6, spentMomentum);
    if (has('nine-crest') && (selectedEnemy?.hp ?? m.enemyHp) <= (selectedEnemy?.maxHp ?? m.enemyMaxHp) / 2 && once('nine-crest')) bonus += 5;
    if (spentMomentum >= 3 && has('burst-laces') && !m.battleFlags.burst) { m.battleFlags.burst = true; energy(); }
    if (spentMomentum >= 3 && e.breakBlock) breakBlock(e.breakBlock);
    m.shotCardPlayed = true;
  }
  if (type === 'header') {
    bonus += m.nextHeader; m.nextHeader = 0;
    if (spentBlock >= 4 && has('energy-flask') && once('energy-flask')) bonus += 4;
    if (spentBlock && has('catenaccio-band')) bonus += Math.min(6, spentBlock);
    if (spentBlock && has('libero-seal') && once('libero-seal')) block += 3;
  }
  if (damage && m.enemyExposed && has('playmaker-lens') && once('playmaker-lens')) bonus += 4;
  if (type === 'dribble') {
    m.dribbleCardPlayed = true;
    breakBlock(m.intent.dribbleBreak || 0);
  }
  if (type === 'pass') {
    if (!m.passCardPlayed && has('ankle-tape')) block += 3;
    m.passCardPlayed = true;
  }
  if (isTechnique(card) && has('maestro-touch')) {
    names.add(card.id);
    if (names.size >= 3 && once('maestro-touch')) hooks.draw(1);
  }
  if (['tactic','training'].includes(type)) m.tacticCardPlayed = true;
  if (type === 'defense') {
    if (!m.defenseCardPlayed && has('training-kit') && m.hand.some(c => CARDS[c.id].type === 'header')) block += 3;
    m.defenseCardPlayed = true;
  }
  if (has('tempo-charm') && m.dribbleCardPlayed && m.shotCardPlayed && !m.tempoTriggered) { energy(); m.tempoTriggered = true; }
  // Fixed bonuses occur on the first strike only, before exposure multipliers.
  if (damage) {
    if (e.target === 'all' && m.enemies) {
      // Resource bonuses apply to each target; flat equipment bonuses apply only once.
      const resourceBonus = spentBlock * (e.blockRatio || 0) + spentMomentum * (e.ratio || 0);
      const targets = m.enemies.filter(enemy => enemy.hp > 0).map(enemy => enemy.id);
      for (const id of targets) hooks.damage(damage + (id === m.targetId ? bonus : resourceBonus), id);
    } else for (let hit = 0; hit < hits; hit++) hooks.damage(damage + (hit === 0 ? bonus : 0));
    if (combo && e.comboSplash) hooks.damage(e.comboSplash, 'other');
  }
  m.defense += block;
  const status = {exposed:e.exposed || 0, weakened:(e.weakened || 0) + (combo ? e.comboWeakened || 0 : 0)};
  if (hooks.status) hooks.status(status);
  else {
    m.enemyExposed = Math.min(99, m.enemyExposed + status.exposed);
    m.enemyWeakened = Math.min(99, m.enemyWeakened + status.weakened);
  }
  if (e.injury) {
    const injury = {uid:`c${run.nextUid++}`, id:e.injury, upgraded:false, temporary:true};
    m.temporaryCards.push(injury); m.draw = hooks.shuffle([...m.draw, injury]);
  }
  if (e.choice) {
    const candidates = e.choice === 'discard' ? m.hand.map(c => c.uid)
      : e.choice === 'retrieve' ? m.discard.filter(isTechnique).map(c => c.uid)
        : m.draw.slice(-3).reverse().map(c => c.uid);
    if (candidates.length) m.choice = {kind:e.choice, candidates, remaining:Math.min(e.choose || 1, candidates.length), draw:e.draw || 0, bonus:e.retrievedDamage || 0};
    else if (e.choice === 'discard') hooks.draw(e.draw);
  } else if (e.draw) hooks.draw(e.draw);
}

export function resolveChoice(run, uid, draw) {
  const m = run.match, choice = m.choice;
  if (!choice?.candidates.includes(uid)) return false;
  const source = choice.kind === 'discard' ? m.hand : choice.kind === 'retrieve' ? m.discard : m.draw;
  const index = source.findIndex(c => c.uid === uid);
  if (index < 0) return false;
  const [card] = source.splice(index, 1);
  if (choice.kind === 'discard') { m.discard.push(card); draw(choice.draw); }
  else {
    m.hand.push(card);
    if (choice.kind === 'retrieve') { m.discounts[uid] = true; m.damageBonuses[uid] = Math.max(m.damageBonuses[uid] || 0, choice.bonus); }
  }
  choice.candidates = choice.candidates.filter(id => id !== uid);
  if (--choice.remaining === 0) m.choice = null;
  return true;
}

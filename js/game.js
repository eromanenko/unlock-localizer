/**
 * game.js — Game view renderer
 *
 * Renders:
 *  - Game background (Skins/{GameID}_fond.jpg)
 *  - Icon + title + description card
 *  - Code input + submit
 *  - Card/hint number input + submit
 *  - Hidden objects button (disabled if none)
 */

import { t, detectGameLangs, resolveGameLocale } from './i18n.js';
import { showCodeResult, showHints, showHiddenObjects } from './modal.js';
import { getDisplayName } from './catalog.js';

/* ── Skin filename overrides ──────────────────────────────── */
// Some skins don't follow the exact GameID naming pattern
const SKIN_MAP = {
  Nautilus: 'Naut',
  HouseOnHill: 'Haunt',
  'Donjon_Doo-Arann': 'DooArann',
  Poursuite_Cabrakan: 'Cabrakan',
};

function getSkinBase(gameId, gameData) {
  return gameData?.skinName || SKIN_MAP[gameId] || gameId;
}

/* ── State for current game ────────────────────────────────── */
let _state = null; // { gameId, gameData, gameStrings, uiStrings, lang, availLangs, descriptions }

/**
 * Load and render the game view.
 *
 * @param {string} gameId
 * @param {object} state  — global app state { lang, uiStrings, descriptions }
 * @param {function} onLangChange — callback when user switches lang inside game view
 */
export async function renderGame(gameId, state, onLangChange) {
  const view = document.getElementById('view-game');
  view.innerHTML = '<div class="game-content"><div class="skeleton" style="height:100px;border-radius:14px"></div></div>';

  // Load game JSON
  let gameData;
  try {
    const r = await fetch(`assets/GameData/${gameId}/${gameId}.json`);
    if (!r.ok) throw new Error('not found');
    gameData = await r.json();
  } catch {
    view.innerHTML = `<div class="game-content"><div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Game data not found for ${gameId}</div></div></div>`;
    return;
  }

  // Detect available langs & resolve game strings
  const availLangs = await detectGameLangs(gameId);
  const effectiveLang = availLangs.includes(state.lang) ? state.lang : (availLangs[0] ?? 'fr');
  const { strings: gameStrings, lang: resolvedLang } = await resolveGameLocale(gameId, effectiveLang);

  _state = { gameId, gameData, gameStrings, uiStrings: state.uiStrings, lang: resolvedLang, availLangs, descriptions: state.descriptions };

  _renderView(view);

  // Update language buttons visibility in header
  _updateLangButtons(availLangs, resolvedLang, onLangChange);
}

/** Called when user picks a lang from header inside game view */
export async function switchGameLang(lang, onLangChange) {
  if (!_state) return;
  const { gameId } = _state;

  // Load both game strings and UI strings for new lang in parallel
  const { loadUILocale } = await import('./i18n.js');
  const [{ strings: gameStrings, lang: resolvedLang }, uiStrings] = await Promise.all([
    resolveGameLocale(gameId, lang),
    loadUILocale(lang),
  ]);

  _state.gameStrings = gameStrings;
  _state.uiStrings = uiStrings ?? _state.uiStrings;
  _state.lang = resolvedLang;

  const view = document.getElementById('view-game');
  _renderView(view);
  _updateLangButtons(_state.availLangs, resolvedLang, onLangChange);
}

/* ── Internal render ───────────────────────────────────────── */
function _renderView(view) {
  const { gameId, gameData, gameStrings, uiStrings, descriptions, lang } = _state;
  const skinBase = getSkinBase(gameId, gameData);

  view.innerHTML = '';

  // Background layers
  const bg = document.createElement('div');
  bg.className = 'game-bg';
  bg.style.backgroundImage = `url('assets/Skins/${skinBase}_fond.jpg')`;

  view.append(bg);

  // Main content
  const content = document.createElement('div');
  content.className = 'game-content';

  // ── Description card ────────────────────────────────────
  const descCard = document.createElement('div');
  descCard.className = 'game-desc-card';

  const icon = document.createElement('img');
  icon.className = 'game-icon';
  icon.alt = gameId;
  icon.src = `assets/images/icons/${gameId}.png`;
  icon.onerror = function () {
    const ph = document.createElement('div');
    ph.className = 'game-icon-placeholder';
    ph.textContent = '🎮';
    this.replaceWith(ph);
  };

  const info = document.createElement('div');
  info.className = 'game-info';

  const title = document.createElement('div');
  title.className = 'game-title';
  title.textContent = getDisplayName(gameId);

  const desc = document.createElement('div');
  desc.className = 'game-description';
  const descData = descriptions?.[gameId];
  const descLang = descData?.[lang] ? lang : (descData?.['en'] ? 'en' : (descData?.['fr'] ? 'fr' : null));
  desc.textContent = descLang ? descData[descLang] : '';

  info.append(title, desc);
  descCard.append(icon, info);
  content.appendChild(descCard);

  // ── Action panel ────────────────────────────────────────
  const panel = document.createElement('div');
  panel.className = 'action-panel';

  const svgCross = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  // Code input
  const hasCodes = Array.isArray(gameData.codes) && gameData.codes.length > 0;

  if (hasCodes) {
    const codeLabel = document.createElement('div');
    codeLabel.className = 'input-label';
    codeLabel.textContent = t(uiStrings, 'enter_code');

    const codeRow = document.createElement('div');
    codeRow.className = 'code-row';

    const codeWrapper = document.createElement('div');
    codeWrapper.className = 'input-wrapper';

    const codeInput = document.createElement('input');
    codeInput.id = 'code-input';
    codeInput.className = 'code-input';
    codeInput.type = 'number';
    codeInput.inputMode = 'numeric';
    codeInput.maxLength = 4;
    codeInput.placeholder = '0000';
    codeInput.setAttribute('aria-label', t(uiStrings, 'enter_code'));

    const codeClear = document.createElement('button');
    codeClear.className = 'btn-clear-input hidden';
    codeClear.innerHTML = svgCross;
    codeClear.setAttribute('aria-label', 'Clear');

    codeInput.addEventListener('input', () => {
      if (codeInput.value) codeClear.classList.remove('hidden');
      else codeClear.classList.add('hidden');
    });

    codeWrapper.append(codeInput, codeClear);

    const codeBtn = document.createElement('button');
    codeBtn.id = 'btn-submit-code';
    codeBtn.className = 'btn-primary';
    codeBtn.textContent = t(uiStrings, 'go');
    codeBtn.setAttribute('aria-label', t(uiStrings, 'enter_code'));

    codeRow.append(codeWrapper, codeBtn);

    const codeResult = document.createElement('div');
    codeResult.className = 'inline-result';

    panel.append(codeLabel, codeRow, codeResult);

    codeBtn.addEventListener('click', () => _handleCode(codeInput.value.trim(), codeResult));
    codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') _handleCode(codeInput.value.trim(), codeResult); });
    codeClear.addEventListener('click', () => {
      codeInput.value = '';
      codeResult.innerHTML = '';
      codeClear.classList.add('hidden');
      codeInput.focus();
    });
  }

  // Hint input
  const hintLabel = document.createElement('div');
  hintLabel.className = 'input-label';
  hintLabel.textContent = t(uiStrings, 'hint_button');

  const hintRow = document.createElement('div');
  hintRow.className = 'hint-row';

  const hintWrapper = document.createElement('div');
  hintWrapper.className = 'input-wrapper';

  const hintInput = document.createElement('input');
  hintInput.id = 'hint-input';
  hintInput.className = 'hint-input';
  hintInput.type = 'number';
  hintInput.inputMode = 'numeric';
  hintInput.placeholder = '101';
  hintInput.setAttribute('aria-label', t(uiStrings, 'hint_button'));

  const hintClear = document.createElement('button');
  hintClear.className = 'btn-clear-input hidden';
  hintClear.innerHTML = svgCross;
  hintClear.setAttribute('aria-label', 'Clear');

  hintInput.addEventListener('input', () => {
    if (hintInput.value) hintClear.classList.remove('hidden');
    else hintClear.classList.add('hidden');
  });

  hintWrapper.append(hintInput, hintClear);

  const hintBtn = document.createElement('button');
  hintBtn.id = 'btn-submit-hint';
  hintBtn.className = 'btn-primary';
  hintBtn.textContent = t(uiStrings, 'go');

  hintRow.append(hintWrapper, hintBtn);

  const hintResult = document.createElement('div');
  hintResult.className = 'inline-result';

  panel.append(hintLabel, hintRow, hintResult);

  hintBtn.addEventListener('click', () => _handleHint(hintInput.value.trim(), hintResult));
  hintInput.addEventListener('keydown', e => { if (e.key === 'Enter') _handleHint(hintInput.value.trim(), hintResult); });
  hintClear.addEventListener('click', () => {
    hintInput.value = '';
    hintResult.innerHTML = '';
    hintClear.classList.add('hidden');
    hintInput.focus();
  });

  // Hidden objects
  const hasHO = Array.isArray(gameData.hiddenObjects) && gameData.hiddenObjects.length > 0;

  if (hasHO) {
    const hoSpoiler = document.createElement('details');
    hoSpoiler.className = 'spoiler';
    hoSpoiler.style.marginTop = '12px';

    const svgChevron = `<svg class="spoiler-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const svgHO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    const summary = document.createElement('summary');
    summary.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="color:var(--clr-accent); display:flex; width:20px; height:20px;">${svgHO}</div>
        <span>${t(uiStrings, 'hidden_object_button').replace('\\n', ' ')}</span>
      </div>
      ${svgChevron}
    `;

    const body = document.createElement('div');
    body.className = 'spoiler-body';

    // We render the hidden objects inside this body container
    showHiddenObjects(gameData.hiddenObjects, gameStrings, uiStrings, body);

    hoSpoiler.append(summary, body);
    panel.appendChild(hoSpoiler);
  }

  content.appendChild(panel);
  view.appendChild(content);
}

/* ── Code lookup ───────────────────────────────────────────── */
function _handleCode(rawValue, container) {
  const { gameData, gameStrings, uiStrings } = _state;
  if (!rawValue || rawValue.length < 1) return;

  const num = parseInt(rawValue, 10);
  const codes = gameData.codes ?? [];
  const found = codes.find(c => parseInt(c.number, 10) === num);

  // Resolve message from game strings
  if (found) {
    const dialKey = `code_${found.number}_dial`;
    const regKey = `code_${found.number}`;
    if (found.type === 'Dial' && gameStrings?.[dialKey]) {
      found._resolvedMessage = gameStrings[dialKey];
    } else if (gameStrings?.[regKey]) {
      found._resolvedMessage = gameStrings[regKey];
    } else {
      found._resolvedMessage = found.message;
    }
  }

  const codeObj = found ? { ...found, message: found._resolvedMessage } : null;
  showCodeResult(codeObj, uiStrings, container);
}

/* ── Hint lookup ───────────────────────────────────────────── */
function _handleHint(rawValue, container) {
  const { gameData, gameStrings, uiStrings } = _state;
  if (!rawValue || rawValue.length < 1) return;

  const num = parseInt(rawValue, 10);
  const hints = gameData.hints ?? [];
  const answers = gameData.answers ?? [];

  // Find all hint entries for this card number (there can be multiple)
  const matchingHints = hints.filter(h => parseInt(h.number, 10) === num);
  // Primary hint object (first one) drives the modal header
  const hintObj = matchingHints[0] ?? null;

  // Resolve hint[] messages using locale keys:
  // Multiple hints with same number: first gets key hint_{X}_first, last gets hint_{X}
  // Hints with non-empty ID get key hint_{ID}
  const resolvedHints = _resolveHintMessages(matchingHints, gameStrings);

  // Resolve answer[] messages using locale keys: answer_hint_{hintNumber} or answer_hint_{hintID}
  const allResolvedAnswers = _resolveAnswerMessages(answers, gameStrings);
  // Filter to only answers for this card number
  const resolvedAnswers = allResolvedAnswers.filter(
    a => String(a.hintNumber) === String(num)
  );

  showHints(hintObj, resolvedHints, resolvedAnswers, gameStrings, uiStrings, container);
}

/**
 * Build locale key and resolve message for each hint entry.
 * Multiple entries with same number:
 *   - hasMoreHint === "True"  → key: hint_{num}_first
 *   - otherwise               → key: hint_{num}
 * If entry has a non-empty ID: key is hint_{ID}
 */
function _resolveHintMessages(hints, gameStrings) {
  return hints.map(h => {
    const id = h.ID?.trim();
    let key;
    if (id) {
      key = `hint_${id}`;
    } else if (h.hasMoreHint === 'True') {
      key = `hint_${h.number}_first`;
    } else {
      key = `hint_${h.number}`;
    }
    return {
      ...h,
      message: gameStrings?.[key] ?? h.message ?? '',
    };
  });
}

/**
 * Build locale key and resolve message for each answer entry.
 * Key: answer_hint_{hintNumber} or answer_hint_{hintID} if non-empty ID.
 */
function _resolveAnswerMessages(answers, gameStrings) {
  return answers.map(a => {
    const id = a.hintID?.trim();
    const key = id ? `answer_hint_${id}` : `answer_hint_${a.hintNumber}`;
    return {
      ...a,
      message: gameStrings?.[key] ?? a.message ?? '',
    };
  });
}

/* ── Language button update ────────────────────────────────── */
function _updateLangButtons(availLangs, activeLang, onLangChange) {
  // Always include 'fr' since it's the universal fallback
  const visible = [...new Set([...availLangs, 'fr'])];
  // Notify app.js so it can update button states
  if (onLangChange) onLangChange(visible, activeLang);
}

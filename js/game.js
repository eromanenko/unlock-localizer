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
  Nautilus:            'Naut',
  HouseOnHill:         'Haunt',
  'Donjon_Doo-Arann':  'DooArann',
  Poursuite_Cabrakan:  'Cabrakan',
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
  _state.uiStrings   = uiStrings ?? _state.uiStrings;
  _state.lang        = resolvedLang;

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

  const skin = document.createElement('div');
  skin.className = 'game-skin-overlay';
  skin.style.backgroundImage = `url('assets/Skins/${skinBase}_skin.png')`;

  view.append(bg, skin);

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

  // Code input
  const codeLabel = document.createElement('div');
  codeLabel.className = 'input-label';
  codeLabel.textContent = t(uiStrings, 'enter_code');

  const codeRow = document.createElement('div');
  codeRow.className = 'code-row';

  const codeInput = document.createElement('input');
  codeInput.id = 'code-input';
  codeInput.className = 'code-input';
  codeInput.type = 'number';
  codeInput.inputMode = 'numeric';
  codeInput.maxLength = 4;
  codeInput.placeholder = '0000';
  codeInput.setAttribute('aria-label', t(uiStrings, 'enter_code'));

  const codeBtn = document.createElement('button');
  codeBtn.id = 'btn-submit-code';
  codeBtn.className = 'btn-primary';
  codeBtn.textContent = t(uiStrings, 'go');
  codeBtn.setAttribute('aria-label', t(uiStrings, 'enter_code'));

  codeRow.append(codeInput, codeBtn);
  panel.append(codeLabel, codeRow);

  // Hint input
  const hintLabel = document.createElement('div');
  hintLabel.className = 'input-label';
  hintLabel.textContent = t(uiStrings, 'hint_button');

  const hintRow = document.createElement('div');
  hintRow.className = 'hint-row';

  const hintInput = document.createElement('input');
  hintInput.id = 'hint-input';
  hintInput.className = 'hint-input';
  hintInput.type = 'number';
  hintInput.inputMode = 'numeric';
  hintInput.placeholder = '101';
  hintInput.setAttribute('aria-label', t(uiStrings, 'hint_button'));

  const hintBtn = document.createElement('button');
  hintBtn.id = 'btn-submit-hint';
  hintBtn.className = 'btn-primary';
  hintBtn.textContent = t(uiStrings, 'go');

  hintRow.append(hintInput, hintBtn);
  panel.append(hintLabel, hintRow);

  // Hidden objects button
  const hasHO = Array.isArray(gameData.hiddenObjects) && gameData.hiddenObjects.length > 0;
  const hoBtn = document.createElement('button');
  hoBtn.id = 'btn-hidden-objects';
  hoBtn.className = 'btn-hidden-objects';
  hoBtn.disabled = !hasHO;
  hoBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      ${!hasHO ? '<line x1="3" y1="3" x2="21" y2="21"/>' : ''}
    </svg>
    <span class="btn-hidden-objects-label">${t(uiStrings, 'hidden_object_button').replace('\\n', ' ')}</span>
  `;
  panel.appendChild(hoBtn);

  content.appendChild(panel);
  view.appendChild(content);

  // ── Wire up events ──────────────────────────────────────
  codeBtn.addEventListener('click', () => _handleCode(codeInput.value.trim()));
  codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') _handleCode(codeInput.value.trim()); });

  hintBtn.addEventListener('click', () => _handleHint(hintInput.value.trim()));
  hintInput.addEventListener('keydown', e => { if (e.key === 'Enter') _handleHint(hintInput.value.trim()); });

  hoBtn.addEventListener('click', () => {
    if (!hasHO) return;
    showHiddenObjects(gameData.hiddenObjects, gameStrings, uiStrings);
  });
}

/* ── Code lookup ───────────────────────────────────────────── */
function _handleCode(rawValue) {
  const { gameData, gameStrings, uiStrings } = _state;
  if (!rawValue || rawValue.length < 1) return;

  const num = parseInt(rawValue, 10);
  const codes = gameData.codes ?? [];
  const found = codes.find(c => parseInt(c.number, 10) === num);

  // Resolve message from game strings
  if (found && found.message && gameStrings?.[found.message]) {
    found._resolvedMessage = gameStrings[found.message];
  } else if (found && found.message) {
    found._resolvedMessage = found.message;
  }

  const codeObj = found ? { ...found, message: found._resolvedMessage } : null;
  showCodeResult(codeObj, uiStrings);
}

/* ── Hint lookup ───────────────────────────────────────────── */
function _handleHint(rawValue) {
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
  const resolvedAnswers = _resolveAnswerMessages(answers, gameStrings);

  showHints(hintObj, resolvedHints, resolvedAnswers, gameStrings, uiStrings);
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

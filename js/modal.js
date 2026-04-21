/**
 * modal.js — Modal overlay management
 *
 * Renders three types of content inside the shared #modal-overlay:
 *   1. Code result (correct code, sound code, wrong code)
 *   2. Hints & solution spoilers for a card
 *   3. Hidden objects list
 */

import { t } from './i18n.js';

const overlay   = document.getElementById('modal-overlay');
const box       = document.getElementById('modal-box');
const modalTitle = document.getElementById('modal-title');
const content   = document.getElementById('modal-content');
const closeBtn  = document.getElementById('modal-close');

/* ── Open / close ──────────────────────────────────────────── */
function open() {
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
}

export function closeModal() {
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ── SVG helpers ───────────────────────────────────────────── */
const svgChevron = `<svg class="spoiler-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

/* ── Spoiler builder ───────────────────────────────────────── */
function makeSpoiler(summary, body) {
  const d = document.createElement('details');
  d.className = 'spoiler';
  d.innerHTML = `
    <summary>${summary}${svgChevron}</summary>
    <div class="spoiler-body">${body}</div>
  `;
  return d;
}

/* ────────────────────────────────────────────────────────────
   1. CODE RESULT
   ────────────────────────────────────────────────────────── */
export function showCodeResult(codeObj, uiStrings) {
  content.innerHTML = '';

  if (!codeObj) {
    // Wrong code
    modalTitle.textContent = t(uiStrings, 'code_wrong');
    const div = document.createElement('div');
    div.className = 'wrong-notice';
    div.textContent = t(uiStrings, 'code_wrong');
    content.appendChild(div);
    open();
    return;
  }

  const { type, number, message, cardsToTake, cardsToDiscard } = codeObj;

  modalTitle.textContent = type === 'Sound' ? '🔊 ' + number : '✓ ' + number;

  // Code number + badge
  const header = document.createElement('div');
  header.className = 'code-result-header';

  const badge = document.createElement('div');
  badge.className = `code-result-badge ${type === 'Sound' ? 'sound' : 'correct'}`;
  badge.textContent = type === 'Sound' ? '🔊' : '✓';

  const num = document.createElement('div');
  num.className = 'code-result-num';
  num.textContent = number;

  header.append(badge, num);
  content.appendChild(header);

  // Sound type: redirect to original app
  if (type === 'Sound') {
    const notice = document.createElement('div');
    notice.className = 'sound-notice';
    notice.textContent = uiStrings?.sound_notice
      ?? 'This code triggers a sound puzzle. Please enter it in the official Unlock! app.';
    content.appendChild(notice);
    open();
    return;
  }

  // Message
  // Normalize cardsToTake/Discard to arrays (JSON has them as comma-separated strings)
  const toArr = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  const takeList    = toArr(cardsToTake);
  const discardList = toArr(cardsToDiscard);

  if (message) {
    const msg = document.createElement('div');
    msg.className = 'code-result-message';
    msg.textContent = message;
    content.appendChild(msg);
  }

  // Cards to take
  if (takeList.length > 0) {
    const el = document.createElement('div');
    el.className = 'cards-action';
    el.innerHTML = `
      <span class="cards-action-label">${t(uiStrings, takeList.length === 1 ? 'take_card' : 'take_cards')}</span>
      <span class="cards-action-value">${takeList.join(', ')}</span>
    `;
    content.appendChild(el);
  }

  // Cards to discard
  if (discardList.length > 0) {
    const el = document.createElement('div');
    el.className = 'cards-action discard';
    el.innerHTML = `
      <span class="cards-action-label">${t(uiStrings, 'discard')}</span>
      <span class="cards-action-value">${discardList.join(', ')}</span>
    `;
    content.appendChild(el);
  }

  open();
}

/* ────────────────────────────────────────────────────────────
   2. HINTS
   ────────────────────────────────────────────────────────────
   hintObj  — entry from `hints[]`
   answers  — all entries from `answers[]` (filtered by hintNumber)
   gameStrings — game locale strings (for message resolution)
   uiStrings   — UI locale strings
   ────────────────────────────────────────────────────────── */
export function showHints(hintObj, resolvedHints, answers, gameStrings, uiStrings) {
  content.innerHTML = '';
  modalTitle.textContent = t(uiStrings, 'hint');

  if (!hintObj) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state-icon">🔍</div><div class="empty-state-text">${t(uiStrings, 'hint_not_found')}</div>`;
    content.appendChild(div);
    open();
    return;
  }

  const cardNum = hintObj.number;

  // Filter answers for this card number
  const hintAnswers = answers.filter(a => a.hintNumber === cardNum);

  if (resolvedHints.length === 0 && hintAnswers.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state-icon">🔍</div><div class="empty-state-text">${t(uiStrings, 'nothing_to_report')}</div>`;
    content.appendChild(div);
    open();
    return;
  }

  // Hints section: show all resolved hint messages as spoilers
  if (resolvedHints.length) {
    const label = document.createElement('div');
    label.className = 'modal-section-title';
    label.textContent = t(uiStrings, 'hint');
    content.appendChild(label);

    resolvedHints.forEach((h, idx) => {
      const spoiler = makeSpoiler(
        `${t(uiStrings, 'hint_number', idx + 1)}`,
        escHtml(h.message)
      );
      content.appendChild(spoiler);
    });
  }

  // Solution section: answers for this card
  const solutionItems = hintAnswers.filter(a => !a.code || a.code === '');
  const codeItems     = hintAnswers.filter(a => a.code && a.code !== '');
  const allSolutions  = [...solutionItems, ...codeItems];

  if (allSolutions.length || hintObj.hasSolution === 'True') {
    const label = document.createElement('div');
    label.className = 'modal-section-title';
    label.textContent = t(uiStrings, 'solution');
    content.appendChild(label);

    allSolutions.forEach(ans => {
      const extra = ans.code ? ` — <strong>${ans.code}</strong>` : '';
      const spoiler = makeSpoiler(
        t(uiStrings, 'solution'),
        escHtml(ans.message) + extra
      );
      content.appendChild(spoiler);
    });
  }

  open();
}

/* ────────────────────────────────────────────────────────────
   3. HIDDEN OBJECTS
   ────────────────────────────────────────────────────────── */
export function showHiddenObjects(hiddenObjects, gameStrings, uiStrings) {
  content.innerHTML = '';
  modalTitle.textContent = t(uiStrings, 'hidden_object');

  if (!hiddenObjects?.length) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state-icon">🙈</div><div class="empty-state-text">${t(uiStrings, 'nothing_to_report')}</div>`;
    content.appendChild(div);
    open();
    return;
  }

  const label = document.createElement('div');
  label.className = 'modal-section-title';
  label.textContent = t(uiStrings, 'hidden_object');
  content.appendChild(label);

  hiddenObjects.forEach(ho => {
    const msg = resolveGameString(ho.message, gameStrings);
    const timeLabel = ho.time != null
      ? `<span class="ho-time-chip">⏱ ${formatTime(ho.time)}</span> `
      : '';
    const spoiler = makeSpoiler(
      `${timeLabel}${t(uiStrings, 'hidden_object')} ${ho.number ?? ''}`,
      escHtml(msg)
    );
    content.appendChild(spoiler);
  });

  open();
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Resolve a game string: it may be a direct string or a key
 * referencing game locale strings.
 */
function resolveGameString(value, gameStrings) {
  if (!value) return '';
  // If the value is a key in gameStrings, resolve it
  if (gameStrings && gameStrings[value]) return gameStrings[value];
  return value;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

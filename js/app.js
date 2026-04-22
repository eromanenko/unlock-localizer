/**
 * app.js — Entry point & SPA controller
 */

import { loadUILocale, SUPPORTED_LANGS } from './i18n.js';
import { renderCatalog, getDisplayName } from './catalog.js';
import { renderGame, switchGameLang } from './game.js';
import { APP_VERSION } from './version.js';

/* ── Global state ──────────────────────────────────────────── */
const state = {
  lang:        'en',
  uiStrings:   {},
  boxes:       [],
  descriptions:{},
  currentGame: null,
};

/* ── DOM refs ──────────────────────────────────────────────── */
const header      = document.getElementById('app-header');
const btnBack     = document.getElementById('btn-back');
const headerTitle = document.getElementById('header-title');
const viewCatalog = document.getElementById('view-catalog');
const viewGame    = document.getElementById('view-game');

/* ═══════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════ */
async function boot() {
  // Detect preferred language
  const saved = localStorage.getItem('unlock-lang');
  const browserLang = navigator.language?.slice(0, 2).toLowerCase();
  state.lang = saved ?? (SUPPORTED_LANGS.includes(browserLang) ? browserLang : 'en');

  // Load everything in parallel
  const [unlockData, descriptionsData, uiStrings] = await Promise.all([
    fetch('assets/GameData/Unlock.json').then(r => r.json()),
    fetch('assets/GameData/descriptions.json').then(r => r.json()),
    loadUILocale(state.lang),
  ]);

  state.boxes        = unlockData.boxes;
  state.descriptions = descriptionsData;
  state.uiStrings    = uiStrings ?? {};

  showCatalog();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ═══════════════════════════════════════════════════════════
   VIEW: CATALOG
═══════════════════════════════════════════════════════════ */
function showCatalog() {
  state.currentGame = null;

  // Header visible on catalog (language switcher needed), back button hidden
  header.classList.remove('hidden');
  headerTitle.innerHTML = `UNLOCK! Localizer <span class="header-version">v${APP_VERSION}</span>`;
  btnBack.classList.add('hidden');
  updateLangButtons(SUPPORTED_LANGS, state.lang);

  // Views
  viewCatalog.classList.add('active');
  viewGame.classList.remove('active');

  // Render
  renderCatalog(
    state.boxes,
    state.descriptions,
    state.lang,
    state.uiStrings,
    (advId) => showGame(advId)
  );
}

/* ═══════════════════════════════════════════════════════════
   VIEW: GAME
═══════════════════════════════════════════════════════════ */
async function showGame(gameId) {
  state.currentGame = gameId;

  // Header
  header.classList.remove('hidden');
  headerTitle.textContent = getDisplayName(gameId);
  btnBack.classList.remove('hidden');
  // Show all buttons initially; game.js will refine
  updateLangButtons(SUPPORTED_LANGS, state.lang);

  // Views
  viewCatalog.classList.remove('active');
  viewGame.classList.add('active');

  const { title } = await renderGame(
    gameId,
    { lang: state.lang, uiStrings: state.uiStrings, descriptions: state.descriptions },
    (availLangs, activeLang) => {
      updateLangButtons(availLangs, activeLang);
    }
  );
  if (title) headerTitle.textContent = title;
}

/* ═══════════════════════════════════════════════════════════
   LANGUAGE SWITCHING
═══════════════════════════════════════════════════════════ */
function updateLangButtons(visible, active) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const l = btn.dataset.lang;
    btn.classList.toggle('hidden', !visible.includes(l));
    btn.classList.toggle('active', l === active);
  });
}

// Delegate all lang-btn clicks here
document.getElementById('lang-switcher').addEventListener('click', async e => {
  const btn = e.target.closest('.lang-btn');
  if (!btn || btn.classList.contains('hidden')) return;

  const newLang = btn.dataset.lang;

  if (state.currentGame) {
    // Inside game view: delegate to game module
    state.lang = newLang; // sync so back→catalog uses this lang
    localStorage.setItem('unlock-lang', newLang);
    const { title } = await switchGameLang(newLang, (availLangs, activeLang) => {
      updateLangButtons(availLangs, activeLang);
    });
    if (title) headerTitle.textContent = title;
  } else {
    // Catalog: switch UI language and re-render catalog
    state.lang = newLang;
    localStorage.setItem('unlock-lang', newLang);
    state.uiStrings = await loadUILocale(newLang) ?? {};
    showCatalog();
  }
});

/* ═══════════════════════════════════════════════════════════
   BACK BUTTON
═══════════════════════════════════════════════════════════ */
btnBack.addEventListener('click', async () => {
  // Reload UI strings for current lang in case game switched them
  state.uiStrings = await loadUILocale(state.lang) ?? state.uiStrings;
  showCatalog();
});

/* ── Start ─────────────────────────────────────────────────── */
boot();

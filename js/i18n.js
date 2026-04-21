/**
 * i18n.js — Locale loading & UI string resolution
 *
 * Sources:
 *  - UI strings:   assets/GameData/Locale/{Language}/locale.json
 *  - Game strings: assets/GameData/{GameID}/Locale/{Language}/locale.json
 *
 * Supported UI langs: en, fr, uk, ru
 * Fallback chain for game content: chosen → fr
 */

const SUPPORTED_LANGS = ['en', 'fr', 'uk', 'ru'];

// Directory name used in the file system for each lang key
const LANG_DIR = {
  en: 'English',
  fr: 'French',
  uk: 'Ukrainian',
  ru: 'Russian',
};

// Cache: "ui:en" | "game:Kilea:uk" → { key: value }
const _cache = new Map();

/* ── Low-level fetch with cache ────────────────────────────── */
async function _fetchLocale(url) {
  if (_cache.has(url)) return _cache.get(url);
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const json = await r.json();
    const strings = json.localizations ?? {};
    _cache.set(url, strings);
    return strings;
  } catch {
    _cache.set(url, null);
    return null;
  }
}

/* ── UI locale ─────────────────────────────────────────────── */
export async function loadUILocale(lang) {
  const dir = LANG_DIR[lang] ?? LANG_DIR.en;
  return _fetchLocale(`assets/GameData/Locale/${dir}/locale.json`);
}

/* ── Game locale ───────────────────────────────────────────── */
export async function loadGameLocale(gameId, lang) {
  const dir = LANG_DIR[lang] ?? LANG_DIR.fr;
  return _fetchLocale(`assets/GameData/${gameId}/Locale/${dir}/locale.json`);
}

/**
 * Resolve a game locale with fallback to French.
 * Returns { strings, lang } where lang is the actual language used.
 */
export async function resolveGameLocale(gameId, lang) {
  let strings = await loadGameLocale(gameId, lang);
  if (strings) return { strings, lang };

  // fallback to French
  strings = await loadGameLocale(gameId, 'fr');
  return { strings: strings ?? {}, lang: strings ? 'fr' : null };
}

/**
 * Detect which languages are available for a given game.
 * Returns an array of lang keys that have a locale file.
 */
export async function detectGameLangs(gameId) {
  const results = await Promise.all(
    SUPPORTED_LANGS.map(async lang => {
      const s = await loadGameLocale(gameId, lang);
      return s ? lang : null;
    })
  );
  return results.filter(Boolean);
}

/* ── String resolution helper ──────────────────────────────── */

/**
 * Get a UI string by key from a strings map.
 * Supports {0} placeholder substitution.
 */
export function t(strings, key, ...args) {
  let str = strings?.[key] ?? key;
  args.forEach((arg, i) => { str = str.replaceAll(`{${i}}`, arg); });
  return str;
}

export { SUPPORTED_LANGS, LANG_DIR };

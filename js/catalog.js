/**
 * catalog.js — Catalog view renderer
 *
 * Layout:
 *  - Full-width banner per box (cover image, name baked in)
 *  - Clicking banner toggles a 3-column grid of adventure cards below
 *  - Adventure card: icon image fills card, localized name overlay at bottom
 *  - Game titles are loaded lazily from each game's locale.json on accordion open
 */

import { t, loadGameLocale, LANG_DIR } from './i18n.js';

const SKIP_BOXES = [];

/**
 * Render the catalog into #view-catalog.
 */
export function renderCatalog(boxes, descriptions, lang, uiStrings, onSelect) {
  const view = document.getElementById('view-catalog');
  view.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = 'catalog-inner';

  for (const box of boxes) {
    if (SKIP_BOXES.includes(box.ID)) continue;

    const section = document.createElement('div');
    section.className = 'box-section';
    section.dataset.boxId = box.ID;

    // ── Banner ─────────────────────────────────────────────────
    const banner = document.createElement('div');
    banner.className = 'box-banner';
    banner.setAttribute('role', 'button');
    banner.setAttribute('tabindex', '0');
    banner.setAttribute('aria-expanded', 'false');
    banner.setAttribute('aria-label', box.displayName || box.ID);

    const coverImg = document.createElement('img');
    coverImg.alt = box.displayName || box.ID;
    coverImg.loading = 'lazy';
    coverImg.src = `assets/images/covers/${box.ID}.png`;
    coverImg.onerror = function () {
      banner.style.background = buildGradientForBox(box.ID);
      this.remove();
    };

    // Hidden label div (kept for DOM structure but display:none in CSS)
    const label = document.createElement('div');
    label.className = 'box-banner-label';

    banner.append(coverImg, label);

    // ── Grid wrapper (collapsed by default) ────────────────────
    const gridWrap = document.createElement('div');
    gridWrap.className = 'adventures-grid-wrap';

    const grid = document.createElement('div');
    grid.className = 'adventures-grid';

    // Build cards with fallback display names first
    const cardMap = {}; // advId → nameEl
    for (const advId of box.adventures) {
      const { card, nameEl } = buildAdventureCard(advId);
      cardMap[advId] = nameEl;
      card.addEventListener('click', () => onSelect(advId, box.ID));
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(advId, box.ID); }
      });
      grid.appendChild(card);
    }

    gridWrap.appendChild(grid);

    // ── Toggle on banner click — lazy-load titles on first open ──
    let titlesLoaded = false;

    const toggle = async () => {
      const isOpen = section.classList.toggle('open');
      banner.setAttribute('aria-expanded', String(isOpen));

      // Load localized titles once when first opened
      if (isOpen && !titlesLoaded) {
        titlesLoaded = true;
        await loadLocalizedTitles(box.adventures, lang, cardMap);
      }
    };

    banner.addEventListener('click', toggle);
    banner.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    section.append(banner, gridWrap);
    inner.appendChild(section);
  }

  view.appendChild(inner);
}

/* ── Lazy-load localized titles ────────────────────────────── */
async function loadLocalizedTitles(advIds, lang, cardMap) {
  // Load all titles in parallel
  await Promise.all(advIds.map(async advId => {
    const nameEl = cardMap[advId];
    if (!nameEl) return;

    // Try selected lang, then 'en' fallback, then 'fr'
    let title = null;
    for (const l of [lang, 'en', 'fr']) {
      const strings = await loadGameLocale(advId, l);
      if (strings?.title) { title = strings.title; break; }
    }

    if (title) nameEl.textContent = title;
  }));
}

/* ── Adventure card ────────────────────────────────────────── */
function buildAdventureCard(advId) {
  const card = document.createElement('div');
  card.className = 'adventure-card';
  card.dataset.id = advId;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  // Icon image
  const img = document.createElement('img');
  img.className = 'adventure-card-img';
  img.alt = getDisplayName(advId);
  img.loading = 'lazy';
  img.src = `assets/images/icons/${advId}.png`;
  img.onerror = function () {
    const ph = document.createElement('div');
    ph.className = 'adventure-card-img-placeholder';
    ph.textContent = '🎮';
    this.replaceWith(ph);
  };

  // Name overlay (starts with fallback English name)
  const nameEl = document.createElement('div');
  nameEl.className = 'adventure-card-name';
  nameEl.textContent = getDisplayName(advId);

  card.append(img, nameEl);
  return { card, nameEl };
}

/* ── Fallback gradient per box ─────────────────────────────── */
function buildGradientForBox(id) {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const h1 = seed % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,20%) 0%, hsl(${h2},70%,30%) 100%)`;
}

/* ── Display name map (EN fallback) ────────────────────────── */
const NAME_MAP = {
  Kilea: "Kilea's Wrath",
  Funfair: 'Frenzy at the Amusement Park',
  Excalibur: 'The Curse on Camelot',
  Altipia: "Queen Altipia's Crown",
  Lapinot: 'A Memorable Date',
  Mafia: 'Cover Operation in Little Italy',
  NovaCity: 'Nova City Under Threat',
  DiaDeMuertos: 'Día de los Muertos',
  Ragnarok: 'Ragnarök',
  Restart: 'Restart',
  Hollywood: 'Hollywood Confidential',
  Waff: "W.A.F.F.'s Odyssey",
  TicketToRide: 'Ticket to Ride',
  Mysterium: 'Mysterium',
  Pandemic: 'Pandemic',
  ActionStory: 'Action Story',
  Robin: 'Robin Hood',
  Sherlock2: 'Sherlock Holmes — The Burnt Angels Case',
  Grece: 'In the Clutches of Hades',
  Animalomatic: 'The Animal-O-Matic',
  TourDuMonde: 'Around the World in 80 Min.',
  Cinema: 'The Seventh Screening',
  Chine: "The Dragon's Seven Tests",
  Espions: 'Mission #07',
  Circus: 'The Noside Show',
  Paris: 'Arsène Lupin',
  TimeTravel: 'Lost in the TimeWarp!',
  InsertCoin: 'Insert Coin',
  Sherlock: 'Sherlock Holmes — Scarlet Thread',
  Alice: 'In Pursuit of the White Rabbit',
  CroqueMitaine: 'Night of the Boogeymen',
  MilleNuits: "Scheherazade's Last Tale",
  Challenger: 'Expedition: Challenger',
  NosideStory: 'A Noside Story',
  Tombstone: 'Tombstone Express',
  Oz: 'The Adventurers of Oz',
  HouseOnHill: 'The House on the Hill',
  Nautilus: "The Nautilus' Traps",
  Tonipal: "Tonipal's Treasure",
  DoctorGoorse: 'The Island of Doctor Goorse',
  Formula: 'The Formula',
  Squeek: 'Squeek & Sausage',
  TourEiffel: 'Escape from the Eiffel Tower',
  MasqueDeFer: 'Le Masque de Fer',
  Lastman: 'Lastman',
  Tuto: 'Tutorial',
  Sabre: "Sabre's Edge",
  Ascension: 'The Ascent',
  Sirene: "The Ocean's Heart",
  Migration: 'The Song of the Sea Spray',
  SherlockHead: 'Inside the Mind of Sherlock Holmes',
  Chat: "Schrödinger's Cat",
  Birmingham: 'The Birmingham Murder',
  RedMask: 'Red Mask',
  'Donjon_Doo-Arann': "Doo Arann's Dungeon",
  Cuisine: 'Secret Recipes of Yore',
  Momie: 'The Awakening of the Mummy',
  Ange: 'The Flight of the Angel',
  Poursuite_Cabrakan: 'In Pursuit of Cabrakan',
  Pieuvre: 'The Secrets of the Octopus',
  Heat: 'Heat',
  Carcassonne: 'Carcassonne',
  SevenWonders: 'Seven Wonders',
  '5thAvenue': '5th Avenue',
  RalphAzham: 'Ralph Azham',
  GhostStone: 'Ghost Stone',
  TicketToRide_Demo: 'Ticket to Ride (Demo)',
  Elite: 'Elite',
  Noel: 'Noël',
  RA: 'RA',
};

export function getDisplayName(id) {
  return NAME_MAP[id] ?? id.replace(/([A-Z])/g, ' $1').trim();
}

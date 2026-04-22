/**
 * modal.js — Modal overlay management
 *
 * Renders three types of content inside the shared #modal-overlay:
 *   1. Code result (correct code, sound code, wrong code)
 *   2. Hints & solution spoilers for a card
 *   3. Hidden objects list
 */

import { t } from "./i18n.js";

/* ── SVG helpers ───────────────────────────────────────────── */
const svgChevron = `<svg class="spoiler-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

/* ── Spoiler builder ───────────────────────────────────────── */
function makeSpoiler(summary, body) {
  const d = document.createElement("details");
  d.className = "spoiler";
  d.innerHTML = `
    <summary>${summary}${svgChevron}</summary>
    <div class="spoiler-body">${body}</div>
  `;
  return d;
}

/* ────────────────────────────────────────────────────────────
   1. CODE RESULT
   ────────────────────────────────────────────────────────── */
export function showCodeResult(codeObj, uiStrings, container) {
  container.innerHTML = "";

  if (!codeObj) {
    // Wrong code
    const div = document.createElement("div");
    div.className = "wrong-notice";
    div.textContent = t(uiStrings, "code_wrong");
    container.appendChild(div);
    return;
  }

  const { type, number, message, cardsToTake, cardsToDiscard } = codeObj;

  // Code number + badge
  const header = document.createElement("div");
  header.className = "code-result-header";

  const badge = document.createElement("div");
  badge.className = `code-result-badge ${type === "Sound" ? "sound" : "correct"}`;
  badge.textContent = type === "Sound" ? "🔊" : "✓";

  const num = document.createElement("div");
  num.className = "code-result-num";
  num.textContent = number;

  header.append(badge, num);
  container.appendChild(header);

  // Sound type: redirect to original app
  if (type === "Sound") {
    const notice = document.createElement("div");
    notice.className = "sound-notice";
    notice.textContent =
      uiStrings?.sound_notice ??
      "This code triggers a sound puzzle. Please enter it in the official Unlock! app.";
    container.appendChild(notice);
    return;
  }

  // Message
  // Normalize cardsToTake/Discard to arrays (JSON has them as comma-separated strings)
  const toArr = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const takeList = toArr(cardsToTake);
  const discardList = toArr(cardsToDiscard);

  if (message) {
    const msg = document.createElement("div");
    msg.className = "code-result-message";
    msg.innerHTML = escHtml(message);
    container.appendChild(msg);
  }

  // Cards to take
  if (takeList.length > 0) {
    const el = document.createElement("div");
    el.className = "cards-action";
    el.innerHTML = `
      <span class="cards-action-label">${t(uiStrings, takeList.length === 1 ? "take_card" : "take_cards")}</span>
      <span class="cards-action-value">${takeList.join(", ")}</span>
    `;
    container.appendChild(el);
  }

  // Cards to discard
  if (discardList.length > 0) {
    const el = document.createElement("div");
    el.className = "cards-action discard";
    el.innerHTML = `
      <span class="cards-action-label">${t(uiStrings, "discard")}</span>
      <span class="cards-action-value">${discardList.join(", ")}</span>
    `;
    container.appendChild(el);
  }
}

/* ────────────────────────────────────────────────────────────
   2. HINTS
   ────────────────────────────────────────────────────────────
   hintObj  — entry from `hints[]`
   answers  — all entries from `answers[]` (filtered by hintNumber)
   gameStrings — game locale strings (for message resolution)
   uiStrings   — UI locale strings
   ────────────────────────────────────────────────────────── */
export function showHints(
  hintObj,
  resolvedHints,
  answers,
  gameStrings,
  uiStrings,
  container,
) {
  container.innerHTML = "";

  if (!hintObj) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.innerHTML = `<div class="empty-state-icon">🔍</div><div class="empty-state-text">${t(uiStrings, "hint_not_found")}</div>`;
    container.appendChild(div);
    return;
  }

  if (resolvedHints.length === 0 && answers.length === 0) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.innerHTML = `<div class="empty-state-icon">🔍</div><div class="empty-state-text">${t(uiStrings, "nothing_to_report")}</div>`;
    container.appendChild(div);
    return;
  }

  // Hints section: show all resolved hint messages as spoilers
  if (resolvedHints.length) {
    const label = document.createElement("div");
    label.className = "modal-section-title";
    label.textContent = t(uiStrings, "hint");
    container.appendChild(label);

    resolvedHints.forEach((h, idx) => {
      const spoiler = makeSpoiler(
        `${t(uiStrings, "hint_number", idx + 1)}`,
        escHtml(h.message),
      );
      container.appendChild(spoiler);
    });
  }

  // Solution section: answers for this card
  if (answers.length > 0) {
    const label = document.createElement("div");
    label.className = "modal-section-title solution-title";
    label.textContent = t(uiStrings, "solution");
    container.appendChild(label);

    answers.forEach((ans) => {
      const msg = resolveGameString(ans.message, gameStrings);
      const spoiler = makeSpoiler(
        t(uiStrings, "solution_for_hint") + " " + ans.hintNumber,
        escHtml(msg),
      );
      container.appendChild(spoiler);
    });
  }
}

/* ────────────────────────────────────────────────────────────
   3. HIDDEN OBJECTS
   ────────────────────────────────────────────────────────── */
export function showHiddenObjects(
  hiddenObjects,
  gameStrings,
  uiStrings,
  container,
) {
  container.innerHTML = "";

  if (!hiddenObjects?.length) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.innerHTML = `<div class="empty-state-icon">🙈</div><div class="empty-state-text">${t(uiStrings, "nothing_to_report")}</div>`;
    container.appendChild(div);
    return;
  }

  // Sort by time (ascending), placing items without time at the end
  const sortedHO = [...hiddenObjects].sort((a, b) => {
    const ta = a.time != null && a.time !== "" ? Number(a.time) : Infinity;
    const tb = b.time != null && b.time !== "" ? Number(b.time) : Infinity;
    return ta - tb;
  });

  sortedHO.forEach((ho) => {
    const key = `hiddenObject_${ho.number}`;
    let msg = gameStrings?.[key];
    if (!msg) msg = resolveGameString(ho.message, gameStrings);

    const timeLabel =
      ho.time != null && ho.time !== ""
        ? `<span class="ho-time-chip">⏱ ${formatTime(ho.time)}</span> `
        : "";
    const spoiler = makeSpoiler(
      `${timeLabel}${t(uiStrings, "hidden_object")} ${ho.number ?? ""}`.trim(),
      escHtml(msg),
    );
    container.appendChild(spoiler);
  });
}

/* ── Helpers ───────────────────────────────────────────────── */

/**
 * Resolve a game string: it may be a direct string or a key
 * referencing game locale strings.
 */
function resolveGameString(value, gameStrings) {
  if (!value) return "";
  // If the value is a key in gameStrings, resolve it
  if (gameStrings && gameStrings[value]) return gameStrings[value];
  return value;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

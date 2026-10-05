// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
import "./styles.css";

import { ensureHeadingIds, renderMarkdownToHtml } from "./markdown.js";
import { buildOutlineTree, loadExpandedState, renderOutlineNav } from "./outline.js";
import {
  applyPhraseHighlightByClass,
  applySentenceBackgroundByClass,
  buildSegments,
  clearHighlights,
  firstWordIndexInSection,
  nextSectionHeading,
  nextSentenceStart,
  phraseEndExclusive,
  pickActiveHeadingIndex,
  preparePrompterDom,
  previousSentenceStart,
  resetHighlightClasses,
  scrollHighlightIntoView,
  segmentContaining,
} from "./prompter.js";

const STORAGE_KEY = "markdown-teleprompter-ms-per-phrase";
const LEGACY_STORAGE_KEY = "markdown-teleprompter-ms-per-pair";

const article = /** @type {HTMLElement} */ (document.getElementById("content"));
const fileInput = /** @type {HTMLInputElement} */ (document.getElementById("file-input"));
const dropZone = /** @type {HTMLElement} */ (document.getElementById("drop-zone"));
const outlineEl = /** @type {HTMLElement} */ (document.getElementById("outline"));
const outlineMobile = /** @type {HTMLElement} */ (document.getElementById("outline-mobile"));
const btnPlay = /** @type {HTMLButtonElement} */ (document.getElementById("btn-play"));
const btnPause = /** @type {HTMLButtonElement} */ (document.getElementById("btn-pause"));
const btnPrev = /** @type {HTMLButtonElement} */ (document.getElementById("btn-prev"));
const btnNext = /** @type {HTMLButtonElement} */ (document.getElementById("btn-next"));
const btnRestart = /** @type {HTMLButtonElement} */ (document.getElementById("btn-restart-chapter"));
const speedInput = /** @type {HTMLInputElement} */ (document.getElementById("speed"));
const speedValue = /** @type {HTMLElement} */ (document.getElementById("speed-value"));
const btnSpeedDown = /** @type {HTMLButtonElement} */ (document.getElementById("btn-speed-down"));
const btnSpeedUp = /** @type {HTMLButtonElement} */ (document.getElementById("btn-speed-up"));
const controlBar = document.getElementById("control-bar");
const appRoot = document.getElementById("app");

function syncControlBarHeight() {
  if (!controlBar || !appRoot) return;
  const h = Math.ceil(controlBar.getBoundingClientRect().height);
  appRoot.style.setProperty("--control-bar-h", `${h}px`);
}

syncControlBarHeight();
if (controlBar && typeof ResizeObserver !== "undefined") {
  new ResizeObserver(syncControlBarHeight).observe(controlBar);
}
window.addEventListener("resize", syncControlBarHeight);
window.addEventListener("orientationchange", () => {
  requestAnimationFrame(syncControlBarHeight);
});
if (document.fonts?.ready) {
  document.fonts.ready.then(() => requestAnimationFrame(syncControlBarHeight));
}

/** @type {number} */
let wordIndex = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let timer = null;
/** @type {boolean} */
let startedOnce = false;
/** @type {boolean} */
let playing = false;

/** @type {{ words: import("./prompter.js").WordRef[], segments: import("./prompter.js").Segment[] } | null} */
let prompterCache = null;

function rebuildCache() {
  const words = preparePrompterDom(article);
  const segments = buildSegments(words, article);
  prompterCache = { words, segments };
  return prompterCache;
}

function ensureCache() {
  if (!prompterCache) return rebuildCache();
  return prompterCache;
}

function getHeadings() {
  return Array.from(article.querySelectorAll("h1, h2, h3, h4, h5, h6"));
}

function onOutlineHeadingClick(h) {
  h.scrollIntoView({ behavior: "smooth", block: "start" });
  const headings = getHeadings();
  const end = nextSectionHeading(headings, h);
  const { words } = ensureCache();
  pause();
  startedOnce = true;
  wordIndex = firstWordIndexInSection(words, h, end);
  renderPhraseAt(wordIndex);
}

function buildOutline() {
  const headings = getHeadings();
  const tree = buildOutlineTree(headings);
  loadExpandedState(tree);
  [outlineEl, outlineMobile].forEach((nav) => {
    renderOutlineNav(nav, tree, onOutlineHeadingClick);
  });
}

function anchorWordIndexFromViewport() {
  const headings = getHeadings();
  if (!headings.length) {
    wordIndex = 0;
    return;
  }
  const rects = headings.map((h) => h.getBoundingClientRect());
  const idx = pickActiveHeadingIndex(rects, window.innerHeight);
  const h = headings[idx];
  const end = nextSectionHeading(headings, h);
  const { words } = ensureCache();
  wordIndex = firstWordIndexInSection(words, h, end);
}

function setPlaying(next) {
  playing = next;
  btnPlay.disabled = next;
  btnPause.disabled = !next;
}

function renderPhraseAt(index) {
  const { words, segments } = ensureCache();
  if (index >= words.length) return;
  resetHighlightClasses(words);
  const seg = segmentContaining(index, segments);
  const phraseEnd = phraseEndExclusive(index, seg);
  applySentenceBackgroundByClass(words, seg);
  const el = applyPhraseHighlightByClass(words, index, phraseEnd);
  scrollHighlightIntoView(el);
}

function tick() {
  const { words, segments } = ensureCache();
  if (wordIndex >= words.length) {
    pause();
    return;
  }
  renderPhraseAt(wordIndex);
  const seg = segmentContaining(wordIndex, segments);
  wordIndex = phraseEndExclusive(wordIndex, seg);
}

function play() {
  if (playing) return;
  if (!startedOnce) {
    anchorWordIndexFromViewport();
    startedOnce = true;
  }
  setPlaying(true);
  tick();
  const ms = Number(speedInput.value) || 600;
  timer = setInterval(tick, ms);
}

function pause() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  setPlaying(false);
}

function restartChapter() {
  anchorWordIndexFromViewport();
  renderPhraseAt(wordIndex);
}

function nextPhrase() {
  const { words, segments } = ensureCache();
  if (!words.length) return;
  const wasPlaying = playing;
  pause();
  if (wordIndex >= words.length) {
    wordIndex = Math.max(0, words.length - 1);
  }
  const next = nextSentenceStart(wordIndex, segments);
  if (next < words.length) {
    wordIndex = next;
    renderPhraseAt(wordIndex);
  }
  if (wasPlaying) play();
}

function prevPhrase() {
  const { words, segments } = ensureCache();
  if (!words.length) return;
  const wasPlaying = playing;
  pause();
  wordIndex = previousSentenceStart(wordIndex, segments);
  renderPhraseAt(wordIndex);
  if (wasPlaying) play();
}

function loadMarkdown(text) {
  pause();
  startedOnce = false;
  article.innerHTML = renderMarkdownToHtml(text);
  ensureHeadingIds(article);
  buildOutline();
  wordIndex = 0;
  clearHighlights(article);
  prompterCache = null;
  rebuildCache();
}

function onFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const t = typeof reader.result === "string" ? reader.result : "";
    loadMarkdown(t);
  };
  reader.readAsText(file);
}

function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) onFile(f);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add("ring-2", "ring-emerald-500/50");
  });
});
["dragleave", "drop"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove("ring-2", "ring-emerald-500/50");
  });
});
dropZone.addEventListener("drop", (e) => {
  const dt = e.dataTransfer;
  const f = dt?.files?.[0];
  if (f && /\.(md|txt)$/i.test(f.name)) onFile(f);
});

btnPlay.addEventListener("click", () => play());
btnPause.addEventListener("click", () => pause());
btnPrev.addEventListener("click", () => prevPhrase());
btnNext.addEventListener("click", () => nextPhrase());
btnRestart.addEventListener("click", () => {
  const wasPlaying = playing;
  pause();
  restartChapter();
  if (wasPlaying) play();
});

function handleRestartChapter() {
  const wasPlaying = playing;
  pause();
  restartChapter();
  if (wasPlaying) play();
}

document.addEventListener("keydown", (e) => {
  if (isEditableTarget(document.activeElement)) return;
  switch (e.key) {
    case " ":
      e.preventDefault();
      if (playing) pause();
      else play();
      break;
    case "PageDown":
      e.preventDefault();
      nextPhrase();
      break;
    case "PageUp":
      e.preventDefault();
      prevPhrase();
      break;
    case "Delete":
      e.preventDefault();
      handleRestartChapter();
      break;
    case "-":
    case "_":
      e.preventDefault();
      applySpeed(Number(speedInput.value) + speedStep());
      break;
    case "+":
    case "=":
      e.preventDefault();
      applySpeed(Number(speedInput.value) - speedStep());
      break;
    default:
      break;
  }
});

function speedMin() {
  return Number(speedInput.min) || 200;
}

function speedMax() {
  return Number(speedInput.max) || 2000;
}

function speedStep() {
  return Number(speedInput.step) || 50;
}

function clampSpeed(n) {
  const lo = speedMin();
  const hi = speedMax();
  const step = speedStep();
  const snapped = Math.round((n - lo) / step) * step + lo;
  return Math.min(hi, Math.max(lo, snapped));
}

function syncSpeedStepButtons() {
  const v = Number(speedInput.value);
  btnSpeedDown.disabled = !Number.isFinite(v) || v <= speedMin();
  btnSpeedUp.disabled = !Number.isFinite(v) || v >= speedMax();
}

/**
 * @param {number} next
 */
function applySpeed(next) {
  const v = clampSpeed(next);
  speedInput.value = String(v);
  speedValue.textContent = String(v);
  localStorage.setItem(STORAGE_KEY, String(v));
  syncSpeedStepButtons();
  if (playing) {
    pause();
    play();
  }
}

const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
if (saved) {
  const n = Number(saved);
  if (Number.isFinite(n) && n >= speedMin() && n <= speedMax()) {
    const v = clampSpeed(n);
    speedInput.value = String(v);
    localStorage.setItem(STORAGE_KEY, String(v));
  }
}
speedValue.textContent = speedInput.value;
syncSpeedStepButtons();

speedInput.addEventListener("input", () => {
  applySpeed(Number(speedInput.value));
});

btnSpeedDown.addEventListener("click", () => {
  applySpeed(Number(speedInput.value) - speedStep());
});

btnSpeedUp.addEventListener("click", () => {
  applySpeed(Number(speedInput.value) + speedStep());
});

rebuildCache();

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
/** @typedef {{ element: HTMLSpanElement }} WordRef */
/** @typedef {{ start: number, end: number }} Segment */

const BLOCK_TAGS = new Set([
  "P",
  "BLOCKQUOTE",
  "TD",
  "TH",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "DD",
  "DT",
  "FIGCAPTION",
  "CAPTION",
  "SUMMARY",
]);

/**
 * @param {Node} node
 * @param {ParentNode} stopAt
 * @returns {Element}
 */
export function findBlockRoot(node, stopAt) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el && el !== stopAt) {
    if (el.tagName === "LI") return el;
    el = el.parentElement;
  }
  el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el && el !== stopAt) {
    if (el.tagName && BLOCK_TAGS.has(el.tagName)) return el;
    el = el.parentElement;
  }
  return /** @type {Element} */ (stopAt);
}

/**
 * @param {Node} node
 */
function textWalkerFilter(node) {
  const el = node.parentElement;
  if (!el) return NodeFilter.FILTER_REJECT;
  if (el.closest("pre, code, script, style")) return NodeFilter.FILTER_REJECT;
  if (el.closest(".katex, .katex-display, .katex-html")) return NodeFilter.FILTER_REJECT;
  if (el.classList.contains("prompter-word")) return NodeFilter.FILTER_REJECT;
  return NodeFilter.FILTER_ACCEPT;
}

/**
 * @param {ParentNode} blockRoot
 * @returns {string}
 */
export function getBlockFullText(blockRoot) {
  const parts = [];
  const collect = (/** @type {Node} */ node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent?.classList.contains("prompter-word")) return;
      if (parent && !textWalkerFilter(node)) return;
      parts.push(node.nodeValue ?? "");
      return;
    }
    if (node instanceof Element && node.classList.contains("prompter-word")) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node instanceof Element && node.closest("pre, code, script, style, .katex, .katex-display, .katex-html")) {
      return;
    }
    for (const child of node.childNodes) collect(child);
  };
  for (const child of blockRoot.childNodes) collect(child);
  return parts.join("");
}

/**
 * @param {string} text
 * @param {string} [locale="en"]
 * @returns {Array<{ start: number, end: number }>}
 */
export function sentenceRangesForText(text, locale = "en") {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
      const ranges = [];
      for (const seg of segmenter.segment(text)) {
        ranges.push({ start: seg.index, end: seg.index + seg.segment.length });
      }
      if (ranges.length) return ranges;
    } catch {
      /* fall through */
    }
  }
  return sentenceRangesRegex(text);
}

/**
 * Fallback sentence boundaries; imperfect on abbreviations (e.g. "e.g.").
 * @param {string} text
 */
export function sentenceRangesRegex(text) {
  if (!text.length) return [];
  const ranges = [];
  let start = 0;
  const re = /[.!?](?:["'")\]]*)\s+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    ranges.push({ start, end });
    start = end;
  }
  if (start < text.length) ranges.push({ start, end: text.length });
  return ranges;
}

/**
 * @param {ParentNode} blockRoot
 * @param {WordRef} word
 */
export function charOffsetOfWordInBlock(blockRoot, word) {
  const parts = [];
  const collect = (/** @type {Node} */ node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (parent?.classList.contains("prompter-word")) return;
      parts.push({ type: "text", value: node.nodeValue ?? "", node });
      return;
    }
    if (node instanceof Element && node.classList.contains("prompter-word")) {
      parts.push({ type: "word", element: node, value: node.textContent ?? "" });
      return;
    }
    for (const child of node.childNodes) collect(child);
  };
  for (const child of blockRoot.childNodes) collect(child);

  let sum = 0;
  for (const part of parts) {
    if (part.type === "word") {
      if (part.element === word.element) return sum;
      sum += part.value.length;
    } else {
      sum += part.value.length;
    }
  }
  return sum;
}

/**
 * @param {WordRef[]} words
 * @param {ParentNode} root
 * @returns {Segment[]}
 */
export function buildSegments(words, root) {
  if (!words.length) return [];
  /** @type {Segment[]} */
  const segments = [];
  let i = 0;
  while (i < words.length) {
    const block = findBlockRoot(words[i].element, root);
    let j = i + 1;
    while (j < words.length && findBlockRoot(words[j].element, root) === block) j++;

    const blockText = getBlockFullText(block);
    let sentRanges = sentenceRangesForText(blockText);
    if (!sentRanges.length) {
      segments.push({ start: i, end: j });
      i = j;
      continue;
    }

    /**
     * @param {number} wi
     */
    const sentenceIndexForWord = (wi) => {
      const cs = charOffsetOfWordInBlock(block, words[wi]);
      for (let s = 0; s < sentRanges.length; s++) {
        const r = sentRanges[s];
        if (cs >= r.start && cs < r.end) return s;
      }
      return sentRanges.length - 1;
    };

    let k = i;
    while (k < j) {
      const sid = sentenceIndexForWord(k);
      const segStart = k;
      k++;
      while (k < j && sentenceIndexForWord(k) === sid) k++;
      segments.push({ start: segStart, end: k });
    }
    i = j;
  }
  return segments;
}

/**
 * @param {number} wordIndex
 * @param {Segment[]} segments
 */
export function segmentContaining(wordIndex, segments) {
  for (const seg of segments) {
    if (wordIndex >= seg.start && wordIndex < seg.end) return seg;
  }
  const last = segments[segments.length - 1];
  return last ?? { start: 0, end: 0 };
}

/**
 * @param {number} wordIndex
 * @param {Segment} seg
 */
export function phraseEndExclusive(wordIndex, seg) {
  return Math.min(wordIndex + 3, seg.end);
}

/**
 * @param {number} wordIndex
 * @param {Segment[]} segments
 * @returns {number}
 */
export function segmentIndexContaining(wordIndex, segments) {
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (wordIndex >= seg.start && wordIndex < seg.end) return i;
  }
  return Math.max(0, segments.length - 1);
}

/**
 * Index of the first word in the next sentence segment, or past-the-end index at document end.
 * @param {number} wordIndex
 * @param {Segment[]} segments
 * @returns {number}
 */
export function nextSentenceStart(wordIndex, segments) {
  if (!segments.length) return 0;
  const i = segmentIndexContaining(wordIndex, segments);
  if (i + 1 < segments.length) return segments[i + 1].start;
  return segments[i].end;
}

/**
 * Index of the first word in the previous sentence segment, or 0 at document start.
 * @param {number} wordIndex
 * @param {Segment[]} segments
 * @returns {number}
 */
export function previousSentenceStart(wordIndex, segments) {
  if (!segments.length || wordIndex <= 0) return 0;
  const i = segmentIndexContaining(wordIndex, segments);
  if (i > 0) return segments[i - 1].start;
  return 0;
}

/**
 * @param {number} wordIndex
 * @param {Segment[]} segments
 * @returns {number}
 */
export function previousPhraseStart(wordIndex, segments) {
  if (wordIndex <= 0) return 0;
  const seg = segmentContaining(Math.max(0, wordIndex - 1), segments);
  let start = seg.start;
  let prev = seg.start;
  while (start < wordIndex) {
    const end = phraseEndExclusive(start, seg);
    if (end >= wordIndex) {
      if (end === wordIndex) return start;
      return start;
    }
    prev = start;
    start = end;
  }
  return prev;
}

/**
 * @param {ParentNode} root
 * @returns {WordRef[]}
 */
export function preparePrompterDom(root) {
  const existing = root.querySelectorAll(".prompter-word");
  if (existing.length) {
    return Array.from(existing).map((el) => ({
      element: /** @type {HTMLSpanElement} */ (el),
    }));
  }

  /** @type {Text[]} */
  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: textWalkerFilter,
  });
  let n;
  while ((n = walker.nextNode())) {
    const text = n.nodeValue;
    if (!text || !/\S/.test(text)) continue;
    textNodes.push(/** @type {Text} */ (n));
  }

  /** @type {WordRef[]} */
  const words = [];
  for (const node of textNodes) {
    const text = node.nodeValue ?? "";
    const parent = node.parentNode;
    if (!parent) continue;
    const re = /\S+/g;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (cursor < m.index) {
        frag.appendChild(document.createTextNode(text.slice(cursor, m.index)));
      }
      const span = document.createElement("span");
      span.className = "prompter-word";
      span.textContent = text.slice(m.index, m.index + m[0].length);
      words.push({ element: span });
      frag.appendChild(span);
      cursor = m.index + m[0].length;
    }
    if (cursor < text.length) {
      frag.appendChild(document.createTextNode(text.slice(cursor)));
    }
    parent.replaceChild(frag, node);
  }
  return words;
}

/**
 * @param {ParentNode} root
 * @returns {WordRef[]}
 */
export function buildWordIndex(root) {
  return preparePrompterDom(root);
}

/**
 * @param {WordRef[]} words
 */
export function resetHighlightClasses(words) {
  for (const w of words) {
    w.element.classList.remove(
      "prompter-sentence-active",
      "prompter-phrase",
      "prompter-phrase-last",
    );
  }
}

/**
 * @param {WordRef[]} words
 * @param {Segment} seg
 */
export function applySentenceBackgroundByClass(words, seg) {
  for (let i = seg.start; i < seg.end; i++) {
    words[i].element.classList.add("prompter-sentence-active");
  }
}

/**
 * @param {WordRef[]} words
 * @param {number} startIndex
 * @param {number} endExclusive
 * @returns {HTMLElement | null}
 */
export function applyPhraseHighlightByClass(words, startIndex, endExclusive) {
  if (startIndex >= endExclusive) return null;
  /** @type {HTMLElement | null} */
  let scrollEl = null;
  const lastIdx = endExclusive - 1;
  for (let i = startIndex; i < endExclusive; i++) {
    const el = words[i].element;
    el.classList.add("prompter-phrase");
    if (i === lastIdx) {
      el.classList.add("prompter-phrase-last");
      scrollEl = el;
    }
  }
  return scrollEl;
}

/**
 * @param {ParentNode} root
 */
export function clearHighlights(root) {
  root.querySelectorAll(".prompter-word, .prompter-phrase, .prompter-sentence-bg").forEach((span) => {
    const text = document.createTextNode(span.textContent ?? "");
    span.parentNode?.replaceChild(text, span);
  });
  root.normalize();
}

/**
 * @param {WordRef[]} words
 * @param {Segment} seg
 */
export function applySentenceBackground(words, seg) {
  applySentenceBackgroundByClass(words, seg);
}

/**
 * @param {WordRef[]} words
 * @param {number} startIndex
 * @param {number} endExclusive
 * @returns {HTMLElement | null} element to scroll (last phrase word)
 */
export function applyPhraseHighlight(words, startIndex, endExclusive) {
  return applyPhraseHighlightByClass(words, startIndex, endExclusive);
}

/**
 * @param {HTMLElement | null} el
 */
export function scrollHighlightIntoView(el) {
  if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Heading level 1–6 from tag name.
 * @param {Element} h
 */
export function headingLevel(h) {
  const t = h.tagName;
  if (t.length !== 2 || t[0] !== "H") return 6;
  const n = parseInt(t[1], 10);
  return Number.isFinite(n) ? n : 6;
}

/**
 * Next section boundary: first heading after `heading` with level <= current.
 * @param {Element[]} headings
 * @param {Element} heading
 * @returns {Element | null}
 */
export function nextSectionHeading(headings, heading) {
  const idx = headings.indexOf(heading);
  if (idx < 0) return null;
  const lv = headingLevel(heading);
  for (let j = idx + 1; j < headings.length; j++) {
    if (headingLevel(headings[j]) <= lv) return headings[j];
  }
  return null;
}

/**
 * @param {DOMRectReadOnly[]} rects
 * @param {number} viewportHeight
 * @returns {number} index into headings
 */
export function pickActiveHeadingIndex(rects, viewportHeight) {
  if (!rects.length) return 0;
  let primary = -1;
  let minTop = Infinity;
  for (let i = 0; i < rects.length; i++) {
    const t = rects[i].top;
    if (t >= 0 && t < viewportHeight && t < minTop) {
      minTop = t;
      primary = i;
    }
  }
  if (primary >= 0) return primary;
  let fallback = -1;
  for (let i = 0; i < rects.length; i++) {
    if (rects[i].top < 0) fallback = i;
  }
  if (fallback >= 0) return fallback;
  return 0;
}

/**
 * @param {WordRef[]} words
 * @param {Element} heading
 * @param {Element | null} endHeading
 * @returns {number}
 */
export function firstWordIndexInSection(words, heading, endHeading) {
  for (let i = 0; i < words.length; i++) {
    const node = words[i].element;
    if (!nodeIsInOpenSection(node, heading, endHeading)) continue;
    return i;
  }
  return 0;
}

/**
 * @param {Node} node
 * @param {Element} heading
 * @param {Element | null} endHeading
 */
export function nodeIsInOpenSection(node, heading, endHeading) {
  const ph = heading.compareDocumentPosition(node);
  const afterHeading =
    (ph & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ||
    (ph & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0;
  if (!afterHeading) return false;
  if (!endHeading) return true;
  if (endHeading.contains(node)) return false;
  const pe = endHeading.compareDocumentPosition(node);
  return (pe & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

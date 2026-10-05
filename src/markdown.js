// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
import DOMPurify from "dompurify";
import katex from "katex";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";

import "katex/dist/katex.min.css";

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(texmath, {
  engine: (tex, displayMode) =>
    katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    }),
  delimiters: "dollars",
});

/** Allow KaTeX output and common markdown elements through DOMPurify. */
const PURIFY = {
  ADD_TAGS: [
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mn",
    "mo",
    "ms",
    "mspace",
    "mtext",
    "mfrac",
    "msqrt",
    "mroot",
    "mstyle",
    "merror",
    "mpadded",
    "mphantom",
    "mtable",
    "mtr",
    "mtd",
    "mlabeledtr",
    "menclose",
    "munder",
    "mover",
    "munderover",
    "mmultiscripts",
    "mprescripts",
    "none",
  ],
  ADD_ATTR: ["xmlns", "display", "stretchy", "accent", "accentunder"],
};

/**
 * @param {string} source
 * @returns {string}
 */
export function renderMarkdownToHtml(source) {
  const raw = md.render(source);
  return DOMPurify.sanitize(raw, PURIFY);
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "section";
}

/**
 * Assign stable ids to h1–h6 under root; dedupe with numeric suffixes.
 * @param {ParentNode} root
 */
export function ensureHeadingIds(root) {
  const used = new Set();
  const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
  headings.forEach((el) => {
    if (el.id) {
      used.add(el.id);
      return;
    }
    let base = slugify(el.textContent || "heading");
    let id = base;
    let n = 1;
    while (used.has(id)) {
      id = `${base}-${n++}`;
    }
    used.add(id);
    el.id = id;
  });
}

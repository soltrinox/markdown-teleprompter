// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
import { describe, expect, it } from "vitest";
import {
  applyPhraseHighlightByClass,
  applySentenceBackgroundByClass,
  buildSegments,
  buildWordIndex,
  clearHighlights,
  firstWordIndexInSection,
  headingLevel,
  nextSectionHeading,
  nodeIsInOpenSection,
  nextSentenceStart,
  phraseEndExclusive,
  pickActiveHeadingIndex,
  preparePrompterDom,
  previousPhraseStart,
  previousSentenceStart,
  resetHighlightClasses,
  segmentContaining,
} from "./prompter.js";

describe("pickActiveHeadingIndex", () => {
  it("picks highest heading in viewport band", () => {
    const rects = [
      { top: -200, bottom: -100 },
      { top: 40, bottom: 80 },
      { top: 120, bottom: 160 },
    ];
    expect(pickActiveHeadingIndex(rects, 800)).toBe(1);
  });

  it("falls back to last heading above fold", () => {
    const rects = [
      { top: -300, bottom: -200 },
      { top: -120, bottom: -80 },
      { top: -50, bottom: -10 },
    ];
    expect(pickActiveHeadingIndex(rects, 800)).toBe(2);
  });

  it("defaults to first when empty band and none above", () => {
    const rects = [{ top: 400, bottom: 440 }];
    expect(pickActiveHeadingIndex(rects, 800)).toBe(0);
  });
});

describe("section boundaries", () => {
  it("finds next section at same or higher level", () => {
    document.body.innerHTML = `
      <article id="a">
        <h1 id="x">A</h1>
        <p>t</p>
        <h2 id="y">B</h2>
        <p>u</p>
        <h2 id="z">C</h2>
      </article>
    `;
    const article = document.getElementById("a");
    const headings = Array.from(article.querySelectorAll("h1,h2"));
    expect(headingLevel(headings[0])).toBe(1);
    expect(nextSectionHeading(headings, headings[1])?.id).toBe("z");
  });

  it("places first word in section after nested lower heading", () => {
    document.body.innerHTML = `
      <article id="a">
        <h2 id="h2a">Sec</h2>
        <p>alpha beta</p>
        <h3 id="h3">Sub</h3>
        <p>gamma delta</p>
        <h2 id="h2b">Next</h2>
        <p>epsilon</p>
      </article>
    `;
    const article = document.getElementById("a");
    const h2a = document.getElementById("h2a");
    const h2b = document.getElementById("h2b");
    const words = preparePrompterDom(article);
    const i = firstWordIndexInSection(words, h2a, h2b);
    expect(words[i].element.textContent).toBe("Sec");
  });
});

describe("nodeIsInOpenSection", () => {
  it("excludes content after next heading", () => {
    document.body.innerHTML = `
      <article id="a">
        <h2 id="h1">A</h2>
        <p id="p1">in</p>
        <h2 id="h2">B</h2>
        <p id="p2">out</p>
      </article>
    `;
    const h1 = document.getElementById("h1");
    const h2 = document.getElementById("h2");
    const p1 = document.getElementById("p1").firstChild;
    const p2 = document.getElementById("p2").firstChild;
    expect(nodeIsInOpenSection(p1, h1, h2)).toBe(true);
    expect(nodeIsInOpenSection(p2, h1, h2)).toBe(false);
  });
});

describe("preparePrompterDom", () => {
  it("wraps each word in stable prompter-word spans", () => {
    document.body.innerHTML = `<article id="a"><p>one two three</p></article>`;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    expect(words).toHaveLength(3);
    expect(words.every((w) => w.element.classList.contains("prompter-word"))).toBe(true);
    expect(words.map((w) => w.element.textContent)).toEqual(["one", "two", "three"]);
    expect(article.querySelectorAll(".prompter-word")).toHaveLength(3);
  });

  it("returns existing spans without double-wrapping", () => {
    document.body.innerHTML = `<article id="a"><p>alpha beta</p></article>`;
    const article = document.getElementById("a");
    const first = preparePrompterDom(article);
    const second = preparePrompterDom(article);
    expect(second).toHaveLength(first.length);
    expect(article.querySelectorAll(".prompter-word")).toHaveLength(2);
  });
});

describe("sentence navigation", () => {
  const segments = [
    { start: 0, end: 5 },
    { start: 5, end: 10 },
    { start: 10, end: 12 },
  ];

  it("nextSentenceStart jumps to next segment start", () => {
    expect(nextSentenceStart(0, segments)).toBe(5);
    expect(nextSentenceStart(3, segments)).toBe(5);
    expect(nextSentenceStart(5, segments)).toBe(10);
    expect(nextSentenceStart(9, segments)).toBe(10);
  });

  it("nextSentenceStart returns past-end index on last segment", () => {
    expect(nextSentenceStart(10, segments)).toBe(12);
    expect(nextSentenceStart(11, segments)).toBe(12);
  });

  it("previousSentenceStart jumps to previous segment start", () => {
    expect(previousSentenceStart(0, segments)).toBe(0);
    expect(previousSentenceStart(3, segments)).toBe(0);
    expect(previousSentenceStart(5, segments)).toBe(0);
    expect(previousSentenceStart(7, segments)).toBe(0);
    expect(previousSentenceStart(10, segments)).toBe(5);
    expect(previousSentenceStart(11, segments)).toBe(5);
  });

  it("previousSentenceStart clamps to 0 at document start", () => {
    expect(previousSentenceStart(0, segments)).toBe(0);
    expect(previousSentenceStart(1, [{ start: 0, end: 4 }])).toBe(0);
  });

  it("handles empty segments", () => {
    expect(nextSentenceStart(0, [])).toBe(0);
    expect(previousSentenceStart(3, [])).toBe(0);
  });
});

describe("previousPhraseStart", () => {
  it("returns 0 at document start", () => {
    const segments = [{ start: 0, end: 10 }];
    expect(previousPhraseStart(0, segments)).toBe(0);
  });

  it("steps back one phrase within a segment", () => {
    const segments = [{ start: 0, end: 10 }];
    expect(previousPhraseStart(6, segments)).toBe(3);
    expect(previousPhraseStart(3, segments)).toBe(0);
  });

  it("respects segment boundaries", () => {
    const segments = [
      { start: 0, end: 2 },
      { start: 2, end: 8 },
    ];
    expect(previousPhraseStart(4, segments)).toBe(2);
  });
});

describe("class-based highlights", () => {
  it("resetHighlightClasses clears active classes", () => {
    document.body.innerHTML = `<article id="a"><p>one two three</p></article>`;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    applySentenceBackgroundByClass(words, { start: 0, end: 3 });
    applyPhraseHighlightByClass(words, 0, 2);
    resetHighlightClasses(words);
    for (const w of words) {
      expect(w.element.classList.contains("prompter-sentence-active")).toBe(false);
      expect(w.element.classList.contains("prompter-phrase")).toBe(false);
      expect(w.element.classList.contains("prompter-phrase-last")).toBe(false);
    }
  });

  it("applySentenceBackgroundByClass marks sentence words", () => {
    document.body.innerHTML = `<article id="a"><p>aa bb cc.</p></article>`;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    const segments = buildSegments(words, article);
    applySentenceBackgroundByClass(words, segments[0]);
    const active = words.filter((w) => w.element.classList.contains("prompter-sentence-active"));
    expect(active.length).toBe(segments[0].end - segments[0].start);
  });

  it("applyPhraseHighlightByClass marks phrase and last word", () => {
    document.body.innerHTML = `<article id="a"><p>one two three four</p></article>`;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    const el = applyPhraseHighlightByClass(words, 1, 4);
    expect(words[1].element.classList.contains("prompter-phrase")).toBe(true);
    expect(words[2].element.classList.contains("prompter-phrase")).toBe(true);
    expect(words[3].element.classList.contains("prompter-phrase-last")).toBe(true);
    expect(el).toBe(words[3].element);
  });
});

describe("segments and phrases", () => {
  it("splits two sentences in one paragraph into two segments", () => {
    document.body.innerHTML = `
      <article id="a">
        <p>First sentence here. Second sentence follows.</p>
      </article>
    `;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    const segments = buildSegments(words, article);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const firstSegTokens = words
      .slice(segments[0].start, segments[0].end)
      .map((w) => w.element.textContent);
    expect(firstSegTokens.some((t) => /first/i.test(t ?? ""))).toBe(true);
    const secondStart = words[segments[1].start].element.textContent;
    expect(secondStart?.toLowerCase()).toContain("second");
  });

  it("starts a new segment for each list item", () => {
    document.body.innerHTML = `
      <article id="a">
        <ul>
          <li>alpha beta</li>
          <li>gamma</li>
        </ul>
      </article>
    `;
    const article = document.getElementById("a");
    const words = preparePrompterDom(article);
    const segments = buildSegments(words, article);
    expect(segments.length).toBe(2);
    expect(segments[0]).toEqual({ start: 0, end: 2 });
    expect(segments[1]).toEqual({ start: 2, end: 3 });
  });

  it("clips phrase end at segment boundary", () => {
    const segments = [{ start: 0, end: 5 }];
    const seg = segmentContaining(3, segments);
    expect(seg).toEqual({ start: 0, end: 5 });
    expect(phraseEndExclusive(3, seg)).toBe(5);
  });

  it("single-word segment uses one-word phrase end", () => {
    const segments = [{ start: 0, end: 1 }];
    expect(phraseEndExclusive(0, segments[0])).toBe(1);
  });

  it("class highlights then clear keeps same word count", () => {
    document.body.innerHTML = `<article id="a"><p>one two three four</p></article>`;
    const article = document.getElementById("a");
    let words = preparePrompterDom(article);
    const n0 = words.length;
    applyPhraseHighlightByClass(words, 1, 4);
    words = buildWordIndex(article);
    expect(words.length).toBe(n0);
    clearHighlights(article);
    const plain = article.textContent?.replace(/\s+/g, " ").trim();
    expect(plain).toBe("one two three four");
  });
});

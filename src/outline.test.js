// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
import { describe, expect, it } from "vitest";
import {
  buildOutlineTree,
  loadExpandedState,
  outlineHeadingLevel,
  outlineTreeSignature,
  renderOutlineNav,
  setBranchExpanded,
} from "./outline.js";

function makeHeading(tag, id, text) {
  const el = document.createElement(tag);
  el.id = id;
  el.textContent = text;
  return el;
}

describe("outlineHeadingLevel", () => {
  it("reads level from tag name", () => {
    expect(outlineHeadingLevel(makeHeading("h2", "a", "A"))).toBe(2);
    expect(outlineHeadingLevel(makeHeading("h6", "b", "B"))).toBe(6);
  });
});

describe("buildOutlineTree", () => {
  it("nests headings by level", () => {
    const headings = [
      makeHeading("h1", "intro", "Intro"),
      makeHeading("h2", "sec-a", "Section A"),
      makeHeading("h3", "sub-a1", "Sub A1"),
      makeHeading("h2", "sec-b", "Section B"),
    ];

    const tree = buildOutlineTree(headings);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("intro");
    expect(tree[0].children.map((n) => n.id)).toEqual(["sec-a", "sec-b"]);
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual(["sub-a1"]);
  });

  it("starts new roots after higher-level heading closes branch", () => {
    const headings = [
      makeHeading("h2", "a", "A"),
      makeHeading("h1", "b", "B"),
    ];
    const tree = buildOutlineTree(headings);
    expect(tree.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("returns empty tree for no headings", () => {
    expect(buildOutlineTree([])).toEqual([]);
  });
});

describe("outlineTreeSignature", () => {
  it("orders ids depth-first", () => {
    const headings = [
      makeHeading("h1", "h1", "One"),
      makeHeading("h2", "h2", "Two"),
      makeHeading("h2", "h3", "Three"),
    ];
    const tree = buildOutlineTree(headings);
    expect(outlineTreeSignature(tree)).toBe("h1\0h2\0h3");
  });
});

describe("setBranchExpanded", () => {
  it("sets aria-expanded and hides child list when collapsed", () => {
    const toggle = document.createElement("button");
    toggle.className = "outline-toggle";
    const childList = document.createElement("ul");

    setBranchExpanded(true, toggle, childList);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.classList.contains("outline-toggle-expanded")).toBe(true);
    expect(childList.hidden).toBe(false);

    setBranchExpanded(false, toggle, childList);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.classList.contains("outline-toggle-expanded")).toBe(false);
    expect(childList.hidden).toBe(true);
  });
});

describe("renderOutlineNav", () => {
  it("toggles subsection visibility when chevron is clicked", () => {
    const headings = [
      makeHeading("h1", "intro", "Intro"),
      makeHeading("h2", "sec-a", "Section A"),
    ];
    const tree = buildOutlineTree(headings);
    loadExpandedState(tree);
    const nav = document.createElement("nav");
    renderOutlineNav(nav, tree, () => {});

    const toggle = nav.querySelector(".outline-toggle");
    const childList = nav.querySelector(".outline-children");
    expect(toggle).not.toBeNull();
    expect(childList).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(childList?.hidden).toBe(false);

    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.classList.contains("outline-toggle-expanded")).toBe(false);
    expect(childList?.hidden).toBe(true);

    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(childList?.hidden).toBe(false);
  });

  it("invokes onHeadingClick for link clicks but not chevron clicks", () => {
    const headings = [
      makeHeading("h1", "intro", "Intro"),
      makeHeading("h2", "sec-a", "Section A"),
    ];
    const tree = buildOutlineTree(headings);
    loadExpandedState(tree);
    const nav = document.createElement("nav");
    /** @type {HTMLElement | null} */
    let clicked = null;
    renderOutlineNav(nav, tree, (h) => {
      clicked = h;
    });

    const toggle = nav.querySelector(".outline-toggle");
    const links = nav.querySelectorAll(".outline-link");
    expect(toggle).not.toBeNull();
    expect(links.length).toBeGreaterThan(1);

    toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBeNull();

    links[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBe(headings[1]);
  });
});

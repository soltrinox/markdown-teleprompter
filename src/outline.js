// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 soltrinox and contributors
/** @typedef {{ id: string, level: number, text: string, heading: HTMLElement, children: OutlineNode[] }} OutlineNode */

const EXPANDED_STORAGE_KEY = "markdown-teleprompter-outline-expanded";

/** @type {Set<string>} */
let expandedIds = new Set();

/** @type {OutlineNode[] | null} */
let currentOutlineTree = null;

/**
 * @param {HTMLElement} h
 * @returns {number}
 */
export function outlineHeadingLevel(h) {
  return parseInt(h.tagName[1], 10);
}

/**
 * @param {HTMLElement[]} headings
 * @returns {OutlineNode[]}
 */
export function buildOutlineTree(headings) {
  /** @type {OutlineNode[]} */
  const roots = [];
  /** @type {OutlineNode[]} */
  const stack = [];

  for (const h of headings) {
    const level = outlineHeadingLevel(h);
    const node = {
      id: h.id,
      level,
      text: h.textContent?.trim() ?? "",
      heading: h,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}

/**
 * @param {OutlineNode[]} tree
 * @returns {string}
 */
export function outlineTreeSignature(tree) {
  const ids = [];
  const walk = (/** @type {OutlineNode[]} */ nodes) => {
    for (const n of nodes) {
      ids.push(n.id);
      walk(n.children);
    }
  };
  walk(tree);
  return ids.join("\0");
}

/**
 * @param {OutlineNode[]} tree
 */
export function loadExpandedState(tree) {
  expandedIds = new Set();
  const sig = outlineTreeSignature(tree);
  if (!sig) return;

  let loaded = false;
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const saved = data?.[sig];
      if (Array.isArray(saved)) {
        expandedIds = new Set(saved.filter((id) => typeof id === "string"));
        loaded = true;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }

  if (!loaded) {
    const walk = (/** @type {OutlineNode[]} */ nodes) => {
      for (const n of nodes) {
        if (n.children.length > 0) expandedIds.add(n.id);
        walk(n.children);
      }
    };
    walk(tree);
  }
}

/**
 * @param {OutlineNode[]} tree
 */
function persistExpandedState(tree) {
  const sig = outlineTreeSignature(tree);
  if (!sig) return;
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[sig] = [...expandedIds];
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * @param {boolean} expanded
 * @param {HTMLButtonElement} toggle
 * @param {HTMLUListElement | null} childList
 */
export function setBranchExpanded(expanded, toggle, childList) {
  toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  toggle.classList.toggle("outline-toggle-expanded", expanded);
  if (childList) {
    childList.hidden = !expanded;
  }
}

/**
 * @param {OutlineNode} node
 * @param {(heading: HTMLElement) => void} onHeadingClick
 * @returns {HTMLLIElement}
 */
function renderOutlineNode(node, onHeadingClick) {
  const li = document.createElement("li");
  li.className = "outline-item";

  const row = document.createElement("div");
  row.className = "outline-row";

  const hasChildren = node.children.length > 0;
  let childList = null;

  if (hasChildren) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "outline-toggle";
    toggle.setAttribute("aria-label", "Expand or collapse section");
    toggle.innerHTML =
      '<span class="outline-chevron" aria-hidden="true"></span>';

    childList = document.createElement("ul");
    childList.className = "outline-children";
    for (const child of node.children) {
      childList.appendChild(renderOutlineNode(child, onHeadingClick));
    }

    const expanded = expandedIds.has(node.id);
    setBranchExpanded(expanded, toggle, childList);

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = toggle.getAttribute("aria-expanded") !== "true";
      if (next) expandedIds.add(node.id);
      else expandedIds.delete(node.id);
      setBranchExpanded(next, toggle, childList);
      persistExpandedState(currentOutlineTree ?? []);
    });

    row.appendChild(toggle);
  } else {
    const spacer = document.createElement("span");
    spacer.className = "outline-toggle-spacer";
    spacer.setAttribute("aria-hidden", "true");
    row.appendChild(spacer);
  }

  const link = document.createElement("a");
  link.href = `#${node.id}`;
  link.className = "outline-link";
  link.dataset.level = String(node.level);
  link.textContent = node.text;
  link.addEventListener("click", (e) => {
    e.preventDefault();
    onHeadingClick(node.heading);
  });
  row.appendChild(link);

  li.appendChild(row);
  if (childList) li.appendChild(childList);
  return li;
}

/**
 * @param {HTMLElement} nav
 * @param {OutlineNode[]} tree
 * @param {(heading: HTMLElement) => void} onHeadingClick
 */
export function renderOutlineNav(nav, tree, onHeadingClick) {
  currentOutlineTree = tree;
  nav.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "outline-tree";
  for (const node of tree) {
    ul.appendChild(renderOutlineNode(node, onHeadingClick));
  }
  nav.appendChild(ul);
}

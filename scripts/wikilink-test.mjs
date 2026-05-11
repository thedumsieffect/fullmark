/**
 * Quick standalone round-trip test for the Wikilink extension.
 * Verifies that `[[target]]` and `[[target|alias]]` survive markdown → editor → markdown.
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);

const { Editor } = await import("@tiptap/core");
const { StarterKit } = await import("@tiptap/starter-kit");
const { Markdown } = await import("@tiptap/markdown");

// Manually wire the Wikilink Node so we don't depend on Vite/TS compilation.
// Keep it in sync with src/services/editor/extensions/wikilink.ts
const { Node, InputRule, PasteRule, mergeAttributes } = await import(
  "@tiptap/core"
);

const WIKILINK_PATTERN = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/;
const WIKILINK_PATTERN_GLOBAL = new RegExp(WIKILINK_PATTERN.source, "g");
const WIKILINK_INPUT_RULE = new RegExp(`${WIKILINK_PATTERN.source}$`);

function parseMatch(m) {
  const target = (m[1] || "").trim();
  if (!target) return null;
  const alias = (m[2] || "").trim() || null;
  return { target, alias };
}

const Wikilink = Node.create({
  name: "wikilink",
  inline: true,
  group: "inline",
  atom: true,
  addAttributes() {
    return { target: { default: "" }, alias: { default: null } };
  },
  parseHTML() {
    return [{ tag: "span[data-wikilink]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.alias || node.attrs.target;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-wikilink": node.attrs.target,
        class: "wikilink",
      }),
      label,
    ];
  },
  addInputRules() {
    return [
      new InputRule({
        find: WIKILINK_INPUT_RULE,
        handler: ({ state, range, match }) => {
          const a = parseMatch(match);
          if (!a) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create(a));
        },
      }),
    ];
  },
  addPasteRules() {
    return [
      new PasteRule({
        find: WIKILINK_PATTERN_GLOBAL,
        handler: ({ state, range, match }) => {
          const a = parseMatch(match);
          if (!a) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create(a));
        },
      }),
    ];
  },
  markdownTokenName: "wikilink",
  markdownTokenizer: {
    name: "wikilink",
    level: "inline",
    start(src) {
      return src.indexOf("[[");
    },
    tokenize(src) {
      WIKILINK_PATTERN.lastIndex = 0;
      const match = WIKILINK_PATTERN.exec(src);
      if (!match || match.index !== 0) return undefined;
      const a = parseMatch(match);
      if (!a) return undefined;
      return {
        type: "wikilink",
        raw: match[0],
        target: a.target,
        alias: a.alias ?? undefined,
      };
    },
  },
  parseMarkdown(token) {
    return {
      type: "wikilink",
      attrs: { target: token.target, alias: token.alias ?? null },
    };
  },
  renderMarkdown(node) {
    const target = node.attrs?.target ?? "";
    const alias = node.attrs?.alias;
    return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
  },
});

function makeEditor() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit, Markdown, Wikilink],
    content: "",
  });
}

function roundTrip(md) {
  const editor = makeEditor();
  try {
    editor.commands.setContent(md, { contentType: "markdown" });
    return { out: editor.getMarkdown(), json: editor.getJSON() };
  } finally {
    editor.destroy();
  }
}

const cases = [
  {
    name: "simple wikilink",
    input: "See [[kyra-richards]] for context.\n",
  },
  {
    name: "wikilink with alias",
    input: "See [[kyra-richards|Kyra]] for context.\n",
  },
  {
    name: "multiple wikilinks",
    input: "Check [[sahib]] and [[neha|Neha]].\n",
  },
  {
    name: "nested path",
    input: "Reference [[people/anokhi]] here.\n",
  },
  {
    name: "wikilink in list",
    input: "- [[mike]]\n- [[reza-khadjavi|Reza]]\n",
  },
  {
    name: "wikilink with surrounding text",
    input: "Before [[link]] after.\n",
  },
];

// Normalize trailing whitespace — that's a global @tiptap/markdown behavior
// documented in fidelity-gate-results.md and not specific to the wikilink extension.
const trim = (s) => s.replace(/\n+$/, "").trim();

let pass = 0;
let fail = 0;
for (const c of cases) {
  const { out, json } = roundTrip(c.input);
  const ok = trim(out) === trim(c.input);
  const hasNode = JSON.stringify(json).includes('"type":"wikilink"');
  const status = ok ? "✓" : "✗";
  console.log(`${status} ${c.name}${hasNode ? "" : " (no wikilink node parsed)"}`);
  if (!ok) {
    console.log(`   input:  ${JSON.stringify(c.input)}`);
    console.log(`   output: ${JSON.stringify(out)}`);
    fail++;
  } else if (!hasNode) {
    fail++;
  } else {
    pass++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

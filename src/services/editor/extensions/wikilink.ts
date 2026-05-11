/**
 * Wikilink extension — Obsidian-style `[[target]]` and `[[target|alias]]` inline
 * references.
 *
 * Renders as a chip in the editor. Round-trips through markdown via a custom
 * `marked` tokenizer registered through @tiptap/markdown's MarkdownManager.
 *
 * Pipeline:
 *   markdown source → marked tokenizer → token { target, alias }
 *     → parseMarkdown → ProseMirror node { attrs: { target, alias } }
 *     → renderHTML → <span data-wikilink="…" class="wikilink">…</span>
 *     → renderMarkdown → `[[target|alias]]` back out
 *
 * Click behavior + hover preview live in the React node view (added later).
 * For v0.1 the chip is non-interactive — click handler comes with backlinks UI.
 */

import {
  Node,
  mergeAttributes,
  InputRule,
  PasteRule,
  type MarkdownToken,
  type JSONContent,
} from "@tiptap/core";

/**
 * `[[target]]` or `[[target|alias]]`.
 * Target chars: any non-bracket, non-pipe character.
 * Lazy quantifier so we don't span across an early `]]`.
 */
const WIKILINK_PATTERN = /\[\[([^\[\]|]+?)(?:\|([^\[\]]+?))?\]\]/;
const WIKILINK_PATTERN_GLOBAL = new RegExp(WIKILINK_PATTERN.source, "g");
const WIKILINK_INPUT_RULE = new RegExp(`${WIKILINK_PATTERN.source}$`);

type WikilinkAttrs = {
  target: string;
  alias: string | null;
};

type WikilinkToken = MarkdownToken & {
  type: "wikilink";
  raw: string;
  target: string;
  alias?: string;
};

function parseWikilinkMatch(match: RegExpExecArray): WikilinkAttrs | null {
  const target = (match[1] || "").trim();
  if (!target) return null;
  const alias = (match[2] || "").trim() || null;
  return { target, alias };
}

export const Wikilink = Node.create({
  name: "wikilink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      target: { default: "" },
      alias: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-wikilink]",
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return {
            target: e.getAttribute("data-wikilink") || "",
            alias: e.getAttribute("data-wikilink-alias") || null,
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = node.attrs.target as string;
    const alias = node.attrs.alias as string | null;
    const label = alias || target;
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-wikilink": target,
      "data-wikilink-alias": alias || null,
      class: "wikilink",
      title: target,
    });
    return ["span", attrs, label];
  },

  addInputRules() {
    return [
      new InputRule({
        find: WIKILINK_INPUT_RULE,
        handler: ({ state, range, match }) => {
          const attrs = parseWikilinkMatch(match as unknown as RegExpExecArray);
          if (!attrs) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create(attrs));
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: WIKILINK_PATTERN_GLOBAL,
        handler: ({ state, range, match }) => {
          const attrs = parseWikilinkMatch(match as unknown as RegExpExecArray);
          if (!attrs) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create(attrs));
        },
      }),
    ];
  },

  // --- markdown round-trip via @tiptap/markdown ---

  markdownTokenName: "wikilink",

  markdownTokenizer: {
    name: "wikilink",
    level: "inline" as const,
    start(src: string) {
      const idx = src.indexOf("[[");
      return idx < 0 ? -1 : idx;
    },
    tokenize(src: string): MarkdownToken | undefined {
      WIKILINK_PATTERN.lastIndex = 0;
      const match = WIKILINK_PATTERN.exec(src);
      // Only fire when the match starts at the cursor (marked invokes
      // tokenizers as it scans inline text)
      if (!match || match.index !== 0) return undefined;
      const attrs = parseWikilinkMatch(match);
      if (!attrs) return undefined;
      const token: WikilinkToken = {
        type: "wikilink",
        raw: match[0],
        target: attrs.target,
        alias: attrs.alias ?? undefined,
      };
      return token as unknown as MarkdownToken;
    },
  },

  parseMarkdown(token: MarkdownToken) {
    const t = token as WikilinkToken;
    return {
      type: "wikilink",
      attrs: {
        target: t.target,
        alias: t.alias ?? null,
      },
    };
  },

  renderMarkdown(node: JSONContent): string {
    const target = String(node.attrs?.target ?? "");
    const alias = node.attrs?.alias as string | null | undefined;
    return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
  },
});

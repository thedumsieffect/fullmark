/**
 * Syntax-highlighted code blocks via lowlight (highlight.js engine).
 *
 * Beyond the upstream defaults we tweak:
 *   - exit-on-Enter-after-empty-line so the user isn't trapped (triple-Enter
 *     still works too)
 *   - empty-block placeholder so the user knows ↓ also escapes
 */

import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";

import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml"; // covers html/svg
import yaml from "highlight.js/lib/languages/yaml";

const lowlight = createLowlight();

lowlight.register({
  bash,
  sh: shell,
  shell,
  css,
  diff,
  go,
  js: javascript,
  javascript,
  json,
  markdown,
  md: markdown,
  py: python,
  python,
  rs: rust,
  rust,
  sql,
  ts: typescript,
  typescript,
  html: xml,
  xml,
  svg: xml,
  yaml,
  yml: yaml,
});

export { lowlight };

export const CodeHighlight = CodeBlockLowlight.extend({
  // Expose the resolved language on the <pre> as a data attribute so the
  // language chip in CSS can pick it up. (Upstream only writes a `language-*`
  // class onto the <code>, which CSS can't pull text from.)
  renderHTML({ node, HTMLAttributes }) {
    const upstream = this.parent?.({ node, HTMLAttributes });
    if (!Array.isArray(upstream)) return upstream as unknown as any;
    const [tag, attrs, ...children] = upstream as [string, Record<string, unknown>, ...unknown[]];
    const language = node.attrs.language as string | null;
    const next = language
      ? { ...attrs, "data-tiptap-language": language }
      : attrs;
    return [tag, next, ...children] as unknown as any;
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      // Enter at the end of an empty last line → exit the code block.
      // Triple-Enter still works (upstream handles that path).
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== this.name) return false;

        const isAtEnd = $from.parentOffset === $from.parent.content.size;
        if (!isAtEnd) return false;

        const text = $from.parent.textContent;
        const endsEmpty = text.length === 0 || text.endsWith("\n");
        if (!endsEmpty) return false;

        return editor
          .chain()
          .command(({ tr }) => {
            if (text.endsWith("\n")) {
              tr.delete($from.pos - 1, $from.pos);
            }
            return true;
          })
          .exitCode()
          .run();
      },
    };
  },
}).configure({
  lowlight,
  defaultLanguage: null,
  HTMLAttributes: { spellcheck: "false" },
});

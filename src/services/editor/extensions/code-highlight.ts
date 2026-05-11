/**
 * Syntax-highlighted code blocks via lowlight (highlight.js engine).
 *
 * Registers a curated set of common languages — enough for real reading on
 * a brain/ vault without ballooning bundle size. Tokens render as `<span
 * class="hljs-keyword">` etc. — paired with theme CSS in editor.css.
 *
 * Why lowlight, not Shiki: synchronous tokenization (no async TipTap surgery),
 * official tiptap extension, ships in the editor bundle without WASM loading.
 * Shiki upgrade is a v0.2 polish — VS Code-quality theme colors at the cost
 * of an async render path.
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

export const CodeHighlight = CodeBlockLowlight.configure({
  lowlight,
  defaultLanguage: "plaintext",
  HTMLAttributes: { spellcheck: "false" },
});

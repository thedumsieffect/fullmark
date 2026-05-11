/**
 * Fidelity gate — runs markdown round-trip through TipTap + @tiptap/markdown
 * against the user's actual brain/ corpus and reports divergences.
 *
 * Usage:
 *   node scripts/fidelity-gate.mjs [path/to/corpus] [limit]
 *
 * Defaults: /Users/vamsi/Coding/vamsios/brain, limit=25
 *
 * Output:
 *   - Summary: identical / with-diff / errors counts
 *   - Per-file: pass marker, byte deltas, diff line counts
 *   - First N divergences shown as unified diff fragments
 */

import { JSDOM } from "jsdom";
import * as Diff from "diff";
import fs from "node:fs/promises";
import path from "node:path";

// --- DOM polyfill (must run BEFORE importing TipTap) ---
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

// Node 24 makes some globals (navigator) getter-only — copy carefully.
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
// Only override navigator if jsdom's version is missing fields TipTap probes
try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    writable: true,
    configurable: true,
  });
} catch {
  /* Node 24+ has navigator pre-defined; jsdom can fall back to its own */
}

// --- TipTap imports (after polyfill so module init sees globals) ---
const { Editor } = await import("@tiptap/core");
const { StarterKit } = await import("@tiptap/starter-kit");
const { Markdown } = await import("@tiptap/markdown");

const BRAIN = process.argv[2] || "/Users/vamsi/Coding/vamsios/brain";
const LIMIT = Number(process.argv[3]) || 25;
const SHOW_DIFFS = 5;

async function findMdFiles(dir, files = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (["node_modules", "dist", "target"].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await findMdFiles(p, files);
    else if (e.name.endsWith(".md")) files.push(p);
  }
  return files;
}

function makeEditor() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return new Editor({
    element: el,
    extensions: [StarterKit, Markdown],
    content: "",
  });
}

function roundTrip(md) {
  const editor = makeEditor();
  try {
    editor.commands.setContent(md, { contentType: "markdown" });
    return editor.getMarkdown();
  } finally {
    editor.destroy();
  }
}

function getJSON(md) {
  const editor = makeEditor();
  try {
    editor.commands.setContent(md, { contentType: "markdown" });
    return JSON.stringify(editor.getJSON());
  } finally {
    editor.destroy();
  }
}

function summarize(original, output, idempotent, semanticAstMatch) {
  const diff = Diff.diffLines(original, output);
  let added = 0;
  let removed = 0;
  for (const part of diff) {
    if (part.added) added += part.count || 0;
    else if (part.removed) removed += part.count || 0;
  }
  return {
    added,
    removed,
    isIdentical: original === output,
    isSemanticEquivalent: normalize(original) === normalize(output),
    idempotent,
    semanticAstMatch,
  };
}

/**
 * Normalize a markdown string for "semantic equivalence" comparison.
 * - Decode common HTML entities (&amp; > → & > <)
 * - Collapse multiple blank lines into one
 * - Trim trailing whitespace on each line
 * - Strip leading/trailing whitespace on the whole document
 *
 * If two strings are equivalent after normalization, the divergence is
 * cosmetic (rendering-equivalent) and the save layer can safely treat them
 * as "no change" to avoid spurious diffs on disk.
 */
function normalize(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function printUnifiedFragment(original, output, contextLines = 2, maxHunks = 6) {
  const hunks = Diff.structuredPatch(
    "original",
    "round-tripped",
    original,
    output,
    "",
    "",
    { context: contextLines },
  ).hunks;
  for (const h of hunks.slice(0, maxHunks)) {
    console.log(
      `  @@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
    );
    for (const line of h.lines) console.log(`  ${line}`);
  }
  if (hunks.length > maxHunks) {
    console.log(`  ... (${hunks.length - maxHunks} more hunks omitted)`);
  }
}

async function main() {
  const allFiles = await findMdFiles(BRAIN);
  const files = allFiles.slice(0, LIMIT);
  console.log(
    `Corpus: ${BRAIN}\nFound ${allFiles.length} .md files; testing first ${files.length}.\n`,
  );

  const results = [];
  for (const f of files) {
    const md = await fs.readFile(f, "utf-8");
    try {
      const out1 = roundTrip(md);
      const out2 = roundTrip(out1);
      const idempotent = out1 === out2;
      const semanticAstMatch = getJSON(md) === getJSON(out1);
      const s = summarize(md, out1, idempotent, semanticAstMatch);
      results.push({
        file: path.relative(BRAIN, f),
        original: md,
        output: out1,
        ...s,
      });
    } catch (e) {
      results.push({
        file: path.relative(BRAIN, f),
        error: e?.message || String(e),
      });
    }
  }

  // Summary table
  const ok = results.filter((r) => r.isIdentical).length;
  const idempotent = results.filter(
    (r) => !r.error && r.idempotent,
  ).length;
  const astMatch = results.filter(
    (r) => !r.error && r.semanticAstMatch,
  ).length;
  const errors = results.filter((r) => r.error).length;

  console.log(`=== SUMMARY ===`);
  console.log(`Total:                  ${results.length}`);
  console.log(`✓ Byte-identical:       ${ok}`);
  console.log(`↻ Idempotent (2nd save no-op): ${idempotent}`);
  console.log(`≡ Same parsed AST:      ${astMatch} (truly lossless)`);
  console.log(`✗ Errors:               ${errors}`);
  console.log();

  // Per-file outcomes
  for (const r of results) {
    if (r.error) {
      console.log(`✗ ${r.file} — ERROR: ${r.error}`);
    } else if (r.isIdentical) {
      console.log(`✓ ${r.file}`);
    } else {
      const origLines = r.original.split("\n").length;
      const outLines = r.output.split("\n").length;
      const flags = [
        r.idempotent ? "↻idempotent" : "✗not-idempotent",
        r.semanticAstMatch ? "≡ast-match" : "✗ast-mismatch",
      ].join(" ");
      console.log(
        `≠ ${r.file}  lines: ${origLines}→${outLines}  diff: +${r.added} -${r.removed}  [${flags}]`,
      );
    }
  }

  // First N divergences in detail
  const diverged = results.filter((r) => !r.isIdentical && !r.error);
  if (diverged.length > 0) {
    console.log(`\n=== DIVERGENCE DETAILS (first ${SHOW_DIFFS}) ===\n`);
    for (const r of diverged.slice(0, SHOW_DIFFS)) {
      console.log(`--- ${r.file} ---`);
      printUnifiedFragment(r.original, r.output, 2, 6);
      console.log();
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

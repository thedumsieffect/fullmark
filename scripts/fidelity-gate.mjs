#!/usr/bin/env node

/**
 * Generated-only markdown fidelity gate.
 *
 * Usage:
 *   node scripts/fidelity-gate.mjs --profiles small,unicode-paths --limit 120
 *
 * Generated vaults live in the OS temp directory by default. Set
 * FULLMARK_KEEP_ARTIFACTS=1 to keep generated vaults and report artifacts under .tmp.
 */

import { JSDOM } from "jsdom";
import * as Diff from "diff";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PROFILE_NAMES,
  createGeneratedVault,
  removeGeneratedVault,
} from "./generate-vault.mjs";

const SHOW_DIFFS = 5;
const MD_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);
const HIDDEN = new Set([
  ".git",
  ".svn",
  ".hg",
  ".DS_Store",
  ".editor",
  ".obsidian",
  "node_modules",
  "dist",
  "build",
  "target",
  ".next",
  ".turbo",
]);

// DOM polyfill must run before importing TipTap.
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
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
try {
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    writable: true,
    configurable: true,
  });
} catch {
  // Node 24+ may expose navigator as a getter-only global.
}

const { Editor } = await import("@tiptap/core");
const { StarterKit } = await import("@tiptap/starter-kit");
const { Markdown } = await import("@tiptap/markdown");

function keepArtifacts() {
  return process.env.FULLMARK_KEEP_ARTIFACTS === "1";
}

function defaultArtifactDir() {
  if (process.env.FULLMARK_ARTIFACT_DIR) {
    return path.resolve(process.env.FULLMARK_ARTIFACT_DIR);
  }
  if (keepArtifacts()) {
    return path.resolve(process.cwd(), ".tmp", "fidelity-artifacts");
  }
  return path.join(os.tmpdir(), "fullmark-fidelity-artifacts");
}

function parseProfiles(value) {
  if (!value || value === "all") return PROFILE_NAMES;
  return value
    .split(",")
    .map((profile) => profile.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    profiles: ["small"],
    limit: 100,
    artifactDir: defaultArtifactDir(),
    seed: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profiles" || arg === "--profile") {
      args.profiles = parseProfiles(argv[++i]);
    } else if (arg.startsWith("--profiles=")) {
      args.profiles = parseProfiles(arg.slice("--profiles=".length));
    } else if (arg.startsWith("--profile=")) {
      args.profiles = parseProfiles(arg.slice("--profile=".length));
    } else if (arg === "--limit") {
      args.limit = Number(argv[++i]);
    } else if (arg.startsWith("--limit=")) {
      args.limit = Number(arg.slice("--limit=".length));
    } else if (arg === "--out") {
      args.artifactDir = path.resolve(argv[++i]);
    } else if (arg.startsWith("--out=")) {
      args.artifactDir = path.resolve(arg.slice("--out=".length));
    } else if (arg === "--seed") {
      args.seed = argv[++i];
    } else if (arg.startsWith("--seed=")) {
      args.seed = arg.slice("--seed=".length);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive number");
  }

  for (const profile of args.profiles) {
    if (!PROFILE_NAMES.includes(profile)) {
      throw new Error(`Unknown profile "${profile}". Expected: ${PROFILE_NAMES.join(", ")}`);
    }
  }

  return args;
}

function isMarkdown(name) {
  return MD_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function isHidden(name) {
  return HIDDEN.has(name) || name.startsWith(".");
}

async function findMdFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (isHidden(entry.name)) continue;
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await findMdFiles(absolutePath, files);
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      files.push(absolutePath);
    }
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
    editor.options.element?.remove?.();
  }
}

function getJSON(md) {
  const editor = makeEditor();
  try {
    editor.commands.setContent(md, { contentType: "markdown" });
    return JSON.stringify(editor.getJSON());
  } finally {
    editor.destroy();
    editor.options.element?.remove?.();
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

function normalize(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unifiedFragment(original, output, contextLines = 2, maxHunks = 6) {
  const hunks = Diff.structuredPatch(
    "original",
    "round-tripped",
    original,
    output,
    "",
    "",
    { context: contextLines },
  ).hunks;
  const lines = [];
  for (const hunk of hunks.slice(0, maxHunks)) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    lines.push(...hunk.lines);
  }
  if (hunks.length > maxHunks) {
    lines.push(`... (${hunks.length - maxHunks} more hunks omitted)`);
  }
  return lines.join("\n");
}

async function runProfile(profile, args) {
  let vault;
  try {
    vault = await createGeneratedVault({
      profile,
      seed: args.seed ? `${args.seed}:${profile}` : undefined,
      contentMode: "roundtrip-safe",
    });
    const allFiles = await findMdFiles(vault.root);
    const files = allFiles.slice(0, args.limit);

    console.log(
      `Corpus: ${profile} (${vault.root})\nFound ${allFiles.length} markdown files; testing ${files.length}.\n`,
    );

    const results = [];
    for (const file of files) {
      const md = await fs.readFile(file, "utf-8");
      const relativeFile = path.relative(vault.root, file);
      try {
        const out1 = roundTrip(md);
        const out2 = roundTrip(out1);
        const idempotent = out1 === out2;
        const semanticAstMatch = getJSON(md) === getJSON(out1);
        const summary = summarize(md, out1, idempotent, semanticAstMatch);
        results.push({
          file: relativeFile,
          originalBytes: Buffer.byteLength(md),
          outputBytes: Buffer.byteLength(out1),
          ...summary,
          diff: summary.isIdentical ? undefined : unifiedFragment(md, out1),
        });
      } catch (error) {
        results.push({
          file: relativeFile,
          error: error?.message || String(error),
        });
      }
    }

    return summarizeProfile(profile, vault, allFiles, files, results);
  } finally {
    await removeGeneratedVault(vault);
  }
}

function summarizeProfile(profile, vault, allFiles, files, results) {
  const byteIdentical = results.filter((r) => r.isIdentical).length;
  const semanticEquivalent = results.filter((r) => r.isSemanticEquivalent).length;
  const idempotent = results.filter((r) => !r.error && r.idempotent).length;
  const astMatch = results.filter((r) => !r.error && r.semanticAstMatch).length;
  const errors = results.filter((r) => r.error).length;

  console.log("=== SUMMARY ===");
  console.log(`Profile:                ${profile}`);
  console.log(`Total:                  ${results.length}`);
  console.log(`Byte-identical:         ${byteIdentical}`);
  console.log(`Semantic equivalent:    ${semanticEquivalent}`);
  console.log(`Idempotent:             ${idempotent}`);
  console.log(`Same parsed AST:        ${astMatch}`);
  console.log(`Errors:                 ${errors}`);
  console.log();

  for (const result of results) {
    if (result.error) {
      console.log(`ERROR ${result.file}: ${result.error}`);
    } else if (result.isIdentical) {
      console.log(`OK    ${result.file}`);
    } else if (
      result.isSemanticEquivalent &&
      result.idempotent &&
      result.semanticAstMatch
    ) {
      console.log(`OK    ${result.file} [canonical]`);
    } else {
      const flags = [
        result.idempotent ? "idempotent" : "not-idempotent",
        result.semanticAstMatch ? "ast-match" : "ast-mismatch",
      ].join(" ");
      console.log(
        `DIFF  ${result.file} bytes: ${result.originalBytes}->${result.outputBytes} diff: +${result.added} -${result.removed} [${flags}]`,
      );
    }
  }

  const diverged = results.filter((r) => {
    return (
      !r.error &&
      !r.isIdentical &&
      (!r.isSemanticEquivalent || !r.idempotent || !r.semanticAstMatch)
    );
  });
  if (diverged.length > 0) {
    console.log(`\n=== DIVERGENCE DETAILS (first ${SHOW_DIFFS}) ===\n`);
    for (const result of diverged.slice(0, SHOW_DIFFS)) {
      console.log(`--- ${result.file} ---`);
      console.log(result.diff);
      console.log();
    }
  }

  return {
    profile,
    seed: vault.seed,
    root: vault.root,
    markdownFileCount: allFiles.length,
    testedFileCount: files.length,
    summary: {
      byteIdentical,
      semanticEquivalent,
      idempotent,
      astMatch,
      errors,
    },
    results,
  };
}

function toMarkdown(report, jsonFile) {
  const lines = [
    "# FullMark Generated Fidelity Gate",
    "",
    `JSON artifact: \`${path.basename(jsonFile)}\``,
    "",
    "| Profile | Tested | Byte-identical | Semantic equivalent | Idempotent | AST match | Errors |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const profile of report.results) {
    lines.push(
      [
        `| ${profile.profile}`,
        profile.testedFileCount,
        profile.summary.byteIdentical,
        profile.summary.semanticEquivalent,
        profile.summary.idempotent,
        profile.summary.astMatch,
        profile.summary.errors,
      ].join(" | ") + " |",
    );
  }

  lines.push("");
  lines.push("Generated vaults are built at runtime; no real user corpus is read.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(args.artifactDir, { recursive: true });

  const results = [];
  for (const profile of args.profiles) {
    results.push(await runProfile(profile, args));
  }

  const report = {
    startedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    profiles: args.profiles,
    limit: args.limit,
    results,
  };

  const suffix = args.profiles.join("_").replace(/[^a-z0-9_-]+/gi, "-");
  const jsonFile = path.join(args.artifactDir, `fidelity-gate-${suffix}.json`);
  const markdownFile = path.join(args.artifactDir, `fidelity-gate-${suffix}.md`);
  await fs.writeFile(jsonFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownFile, toMarkdown(report, jsonFile), "utf8");

  console.log(`Wrote ${jsonFile}`);
  console.log(`Wrote ${markdownFile}`);

  const totalErrors = results.reduce((sum, item) => sum + item.summary.errors, 0);
  const nonIdempotent = results.reduce(
    (sum, item) => sum + (item.testedFileCount - item.summary.idempotent),
    0,
  );
  if (totalErrors > 0 || nonIdempotent > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal:", error?.stack || error);
  process.exit(1);
});

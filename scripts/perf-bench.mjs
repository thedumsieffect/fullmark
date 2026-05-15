#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import matter from "gray-matter";
import MiniSearch from "minisearch";
import { JSDOM } from "jsdom";
import {
  PROFILE_NAMES,
  createGeneratedVault,
  removeGeneratedVault,
} from "./generate-vault.mjs";

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

let tiptapModules;

function keepArtifacts() {
  return process.env.FULLMARK_KEEP_ARTIFACTS === "1";
}

function defaultArtifactDir() {
  if (process.env.FULLMARK_ARTIFACT_DIR) {
    return path.resolve(process.env.FULLMARK_ARTIFACT_DIR);
  }
  if (keepArtifacts()) {
    return path.resolve(process.cwd(), ".tmp", "perf-artifacts");
  }
  return path.join(os.tmpdir(), "fullmark-perf-artifacts");
}

function parseList(value) {
  if (!value || value === "all") return PROFILE_NAMES;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    profiles: ["small", "medium", "chaos"],
    sampleSize: 128,
    artifactDir: defaultArtifactDir(),
    seed: undefined,
    markdownRoundTrip: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profiles") args.profiles = parseList(argv[++i]);
    else if (arg.startsWith("--profiles=")) {
      args.profiles = parseList(arg.slice("--profiles=".length));
    } else if (arg === "--profile") args.profiles = parseList(argv[++i]);
    else if (arg.startsWith("--profile=")) {
      args.profiles = parseList(arg.slice("--profile=".length));
    } else if (arg === "--sample-size") {
      args.sampleSize = Number(argv[++i]);
    } else if (arg.startsWith("--sample-size=")) {
      args.sampleSize = Number(arg.slice("--sample-size=".length));
    } else if (arg === "--out") {
      args.artifactDir = path.resolve(argv[++i]);
    } else if (arg.startsWith("--out=")) {
      args.artifactDir = path.resolve(arg.slice("--out=".length));
    } else if (arg === "--seed") {
      args.seed = argv[++i];
    } else if (arg.startsWith("--seed=")) {
      args.seed = arg.slice("--seed=".length);
    } else if (arg === "--no-markdown-roundtrip") {
      args.markdownRoundTrip = false;
    }
  }

  if (!Number.isFinite(args.sampleSize) || args.sampleSize < 1) {
    throw new Error("--sample-size must be a positive number");
  }

  for (const profile of args.profiles) {
    if (!PROFILE_NAMES.includes(profile)) {
      throw new Error(`Unknown profile "${profile}". Expected: ${PROFILE_NAMES.join(", ")}`);
    }
  }

  return args;
}

function isMarkdown(name) {
  const ext = path.extname(name).toLowerCase();
  return MD_EXTENSIONS.has(ext);
}

function isHidden(name) {
  return HIDDEN.has(name) || name.startsWith(".");
}

async function discoverMarkdown(root) {
  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (isHidden(entry.name)) continue;
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && isMarkdown(entry.name)) {
        files.push(absolutePath);
      }
    }
  }
  await walk(root);
  return files;
}

function sampleEvenly(files, size) {
  if (files.length <= size) return files;
  const sample = [];
  const step = (files.length - 1) / (size - 1);
  for (let i = 0; i < size; i++) {
    sample.push(files[Math.round(i * step)]);
  }
  return sample;
}

async function timed(name, fn) {
  const start = performance.now();
  const value = await fn();
  const durationMs = performance.now() - start;
  return { name, durationMs, value };
}

async function readDocuments(files, root) {
  return Promise.all(
    files.map(async (file, index) => {
      const content = await fs.readFile(file, "utf8");
      const parsed = matter(content);
      return {
        id: index,
        path: path.relative(root, file),
        title: parsed.data.title || path.basename(file),
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        text: parsed.content,
        bytes: Buffer.byteLength(content),
      };
    }),
  );
}

function buildSearchIndex(documents) {
  const search = new MiniSearch({
    fields: ["title", "text", "tags"],
    storeFields: ["path", "title"],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  });
  search.addAll(documents);
  return search;
}

async function loadTiptap() {
  if (tiptapModules) return tiptapModules;

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
    // Node may expose navigator as an accessor. TipTap works with jsdom globals above.
  }

  const [{ Editor }, { StarterKit }, { Markdown }] = await Promise.all([
    import("@tiptap/core"),
    import("@tiptap/starter-kit"),
    import("@tiptap/markdown"),
  ]);
  tiptapModules = { Editor, StarterKit, Markdown };
  return tiptapModules;
}

async function roundTripMarkdown(documents) {
  const { Editor, StarterKit, Markdown } = await loadTiptap();
  let changed = 0;
  let outputBytes = 0;

  for (const doc of documents) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const editor = new Editor({
      element,
      extensions: [StarterKit, Markdown],
      content: "",
    });
    try {
      editor.commands.setContent(doc.text, { contentType: "markdown" });
      const markdown = editor.getMarkdown();
      outputBytes += Buffer.byteLength(markdown);
      if (markdown.trim() !== doc.text.trim()) changed++;
    } finally {
      editor.destroy();
      element.remove();
    }
  }

  return { changed, outputBytes };
}

async function runProfile(profile, args) {
  const timings = [];
  let vault;
  const generation = await timed("generate-vault", async () => {
    vault = await createGeneratedVault({
      profile,
      seed: args.seed ? `${args.seed}:${profile}` : undefined,
    });
    return vault.manifest;
  });
  timings.push(withoutValue(generation));

  try {
    const discovery = await timed("discover-markdown", () => discoverMarkdown(vault.root));
    timings.push(withoutValue(discovery));
    const files = discovery.value;
    const sampleFiles = sampleEvenly(files, args.sampleSize);

    const stat = await timed("stat-sample", async () => {
      const stats = await Promise.all(sampleFiles.map((file) => fs.stat(file)));
      return stats.reduce((sum, item) => sum + item.size, 0);
    });
    timings.push(withoutValue(stat));

    const readParse = await timed("read-parse-frontmatter-sample", () =>
      readDocuments(sampleFiles, vault.root),
    );
    timings.push(withoutValue(readParse));
    const documents = readParse.value;

    const searchIndex = await timed("build-search-index-sample", () =>
      Promise.resolve(buildSearchIndex(documents)),
    );
    timings.push(withoutValue(searchIndex));

    const search = await timed("search-index-query", () =>
      Promise.resolve(searchIndex.value.search("generated deterministic vault")),
    );
    timings.push(withoutValue(search));

    let roundTrip = null;
    if (args.markdownRoundTrip) {
      const roundTripSample = documents.slice(0, Math.min(32, documents.length));
      const result = await timed("markdown-roundtrip-sample", () =>
        roundTripMarkdown(roundTripSample),
      );
      timings.push(withoutValue(result));
      roundTrip = result.value;
    }

    return {
      profile,
      root: vault.root,
      seed: vault.seed,
      markdownFileCount: files.length,
      manifestMarkdownFileCount: vault.manifest.markdownFileCount,
      sampleSize: sampleFiles.length,
      sampledBytes: stat.value,
      searchResultCount: search.value.length,
      roundTrip,
      timings,
    };
  } finally {
    await removeGeneratedVault(vault);
  }
}

function withoutValue(result) {
  return {
    name: result.name,
    durationMs: Number(result.durationMs.toFixed(3)),
  };
}

function toMarkdown(results, jsonFile) {
  const lines = [
    "# FullMark Generated Performance Bench",
    "",
    `JSON artifact: \`${path.basename(jsonFile)}\``,
    "",
    "| Profile | Markdown files | Sample | Generate ms | Discover ms | Read/parse ms | Search build ms | Round-trip ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const result of results) {
    const byName = new Map(result.timings.map((timing) => [timing.name, timing.durationMs]));
    lines.push(
      [
        `| ${result.profile}`,
        result.markdownFileCount,
        result.sampleSize,
        byName.get("generate-vault") ?? "",
        byName.get("discover-markdown") ?? "",
        byName.get("read-parse-frontmatter-sample") ?? "",
        byName.get("build-search-index-sample") ?? "",
        byName.get("markdown-roundtrip-sample") ?? "",
      ].join(" | ") + " |",
    );
  }

  lines.push("");
  lines.push("Generated vaults are created from deterministic profiles at runtime.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(args.artifactDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const results = [];
  for (const profile of args.profiles) {
    console.log(`Benchmarking ${profile}...`);
    results.push(await runProfile(profile, args));
  }

  const artifact = {
    startedAt,
    finishedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    profiles: args.profiles,
    sampleSize: args.sampleSize,
    results,
  };

  const suffix = args.profiles.join("_").replace(/[^a-z0-9_-]+/gi, "-");
  const jsonFile = path.join(args.artifactDir, `perf-bench-${suffix}.json`);
  const markdownFile = path.join(args.artifactDir, `perf-bench-${suffix}.md`);
  await fs.writeFile(jsonFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownFile, toMarkdown(results, jsonFile), "utf8");

  console.log(`Wrote ${jsonFile}`);
  console.log(`Wrote ${markdownFile}`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

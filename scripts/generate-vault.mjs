#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MARKDOWN_EXTENSIONS = [".md", ".mdx", ".markdown"];
const HIDDEN_DIRS = [".git", ".obsidian", "node_modules", "dist"];
const NON_MARKDOWN_EXTENSIONS = [".txt", ".json", ".png", ".pdf", ".csv"];

export const PROFILE_NAMES = [
  "small",
  "medium",
  "large",
  "chaos",
  "flat-50k",
  "deep-5k",
  "wide-dirs",
  "mixed-large",
  "unicode-paths",
];

export const PROFILES = {
  small: {
    fileCount: 32,
    dirCount: 8,
    maxDepth: 3,
    paragraphs: 3,
    linksPerFile: 3,
    tagsPerFile: 2,
    frontmatter: true,
    extensions: [".md"],
  },
  medium: {
    fileCount: 750,
    dirCount: 80,
    maxDepth: 5,
    paragraphs: 4,
    linksPerFile: 5,
    tagsPerFile: 4,
    frontmatter: true,
    extensions: [".md", ".mdx"],
  },
  large: {
    fileCount: 5_000,
    dirCount: 320,
    maxDepth: 8,
    paragraphs: 5,
    linksPerFile: 7,
    tagsPerFile: 5,
    frontmatter: true,
    extensions: MARKDOWN_EXTENSIONS,
  },
  chaos: {
    fileCount: 1_200,
    dirCount: 160,
    maxDepth: 7,
    paragraphs: 5,
    linksPerFile: 9,
    tagsPerFile: 6,
    frontmatter: true,
    extensions: MARKDOWN_EXTENSIONS,
    hiddenDirCount: 8,
    nonMarkdownCount: 240,
    longNames: true,
    sparseEmptyDirs: 36,
  },
  "flat-50k": {
    fileCount: 50_000,
    dirCount: 1,
    maxDepth: 1,
    paragraphs: 1,
    linksPerFile: 2,
    tagsPerFile: 2,
    frontmatter: false,
    extensions: [".md"],
    flat: true,
  },
  "deep-5k": {
    fileCount: 5_000,
    dirCount: 120,
    maxDepth: 64,
    paragraphs: 2,
    linksPerFile: 3,
    tagsPerFile: 3,
    frontmatter: true,
    extensions: [".md"],
    deep: true,
  },
  "wide-dirs": {
    fileCount: 3_000,
    dirCount: 1_200,
    maxDepth: 2,
    paragraphs: 2,
    linksPerFile: 2,
    tagsPerFile: 2,
    frontmatter: false,
    extensions: [".md"],
    wide: true,
    sparseEmptyDirs: 300,
  },
  "mixed-large": {
    fileCount: 10_000,
    dirCount: 600,
    maxDepth: 7,
    paragraphs: 4,
    linksPerFile: 8,
    tagsPerFile: 5,
    frontmatter: true,
    extensions: MARKDOWN_EXTENSIONS,
    hiddenDirCount: 20,
    nonMarkdownCount: 2_500,
    sparseEmptyDirs: 200,
  },
  "unicode-paths": {
    fileCount: 420,
    dirCount: 64,
    maxDepth: 4,
    paragraphs: 3,
    linksPerFile: 4,
    tagsPerFile: 3,
    frontmatter: true,
    extensions: [".md", ".markdown"],
    unicode: true,
    nonMarkdownCount: 40,
  },
};

const WORDS = [
  "atlas",
  "beacon",
  "canvas",
  "delta",
  "ember",
  "field",
  "graph",
  "harbor",
  "index",
  "journal",
  "kernel",
  "ledger",
  "matrix",
  "node",
  "orbit",
  "packet",
  "quartz",
  "relay",
  "signal",
  "thread",
  "vector",
  "window",
  "syntax",
  "cursor",
  "buffer",
  "vault",
  "outline",
  "branch",
  "anchor",
  "filter",
];

const UNICODE_SEGMENTS = [
  "cafe",
  "東京",
  "naive-notes",
  "résumé",
  "mañana",
  "данные",
  "δοκιμή",
  "jalapeño",
  "中文",
  "crème",
  "niño",
  "über",
  "façade",
  "서울",
  "हिन्दी",
];

function createRng(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeSegment(value) {
  return value
    .normalize("NFC")
    .replace(/[/:]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function pad(number, width) {
  return String(number).padStart(width, "0");
}

function pick(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function makeTitle(index, rng, unicode) {
  const parts = unicode
    ? [pick(UNICODE_SEGMENTS, rng), pick(WORDS, rng), pad(index, 5)]
    : [pick(WORDS, rng), pick(WORDS, rng), pad(index, 5)];
  return parts.join(" ");
}

function makeSlug(index, rng, unicode, longNames = false) {
  const base = makeTitle(index, rng, unicode);
  const extra = longNames
    ? `-${pick(WORDS, rng)}-${pick(WORDS, rng)}-${pick(WORDS, rng)}`
    : "";
  return sanitizeSegment(`${base}${extra}`);
}

function makeDirectories(profile, rng) {
  if (profile.flat) return ["."];

  if (profile.deep) {
    const dirs = ["."];
    let current = ".";
    for (let i = 0; i < profile.dirCount - 1; i++) {
      current = path.posix.join(current, `level-${pad(i, 3)}`);
      dirs.push(current);
    }
    return dirs;
  }

  if (profile.wide) {
    return [
      ".",
      ...Array.from({ length: profile.dirCount - 1 }, (_, i) => {
        return `section-${pad(i, 4)}`;
      }),
    ];
  }

  const dirs = ["."];
  for (let i = 1; i < profile.dirCount; i++) {
    const depth = 1 + Math.floor(rng() * profile.maxDepth);
    const segments = [];
    for (let d = 0; d < depth; d++) {
      const word = profile.unicode ? pick(UNICODE_SEGMENTS, rng) : pick(WORDS, rng);
      segments.push(`${sanitizeSegment(word)}-${pad((i + d) % 997, 3)}`);
    }
    dirs.push(path.posix.join(...segments));
  }
  return Array.from(new Set(dirs));
}

function makeMarkdown(index, profile, rng, allSlugs, contentMode) {
  const roundTripSafe = contentMode === "roundtrip-safe";
  const title = makeTitle(index, rng, profile.unicode);
  const tags = Array.from({ length: profile.tagsPerFile }, () => pick(WORDS, rng));
  const links = Array.from({ length: profile.linksPerFile }, () => {
    const targetIndex = Math.floor(rng() * allSlugs.length);
    const label = rng() > 0.65 ? `|${pick(WORDS, rng)} ${pick(WORDS, rng)}` : "";
    return `[[${allSlugs[targetIndex]}${label}]]`;
  });

  const blocks = [];
  if (profile.frontmatter && !roundTripSafe) {
    blocks.push(
      [
        "---",
        `title: "${title.replace(/"/g, '\\"')}"`,
        `id: note-${pad(index, 6)}`,
        `rank: ${index}`,
        `tags: [${tags.map((tag) => `"${tag}"`).join(", ")}]`,
        "---",
        "",
      ].join("\n"),
    );
  }

  blocks.push(`# ${title}`);
  blocks.push("");
  blocks.push(
    `Links: ${links.join(", ")}. Tags: ${tags.map((tag) => `#${tag}`).join(" ")}.`,
  );

  for (let i = 0; i < profile.paragraphs; i++) {
    const sentence = Array.from({ length: 18 }, () => pick(WORDS, rng)).join(" ");
    blocks.push("");
    blocks.push(`${sentence}. This generated paragraph is ${pad(index, 6)}:${i}.`);
  }

  if (!roundTripSafe && index % 5 === 0) {
    blocks.push("");
    blocks.push("- [ ] capture follow-up");
    blocks.push("- [x] preserve deterministic content");
  }

  if (index % 9 === 0) {
    blocks.push("");
    blocks.push("```ts");
    blocks.push(`export const generatedNote = "${pad(index, 6)}";`);
    blocks.push("```");
  }

  if (!roundTripSafe && index % 13 === 0) {
    blocks.push("");
    blocks.push("| Key | Value |");
    blocks.push("| --- | --- |");
    blocks.push(`| profile | ${profile.name} |`);
    blocks.push(`| index | ${index} |`);
  }

  return `${blocks.join("\n")}\n`;
}

async function ensureDir(dir, cache) {
  if (cache.has(dir)) return;
  await fs.mkdir(dir, { recursive: true });
  cache.add(dir);
}

async function runBatched(items, concurrency, worker) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function createTempRoot(profileName) {
  const prefix = path.join(os.tmpdir(), `fullmark-${profileName}-`);
  return fs.mkdtemp(prefix);
}

function keepArtifacts() {
  return process.env.FULLMARK_KEEP_ARTIFACTS === "1";
}

export async function createGeneratedVault(options = {}) {
  const profileName = options.profile ?? "small";
  if (!PROFILE_NAMES.includes(profileName)) {
    throw new Error(
      `Unknown profile "${profileName}". Expected one of: ${PROFILE_NAMES.join(", ")}`,
    );
  }

  const profile = { ...PROFILES[profileName], name: profileName };
  const contentMode = options.contentMode ?? "default";
  const seed = String(options.seed ?? `fullmark-${profileName}-v1`);
  const rng = createRng(seed);
  const root =
    options.root ??
    (keepArtifacts()
      ? path.resolve(process.cwd(), ".tmp", "generated-vaults", profileName)
      : await createTempRoot(profileName));

  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });

  const dirs = makeDirectories(profile, rng);
  const dirCache = new Set([root]);
  await runBatched(dirs, 64, async (dir) => {
    await ensureDir(path.join(root, dir), dirCache);
  });

  const slugs = Array.from({ length: profile.fileCount }, (_, i) =>
    makeSlug(i, createRng(`${seed}:slug:${i}`), profile.unicode, profile.longNames),
  );

  const markdownFiles = [];
  let totalBytes = 0;
  const writeJobs = Array.from({ length: profile.fileCount }, (_, i) => i);
  await runBatched(writeJobs, 96, async (index) => {
    const fileRng = createRng(`${seed}:file:${index}`);
    const dir = dirs[index % dirs.length];
    const ext = profile.extensions[index % profile.extensions.length];
    const slug = slugs[index];
    const relPath = path.posix.join(dir, `${slug}${ext}`);
    const absolutePath = path.join(root, relPath);
    await ensureDir(path.dirname(absolutePath), dirCache);
    const markdown = makeMarkdown(index, profile, fileRng, slugs, contentMode);
    await fs.writeFile(absolutePath, markdown, "utf8");
    markdownFiles[index] = relPath;
    totalBytes += Buffer.byteLength(markdown);
  });

  if (profile.nonMarkdownCount) {
    const nonMarkdownJobs = Array.from({ length: profile.nonMarkdownCount }, (_, i) => i);
    await runBatched(nonMarkdownJobs, 64, async (index) => {
      const dir = dirs[(index * 17) % dirs.length];
      const ext = NON_MARKDOWN_EXTENSIONS[index % NON_MARKDOWN_EXTENSIONS.length];
      const relPath = path.posix.join(dir, `asset-${pad(index, 5)}${ext}`);
      const absolutePath = path.join(root, relPath);
      await ensureDir(path.dirname(absolutePath), dirCache);
      await fs.writeFile(absolutePath, `generated non-markdown ${index}\n`, "utf8");
    });
  }

  if (profile.hiddenDirCount) {
    const hiddenJobs = Array.from({ length: profile.hiddenDirCount }, (_, i) => i);
    await runBatched(hiddenJobs, 16, async (index) => {
      const hiddenName = HIDDEN_DIRS[index % HIDDEN_DIRS.length];
      const hiddenRoot = path.join(root, hiddenName, `cache-${pad(index, 3)}`);
      await fs.mkdir(hiddenRoot, { recursive: true });
      await fs.writeFile(
        path.join(hiddenRoot, `hidden-${pad(index, 3)}.md`),
        "# Hidden generated note\n\nThis should be ignored by app tree walkers.\n",
        "utf8",
      );
    });
  }

  if (profile.sparseEmptyDirs) {
    const emptyJobs = Array.from({ length: profile.sparseEmptyDirs }, (_, i) => i);
    await runBatched(emptyJobs, 32, async (index) => {
      await fs.mkdir(path.join(root, "empty", `branch-${pad(index, 4)}`), {
        recursive: true,
      });
    });
  }

  const manifest = {
    profile: profileName,
    seed,
    root,
    markdownFileCount: profile.fileCount,
    directoryCount: dirs.length,
    nonMarkdownFileCount: profile.nonMarkdownCount ?? 0,
    hiddenDirectoryCount: profile.hiddenDirCount ?? 0,
    totalMarkdownBytes: totalBytes,
    contentMode,
    markdownFiles,
  };

  await fs.writeFile(
    path.join(root, "fullmark-generated-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    root,
    profile: profileName,
    seed,
    manifest,
    cleanup: async () => {
      if (!options.root && !keepArtifacts()) {
        await fs.rm(root, { recursive: true, force: true });
      }
    },
  };
}

export async function removeGeneratedVault(vault) {
  if (vault?.cleanup) {
    await vault.cleanup();
    return;
  }
  if (vault?.root && !keepArtifacts()) {
    await fs.rm(vault.root, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const args = {
    profile: "small",
    seed: undefined,
    root: undefined,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--profile") args.profile = argv[++i];
    else if (arg.startsWith("--profile=")) args.profile = arg.slice("--profile=".length);
    else if (arg === "--seed") args.seed = argv[++i];
    else if (arg.startsWith("--seed=")) args.seed = arg.slice("--seed=".length);
    else if (arg === "--out" || arg === "--root") args.root = path.resolve(argv[++i]);
    else if (arg.startsWith("--out=")) args.root = path.resolve(arg.slice("--out=".length));
    else if (arg === "--json") args.json = true;
    else if (arg === "--list") args.list = true;
    else if (!arg.startsWith("-")) args.profile = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    console.log(PROFILE_NAMES.join("\n"));
    return;
  }

  const vault = await createGeneratedVault(args);
  const output = {
    profile: vault.profile,
    seed: vault.seed,
    root: vault.root,
    markdownFileCount: vault.manifest.markdownFileCount,
    directoryCount: vault.manifest.directoryCount,
    nonMarkdownFileCount: vault.manifest.nonMarkdownFileCount,
    totalMarkdownBytes: vault.manifest.totalMarkdownBytes,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Generated ${output.profile} vault at ${output.root}`);
    console.log(
      `${output.markdownFileCount} markdown files, ${output.directoryCount} directories, ${output.totalMarkdownBytes} markdown bytes`,
    );
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (executedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error);
    process.exit(1);
  });
}

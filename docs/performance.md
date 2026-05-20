# Performance Harness

FullMark's benchmark and fidelity tests use generated vaults only. The harness
never reads a real user corpus, so CI and local runs are deterministic and safe
to share.

## Profiles

The generator supports these profiles:

- `small`: 32 markdown notes across a shallow tree.
- `medium`: 750 notes with frontmatter, wikilinks, and mixed `.md`/`.mdx`.
- `large`: 5,000 notes across a deeper tree.
- `chaos`: 1,200 notes plus hidden folders, non-markdown files, long names, and empty directories.
- `flat-50k`: 50,000 markdown notes in one directory.
- `deep-5k`: 5,000 notes distributed through a deep tree.
- `wide-dirs`: 3,000 notes spread across many sibling directories.
- `mixed-large`: 10,000 notes plus non-markdown and hidden-path noise.
- `unicode-paths`: 420 notes with Unicode directory and file names.

## Commands

```sh
npm run test:unit
npm run test:fidelity
npm run test:perf
npm run test:e2e:web
npm run test:ci
```

Run every performance profile when you need a full local sweep:

```sh
node scripts/perf-bench.mjs --profiles all --sample-size 256
```

The benchmark records these critical paths:

- generated vault creation
- markdown file discovery
- sampled `stat` calls
- sampled file read and frontmatter parse
- MiniSearch index construction
- representative query execution
- sampled TipTap markdown round-trip

## Artifacts

`scripts/perf-bench.mjs` writes JSON and Markdown reports. By default, reports
and generated vaults are written under the OS temp directory. Set
`FULLMARK_KEEP_ARTIFACTS=1` to keep generated vaults and reports under `.tmp`:

```sh
FULLMARK_KEEP_ARTIFACTS=1 npm run test:perf
```

Set `FULLMARK_ARTIFACT_DIR=/path/to/reports` to choose an explicit report
directory. Generated vault content is deterministic for a profile and seed.

## Headless web E2E

`npm run test:e2e:web` runs Playwright headlessly against Vite. The tests mock
Tauri's dialog, event, filesystem, and command APIs before the app loads, then
exercise the real React UI for workspace open, markdown-only tree filtering,
source editing and save, quick switching, and reader mode.

Install the browser once on a fresh machine:

```sh
pnpm exec playwright install chromium
```

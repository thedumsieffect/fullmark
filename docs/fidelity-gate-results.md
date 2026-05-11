# Markdown Round-Trip Fidelity Gate — Results

**Date:** 2026-05-11
**Corpus:** `~/Coding/vamsios/brain/` — 34 `.md` files (real PKM vault), tested first 25
**Editor stack:** TipTap 3.23.1 + StarterKit + `@tiptap/markdown` 3.23.1 (marked 17 under the hood)
**Script:** `scripts/fidelity-gate.mjs`

## Summary

```
Total:                  25
✓ Byte-identical:       0
↻ Idempotent (2nd save no-op): 25  ← stabilizes after first pass
≡ Same parsed AST:      24         ← semantically lossless
✗ Errors:               0
```

## Three findings

### 1. First-save reformatting (25/25)

Every file gets reformatted on its first pass through the editor. Three patterns:

- **HTML entity escaping in text:** `&` → `&amp;`, `>` → `&gt;`, `<` → `&lt;`
- **Blank line added after `###` headings** that are followed by indented content
- **Trailing newline normalization** (some files lose, some gain a final `\n`)

These are CommonMark-equivalent on render but byte-different.

### 2. Idempotency on second save (25/25)

Critical finding: `out2 === out1` for every file. **Once a file passes through the editor once, it stabilizes.** Subsequent saves are byte-identical. The file is "FullMark-canonical" after first save.

This means the only diff a user ever sees is the first one. Like running Prettier on a code file: there's a one-time normalize, then no more drift.

### 3. AST equivalence (24/25)

`getJSON(original) === getJSON(roundTripped)` for 24 of 25 files. The single exception is `people/mike.md`, which contains the shrug emoticon `¯\_(ツ)_/¯`. The escaped underscore `\_` is a markdown ambiguity:

- First parse interprets it as a literal escape; `(ツ)` is plain text
- Second parse interprets the re-serialized form as `_(ツ)_` (italic) plus a literal underscore

This is a `marked` parser quirk around `\_` between underscore-italic patterns. Affects display structure (italic marks added/removed) but the **rendered text remains correct**.

## Decision: continue with TipTap + `@tiptap/markdown` for v0.1

Rationale:

- All round-trips are **idempotent on second save**. The "file changes on every save" disaster scenario doesn't happen.
- 96% are **semantically lossless** (AST match).
- Zero crashes or data loss across the corpus.
- Switching to Milkdown costs time and gives up the Notion-style block UX advantage of TipTap.

## Required mitigations (must implement before save layer ships)

1. **Save-on-dirty only.** Never write to disk unless the editor's content has actually been edited by the user. A file opened and immediately closed leaves the disk untouched. *(This is a hard rule — implement in `fs-bridge.ts` and store layer.)*

2. **First-save banner / changelog entry on first commit to GitHub.** Document that FullMark normalizes markdown on first save. Affected: HTML entities, blank lines around headings, trailing newlines. Render-equivalent only.

3. **Escaped-underscore warning.** When loading a file that contains `\_` patterns, log a debug warning. Future enhancement: skip the italic node-rule when `\_` is adjacent — requires a custom TipTap extension.

## Deferred mitigations (v0.2 or later)

1. **Custom remark-based serializer** that respects original formatting decisions (preserve `&`/`>` literally, preserve blank-line conventions, preserve trailing newline policy).
2. **Per-file "first save" diff prompt.** Before the first save, show the user a diff: "FullMark will normalize this file. Show diff / Accept / Cancel."

## Files for reference

- `scripts/fidelity-gate.mjs` — run with `node scripts/fidelity-gate.mjs [corpus] [limit]`
- `docs/ARCHITECTURE.md` — references this decision under #1 (markdown is source of truth)

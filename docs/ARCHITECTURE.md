# FullMark Architecture

This document captures the load-bearing design decisions. Read it before opening a feature PR.

## 1. Markdown is the source of truth

Persisted format is plain `.md` with YAML frontmatter. No JSON state file. No proprietary format. If TipTap+markdown can't represent a feature, we build a custom TipTap extension that round-trips through markdown — or we don't ship the feature.

**Why:** the entire wedge of the project is "Notion UX on plain markdown." Lossy export = no wedge.

**Round-trip status:** see [docs/fidelity-gate-results.md](./fidelity-gate-results.md). 24/25 brain corpus files round-trip with the same parsed AST. 25/25 are idempotent on second save. The known divergences are: HTML entity escaping in text, blank-line normalization after headings, trailing newline. Mitigations (save-on-dirty-only; first-save banner) are mandatory before save layer ships.

## 2. No AI features

Explicitly out of scope. No Cmd+K inline edit, no chat panel, no ghost-text, no Anthropic SDK, no API key handling. Stripping any AI from upstream scaffolds (Novel, etc.) is part of the build.

**Why:** AI features add latency, cost, and API key UX friction without serving the core "really useful markdown editor" goal. Reinstating any AI feature requires a separate ARCHITECTURE.md amendment.

## 3. Three indexes, not one

- **FTS index** (MiniSearch) — tokens → file IDs; invalidates on body change
- **Link graph** — `Map<resolvedPath, Set<{from, position}>>`; invalidates only on `[[wikilink]]` changes
- **Tag index** — `Map<tag, Set<path>>`; invalidates on frontmatter + inline `#tag` changes

They have different invalidation rules and shouldn't share a service.

## 4. Atomic writes

Every file save:
1. Write to `<filename>.tmp-<random>` in same directory
2. `fsync` the temp file
3. Atomically rename → target via Rust's `std::fs::rename` (atomic on same filesystem)
4. On rename failure, delete temp and surface error

**Why:** the test corpus is a live git repo that the user edits in other tools and syncs across machines. One corrupted note destroys trust forever.

## 5. Write-token suppression

The save loop:

```
editor change → debounce → write → fs watcher fires → frontend ignores own write
```

Before writing, `fs-bridge` generates a token and stores `{ path, token, expiresAt: now+800ms }`. Watcher events whose path has a non-expired token are dropped.

Per-file write queue ensures rapid edits don't race in-flight writes.

## 6. Single-tab-per-path constraint

Opening a file already open in another tab focuses the existing tab. No second tab is created. This is a hard constraint, not a UX nicety — multi-tab-same-file = silent data corruption (last writer wins, in-memory states diverge).

## 7. Schema versioning

`.editor/settings.json` carries a top-level `schema_version` field. On read, validate; run migrations if older, warn if newer. Migration functions live in `src/services/migrations.ts`. New schema versions ship with new app versions; old versions never write a newer schema.

## 8. No plugin system

Explicitly out of scope for v0.1. Adding extensibility surfaces (theme plugins, block plugins, command plugins) is a v0.3+ consideration. Do not file issues asking for it.

## 9. No CRDT, no sync engine

Single-user, single-device assumption. iCloud Drive / Dropbox / git is the user's problem. We detect external changes via fs watcher and prompt for conflict resolution (Keep yours / Use external). Full 3-way merge UI is v0.2.

## 10. AIProvider interface ~~is not present~~

(Earlier draft considered an `AIProvider` interface for swappable providers. Removed entirely — no AI in v0.1. See decision #2.)

---

## Critical paths that must have tests

- **Markdown round-trip** — `tests/markdown-roundtrip.test.ts` runs golden-file fixtures
- **Indexer invariants** — `tests/indexer.test.ts` (link graph add/remove, tag resolution)
- **File filter** — `tests/file-filter.test.ts` (gitignore patterns)
- **Save loop race conditions** — `tests/save-loop.integration.ts` (Playwright + Tauri WebDriver)

A PR that breaks any of these is red.

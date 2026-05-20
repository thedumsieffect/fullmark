# Performance Validation

This repo validates stability and fidelity in separate CI lanes so failures stay easy to triage.

## CI lanes

- `Typecheck`: `pnpm exec tsc --noEmit`
- `Build`: `pnpm build`
- `Unit Stability`: save-race and workspace stale-scan regression tests
- `Markdown Fidelity`: production editor markdown idempotency tests plus the corpus fidelity gate over `docs`
- `Performance Smoke`: production build plus a 1.5 MB per-asset smoke budget
- `Web E2E`: runs headless Playwright against Vite with mocked Tauri APIs

## Local commands

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
pnpm exec vitest run tests/save-race.test.ts tests/workspace-race.test.ts
pnpm exec vitest run tests/fidelity-production.test.ts
pnpm exec playwright install chromium
pnpm test:e2e:web
pnpm test:ci
```

## Native Tauri WebDriver

The workflow includes comments for the native Linux WebDriver lane, but does not enable it yet. That lane needs a runner image with `webkit2gtk`, `xvfb`, `tauri-driver`, and the packaged FullMark app available. Once those dependencies are pinned, the lane should:

1. Build the Tauri bundle.
2. Start `tauri-driver` on `127.0.0.1:4444`.
3. Launch the packaged app under `xvfb`.
4. Run WebDriver specs against native filesystem dialogs, focus behavior, and WebView keyboard handling.

The current `web-e2e` lane is intentionally narrower: it proves the frontend
workflows against mocked Tauri APIs, but it does not validate native filesystem
dialogs, platform focus behavior, or packaged-app startup.

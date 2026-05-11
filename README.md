# FullMark

> A really useful markdown editor. Notion-style power. Cursor-quality readability. Plain `.md` files.

FullMark is a desktop markdown editor that combines the block-based editing model of Notion with the rendering quality of Cursor's markdown view — over plain `.md` files on disk. No proprietary format, no lock-in, no AI features.

**Status:** pre-alpha. Under active development.

## Features

- **Notion-style block editor** — type `/` for a slash menu of block insertions, or use markdown shortcuts (`#`, `-`, `>`, ` ``` ` etc.)
- **Beautiful rendering** — typography-first design, warm color palette, syntax-highlighted code blocks
- **Plain `.md` files** — open any folder of markdown as a workspace. Your data stays yours.
- **`[[wikilinks]]` rendered as chips** — Obsidian-compatible
- **Atomic writes** — temp file + fsync + rename, so a crashed process can't corrupt your notes
- **Cmd+K quick switcher** — fuzzy search across all files in the workspace
- **Cmd+R reader mode** — strip chrome and lock editing for focused reading
- **Light / dark / system theme** — follows your OS by default; cycle with the ◐ button in the sidebar
- **Smart typography** — `--` → em-dash, `"x"` → curly quotes, `...` → ellipsis, automatically
- **Native "Open With…" registration** — right-click any `.md` in Finder

**Not included by design:** AI features, cloud sync, real-time collaboration, mobile apps.

## Install

### Option A — DMG (macOS, Apple Silicon)

1. Download the DMG from the [latest release](https://github.com/thedumsieffect/fullmark/releases/latest) — direct link: [FullMark_0.1.1_aarch64.dmg](https://github.com/thedumsieffect/fullmark/releases/download/v0.1.1/FullMark_0.1.1_aarch64.dmg) (~3.5 MB).
2. Open the `.dmg` and drag **FullMark.app** into your Applications folder.
3. **First launch:** because the app isn't notarized yet, macOS Gatekeeper will block it. Either:
   - Right-click FullMark.app → **Open** → confirm in the dialog, or
   - Run once via terminal: `xattr -dr com.apple.quarantine /Applications/FullMark.app`
4. **"Open With FullMark":** the first launch registers the app as a `.md` handler with Launch Services automatically. After that, right-click any `.md` file in Finder → **Open With** → **FullMark**. If you don't see the entry immediately, force a Launch Services rescan:

   ```bash
   /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
     -kill -r -domain local -domain system -domain user
   ```

### Option B — Build from source

Prereqs (one-time setup):

```bash
# 1. Node ≥20 and pnpm — easiest via nvm + corepack, or use brew:
brew install node pnpm

# 2. Rust stable (Tauri compiles the shell in Rust):
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"   # pick up cargo in the current shell

# 3. Xcode Command Line Tools (needed for the linker on macOS):
xcode-select --install
```

Then:
```bash
git clone https://github.com/thedumsieffect/fullmark.git
cd fullmark
pnpm install
pnpm tauri build     # produces src-tauri/target/release/bundle/dmg/FullMark_*.dmg + .app
```

For development:
```bash
pnpm tauri dev       # hot-reload window
```

**Common build errors:**

- `failed to run command cargo metadata` → Rust isn't installed or `cargo` isn't on `$PATH`. Run step 2 above, then `. "$HOME/.cargo/env"` in the current shell (or restart your terminal).
- `xcrun: error: invalid active developer path` → Run step 3 above.
- `error: linker 'cc' not found` → Same fix, Xcode CLT.

## Usage

1. Launch FullMark. The Welcome screen offers an **Open folder…** button.
2. Pick any folder containing `.md` files. The sidebar shows only markdown files; everything else is filtered out by design.
3. Click a file to open it in a tab. Edit. Changes save automatically 1.5 s after you stop typing, or on **Cmd+S**.

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+K` | Quick file switcher (fuzzy) |
| `Cmd+R` | Toggle reader mode |
| `Cmd+S` | Save current file |
| `Cmd+T` / `Cmd+W` | New / close tab |
| `Cmd+Shift+[` / `]` | Previous / next tab |
| `/` | Slash menu (block insert) |
| `[[` | Start a wikilink (then type, then `]]`) |

### Block shortcuts (also available via `/` menu)

| Type | Get |
|---|---|
| `# ` | Heading 1 |
| `## ` | Heading 2 |
| `- ` | Bulleted list |
| `1. ` | Numbered list |
| `- [ ] ` | Task item |
| `> ` | Block quote |
| ` ``` ` | Code block |
| `---` | Horizontal rule |
| `**x**` | Bold |
| `*x*` | Italic |
| `~~x~~` | Strikethrough |

## Stack

Tauri 2 · React + TypeScript · Vite · TipTap 3 · `@tiptap/markdown` · Tailwind · Zustand · lowlight + highlight.js · KaTeX · Mermaid

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for load-bearing design decisions (atomic writes, write-token suppression, single-tab-per-path constraint, etc).

## License

MIT — see [LICENSE](./LICENSE).

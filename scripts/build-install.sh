#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DMG_DIR="$ROOT_DIR/src-tauri/target/release/bundle/dmg"
APP_NAME="FullMark"
INSTALL_DIR="/Applications"

assume_yes=0
skip_deps=0
skip_install=0
active_mount_dir=""

cleanup_active_mount() {
  if [[ -n "$active_mount_dir" ]]; then
    hdiutil detach "$active_mount_dir" -quiet >/dev/null 2>&1 || true
    rmdir "$active_mount_dir" >/dev/null 2>&1 || true
    active_mount_dir=""
  fi
}

trap cleanup_active_mount EXIT

usage() {
  cat <<EOF
Usage: scripts/build-install.sh [options]

Build the Tauri release DMG, then optionally install ${APP_NAME}.app into ${INSTALL_DIR}.

Options:
  -y, --yes       Accept all prompts.
  --skip-deps     Do not prompt to install or refresh pnpm dependencies.
  --skip-install  Build only; do not prompt to install the app.
  -h, --help      Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      ;;
    -y|--yes)
      assume_yes=1
      ;;
    --skip-deps)
      skip_deps=1
      ;;
    --skip-install)
      skip_install=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

confirm() {
  local prompt="$1"
  local default="${2:-n}"
  local suffix="[y/N]"
  local reply

  if [[ "$default" == "y" ]]; then
    suffix="[Y/n]"
  fi

  if [[ "$assume_yes" -eq 1 ]]; then
    echo "$prompt $suffix y"
    return 0
  fi

  while true; do
    read -r -p "$prompt $suffix " reply
    reply="${reply:-$default}"
    case "$reply" in
      y|Y|yes|YES) return 0 ;;
      n|N|no|NO) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

require_command() {
  local command_name="$1"
  local install_hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    echo "$install_hint" >&2
    exit 1
  fi
}

deps_look_stale() {
  [[ ! -d "$ROOT_DIR/node_modules" ]] && return 0
  [[ ! -d "$ROOT_DIR/node_modules/.pnpm" ]] && return 0
  [[ "$ROOT_DIR/package.json" -nt "$ROOT_DIR/node_modules/.modules.yaml" ]] && return 0
  [[ "$ROOT_DIR/pnpm-lock.yaml" -nt "$ROOT_DIR/node_modules/.modules.yaml" ]] && return 0
  return 1
}

latest_dmg() {
  local latest=""
  local dmg

  shopt -s nullglob
  for dmg in "$DMG_DIR"/"${APP_NAME}"_*.dmg; do
    if [[ -z "$latest" || "$dmg" -nt "$latest" ]]; then
      latest="$dmg"
    fi
  done
  shopt -u nullglob

  printf '%s\n' "$latest"
}

install_app_from_dmg() {
  local dmg_path="$1"
  local app_path
  local target_path

  require_command hdiutil "hdiutil is included with macOS."
  require_command ditto "ditto is included with macOS."

  active_mount_dir="$(mktemp -d "/tmp/${APP_NAME}.dmg.XXXXXX")"

  echo "Mounting $dmg_path"
  hdiutil attach "$dmg_path" -mountpoint "$active_mount_dir" -nobrowse -quiet

  app_path="$(find "$active_mount_dir" -maxdepth 1 -type d -name "*.app" -print -quit)"
  if [[ -z "$app_path" ]]; then
    echo "No .app bundle found in $dmg_path" >&2
    cleanup_active_mount
    return 1
  fi

  target_path="$INSTALL_DIR/$(basename "$app_path")"
  if [[ -e "$target_path" ]]; then
    if ! confirm "Replace existing $target_path?" "y"; then
      echo "Install skipped. Built DMG remains at: $dmg_path"
      cleanup_active_mount
      return 0
    fi
  fi

  echo "Installing $(basename "$app_path") to $INSTALL_DIR"
  if [[ -w "$INSTALL_DIR" ]]; then
    rm -rf "$target_path"
    ditto "$app_path" "$target_path"
  else
    sudo rm -rf "$target_path"
    sudo ditto "$app_path" "$target_path"
  fi

  cleanup_active_mount
  echo "Installed: $target_path"
}

cd "$ROOT_DIR"

require_command pnpm "Install pnpm with: corepack enable pnpm"
require_command cargo "Install Rust from https://rustup.rs/"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script expects macOS because it installs a DMG into $INSTALL_DIR." >&2
  exit 1
fi

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Missing Xcode Command Line Tools. Install them with: xcode-select --install" >&2
  exit 1
fi

if [[ "$skip_deps" -eq 0 ]]; then
  if deps_look_stale; then
    if confirm "Dependencies are missing or stale. Run pnpm install now?" "y"; then
      pnpm install
    else
      echo "Continuing without dependency install."
    fi
  elif confirm "Dependencies look installed. Run pnpm install anyway?" "n"; then
    pnpm install
  fi
fi

echo "Building release DMG..."
pnpm tauri build

dmg_path="$(latest_dmg)"
if [[ -z "$dmg_path" ]]; then
  echo "Build finished, but no DMG was found in $DMG_DIR" >&2
  exit 1
fi

echo "Built DMG: $dmg_path"

if [[ "$skip_install" -eq 1 ]]; then
  exit 0
fi

if confirm "Install ${APP_NAME}.app from this DMG into $INSTALL_DIR?" "y"; then
  install_app_from_dmg "$dmg_path"
else
  echo "Install skipped. Built DMG remains at: $dmg_path"
fi

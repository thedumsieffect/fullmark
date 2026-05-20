/**
 * Cmd+K quick file switcher.
 *
 * - Centered modal over a dimmed backdrop
 * - Autofocused input, fuzzy filter against filename + path
 * - ↑/↓ arrows navigate, Enter opens the selected file, Esc closes
 * - Click on a row also opens
 * - Already-open files focus their existing tab (single-tab-per-path rule)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { useTabsStore } from "@/stores/tabs";
import type { WorkspaceFile } from "@/stores/workspace";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Subsequence-style fuzzy match with positional scoring.
 * Returns null if not all query chars are present in order; otherwise a score
 * (higher is better) reflecting how tightly the query matched.
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (q[qi] === t[ti]) {
      // Consecutive-match bonus
      if (lastMatchIdx === ti - 1) score += 5;
      // Word-boundary match bonus
      if (ti === 0 || /[-_/.\s]/.test(t[ti - 1])) score += 10;
      score += 1;
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi < q.length) return null;
  // Shorter strings beat longer ones with the same match
  return score - t.length * 0.05;
}

type Ranked = { file: WorkspaceFile; score: number };

export function rankWorkspaceFiles(
  files: WorkspaceFile[],
  query: string,
  limit = 20,
): Ranked[] {
  const q = query.trim();
  if (!q) {
    return files.slice(0, limit).map((file) => ({ file, score: 0 }));
  }

  const ranked: Ranked[] = [];
  for (const file of files) {
    const nameScore = fuzzyScore(q, file.searchName);
    const pathScore = fuzzyScore(q, file.searchPath);
    if (nameScore === null && pathScore === null) continue;
    const score = Math.max(
      nameScore ?? -Infinity,
      (pathScore ?? -Infinity) * 0.6,
    );
    ranked.push({ file, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export function QuickSwitcher({ open, onClose }: Props) {
  const files = useWorkspaceStore((s) => s.files);
  const openFile = useTabsStore((s) => s.openFile);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo<Ranked[]>(() => {
    return rankWorkspaceFiles(files, query);
  }, [files, query]);

  // Reset selection / query / scroll when opening or filter changes
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      // Defer focus to next tick so the input is in the DOM
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [filtered]);

  // Keep selection visible on arrow nav
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (!open) return null;

  const choose = (idx: number) => {
    const sel = filtered[idx]?.file;
    if (!sel) return;
    void openFile(sel.path).catch((e) => console.error(e));
    onClose();
  };

  return (
    <div
      className="cmdk-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search files"
    >
      <div className="cmdk-dialog" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Search files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelected((i) =>
                Math.min(i + 1, Math.max(filtered.length - 1, 0)),
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelected((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(selected);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <div className="cmdk-results" ref={listRef} role="listbox">
          {filtered.length === 0 && (
            <div className="cmdk-empty">No files match "{query}"</div>
          )}
          {filtered.map(({ file }, idx) => {
            return (
              <button
                key={file.path}
                type="button"
                role="option"
                aria-selected={idx === selected}
                className={`cmdk-result ${idx === selected ? "cmdk-result-active" : ""}`}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => choose(idx)}
              >
                <div className="cmdk-result-name">{file.label}</div>
                {file.folder && (
                  <div className="cmdk-result-path">{file.folder}</div>
                )}
              </button>
            );
          })}
        </div>
        <div className="cmdk-hints">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

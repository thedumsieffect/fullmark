import type { WorkspaceFile } from "@/stores/workspace";
import { stripMarkdownExt } from "@/services/path-utils";

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
}

function stripFragment(value: string): string {
  const hashIdx = value.indexOf("#");
  return (hashIdx >= 0 ? value.slice(0, hashIdx) : value).trim();
}

function withoutMarkdownExt(value: string): string {
  const parts = value.split("/");
  const last = parts.pop();
  if (!last) return value;
  parts.push(stripMarkdownExt(last));
  return parts.join("/");
}

export function resolveWorkspaceLinkTarget(
  files: WorkspaceFile[],
  rawTarget: string,
): WorkspaceFile | null {
  const target = stripFragment(rawTarget);
  if (!target) return null;

  const normalized = normalizePath(target);
  const normalizedNoExt = normalizePath(withoutMarkdownExt(target));

  return (
    files.find((file) => normalizePath(file.path) === normalized) ??
    files.find((file) => normalizePath(file.relativePath) === normalized) ??
    files.find(
      (file) => normalizePath(withoutMarkdownExt(file.relativePath)) === normalizedNoExt,
    ) ??
    files.find((file) => file.searchName === normalizedNoExt) ??
    null
  );
}

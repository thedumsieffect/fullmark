const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx", ".markdown"]);

function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

export function basename(path: string): string {
  const normalized = normalizeSeparators(path);
  const idx = normalized.lastIndexOf("/");
  return idx < 0 ? normalized : normalized.slice(idx + 1);
}

export function dirname(path: string): string {
  const normalized = normalizeSeparators(path);
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return normalized;
  if (idx === 0) return "/";
  return normalized.slice(0, idx);
}

export function stripMarkdownExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  const ext = name.slice(idx).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext) ? name.slice(0, idx) : name;
}

export function isPathInsideRoot(path: string, root: string | null): boolean {
  if (!root) return false;
  const normalizedPath = normalizeSeparators(path);
  const normalizedRoot = normalizeSeparators(root).replace(/\/+$/, "");
  return (
    normalizedPath === normalizedRoot ||
    normalizedPath.startsWith(`${normalizedRoot}/`)
  );
}

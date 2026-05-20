const OPENABLE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isOpenableExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return OPENABLE_URL_SCHEMES.has(url.protocol);
  } catch {
    return false;
  }
}

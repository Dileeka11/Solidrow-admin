/**
 * URL of a small, server-cached thumbnail of an uploaded photo (served by the
 * `/media/...?w=` route) so lists don't download full-size originals.
 */
export function thumbUrl(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}w=${width}`;
}

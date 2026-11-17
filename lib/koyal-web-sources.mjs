export type KoyalWebSource = { title: string; url: string };

const MAX_WEB_SOURCES = 8;

/** Extract only safe, deduplicated HTTP(S) citations from Gemini grounding metadata. */
export function extractWebSources(metadata: unknown): KoyalWebSource[] {
  if (!metadata || typeof metadata !== "object") return [];
  const chunks = (metadata as { groundingChunks?: unknown }).groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set<string>();
  const sources: KoyalWebSource[] = [];
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;
    const web = (chunk as { web?: unknown }).web;
    if (!web || typeof web !== "object") continue;
    const item = web as { uri?: unknown; title?: unknown };
    if (typeof item.uri !== "string") continue;

    let url: URL;
    try {
      url = new URL(item.uri);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const normalizedUrl = url.toString();
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);

    const title = typeof item.title === "string" && item.title.trim()
      ? item.title.trim().slice(0, 180)
      : url.hostname;
    sources.push({ title, url: normalizedUrl });
    if (sources.length >= MAX_WEB_SOURCES) break;
  }
  return sources;
}

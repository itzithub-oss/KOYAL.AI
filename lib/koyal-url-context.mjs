import { isIP } from "node:net";

const MAX_URL_LENGTH = 2048;
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".test", ".invalid"];

export function normalizeKoyalUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_URL_LENGTH) return null;

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || !hostname.includes(".") || isIP(hostname) || hostname.startsWith("[")) return null;
  if (hostname === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return null;

  url.hash = "";
  return url.toString();
}

/** Return citations only for URLs Gemini reports it successfully retrieved. */
export function extractUrlContextSources(metadata) {
  if (!metadata || typeof metadata !== "object") return [];
  const entries = metadata.urlMetadata;
  if (!Array.isArray(entries)) return [];

  const sources = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    if (!String(entry.urlRetrievalStatus || entry.status || "").toUpperCase().endsWith("SUCCESS")) continue;
    const candidate = entry.retrievedUrl || entry.url;
    if (typeof candidate !== "string") continue;

    let url;
    try {
      url = new URL(candidate);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    sources.push({
      title: typeof entry.title === "string" && entry.title.trim()
        ? entry.title.trim().slice(0, 180)
        : url.hostname,
      url: normalized,
    });
    if (sources.length >= 4) break;
  }
  return sources;
}

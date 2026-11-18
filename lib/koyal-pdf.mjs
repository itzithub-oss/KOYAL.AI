export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
export const MAX_PDF_TEXT_CHARACTERS = 30_000;

export function hasPdfHeader(value) {
  if (!(value instanceof Uint8Array) || value.byteLength < 5) return false;
  const header = new TextDecoder("latin1").decode(value.subarray(0, Math.min(value.byteLength, 1024)));
  return header.includes("%PDF-");
}

export function normalizePdfText(value, maxCharacters = MAX_PDF_TEXT_CHARACTERS) {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0 ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!normalized) return "";
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) return "";
  return normalized.length > maxCharacters
    ? normalized.slice(0, maxCharacters).trimEnd() + "\n\n[Document text truncated.]"
    : normalized;
}

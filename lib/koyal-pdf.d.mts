export const MAX_PDF_BYTES: number;
export const MAX_PDF_PAGES: number;
export const MAX_PDF_TEXT_CHARACTERS: number;
export function hasPdfHeader(value: Uint8Array): boolean;
export function normalizePdfText(value: unknown, maxCharacters?: number): string;

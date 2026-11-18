export const MAX_IMAGE_BYTES: number;
export function detectImageMime(value: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null;

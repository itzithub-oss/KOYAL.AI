export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function detectImageMime(value) {
  if (!(value instanceof Uint8Array)) return null;
  if (value.length >= 8 && value[0] === 0x89 && value[1] === 0x50 && value[2] === 0x4e && value[3] === 0x47 && value[4] === 0x0d && value[5] === 0x0a && value[6] === 0x1a && value[7] === 0x0a) return "image/png";
  if (value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff) return "image/jpeg";
  if (value.length >= 12 && String.fromCharCode(...value.subarray(0,4)) === "RIFF" && String.fromCharCode(...value.subarray(8,12)) === "WEBP") return "image/webp";
  return null;
}

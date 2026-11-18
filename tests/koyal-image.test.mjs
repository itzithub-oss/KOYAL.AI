import test from "node:test";
import assert from "node:assert/strict";
import { detectImageMime, MAX_IMAGE_BYTES } from "../lib/koyal-image.mjs";

test("detects PNG, JPEG and WebP signatures", () => {
  assert.equal(detectImageMime(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), "image/png");
  assert.equal(detectImageMime(new Uint8Array([0xff,0xd8,0xff,0x00])), "image/jpeg");
  assert.equal(detectImageMime(new TextEncoder().encode("RIFFxxxxWEBP")), "image/webp");
});
test("rejects unsupported and truncated image signatures", () => {
  assert.equal(detectImageMime(new TextEncoder().encode("GIF89a")), null);
  assert.equal(detectImageMime(new Uint8Array([0xff,0xd8])), null);
});
test("limits image uploads to 10 MB", () => assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024));

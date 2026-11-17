import test from "node:test";
import assert from "node:assert/strict";
import { hasPdfHeader, normalizePdfText, MAX_PDF_TEXT_CHARACTERS } from "../lib/koyal-pdf.mjs";

test("recognizes a PDF signature at the beginning or within the first 1024 bytes", () => {
  assert.equal(hasPdfHeader(new TextEncoder().encode("%PDF-1.7 content")), true);
  assert.equal(hasPdfHeader(new TextEncoder().encode(" ".repeat(100) + "%PDF-1.4")), true);
});

test("rejects non-PDF and too-short buffers", () => {
  assert.equal(hasPdfHeader(new TextEncoder().encode("not a PDF")), false);
  assert.equal(hasPdfHeader(new Uint8Array([37, 80, 68])), false);
  assert.equal(hasPdfHeader("not bytes"), false);
});

test("normalizes extracted text while preserving paragraph boundaries", () => {
  assert.equal(normalizePdfText("  Heading\r\n\r\n  A\t  paragraph.  "), "Heading\n\nA paragraph.");
});

test("bounds extracted document text and marks truncation", () => {
  const result = normalizePdfText("x".repeat(MAX_PDF_TEXT_CHARACTERS + 20));
  assert.equal(result.startsWith("x".repeat(MAX_PDF_TEXT_CHARACTERS)), true);
  assert.equal(result.endsWith("[Document text truncated.]"), true);
});

test("returns empty text for invalid inputs", () => {
  assert.equal(normalizePdfText(null), "");
  assert.equal(normalizePdfText("   "), "");
  assert.equal(normalizePdfText("text", 0), "");
});

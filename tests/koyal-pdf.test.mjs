import test from "node:test";
import assert from "node:assert/strict";
import { PDFParse } from "pdf-parse";
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

function createOnePagePdf() {
  const stream = "BT /F1 18 Tf 72 720 Td (Hello from KOYAL PDF Reader) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\\nstream\\n${stream}\\nendstream`,
  ];
  let source = "%PDF-1.4\\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\\n${object}\\nendobj\\n`;
  }
  const xrefOffset = Buffer.byteLength(source);
  source += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
  for (const offset of offsets.slice(1)) source += `${String(offset).padStart(10, "0")} 00000 n \\n`;
  source += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xrefOffset}\\n%%EOF`;
  return Buffer.from(source, "binary");
}

test("pdf-parse extracts text from a valid uploaded PDF", async () => {
  const parser = new PDFParse({ data: new Uint8Array(createOnePagePdf()) });
  try {
    const info = await parser.getInfo();
    assert.equal(info.total, 1);
    const result = await parser.getText({ partial: [1] });
    assert.match(result.text, /Hello from KOYAL PDF Reader/);
  } finally {
    await parser.destroy();
  }
});

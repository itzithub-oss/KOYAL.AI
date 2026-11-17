import test from "node:test";
import assert from "node:assert/strict";
import { extractUrlContextSources, normalizeKoyalUrl } from "../lib/koyal-url-context.mjs";

test("normalizes public HTTP(S) URLs and removes fragments", () => {
  assert.equal(normalizeKoyalUrl(" HTTPS://Example.com/path#section "), "https://example.com/path");
  assert.equal(normalizeKoyalUrl("http://example.org"), "http://example.org/");
});

test("rejects unsafe schemes, credentials, local hosts, IP literals and unusual ports", () => {
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com/",
    "http://localhost:3000",
    "http://127.0.0.1/",
    "http://192.168.1.5/",
    "http://[::1]/",
    "https://printer.local/",
    "https://service.internal/",
    "https://example.com:3000/",
    "not a URL",
    "https://example.com/" + "x".repeat(2100),
  ]) assert.equal(normalizeKoyalUrl(value), null, value);
});

test("extracts only successful safe URL-context retrievals", () => {
  assert.deepEqual(extractUrlContextSources({
    urlMetadata: [
      { urlRetrievalStatus: "SUCCESS", retrievedUrl: "https://example.com/page", title: "Example page" },
      { urlRetrievalStatus: "URL_RETRIEVAL_STATUS_UNSAFE", retrievedUrl: "https://unsafe.example/" },
      { urlRetrievalStatus: "SUCCESS", retrievedUrl: "javascript:alert(1)" },
      { urlRetrievalStatus: "SUCCESS", retrievedUrl: "https://example.com/page", title: "Duplicate" },
    ],
  }), [{ title: "Example page", url: "https://example.com/page" }]);
});

test("handles absent metadata", () => {
  assert.deepEqual(extractUrlContextSources(null), []);
  assert.deepEqual(extractUrlContextSources({}), []);
});

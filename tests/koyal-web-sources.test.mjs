import test from "node:test";
import assert from "node:assert/strict";
import { extractWebSources } from "../lib/koyal-web-sources.mjs";

test("extracts safe grounding links and ignores invalid or unsafe entries", () => {
  const sources = extractWebSources({
    groundingChunks: [
      { web: { title: "Official source", uri: "https://example.com/article" } },
      { web: { title: "Duplicate", uri: "https://example.com/article" } },
      { web: { title: "Unsafe", uri: "javascript:alert(1)" } },
      { web: { title: "Bad URL", uri: "not a url" } },
      { web: { title: "Second source", uri: "https://news.example.org/story" } },
      { maps: { title: "Not a web chunk", uri: "https://maps.example" } },
    ],
  });
  assert.deepEqual(sources, [
    { title: "Official source", url: "https://example.com/article" },
    { title: "Second source", url: "https://news.example.org/story" },
  ]);
});

test("handles missing metadata and bounds the number of citations", () => {
  assert.deepEqual(extractWebSources(null), []);
  assert.deepEqual(extractWebSources({}), []);
  const groundingChunks = Array.from({ length: 20 }, (_, index) => ({
    web: { uri: `https://example.com/${index}` },
  }));
  const sources = extractWebSources({ groundingChunks });
  assert.equal(sources.length, 8);
  assert.equal(sources[0].title, "example.com");
});

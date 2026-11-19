import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_THOUGHTS, getDailyThought } from "../lib/daily-thoughts.mjs";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
test("returns the same thought within a three-hour window", () => {
  assert.deepEqual(getDailyThought(0), getDailyThought(10_000));
  assert.deepEqual(getDailyThought(10_000), getDailyThought(THREE_HOURS_MS - 1));
});
test("changes the thought at the next three-hour boundary", () => {
  assert.notDeepEqual(getDailyThought(0), getDailyThought(THREE_HOURS_MS));
});
test("cycles through the thought collection", () => {
  assert.equal(getDailyThought(DAILY_THOUGHTS.length * THREE_HOURS_MS).text, DAILY_THOUGHTS[0].text);
});
test("handles invalid timestamps safely", () => {
  assert.equal(getDailyThought(Number.NaN).text, DAILY_THOUGHTS[0].text);
});

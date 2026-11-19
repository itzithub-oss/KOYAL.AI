import test from "node:test";
import assert from "node:assert/strict";
import { findUpBusinesses, searchFindUpBusinesses } from "../lib/find-up-data.mjs";

test("FIND UP includes The Body Mechanics as its initial business", () => {
  assert.equal(findUpBusinesses.length, 1);
  assert.equal(findUpBusinesses[0].name, "The Body Mechanics");
  assert.deepEqual(findUpBusinesses[0].qualifications, ["BPT", "MPT (Musculoskeletal & Sports)"]);
});

test("FIND UP matches a relevant service and location", () => {
  const results = searchFindUpBusinesses(findUpBusinesses, "physiotherapy in Jalpaiguri");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "the-body-mechanics");
});

test("FIND UP does not invent or return unrelated listings", () => {
  assert.deepEqual(searchFindUpBusinesses(findUpBusinesses, "car mechanic in Delhi"), []);
});

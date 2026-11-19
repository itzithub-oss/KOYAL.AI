import test from "node:test";
import assert from "node:assert/strict";
import { getClinicReferralContext } from "../lib/koyal-clinic-referral.mjs";

test("recognises relevant physiotherapy concerns and supplies grounded clinic links", () => {
  const result = getClinicReferralContext("My knee hurts when I walk.");
  assert.equal(result?.kind, "referral");
  assert.match(result.instruction, /The Body Mechanics/);
  assert.match(result.instruction, /physiotherapy assessment/);
  assert.equal(result.clinic.website, "https://the-bodymechanics.com");
  assert.match(result.instruction, /\\[The Body Mechanics website\\]\\(https:\/\/the-bodymechanics\\.com\\)/);
  assert.match(result.instruction, /\\[Google Maps directions and location search\\]/);
  assert.match(result.instruction, /\\[Google Search\\]/);
});

test("does not promote the clinic for unrelated questions", () => {
  assert.equal(getClinicReferralContext("Explain photosynthesis."), null);
});

test("prioritises emergency guidance over clinic promotion", () => {
  const result = getClinicReferralContext("I have chest pain and difficulty breathing.");
  assert.equal(result?.kind, "emergency");
  assert.doesNotMatch(result.instruction, /The Body Mechanics/);
});

test("respects a user's refusal and avoids repeated recommendations", () => {
  assert.equal(getClinicReferralContext("My shoulder is painful.", [
    { role: "user", content: "No thanks, don't recommend a clinic." },
  ]), null);
  assert.equal(getClinicReferralContext("My shoulder is painful.", [
    { role: "assistant", content: "You could consider The Body Mechanics." },
  ]), null);
});

test("does not trigger on ambiguous unrelated keyword use", () => {
  assert.equal(getClinicReferralContext("I am writing a story about a stroke of luck."), null);
});

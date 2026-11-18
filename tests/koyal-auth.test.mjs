import test from "node:test";
import assert from "node:assert/strict";
import { validateKoyalCredentials } from "../lib/koyal-auth.mjs";

test("email is required for every auth action", () => {
  assert.equal(validateKoyalCredentials({ email: "", password: "secret1", mode: "login" }), "Enter a valid email address.");
});
test("phone is optional during signup", () => {
  assert.equal(validateKoyalCredentials({ email: "user@example.com", password: "secret1", phone: "", mode: "signup" }), "");
});
test("phone is validated only when supplied", () => {
  assert.match(validateKoyalCredentials({ email: "user@example.com", password: "secret1", phone: "123", mode: "signup" }), /valid phone/);
});
test("password reset does not require a password", () => {
  assert.equal(validateKoyalCredentials({ email: "user@example.com", password: "", mode: "reset" }), "");
});

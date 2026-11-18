import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMORY_STORAGE_KEY, MAX_MEMORIES, MAX_MEMORY_LENGTH,
  addMemory, buildMemoryContext, createMemory, deleteMemory,
  loadMemories, normalizeMemories, saveMemories, suggestMemoryFromMessage,
} from "../lib/koyal-memory.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("normalizes invalid records, trims text and removes duplicate IDs", () => {
  const result = normalizeMemories([
    { id: "a", text: "  remember this  ", createdAt: 12 },
    { id: "a", text: "duplicate" },
    { id: "", text: "missing id" },
    null,
  ]);
  assert.deepEqual(result, [{ id: "a", text: "remember this", createdAt: 12 }]);
});

test("persists and reloads memories locally", () => {
  const storage = memoryStorage();
  const created = addMemory(storage, [], "My preferred language is English.", { id: "m1", createdAt: 10 });
  assert.equal(created.length, 1);
  assert.deepEqual(loadMemories(storage), created);
  assert.equal(storage.getItem(MEMORY_STORAGE_KEY) !== null, true);
});

test("rejects blank and oversized memories", () => {
  assert.throws(() => createMemory("   "), /cannot be empty/);
  assert.throws(() => createMemory("x".repeat(MAX_MEMORY_LENGTH + 1)), /under 500 characters/);
});

test("enforces the maximum number of memories", () => {
  const storage = memoryStorage();
  const full = Array.from({ length: MAX_MEMORIES }, (_, i) => ({ id: String(i), text: `fact ${i}`, createdAt: i }));
  assert.throws(() => addMemory(storage, full, "one too many"), /up to 100 memories/);
});

test("deletes one memory without changing the others", () => {
  const storage = memoryStorage();
  const items = [
    { id: "one", text: "first", createdAt: 1 },
    { id: "two", text: "second", createdAt: 2 },
  ];
  assert.deepEqual(deleteMemory(storage, items, "one"), [items[1]]);
  assert.deepEqual(loadMemories(storage), [items[1]]);
});

test("builds bounded context only from valid saved memories", () => {
  const context = buildMemoryContext([{ id: "a", text: "Likes concise explanations." }]);
  assert.match(context, /User-approved local memories/);
  assert.match(context, /Likes concise explanations/);
  assert.equal(buildMemoryContext([]), "");
});

test("storage failures are handled safely", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  assert.deepEqual(loadMemories(broken), []);
  assert.equal(saveMemories(broken, []), false);
});


test("suggests only clearly phrased, low-risk memories without saving them", () => {
  assert.equal(suggestMemoryFromMessage("I prefer short explanations with examples."), "User prefers short explanations with examples");
  assert.equal(suggestMemoryFromMessage("My goal is to become an IAS officer."), "User's goal is to become an IAS officer");
  assert.equal(suggestMemoryFromMessage("Remember that I enjoy football."), "I enjoy football");
  assert.equal(suggestMemoryFromMessage("What is the capital of India?"), "");
  assert.equal(suggestMemoryFromMessage("I prefer using email address demo@example.com"), "");
  assert.equal(suggestMemoryFromMessage("Remember my password is abc123"), "");
});

test("does not suggest a memory that is already saved", () => {
  const saved = [{ id: "existing", text: "User prefers short explanations with examples", createdAt: 1 }];
  assert.equal(suggestMemoryFromMessage("I prefer short explanations with examples.", saved), "");
});

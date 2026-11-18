import test from "node:test";
import assert from "node:assert/strict";
import { CHAT_HISTORY_KEY, MAX_CHAT_SESSIONS, createChatSession, getChatTitle, readChatHistory, saveChatHistory, searchChatSessions, upsertChatSession } from "../lib/koyal-chat-history.mjs";
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); } };
}
test("titles chats from the first user message and truncates long titles", () => {
  assert.equal(getChatTitle([{role:"assistant",content:"Hi"},{role:"user",content:" Help   me learn history "}]), "Help me learn history");
  assert.equal(getChatTitle([{role:"assistant",content:"Welcome"}]), "New chat");
  assert.equal(getChatTitle([{role:"user",content:"x".repeat(70)}]).length, 52);
});
test("creates and persists sessions in browser storage", () => {
  const storage=memoryStorage(), session=createChatSession([{role:"user",content:"Hello"}],"chat-1","2026-01-01T00:00:00.000Z");
  assert.equal(saveChatHistory(storage,[session]),true);
  assert.deepEqual(readChatHistory(storage),[session]);
  assert.notEqual(storage.getItem(CHAT_HISTORY_KEY),null);
});
test("recovers from invalid or malformed stored history", () => {
  assert.deepEqual(readChatHistory(memoryStorage({[CHAT_HISTORY_KEY]:"{"})),[]);
  assert.deepEqual(readChatHistory(memoryStorage({[CHAT_HISTORY_KEY]:JSON.stringify({bad:true})})),[]);
});
test("upserts, sorts newest first and enforces the history limit", () => {
  const old=createChatSession([{role:"user",content:"Old"}],"old","2026-01-01T00:00:00.000Z");
  const newer=createChatSession([{role:"user",content:"New"}],"new","2026-01-02T00:00:00.000Z");
  assert.deepEqual(upsertChatSession([old],newer).map(s=>s.id),["new","old"]);
  let many=[];
  for(let i=0;i<MAX_CHAT_SESSIONS+5;i++) many=upsertChatSession(many,createChatSession([],"id-"+i,new Date(2026,0,1,0,i).toISOString()));
  assert.equal(many.length,MAX_CHAT_SESSIONS);
});
test("searches titles and message contents case-insensitively", () => {
  const sessions=[createChatSession([{role:"user",content:"Explain photosynthesis"}],"one","2026-01-01T00:00:00.000Z"),createChatSession([{role:"user",content:"Plan a trip"}],"two","2026-01-02T00:00:00.000Z")];
  assert.deepEqual(searchChatSessions(sessions,"PHOTO").map(s=>s.id),["one"]);
  assert.deepEqual(searchChatSessions(sessions,"trip").map(s=>s.id),["two"]);
  assert.equal(searchChatSessions(sessions,"  ").length,2);
});

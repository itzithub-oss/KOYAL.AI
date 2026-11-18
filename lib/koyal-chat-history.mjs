export const CHAT_HISTORY_KEY = "koyal-ai-chat-history";
export const ACTIVE_CHAT_KEY = "koyal-ai-active-chat";
export const MAX_CHAT_SESSIONS = 100;
function validDate(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : new Date(0).toISOString(); }
export function getChatTitle(messages) {
  const first = Array.isArray(messages) ? messages.find((m) => m && m.role === "user" && typeof m.content === "string" && m.content.trim()) : null;
  const title = first?.content?.trim().replace(/\\s+/g, " ") || "New chat";
  return title.length > 52 ? title.slice(0, 49).trimEnd() + "..." : title;
}
export function createChatSession(messages, id, now = new Date().toISOString()) {
  const safe = Array.isArray(messages) ? messages : [];
  return { id: String(id), title: getChatTitle(safe), messages: safe, createdAt: now, updatedAt: now };
}
export function readChatHistory(storage) {
  try {
    const raw = storage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === "string" && Array.isArray(s.messages)).map((s) => ({
      id: s.id, title: typeof s.title === "string" && s.title.trim() ? s.title : getChatTitle(s.messages),
      messages: s.messages, createdAt: validDate(s.createdAt), updatedAt: validDate(s.updatedAt),
    })).sort((a,b) => Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0, MAX_CHAT_SESSIONS);
  } catch { return []; }
}
export function saveChatHistory(storage, sessions) {
  try { storage.setItem(CHAT_HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_CHAT_SESSIONS))); return true; }
  catch { return false; }
}
export function upsertChatSession(sessions, session) {
  const next = sessions.filter((s) => s.id !== session.id);
  next.push({ ...session, title: getChatTitle(session.messages) });
  return next.sort((a,b) => Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0, MAX_CHAT_SESSIONS);
}
export function searchChatSessions(sessions, query) {
  const term = String(query || "").trim().toLocaleLowerCase();
  if (!term) return sessions;
  return sessions.filter((s) => s.title.toLocaleLowerCase().includes(term) || s.messages.some((m) => String(m?.content || "").toLocaleLowerCase().includes(term)));
}

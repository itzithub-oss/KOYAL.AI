"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import VoiceMode from "./components/VoiceMode";
import AuthGate from "./components/AuthGate";
import BootScreen from "./components/BootScreen";
import WingedAvatar from "./components/WingedAvatar";
import styles from "./koyal-final.module.css";
import { addMemory, buildMemoryContext, deleteMemory, loadMemories, suggestMemoryFromMessage, type KoyalMemory } from "../lib/koyal-memory.mjs";
import { addTask, deleteTask, loadTasks, updateTask, type KoyalTask } from "../lib/koyal-tasks.mjs";
import { ACTIVE_CHAT_KEY, createChatSession, readChatHistory, saveChatHistory, searchChatSessions, upsertChatSession } from "../lib/koyal-chat-history.mjs";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  time?: string;
  sources?: { title: string; url: string }[];
};
type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";
type CharacterMode =
  | "normal" | "mother" | "father" | "school-friend"
  | "school-female-friend" | "business-partner" | "enemy";
type ThinkingEffort =
  | "just" | "let-it" | "care" | "high" | "ultra-high" | "elite" | "supreme";
type ChatApiResponse = { reply?: string; error?: string; sources?: { title: string; url: string }[] };
type Profile = { name: string; gender: string; phone: string; dob: string; photo: string };
type ChatSession = { id: string; title: string; messages: Message[]; createdAt: string; updatedAt: string };
const EMPTY_PROFILE: Profile = { name: "", gender: "", phone: "", dob: "", photo: "" };
type FeatherPack = { quantity: number; rupees: number };
const FEATHER_PACKS: FeatherPack[] = [
  { quantity: 100, rupees: 50 },
  { quantity: 450, rupees: 225 },
  { quantity: 700, rupees: 350 },
  { quantity: 1000, rupees: 500 },
];
const PRICE_PER_FEATHER = 0.5;
type IconName =
  | "chat" | "user" | "brain" | "masks" | "book" | "message" | "feather"
  | "diamond" | "moon" | "sun" | "search" | "dots" | "plus" | "paperclip"
  | "send" | "chevron" | "x" | "volume" | "stop" | "menu" | "check"
  | "arrow" | "copy" | "memory" | "tasks" | "graduation";

const ERROR_REPLY = "sorry,there is a problem in my server please try me later";
const WELCOME: Message = {
  role: "assistant",
  content: "Hi! I’m Koyal. 👋\nHow can I help you today?",
};

const characters: { id: CharacterMode; name: string; icon: string; color: string }[] = [
  { id: "normal", name: "Koyal", icon: "🐦", color: "#fe476d" },
  { id: "mother", name: "Mother", icon: "♥", color: "#fa368e" },
  { id: "father", name: "Father", icon: "♟", color: "#4f90e7" },
  { id: "school-friend", name: "School Friend", icon: "✦", color: "#11b8a4" },
  { id: "school-female-friend", name: "Good School Female Friend", icon: "✿", color: "#bd4cff" },
  { id: "business-partner", name: "Business Partner", icon: "▣", color: "#dca632" },
  { id: "enemy", name: "Enemy", icon: "♜", color: "#dc3053" },
];
const teacherSubjects = [
  "General Science", "Mathematics", "Physics", "Chemistry", "Biology",
  "History", "Geography", "Civics", "Economics", "Computer Science",
  "English", "Social Science",
];
const thinking: { id: ThinkingEffort; name: string; feathers: number }[] = [
  { id: "just", name: "Just", feathers: 0 },
  { id: "let-it", name: "Let It", feathers: 1 },
  { id: "care", name: "Care", feathers: 2 },
  { id: "high", name: "High", feathers: 3 },
  { id: "ultra-high", name: "Ultra High", feathers: 6 },
  { id: "elite", name: "Elite", feathers: 8 },
  { id: "supreme", name: "Supreme", feathers: 0 },
];
const plans: { name: PlanName; price: number; description: string }[] = [
  { name: "Just", price: 0, description: "Basic conversations" },
  { name: "Let It", price: 70, description: "Explore more thinking" },
  { name: "Care", price: 120, description: "More detailed responses" },
  { name: "Elite", price: 220, description: "Advanced thinking" },
  { name: "Supreme", price: 400, description: "Supreme thinking access" },
];

function Icon({ name, size = 21 }: { name: IconName; size?: number }) {
  const base = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, React.ReactNode> = {
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.8-5.5A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11.5h8"/></>,
    user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    brain: <><path d="M12 6a4 4 0 0 0-7.2-2.3 4 4 0 0 0-2 5.7 4 4 0 0 0 0 5.2 4 4 0 0 0 3.1 5.8A4 4 0 0 0 12 18V6Zm0 0a4 4 0 0 1 7.2-2.3 4 4 0 0 1 2 5.7 4 4 0 0 1 0 5.2 4 4 0 0 1-3.1 5.8A4 4 0 0 1 12 18"/><path d="M12 4v16M6 9l2 2-2 2m12-4-2 2 2 2"/></>,
    masks: <><path d="M3 5c3-1 6-1 9 0v10c0 4-3 6-5 6-3-1-5-4-5-7V6Zm10 0c3-1 6-1 9 0v9c0 3-3 6-6 7-1 0-3-1-4-2"/><path d="M5 10h2m3 0h1M5 15c2-1 3-1 5 0m6-5h2"/></>,
    book: <><path d="M12 6C9 4 5 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1Zm0 0v14"/></>,
    message: <><path d="M21 11a9 9 0 0 1-9 9 9.1 9.1 0 0 1-4-.9L3 21l1.6-5A9 9 0 1 1 21 11Z"/><path d="M8 11h8"/></>,
    feather: <><path d="M20 4C12 3 5 8 5 16l-2 5m2-5 8-8M4 20l13-11m-6 0 6 0m-8 5v-5"/></>,
    diamond: <><path d="m6 3-4 7 10 11 10-11-4-7H6ZM2 10h20M8 3l-2 7 6 11 6-11-2-7"/></>,
    moon: <path d="M20.5 15A8.5 8.5 0 0 1 9 3.5 8.5 8.5 0 1 0 20.5 15Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    dots: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    paperclip: <path d="m20 11-8.8 8.8a5 5 0 0 1-7.1-7.1l9.4-9.4a3.5 3.5 0 0 1 5 5l-9.4 9.4a2 2 0 0 1-2.8-2.8L15 6"/>,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    x: <path d="M18 6 6 18M6 6l12 12"/>,
    volume: <><path d="M4 9v6h4l5 4V5L8 9H4Zm13-1a5 5 0 0 1 0 8m2-11a9 9 0 0 1 0 14"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2"/>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    memory: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    tasks: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></>,
    graduation: <><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v6"/></>,
  };
  return <svg {...base}>{paths[name]}</svg>;
}


function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function makeStoredZip(files: { name: string; content: string }[]) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const crc32 = (data: Uint8Array) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const u16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const u32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv,0,0x04034b50); u16(lv,4,20); u16(lv,6,0x0800); u16(lv,8,0);
    u32(lv,14,crc); u32(lv,18,data.length); u32(lv,22,data.length); u16(lv,26,name.length);
    local.set(name,30); chunks.push(local,data);
    const entry = new Uint8Array(46 + name.length);
    const ev = new DataView(entry.buffer);
    u32(ev,0,0x02014b50); u16(ev,4,20); u16(ev,6,20); u16(ev,8,0x0800); u16(ev,10,0);
    u32(ev,16,crc); u32(ev,20,data.length); u32(ev,24,data.length); u16(ev,28,name.length);
    u32(ev,42,offset); entry.set(name,46); central.push(entry);
    offset += local.length + data.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev,0,0x06054b50); u16(ev,8,files.length); u16(ev,10,files.length);
  u32(ev,12,centralSize); u32(ev,16,offset);
  const parts = [...chunks, ...central, end];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) { output.set(part, cursor); cursor += part.length; }
  return new Blob([output.buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function KoyalApp() {
  const [booting, setBooting] = useState(true);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanName>("Just");
  const [feathers, setFeathers] = useState(2480);
  const [thinkingId, setThinkingId] = useState<ThinkingEffort>("high");
  const [characterMode, setCharacterMode] = useState<CharacterMode>("normal");
  const [characterOpen, setCharacterOpen] = useState(true);
  const [preciseMode, setPreciseMode] = useState(false);
  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherClass, setTeacherClass] = useState("8");
  const [teacherSubject, setTeacherSubject] = useState("General Science");
  const [philosophicalMode, setPhilosophicalMode] = useState(false);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [draftProfile, setDraftProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasks, setTasks] = useState<KoyalTask[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState("");
  const [studyMode, setStudyMode] = useState(false);
  const [studyFocus, setStudyFocus] = useState("Understand the topic");
  const [memories, setMemories] = useState<KoyalMemory[]>([]);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryError, setMemoryError] = useState("");
  const [pendingMemorySuggestion, setPendingMemorySuggestion] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [urlReaderEnabled, setUrlReaderEnabled] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [featherShopOpen, setFeatherShopOpen] = useState(false);
  const [customFeathers, setCustomFeathers] = useState("250");
  const [purchaseNotice, setPurchaseNotice] = useState("");
  const profilePhotoInput = useRef<HTMLInputElement>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lightMode, setLightMode] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const chatSessionsRef = useRef<ChatSession[]>([]);
  const currentThinking = thinking.find((option) => option.id === thinkingId) || thinking[3];
  const indexThinking = thinking.findIndex((option) => option.id === thinkingId);
  const currentCharacter = characters.find((character) => character.id === characterMode) || characters[0];
  const featherCost = selectedPlan === "Supreme" ? 0 : currentThinking.feathers;
  const visibleMessages = search.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages;
  const visibleChatSessions = searchChatSessions(chatSessions, historyQuery);

  useEffect(() => {
    try {
      setMemories(loadMemories(localStorage));
      setTasks(loadTasks(localStorage));
      const saved = localStorage.getItem("koyal-ai-chat");
      let legacyMessages: Message[] = [WELCOME];
      if (saved) {
        try { const parsed: Message[] = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length) legacyMessages = parsed; }
        catch { /* Start with a welcome chat if legacy storage is invalid. */ }
      }
      const storedSessions = readChatHistory(localStorage) as ChatSession[];
      if (storedSessions.length) {
        const requestedId = localStorage.getItem(ACTIVE_CHAT_KEY);
        const activeSession = storedSessions.find((s) => s.id === requestedId) || storedSessions[0];
        chatSessionsRef.current = storedSessions; setChatSessions(storedSessions);
        setActiveChatId(activeSession.id); setMessages(activeSession.messages);
      } else {
        const initialSession = createChatSession(legacyMessages, "chat-" + Date.now()) as ChatSession;
        chatSessionsRef.current = [initialSession]; setChatSessions([initialSession]);
        setActiveChatId(initialSession.id); setMessages(legacyMessages);
        saveChatHistory(localStorage, [initialSession]); localStorage.setItem(ACTIVE_CHAT_KEY, initialSession.id);
      }
      historyLoadedRef.current = true;
      const plan = localStorage.getItem("koyal-ai-subscription-plan");
      if (plans.some((p) => p.name === plan)) setSelectedPlan(plan as PlanName);
      const featherStore = localStorage.getItem("koyal-ai-feather-balance");
      if (featherStore !== null && Number.isFinite(Number(featherStore))) setFeathers(Number(featherStore));
      const profileJson = localStorage.getItem("koyal-ai-profile-v2");
      if (profileJson) {
        const stored = JSON.parse(profileJson) as Partial<Profile>;
        const valid: Profile = {
          name: typeof stored.name === "string" ? stored.name : "",
          gender: typeof stored.gender === "string" ? stored.gender : "",
          phone: typeof stored.phone === "string" ? stored.phone : "",
          dob: typeof stored.dob === "string" ? stored.dob : "",
          photo: typeof stored.photo === "string" ? stored.photo : "",
        };
        setProfile(valid);
      } else {
        const oldName = localStorage.getItem("koyal-ai-profile-name");
        if (oldName) setProfile({ ...EMPTY_PROFILE, name: oldName });
      }
    } catch {
      // Ignore invalid local data and keep defaults.
    }
    loadedRef.current = true;
    const bootTimer = window.setTimeout(() => setBooting(false), 13200);
    return () => window.clearTimeout(bootTimer);
  }, []);
  useEffect(() => {
    if (loadedRef.current) localStorage.setItem("koyal-ai-chat", JSON.stringify(messages));
    if (historyLoadedRef.current && activeChatId) {
      const existing = chatSessionsRef.current.find((s) => s.id === activeChatId);
      const session: ChatSession = { id: activeChatId, title: "New chat", messages, createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      const next = upsertChatSession(chatSessionsRef.current, session) as ChatSession[];
      chatSessionsRef.current = next; setChatSessions(next); saveChatHistory(localStorage, next);
      localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeChatId]);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);
  useEffect(() => {
    if (!profileOpen && !memoryOpen && !tasksOpen && !subscriptionOpen && !featherShopOpen && !historyOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setMemoryOpen(false);
        setTasksOpen(false);
        setSubscriptionOpen(false);
        setFeatherShopOpen(false);
        setHistoryOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profileOpen, memoryOpen, tasksOpen, subscriptionOpen, featherShopOpen, historyOpen]);

  function resetChat() {
    const nextMessages = [{ ...WELCOME, time: timestamp() }];
    const nextSession = createChatSession(nextMessages, "chat-" + Date.now()) as ChatSession;
    const nextSessions = upsertChatSession(chatSessionsRef.current, nextSession) as ChatSession[];
    chatSessionsRef.current = nextSessions; setChatSessions(nextSessions); saveChatHistory(localStorage, nextSessions);
    setActiveChatId(nextSession.id); localStorage.setItem(ACTIVE_CHAT_KEY, nextSession.id);
    setMessages(nextMessages); setHistoryOpen(false); setHistoryQuery("");
    setPendingMemorySuggestion("");
    setInput("");
    setSelectedFile(null);
    setSearch("");
    setSearchOpen(false);
    setMobileNav(false);
    setProfileOpen(false);
    setMemoryOpen(false);
    setTasksOpen(false);
    setEditingProfile(false);
    window.speechSynthesis?.cancel();
  }
  function openChatHistory() {
    setHistoryQuery(""); setHistoryOpen(true); setMobileNav(false);
    setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false);
  }
  function openChatSession(session: ChatSession) {
    setActiveChatId(session.id); setMessages(session.messages); setHistoryOpen(false); setHistoryQuery("");
    setSearch(""); setSearchOpen(false); setMobileNav(false);
  }
  function deleteChatSession(sessionId: string) {
    const remaining = chatSessionsRef.current.filter((s) => s.id !== sessionId);
    if (sessionId === activeChatId) {
      const replacement = remaining[0] || (createChatSession([{ ...WELCOME, time: timestamp() }], "chat-" + Date.now()) as ChatSession);
      const next = remaining.length ? remaining : [replacement];
      chatSessionsRef.current = next; setChatSessions(next); saveChatHistory(localStorage, next);
      setActiveChatId(replacement.id); localStorage.setItem(ACTIVE_CHAT_KEY, replacement.id); setMessages(replacement.messages);
    } else { chatSessionsRef.current = remaining; setChatSessions(remaining); saveChatHistory(localStorage, remaining); }
  }
  function changeThinking(idx: number) {
    const option = thinking[Math.max(0, Math.min(6, idx))];
    if (option.id === "supreme" && selectedPlan !== "Supreme") {
      setSubscriptionOpen(true);
      return;
    }
    setThinkingId(option.id);
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setFileError("");
    if (!file) { setSelectedFile(null); return; }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
    if (!isPdf && !isImage) {
      setSelectedFile(null); setFileError("Choose a PDF, PNG, JPG or WebP file."); event.target.value = ""; return;
    }
    const maxBytes = isPdf ? 8 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size <= 0 || file.size > maxBytes) {
      setSelectedFile(null);
      setFileError(isPdf ? "PDF files must be between 1 byte and 8 MB." : "Images must be between 1 byte and 10 MB.");
      event.target.value = ""; return;
    }
    setSelectedFile(file);
  }
  function openProfile() {
    setDraftProfile({ ...profile });
    setProfileError("");
    setEditingProfile(false);
    setProfileOpen(true);
    setMemoryOpen(false);
    setTasksOpen(false);
    setMobileNav(false);
  }
  function openMemory() {
    setProfileOpen(false);
    setTasksOpen(false);
    setMemoryOpen(true);
    setMemoryError("");
    setMobileNav(false);
  }
  function openTasks() {
    setProfileOpen(false); setMemoryOpen(false); setTasksOpen(true); setTaskError(""); setMobileNav(false);
  }
  function saveTask() {
    try {
      setTasks(addTask(localStorage, tasks, taskTitle, { notes: taskNotes, dueDate: taskDueDate }));
      setTaskTitle(""); setTaskNotes(""); setTaskDueDate(""); setTaskError("");
    } catch (error) { setTaskError(error instanceof Error ? error.message : "Could not save this task."); }
  }
  function toggleTask(task: KoyalTask) {
    try { setTasks(updateTask(localStorage, tasks, task.id, { done: !task.done })); }
    catch (error) { setTaskError(error instanceof Error ? error.message : "Could not update this task."); }
  }
  function removeTask(id: string) {
    try { setTasks(deleteTask(localStorage, tasks, id)); setTaskError(""); }
    catch (error) { setTaskError(error instanceof Error ? error.message : "Could not delete this task."); }
  }
  function saveLocalMemory() {
    try {
      const next = addMemory(localStorage, memories, memoryDraft);
      setMemories(next);
      setMemoryDraft("");
      setMemoryError("");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not save this memory.");
    }
  }
  function saveSuggestedMemory() {
    if (!pendingMemorySuggestion) return;
    try {
      const next = addMemory(localStorage, memories, pendingMemorySuggestion);
      setMemories(next);
      setPendingMemorySuggestion("");
      setMemoryError("");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not save this memory.");
    }
  }
  function removeLocalMemory(id: string) {
    try {
      setMemories(deleteMemory(localStorage, memories, id));
      setMemoryError("");
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Could not delete this memory.");
    }
  }
  function saveProfile() {
    const name = draftProfile.name.trim();
    const digits = draftProfile.phone.replace(/\D/g, "");
    if (!name) { setProfileError("Please enter your name."); return; }
    if (draftProfile.phone && (digits.length < 7 || digits.length > 15)) {
      setProfileError("Enter a valid phone number (7–15 digits)."); return;
    }
    if (draftProfile.dob && draftProfile.dob > new Date().toISOString().slice(0, 10)) {
      setProfileError("Date of birth cannot be in the future."); return;
    }
    const saved = { ...draftProfile, name };
    try {
      localStorage.setItem("koyal-ai-profile-v2", JSON.stringify(saved));
      localStorage.setItem("koyal-ai-profile-name", name);
    } catch {
      setProfileError("Could not save the photo. Try a smaller photo."); return;
    }
    setProfile(saved);
    setDraftProfile(saved);
    setEditingProfile(false);
    setProfileError("");
  }
  function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("Choose a PNG, JPG, or WebP photo."); return;
    }
    if (file.size > 900_000) {
      setProfileError("Choose a photo smaller than 900 KB for browser storage."); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraftProfile((old) => ({ ...old, photo: reader.result as string }));
        setProfileError("");
      }
    };
    reader.onerror = () => setProfileError("Could not read the selected photo.");
    reader.readAsDataURL(file);
    event.target.value = "";
  }
  function openFeatherShop() {
    setPurchaseNotice("");
    setFeatherShopOpen(true);
    setMobileNav(false);
  }
  function requestFeatherPurchase(amount: number, rupees: number) {
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) {
      setPurchaseNotice("Choose a whole number between 1 and 100,000 feathers.");
      return;
    }
    // IMPORTANT: Browser-only accounts cannot securely receive paid credits.
    // A verified payment gateway, database and authenticated webhook are required.
    setPurchaseNotice(`₹${rupees.toLocaleString("en-IN")} for ${amount.toLocaleString("en-IN")} feathers. Checkout is not connected yet; no payment was taken and your balance has not changed.`);
  }
  function selectPlan(plan: PlanName) {
    setSelectedPlan(plan);
    localStorage.setItem("koyal-ai-subscription-plan", plan);
    setSubscriptionOpen(false);
    if (plan !== "Supreme" && thinkingId === "supreme") setThinkingId("high");
  }
  function speakMessage(text: string, index: number) {
    if (!("speechSynthesis" in window)) return;
    if (speakingIndex === index) { window.speechSynthesis.cancel(); setSpeakingIndex(null); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0900-\u097f]/.test(text) ? "hi-IN" : "en-IN";
    utterance.rate = 0.96;
    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    window.speechSynthesis.speak(utterance);
  }
  function chatTranscript() {
    return messages.map((m) => `${m.role === "assistant" ? "Koyal" : "You"}${m.time ? ` · ${m.time}` : ""}:\n${m.content}${m.fileName ? `\n[Attachment: ${m.fileName}]` : ""}${m.sources?.length ? `\nSources:\n${m.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}` : ""}`).join("\n\n------------------------------\n\n");
  }
  async function copyChat() {
    try {
      await navigator.clipboard.writeText(chatTranscript());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
    setMenuOpen(false);
  }
  function exportChat(format: "txt" | "docx" | "pdf") {
    const title = "KOYAL AI Conversation";
    const transcript = chatTranscript();
    const safeName = `koyal-chat-${new Date().toISOString().slice(0,10)}`;
    if (format === "txt") {
      downloadBlob(new Blob([transcript], { type: "text/plain;charset=utf-8" }), `${safeName}.txt`);
    } else if (format === "docx") {
      const paragraphs = messages.map((m) => {
        const label = m.role === "assistant" ? "Koyal" : "You";
        const lines = [`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(label + (m.time ? ` · ${m.time}` : ""))}</w:t></w:r></w:p>`];
        for (const line of m.content.split(/\r?\n/)) lines.push(`<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`);
        if (m.fileName) lines.push(`<w:p><w:r><w:t>${xmlEscape("[Attachment: " + m.fileName + "]")}</w:t></w:r></w:p>`);
        for (const source of m.sources || []) lines.push(`<w:p><w:r><w:t>${xmlEscape(source.title + ": " + source.url)}</w:t></w:r></w:p>`);
        return lines.join("");
      }).join('<w:p><w:r><w:t> </w:t></w:r></w:p>');
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${title}</w:t></w:r></w:p>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
      const blob = makeStoredZip([
        { name: "[Content_Types].xml", content: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
        { name: "_rels/.rels", content: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
        { name: "word/document.xml", content: documentXml },
      ]);
      downloadBlob(blob, `${safeName}.docx`);
    } else {
      const printWindow = window.open("", "_blank");
      if (!printWindow) { window.alert("Allow pop-ups for Koyal to create a PDF."); return; }
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font:14px/1.6 Arial,sans-serif;color:#222;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:22px}article{white-space:pre-wrap;overflow-wrap:anywhere;margin:16px 0;padding-bottom:12px;border-bottom:1px solid #ddd}.who{font-weight:bold;color:#9b1c3c}@media print{body{margin:0 auto}}</style></head><body><h1>${title}</h1>${messages.map(m=>`<article><div class="who">${xmlEscape(m.role === "assistant" ? "Koyal" : "You")}${m.time ? " · " + xmlEscape(m.time) : ""}</div>${xmlEscape(m.content)}${m.fileName ? "\\n[Attachment: " + xmlEscape(m.fileName) + "]" : ""}${(m.sources || []).map(s=>"\\n"+xmlEscape(s.title+": "+s.url)).join("")}</article>`).join("")}<script>window.onload=()=>window.print()<\/script></body></html>`;
      printWindow.document.write(html);
      printWindow.document.close();
    }
    setMenuOpen(false);
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const text = input.trim();
    const attachment = selectedFile;
    if (!text && !attachment && !(urlReaderEnabled && urlInput.trim())) return;
    if (featherCost > feathers) { openFeatherShop(); return; }
    const message = text || (attachment ? (attachment.type === "application/pdf" ? "Please summarize the attached PDF." : "Please describe and read the attached image.") : urlReaderEnabled ? "Please summarize this webpage." : "Please help me with this attachment.");
    setMessages((old) => [...old, { role: "user", content: message, fileName: attachment?.name, time: timestamp() }]);
    setInput("");
    setSelectedFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setLoading(true);
    try {
      const systemDetails = [
        "You are Koyal. Introduce yourself as Koyal, not Koyal AI.",
        "Reply in English by default; use Hindi or another language only when explicitly requested.",
        characterMode !== "normal" ? `Character mode: ${currentCharacter.name}.` : "",
        teacherMode ? `Teacher mode: Class ${teacherClass}, ${teacherSubject}.` : "",
        studyMode ? `Study Mode: tutor me at Class ${teacherClass} level in ${teacherSubject}. Focus: ${studyFocus}.` : "",
        philosophicalMode ? "Philosophical mode: provide thoughtful reasoning." : "",
        buildMemoryContext(memories),
      ].filter(Boolean).join(" ");
      const requestPayload = {
          message: `${message}\n\n${systemDetails}`,
          mode: teacherMode ? "Teacher" : philosophicalMode ? "Philosophical" : preciseMode ? "Precise" : "Normal",
          thinkingLevel: currentThinking.name,
          language: "English by default",
          subscriptionPlan: selectedPlan,
          name: profile.name,
          characterMode,
          teacherMode,
          teacherClass,
          teacherSubject,
          studyMode,
          studyClass: teacherClass,
          studySubject: teacherSubject,
          studyFocus,
          preciseMode,
          philosophicalMode,
          webSearch: webSearchEnabled,
          urlContextUrl: urlReaderEnabled ? urlInput.trim() : undefined,
        };
      let requestBody: BodyInit;
      let requestHeaders: HeadersInit | undefined;
      if (attachment) {
        const formData = new FormData();
        for (const [key, value] of Object.entries(requestPayload)) {
          if (value !== undefined && value !== null) formData.append(key, String(value));
        }
        formData.append("file", attachment);
        requestBody = formData;
      } else {
        requestHeaders = { "Content-Type": "application/json" };
        requestBody = JSON.stringify(requestPayload);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });
      const data: ChatApiResponse = await response.json();
      if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) throw new Error(ERROR_REPLY);
      setMessages((old) => [...old, { role: "assistant", content: data.reply || ERROR_REPLY, time: timestamp(), sources: Array.isArray(data.sources) ? data.sources : [] }]);
      setPendingMemorySuggestion(suggestMemoryFromMessage(text, memories));
      if (featherCost > 0) setFeathers((old) => {
        const value = Math.max(0, old - featherCost);
        localStorage.setItem("koyal-ai-feather-balance", String(value));
        return value;
      });
    } catch {
      setPendingMemorySuggestion("");
      setMessages((old) => [...old, { role: "assistant", content: ERROR_REPLY, time: timestamp() }]);
    } finally { setLoading(false); }
  }

  const closeSidebar = () => setMobileNav(false);

  return (
    <main className={`${styles.app} ${lightMode ? styles.light : ""}`}>
      {booting && <BootScreen />}
      <div className={styles.layout}>
        <button type="button" aria-label="Open navigation" className={styles.mobileMenuButton} onClick={() => setMobileNav(true)}><Icon name="menu"/></button>
        {mobileNav && <button type="button" aria-label="Close menu" className={styles.mobileDimmer} onClick={closeSidebar}/>}
        <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ""}`}>
          <div className={styles.brand}>
            <img className={styles.brandBird} src="/koyal-bird.png" alt="KOYAL bird" />
            <div className={styles.brandName}>KOYAL <span>AI</span></div>
            <div className={styles.brandTagline}>Intelligence with a Softer Soul</div>
            <div className={styles.credits}>Brought to you by<br/><strong>Divyansh Acharjee &amp; Tejas Raj</strong></div>
          </div>
          <nav className={styles.nav} aria-label="Koyal features">
            <button type="button" onClick={resetChat} className={`${styles.navItem} ${styles.navMain}`}><Icon name="chat"/><strong>New Chat</strong></button>
            <button type="button" onClick={openChatHistory} className={`${styles.navItem} ${historyOpen ? styles.navOn : ""}`}><Icon name="chat"/>Chat History<span className={styles.navSmall}>{chatSessions.length}</span></button>
            <button type="button" onClick={openProfile} className={`${styles.navItem} ${profileOpen ? styles.navOn : ""}`}><Icon name="user"/>Profile</button>
            <button type="button" onClick={openMemory} className={`${styles.navItem} ${memoryOpen ? styles.navOn : ""}`}><Icon name="memory"/>Memory<span className={styles.navSmall}>{memories.length}</span></button>
            <button type="button" onClick={openTasks} className={`${styles.navItem} ${tasksOpen ? styles.navOn : ""}`}><Icon name="tasks"/>Tasks<span className={styles.navSmall}>{tasks.filter((task) => !task.done).length}</span></button>
            <button type="button" onClick={() => setPreciseMode((v) => !v)} className={`${styles.navItem} ${preciseMode ? styles.navOn : ""}`}><Icon name="brain"/>Precise Mode<span className={styles.navSmall}>{preciseMode ? "On" : ""}</span></button>
            <div className={styles.characterPanel}>
              <button type="button" className={styles.characterHeading} onClick={() => setCharacterOpen((v) => !v)} aria-expanded={characterOpen}><Icon name="masks"/><strong>Character Mode</strong><span className={characterOpen ? styles.chevronUp : ""}><Icon name="chevron" size={16}/></span></button>
              {characterOpen && <div className={styles.characterList}>
                {characters.slice(1).map((character) => <button key={character.id} type="button" className={`${styles.characterItem} ${characterMode === character.id ? styles.characterSelected : ""}`} onClick={() => setCharacterMode(character.id)}><span className={styles.characterIcon} style={{ backgroundColor: character.color }}>{character.icon}</span>{character.name}</button>)}
                {characterMode !== "normal" && <button type="button" className={styles.normalMode} onClick={() => setCharacterMode("normal")}>Use normal Koyal</button>}
              </div>}
            </div>
            <button type="button" onClick={() => setTeacherMode((v) => !v)} className={`${styles.navItem} ${teacherMode ? styles.navOn : ""}`}><Icon name="book"/>Teacher Mode<span className={styles.navSmall}>{teacherMode ? "On" : ""}</span></button>
            <button type="button" onClick={() => setStudyMode((v) => !v)} className={`${styles.navItem} ${studyMode ? styles.navOn : ""}`}><Icon name="graduation"/>Study Mode<span className={styles.navSmall}>{studyMode ? "On" : "Off"}</span></button>
            {studyMode && <div className={styles.teacherSettings}>
              <label>Study class<select value={teacherClass} onChange={(e) => setTeacherClass(e.target.value)}>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1)}>{i+1}</option>)}</select></label>
              <label>Subject<select value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)}>{teacherSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label>Learning focus<select value={studyFocus} onChange={(e) => setStudyFocus(e.target.value)}>{["Understand the topic","Homework help","Quiz practice","Exam preparation","Revision and notes"].map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>}
            {teacherMode && <div className={styles.teacherSettings}>
              <label>Class<select value={teacherClass} onChange={(e) => setTeacherClass(e.target.value)}>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1)}>{i+1}</option>)}</select></label>
              <label>Subject<select value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)}>{teacherSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>}
            <button type="button" onClick={() => setPhilosophicalMode((v) => !v)} className={`${styles.navItem} ${philosophicalMode ? styles.navOn : ""}`}><Icon name="message"/>Philosophical Mode<span className={styles.navSmall}>{philosophicalMode ? "On" : ""}</span></button>
            <button type="button" onClick={openFeatherShop} className={styles.navItem}><Icon name="feather"/>Feather Balance<span className={styles.navSmall}>{selectedPlan === "Supreme" ? "∞" : feathers.toLocaleString("en-IN")}</span></button>
            <button type="button" onClick={() => { setSubscriptionOpen(true); closeSidebar(); }} className={styles.navItem}><Icon name="diamond"/>Subscription</button>
          </nav>
          <button type="button" className={styles.sidebarProfile} onClick={openProfile} aria-label="Open your profile">
            <div className={styles.sidebarProfileTop}>
              <WingedAvatar photo={profile.photo} supreme={selectedPlan === "Supreme"} variant="small" />
              <span className={styles.sidebarProfileName}><strong>{profile.name || "Your Profile"}</strong><small>{selectedPlan === "Supreme" ? "♛ Supreme Plan" : `${selectedPlan} Plan`}</small></span>
              <Icon name="chevron" size={17}/>
            </div>
            <div className={styles.sidebarProfileStats}>
              <span>🪶 <strong>{selectedPlan === "Supreme" ? "∞" : feathers.toLocaleString("en-IN")}</strong><small>Feather balance</small></span>
              <span>◇ <strong>{selectedPlan}</strong><small>Active plan</small></span>
            </div>
          </button>
        </aside>

        <section className={styles.mainPanel}>
          <header className={styles.topbar}>
            <div className={styles.headerBrand}>
              <span className={styles.headerAvatar}><img src="/koyal-bird.png" alt=""/></span>
              <span className={styles.headerText}><strong>KOYAL <em>AI</em></strong><small>INTELLIGENCE WITH A SOFTER SOUL</small></span>
            </div>
            <div className={styles.topActions}>
              {searchOpen && <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus className={styles.searchInput} placeholder="Search this chat..." aria-label="Search messages"/>}{searchOpen && search.trim() && <small aria-live="polite" style={{ whiteSpace: "nowrap", opacity: .75 }}>{visibleMessages.length} match{visibleMessages.length === 1 ? "" : "es"}</small>}
              <button type="button" className={styles.roundTop} title={lightMode ? "Dark theme" : "Light theme"} aria-label="Toggle theme" onClick={() => setLightMode((v) => !v)}><Icon name={lightMode ? "sun" : "moon"}/></button>
              <button type="button" className={styles.roundTop} title="Search messages" aria-label="Search messages" onClick={() => {setSearchOpen((v) => !v);setSearch("");}}><Icon name="search"/></button>
              <div className={styles.menuWrap}><button type="button" className={styles.roundTop} title="More options" aria-label="More options" onClick={() => setMenuOpen((v) => !v)}><Icon name="dots"/></button>
                {menuOpen && <div className={styles.overflowMenu}>
                  <button type="button" onClick={copyChat}><Icon name="copy" size={16}/>{copied ? "Copied" : "Copy conversation"}</button>
                  <button type="button" onClick={() => exportChat("txt")}>Download TXT</button>
                  <button type="button" onClick={() => exportChat("docx")}>Download Word (.docx)</button>
                  <button type="button" onClick={() => exportChat("pdf")}>Print / Save as PDF</button>
                  <button type="button" onClick={() => {resetChat();setMenuOpen(false);}}><Icon name="chat" size={16}/>Clear conversation</button>
                </div>}
              </div>
            </div>
          </header>

          {historyOpen && <div className={styles.historyOverlay} role="dialog" aria-modal="true" aria-label="Chat history">
            <div className={styles.historyPanel}>
              <div className={styles.historyHeader}><div><h2>Chat History</h2><p>Your saved conversations on this device</p></div>
                <button type="button" className={styles.historyClose} aria-label="Close chat history" onClick={() => setHistoryOpen(false)}><Icon name="x" size={20}/></button>
              </div>
              <label className={styles.historySearch}><Icon name="search" size={17}/><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Search chats and messages..." aria-label="Search chat history"/></label>
              <div className={styles.historyList}>
                {visibleChatSessions.length === 0 && <p className={styles.historyEmpty}>{chatSessions.length ? "No conversations match your search." : "Your conversations will appear here when you start chatting."}</p>}
                {visibleChatSessions.map((session) => <div className={`${styles.historyItem} ${session.id === activeChatId ? styles.historyItemActive : ""}`} key={session.id}>
                  <button type="button" className={styles.historyOpen} onClick={() => openChatSession(session)}><strong>{session.title}</strong>
                    <span>{session.messages.filter((m) => m.role === "user").length} messages · {new Date(session.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                    <small>{session.messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "No messages yet"}</small>
                  </button>
                  <button type="button" className={styles.historyDelete} aria-label={"Delete " + session.title} title="Delete conversation" onClick={() => deleteChatSession(session.id)}><Icon name="x" size={17}/></button>
                </div>)}
              </div>
              <div className={styles.historyFooter}><span>{chatSessions.length} / 100 saved chats</span><button type="button" onClick={resetChat}>＋ New Chat</button></div>
            </div>
          </div>}

          <section className={styles.chatSpace} aria-label="Conversation">
            <div className={styles.sceneBackdrop}/>
      {tasksOpen && <div className={styles.profileModal} role="region" aria-label="Koyal tasks">
          <div className={styles.profileHead}>
            <div><h2>My Tasks</h2><p>Plan your work and track what you finish.</p></div>
            <button type="button" aria-label="Close tasks" className={styles.profileClose} onClick={() => setTasksOpen(false)}><Icon name="x" size={24}/></button>
          </div>
          <div className={styles.profileBody}>
            <div className={styles.profileFields}>
              <label><span>Task title</span><input value={taskTitle} maxLength={160} placeholder="e.g. Revise the Mughal Empire" onChange={(e) => setTaskTitle(e.target.value)}/></label>
              <label><span>Notes (optional)</span><textarea value={taskNotes} maxLength={500} rows={2} placeholder="What needs to be done?" onChange={(e) => setTaskNotes(e.target.value)}/></label>
              <label><span>Due date (optional)</span><input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)}/></label>
              <button type="button" className={styles.saveProfileButton} onClick={saveTask} disabled={!taskTitle.trim()}>Add Task</button>
              {taskError && <p className={styles.profileError} role="alert">{taskError}</p>}
              <p className={styles.profilePrivacy}>Tasks are saved only in this browser. They are not sent to the AI provider.</p>
            </div>
            <div className={styles.profileFields}>
              <h3>Task list ({tasks.filter((t) => !t.done).length} pending · {tasks.filter((t) => t.done).length} completed)</h3>
              {tasks.length === 0 && <p className={styles.profilePrivacy}>No tasks yet. Add your first task above.</p>}
              {tasks.map((task) => <div key={task.id} className={styles.identityCard} style={{ display:"flex",alignItems:"flex-start",gap:10 }}>
                <input type="checkbox" checked={task.done} onChange={() => toggleTask(task)} aria-label={task.done ? "Mark task pending" : "Mark task complete"} style={{ marginTop:5 }}/>
                <div style={{ flex:1,minWidth:0 }}>
                  <strong style={{ textDecoration:task.done ? "line-through" : "none",opacity:task.done ? 0.6 : 1 }}>{task.title}</strong>
                  {task.notes && <p style={{ margin:"5px 0",whiteSpace:"pre-wrap" }}>{task.notes}</p>}
                  {task.dueDate && <small style={{ opacity:.7 }}>Due {task.dueDate}</small>}
                </div>
                <button type="button" className={styles.profileClose} aria-label="Delete task" onClick={() => removeTask(task.id)}><Icon name="x" size={18}/></button>
              </div>)}
            </div>
          </div>
      </div>}
      {memoryOpen && <div className={styles.profileModal} role="region" aria-label="Koyal local memory">
          <div className={styles.profileHead}>
            <div><h2>Koyal Memory</h2><p>Saved only in this browser. You choose what Koyal remembers.</p></div>
            <button type="button" aria-label="Close memory" className={styles.profileClose} onClick={() => setMemoryOpen(false)}><Icon name="x" size={24}/></button>
          </div>
          <div className={styles.profileBody}>
            <div className={styles.profileFields}>
              <label><span>Add a memory (max 500 characters)</span><textarea value={memoryDraft} maxLength={500} rows={3} placeholder="Example: I prefer short explanations with examples." onChange={(e) => setMemoryDraft(e.target.value)} /></label>
              <button type="button" className={styles.saveProfileButton} onClick={saveLocalMemory} disabled={!memoryDraft.trim()}>Save Memory</button>
              {memoryError && <p className={styles.profileError} role="alert">{memoryError}</p>}
              <p className={styles.profilePrivacy}>Memories are stored locally on this device. When you send a chat message, saved memories are included in that request to the configured AI provider. Do not save passwords, payment details or other secrets.</p>
            </div>
            <div className={styles.profileFields}>
              <h3>Saved memories ({memories.length}/100)</h3>
              {memories.length === 0 && <p className={styles.profilePrivacy}>No memories saved yet. Add a fact or preference above.</p>}
              {memories.map((memory) => <div key={memory.id} className={styles.identityCard} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{memory.text}</p>
                <button type="button" className={styles.profileClose} aria-label="Delete memory" title="Delete memory" onClick={() => removeLocalMemory(memory.id)}><Icon name="x" size={18}/></button>
              </div>)}
            </div>
          </div>
      </div>}
      {profileOpen && <div className={styles.profileModal} role="region" aria-label="Profile">
          <div className={styles.profileHead}>
            <div><h2>Profile</h2><p>Manage your personal information and account details</p></div>
            <div className={styles.profileHeadActions}>
              <button type="button" className={styles.editProfileButton} onClick={() => {setEditingProfile((v) => !v);setProfileError("");setDraftProfile({ ...profile });}}>{editingProfile ? "Cancel Edit" : "✎ Edit Profile"}</button>
              <button type="button" aria-label="Close profile" className={styles.profileClose} onClick={() => setProfileOpen(false)}><Icon name="x" size={24}/></button>
            </div>
          </div>
          <div className={styles.profileBody}>
            <div className={styles.profileVisual}>
              <div className={styles.bigAvatarContainer}>
                <WingedAvatar photo={draftProfile.photo || profile.photo} supreme={selectedPlan === "Supreme"} variant="large" />
                {editingProfile && <>
                  <input ref={profilePhotoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadProfilePhoto} />
                  <button type="button" aria-label="Change profile photo" className={styles.cameraButton} onClick={() => profilePhotoInput.current?.click()}>📷</button>
                </>}
              </div>
              <div className={styles.profilePlanBadge}>{selectedPlan === "Supreme" ? "♛ Supreme Plan" : `${selectedPlan} Plan`}</div>
              <div className={styles.identityCard}><div className={styles.identityTitle}>🪶 Your KOYAL Identity</div><p>Your profile helps Koyal personalize your experience. Supreme members have animated wings around their photo.</p></div>
            </div>
            <div className={styles.profileFields}>
              <label><span>♙ Name</span><input value={draftProfile.name} disabled={!editingProfile} placeholder="Your name" onChange={(e) => setDraftProfile((old) => ({ ...old, name: e.target.value }))} /></label>
              <label><span>⚥ Gender</span><select value={draftProfile.gender} disabled={!editingProfile} onChange={(e) => setDraftProfile((old) => ({ ...old, gender: e.target.value }))}>
                <option value="">Select gender</option><option value="Male">Male</option><option value="Female">Female</option><option value="Non-binary">Non-binary</option><option value="Prefer not to say">Prefer not to say</option><option value="Other">Other</option>
              </select></label>
              <label><span>♧ Phone No</span><input type="tel" inputMode="tel" autoComplete="tel" disabled={!editingProfile} value={draftProfile.phone} placeholder="+91 98765 43210" onChange={(e) => setDraftProfile((old) => ({ ...old, phone: e.target.value }))} /></label>
              <label><span>▦ DOB</span><input type="date" max={new Date().toISOString().slice(0,10)} disabled={!editingProfile} value={draftProfile.dob} onChange={(e) => setDraftProfile((old) => ({ ...old, dob: e.target.value }))} /></label>
              {profileError && <p className={styles.profileError} role="alert">{profileError}</p>}
              {editingProfile && <button type="button" className={styles.saveProfileButton} onClick={saveProfile}>Save Profile</button>}
              <p className={styles.profilePrivacy}>Profile information and photos are saved only in this browser in this version.</p>
            </div>
          </div>
      </div>}
            {!profileOpen && !memoryOpen && !tasksOpen && <div className={styles.chatScroll}>
              <div className={styles.messages}>
                {visibleMessages.length === 0 && <div className={styles.noResults}>No matching messages found.</div>}
                {visibleMessages.map((message, index) => <div key={`${index}-${message.role}`} className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : styles.assistantRow}`}>
                  {message.role === "assistant" && <span className={styles.messageAvatar}><img src="/koyal-bird.png" alt="Koyal"/></span>}
                  <div className={styles.messageGroup}>
                    <div className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                      {message.fileName && <div className={styles.fileLabel}><Icon name="paperclip" size={14}/>{message.fileName}</div>}
                      <span>{message.content}</span>
                      <div className={styles.bubbleFooter}><time>{message.time || ""}</time></div>
                    </div>
                    {message.role === "assistant" && Boolean(message.sources?.length) && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 4px 4px" }} aria-label="Web sources">
                      {message.sources?.filter((source) => /^https?:\/\//i.test(source.url)).map((source, sourceIndex) => <a key={source.url + sourceIndex} href={source.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%", padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,71,109,.3)", color: "inherit", fontSize: 12, textDecoration: "none", overflowWrap: "anywhere" }}>{source.title || "Source"} ↗</a>)}
                    </div>}
                    {message.role === "assistant" && <button type="button" className={styles.listen} title="Read this message aloud" onClick={() => speakMessage(message.content,index)}><Icon name={speakingIndex === index ? "stop" : "volume"} size={15}/>{speakingIndex === index ? "Stop" : "Listen"}</button>}
                  </div>
                  {message.role === "user" && <span className={`${styles.messageAvatar} ${styles.userAvatar}`}><Icon name="user" size={23}/></span>}
                </div>)}
                {loading && <div className={styles.messageRow}><span className={styles.messageAvatar}><img src="/koyal-bird.png" alt=""/></span><div className={styles.loadingBubble}><span/><span/><span/> Koyal is thinking...</div></div>}
                {pendingMemorySuggestion && !loading && <div role="status" aria-live="polite" style={{ margin: "12px 42px 16px", padding: "14px 16px", border: "1px solid rgba(255,71,109,.38)", borderRadius: 16, background: "rgba(255,71,109,.08)", maxWidth: 520 }}>
                  <strong style={{ display: "block", marginBottom: 6 }}>Should I remember this?</strong>
                  <p style={{ margin: "0 0 12px", overflowWrap: "anywhere" }}>{pendingMemorySuggestion}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button type="button" className={styles.saveProfileButton} onClick={saveSuggestedMemory}>Yes, remember</button>
                    <button type="button" className={styles.editProfileButton} onClick={() => setPendingMemorySuggestion("")}>Not now</button>
                  </div>
                  <small style={{ display: "block", marginTop: 8, opacity: .75 }}>Nothing is saved unless you choose “Yes, remember”.</small>
                </div>}
                <div ref={bottomRef} />
              </div>
            </div>}
          </section>

          {!profileOpen && !memoryOpen && !tasksOpen && <div className={styles.bottomArea}>
            <div className={styles.effortCard}>
              <div className={styles.effortHeading}>Thinking Effort</div>
              <button className={styles.thinkingLabel} type="button" onClick={() => changeThinking((indexThinking + 1) % thinking.length)} title="Click to change thinking level"><span>{selectedPlan === "Supreme" ? "∞" : currentThinking.feathers}</span><span className={styles.featherSymbol}>🪶</span><strong>{currentThinking.name}</strong><Icon name="chevron" size={14}/></button>
              <div className={styles.sliderOuter}>
                <div className={styles.sliderTrack}><div className={styles.sliderFilled} style={{ width: `${indexThinking/6*100}%` }}/>{thinking.map((item,index) => <span key={item.id} className={styles.sliderMark} style={{ left: `${index/6*100}%` }}/>)}</div>
                <div className={styles.birdThumb} style={{ left: `${indexThinking/6*100}%` }}><img src="/koyal-bird.png" alt=""/></div>
                <input className={styles.sliderInput} aria-label={`Thinking effort: ${currentThinking.name}`} type="range" min={0} max={6} step={1} value={indexThinking} onChange={(event) => changeThinking(Number(event.target.value))} />
              </div>
            </div>
            <form className={styles.composer} onSubmit={sendMessage}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "0 12px 8px" }}>
                <button type="button" aria-pressed={webSearchEnabled} onClick={() => setWebSearchEnabled((enabled) => !enabled)} style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "7px 12px", border: webSearchEnabled ? "1px solid rgba(255,71,109,.8)" : "1px solid var(--border, rgba(150,150,150,.3))", background: webSearchEnabled ? "rgba(255,71,109,.13)" : "transparent", color: "inherit", fontSize: 12, cursor: "pointer" }}>
                  <Icon name="search" size={15}/> Web Search {webSearchEnabled ? "On" : "Off"}
                </button>
                {webSearchEnabled && <small style={{ opacity: .7 }}>Searches current web sources. Uses Gemini online.</small>}
                <button type="button" aria-pressed={urlReaderEnabled} onClick={() => setUrlReaderEnabled((enabled) => !enabled)} style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "7px 12px", border: urlReaderEnabled ? "1px solid rgba(255,71,109,.8)" : "1px solid var(--border, rgba(150,150,150,.3))", background: urlReaderEnabled ? "rgba(255,71,109,.13)" : "transparent", color: "inherit", fontSize: 12, cursor: "pointer" }}>
                  ↗ Read URL {urlReaderEnabled ? "On" : "Off"}
                </button>
                {urlReaderEnabled && <small style={{ opacity: .7 }}>Paste a public webpage link. Uses Gemini URL Context.</small>}
              </div>
              {urlReaderEnabled && <div style={{ padding: "0 12px 10px" }}>
                <input type="url" aria-label="Webpage URL to read" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="https://example.com/article" maxLength={2048} required style={{ width: "100%", minWidth: 0, borderRadius: 12, border: "1px solid var(--border, rgba(150,150,150,.3))", padding: "11px 13px", background: "transparent", color: "inherit", font: "inherit", fontSize: 13 }} />
              </div>}
              {fileError && <p role="alert" style={{ margin: "0 12px 8px", color: "#ff647c", fontSize: 12 }}>{fileError}</p>}
              {selectedFile && <div className={styles.attachment}><Icon name="paperclip" size={16}/>{selectedFile.name}<small style={{ opacity: .7 }}>PDF text is extracted locally; scanned PDFs and images use Gemini</small><button type="button" aria-label="Remove attachment" onClick={() => {setSelectedFile(null);setFileError("");if(fileInput.current)fileInput.current.value="";}}><Icon name="x" size={14}/></button></div>}
              <div className={styles.composerRow}>
                <input ref={fileInput} type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" hidden onChange={handleFile}/>
                <button type="button" className={styles.attachmentButton} title="Attach a PDF or image" aria-label="Attach a PDF or image" onClick={() => fileInput.current?.click()}><Icon name="paperclip" size={24}/></button>
                <textarea value={input} placeholder={teacherMode ? `Ask your Class ${teacherClass} ${teacherSubject} teacher...` : characterMode !== "normal" ? `Message ${currentCharacter.name}...` : "Message Koyal..."} rows={1} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/>
                <div className={styles.voiceButton}><VoiceMode subscriptionPlan={selectedPlan}/></div>
                <button type="submit" className={styles.sendButton} disabled={loading || (!input.trim() && !selectedFile && !(urlReaderEnabled && urlInput.trim()))} title="Send message" aria-label="Send message"><Icon name="send" size={22}/></button>
              </div>
            </form>
          </div>}
        </section>
      </div>

      {featherShopOpen && <div className={styles.modalOverlay} onClick={() => setFeatherShopOpen(false)}><div className={styles.featherModal} role="dialog" aria-modal="true" aria-label="Feather store" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2>🪶 Feather Store</h2><button type="button" aria-label="Close feather store" onClick={() => setFeatherShopOpen(false)}><Icon name="x"/></button></div>
        <p className={styles.featherBalanceLine}>Current balance: <strong>{selectedPlan === "Supreme" ? "∞ Unlimited feathers" : `${feathers.toLocaleString("en-IN")} feathers`}</strong></p>
        <p className={styles.demoNotice}>Prices are shown in INR. Payment checkout is not connected, so these buttons will not take payment or add feathers.</p>
        <div className={styles.packGrid}>{FEATHER_PACKS.map((pack) => <div className={styles.pack} key={pack.quantity}>
          <div className={styles.packCount}>🪶 {pack.quantity.toLocaleString("en-IN")}</div><div className={styles.packPrice}>₹{pack.rupees}</div><small>₹0.50 per feather</small>
          <button type="button" onClick={() => requestFeatherPurchase(pack.quantity,pack.rupees)}>View purchase</button>
        </div>)}</div>
        <div className={styles.customPack}><div><strong>Custom feather amount</strong><p>₹0.50 per feather</p></div>
          <label>Feathers <input type="number" min="1" max="100000" step="1" value={customFeathers} onChange={(e) => setCustomFeathers(e.target.value)} /></label>
          <div className={styles.customTotal}>₹{(Math.max(0,Number(customFeathers) || 0) * PRICE_PER_FEATHER).toLocaleString("en-IN",{maximumFractionDigits:2})}</div>
          <button type="button" onClick={() => requestFeatherPurchase(Number(customFeathers), Number(customFeathers) * PRICE_PER_FEATHER)}>View purchase</button>
        </div>
        {purchaseNotice && <div className={styles.purchaseNotice} role="status">{purchaseNotice}</div>}
      </div></div>}
      {subscriptionOpen && <div className={styles.modalOverlay} onClick={() => setSubscriptionOpen(false)}><div className={styles.modal} role="dialog" aria-modal="true" aria-label="Subscription plans" onClick={(e) => e.stopPropagation()}><div className={styles.modalHead}><h2>KOYAL Plans</h2><button onClick={() => setSubscriptionOpen(false)} type="button"><Icon name="x"/></button></div><p className={styles.demoNotice}>Demo plan selector only. Selecting Supreme locally shows unlimited feathers and wings, but does not activate a paid subscription. Production subscriptions require server-side payment verification.</p><div className={styles.planGrid}>{plans.map((plan) => <div key={plan.name} className={`${styles.planCard} ${selectedPlan === plan.name ? styles.planCurrent : ""}`}><h3>{plan.name}</h3><div className={styles.price}>₹{plan.price}<small>/mo</small></div><p>{plan.description}</p><button type="button" onClick={() => selectPlan(plan.name)}>{selectedPlan === plan.name ? "Selected" : "Select demo plan"}</button></div>)}</div></div></div>}
    </main>
  );
}

export default function Home() {
  return <AuthGate><KoyalApp /></AuthGate>;
}

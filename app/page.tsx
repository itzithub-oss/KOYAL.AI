"use client";

import { ChangeEvent, FormEvent, Fragment, useEffect, useRef, useState } from "react";
import VoiceMode from "./components/VoiceMode";
import AuthGate from "./components/AuthGate";
import BootScreen from "./components/BootScreen";
import WingedAvatar from "./components/WingedAvatar";
import styles from "./koyal-final.module.css";

import { addMemory, buildMemoryContext, deleteMemory, loadMemories, suggestMemoryFromMessage, type KoyalMemory } from "../lib/koyal-memory.mjs";
import { addTask, deleteTask, loadTasks, updateTask, type KoyalTask } from "../lib/koyal-tasks.mjs";
import { getDailyThought } from "../lib/daily-thoughts.mjs";
import { ACTIVE_CHAT_KEY, createChatSession, readChatHistory, saveChatHistory, searchChatSessions, upsertChatSession } from "../lib/koyal-chat-history.mjs";

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget?: string }) => Promise<unknown>;
    };
  }
}

type PublicAnnouncement = { id: string; title: string; message: string; priority: "normal" | "urgent"; created_at: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  time?: string;
  sources?: { title: string; url: string }[];
};
type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";
type CharacterMode =
  | "normal" | "mother" | "father" | "school-friend" | "college-friend" | "adult-friend"
  | "school-female-friend" | "business-partner" | "enemy";
type ThinkingEffort =
  | "just" | "let-it" | "care" | "high" | "ultra-high" | "elite" | "supreme";
type ChatApiResponse = { reply?: string; error?: string; debug?: { requestKind?: string; errorName?: string; status?: unknown; message?: string }; sources?: { title: string; url: string }[] };
type ChatQueueJob = { message: string; originalText: string; attachment: File | null; urlContextUrl?: string; systemDetails: string; mode: string; thinkingLevel: string; subscriptionPlan: string; name: string; characterMode: string; teacherMode: boolean; teacherClass: string; teacherSubject: string; studyMode: boolean; studyFocus: string; preciseMode: boolean; philosophicalMode: boolean; webSearch: boolean; featherCost: number };
type Profile = { name: string; gender: string; phone: string; dob: string; photo: string };
type FindUpBusiness = { id: string; name: string; category: string; description: string; contactName?: string; location: string; startingPrice?: string; operatorName?: string; phone?: string; email?: string; website?: string; professionalName?: string; qualifications?: string[]; experience?: string; services?: string[]; serviceHours?: string; };
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
  | "arrow" | "copy" | "memory" | "tasks" | "graduation" | "code";

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
    code: <><path d="m8 17-5-5 5-5m8 10 5-5-5-5m-3-7-2 20"/></>,
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

function renderMessageContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(content)) !== null) {
    if (match.index > cursor) parts.push(content.slice(cursor, match.index));

    let url = match[2] || match[3];
    let label = match[1] || url;
    let trailing = "";
    if (!match[2]) {
      trailing = url.match(/[.,!?;:]+$/)?.[0] || "";
      url = url.slice(0, url.length - trailing.length);
      label = url;
    }

    if (url) {
      parts.push(
        <a
          key={`message-link-${match.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#ff6685", textDecoration: "underline", textUnderlineOffset: 3, overflowWrap: "anywhere" }}
        >
          {label}
        </a>
      );
    }
    if (trailing) parts.push(trailing);
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) parts.push(content.slice(cursor));
  return <>{parts.map((part, index) => <Fragment key={index}>{part}</Fragment>)}</>;
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
  const [queuedCount, setQueuedCount] = useState(0);
  const [queuedQuestions, setQueuedQuestions] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanName>("Just");
  const [feathers, setFeathers] = useState(257);
  const [thinkingId, setThinkingId] = useState<ThinkingEffort>("just");
  const [thinkingEffortOpen, setThinkingEffortOpen] = useState(false);
  const [characterMode, setCharacterMode] = useState<CharacterMode>("normal");
  const [characterOpen, setCharacterOpen] = useState(true);
  const [friendSubcategoryOpen, setFriendSubcategoryOpen] = useState(false);
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
  const [rateReviewOpen, setRateReviewOpen] = useState(false);
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
  const [downloadAppOpen, setDownloadAppOpen] = useState(false);
  const [findUpOpen, setFindUpOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [travelTab, setTravelTab] = useState<"planner" | "agencies">("planner");
  const [tripDestination, setTripDestination] = useState("");
  const [tripStartDate, setTripStartDate] = useState("");
  const [tripEndDate, setTripEndDate] = useState("");
  const [tripTravellers, setTripTravellers] = useState("2");
  const [tripBudget, setTripBudget] = useState("");
  const [tripStyle, setTripStyle] = useState("Balanced");
  const [tripPlan, setTripPlan] = useState("");
  const [tripPlanLoading, setTripPlanLoading] = useState(false);
  const [tripPlanError, setTripPlanError] = useState("");
  const [tripDetailsEditing, setTripDetailsEditing] = useState(false);
  const [travelAgencyQuery, setTravelAgencyQuery] = useState("");
  const [travelAgencyResults, setTravelAgencyResults] = useState<FindUpBusiness[]>([]);
  const [travelAgencyLoading, setTravelAgencyLoading] = useState(false);
  const [travelAgencySearched, setTravelAgencySearched] = useState(false);
  const [travelAgencyError, setTravelAgencyError] = useState("");
  const [findUpQuery, setFindUpQuery] = useState("");
  const [findUpResults, setFindUpResults] = useState<FindUpBusiness[]>([]);
  const [findUpLoading, setFindUpLoading] = useState(false);
  const [findUpSearched, setFindUpSearched] = useState(false);
  const [findUpError, setFindUpError] = useState("");
  const [dailyHubOpen, setDailyHubOpen] = useState(false);
  const [dailyThought, setDailyThought] = useState(() => getDailyThought(0));
  const [chatSummary, setChatSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryChatId, setSummaryChatId] = useState("");
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
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponNotice, setCouponNotice] = useState("");
  const profilePhotoInput = useRef<HTMLInputElement>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [subscriptionNotice, setSubscriptionNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [publicAnnouncements, setPublicAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [lightMode, setLightMode] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeModeOpen, setCodeModeOpen] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState("TypeScript");
  const [codePrompt, setCodePrompt] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const chatQueueRef = useRef<ChatQueueJob[]>([]);
  const processingQueueRef = useRef(false);
  const conversationContextRef = useRef<Message[]>([WELCOME]);
  const chatSessionsRef = useRef<ChatSession[]>([]);
  const currentThinking = thinking.find((option) => option.id === thinkingId) || thinking[3];
  const indexThinking = thinking.findIndex((option) => option.id === thinkingId);
  const currentCharacter = characters.find((character) => character.id === characterMode) || characters[0];
  const isAdminAccount = accountEmail.trim().toLowerCase() === "koyalaiindia@gmail.com";
  const effectivePlan: PlanName = isAdminAccount ? "Supreme" : selectedPlan;
  const discountedThinkingIds: string[] = effectivePlan === "Let It" ? ["let-it"] : effectivePlan === "Care" ? ["let-it", "care"] : effectivePlan === "Elite" ? ["let-it", "care", "high", "ultra-high", "elite"] : [];
  const featherCost = effectivePlan === "Supreme" ? 0 : discountedThinkingIds.includes(thinkingId) ? currentThinking.feathers * 0.5 : currentThinking.feathers;
  const visibleMessages = search.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages;
  const visibleChatSessions = searchChatSessions(chatSessions, historyQuery);

  useEffect(() => {
    const syncAccountEmail = () => {
      try {
        const session = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
        setAccountEmail(typeof session?.user?.email === "string" ? session.user.email : "");
      } catch { setAccountEmail(""); }
    };
    syncAccountEmail();
    window.addEventListener("koyal-account-signed-in", syncAccountEmail);
    window.addEventListener("koyal-account-signed-out", syncAccountEmail);
    return () => {
      window.removeEventListener("koyal-account-signed-in", syncAccountEmail);
      window.removeEventListener("koyal-account-signed-out", syncAccountEmail);
    };
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const saved = JSON.parse(localStorage.getItem("koyal-ai-dismissed-announcements") || "[]");
      if (Array.isArray(saved)) setDismissedAnnouncements(saved.filter((id): id is string => typeof id === "string"));
    } catch { /* Ignore invalid dismissal state. */ }

    const loadAnnouncements = async () => {
      try {
        const response = await fetch("/api/announcements", { headers: getAuthHeaders(), cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (active && Array.isArray(data.announcements)) setPublicAnnouncements(data.announcements);
      } catch { /* Keep the app usable if the announcement feed is temporarily unavailable. */ }
    };
    void loadAnnouncements();
    const timer = window.setInterval(loadAnnouncements, 60_000);
    window.addEventListener("koyal-account-signed-in", loadAnnouncements);
    window.addEventListener("koyal-account-signed-out", loadAnnouncements);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("koyal-account-signed-in", loadAnnouncements);
      window.removeEventListener("koyal-account-signed-out", loadAnnouncements);
    };
  }, []);

  const dismissPublicAnnouncement = (id: string) => {
    setDismissedAnnouncements((current) => {
      const next = current.includes(id) ? current : [...current, id];
      try { localStorage.setItem("koyal-ai-dismissed-announcements", JSON.stringify(next)); } catch { /* Dismissal remains in memory. */ }
      return next;
    });
  };

  useEffect(() => {
    const refreshThought = () => setDailyThought(getDailyThought(Date.now()));
    refreshThought();
    const thoughtTimer = window.setInterval(refreshThought, 60_000);
    return () => window.clearInterval(thoughtTimer);
  }, []);

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
      setSelectedPlan("Just");
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      const userId = auth && auth.access_token && auth.user && auth.user.id ? String(auth.user.id) : "";
      const walletKey = userId ? "koyal-ai-feather-balance:" + userId : "koyal-ai-feather-balance:guest";
      const savedWallet = localStorage.getItem(walletKey);
      const legacyWallet = localStorage.getItem("koyal-ai-feather-balance");
      if (savedWallet !== null && Number.isFinite(Number(savedWallet))) setFeathers(Math.max(0, Number(savedWallet)));
      else if (userId && legacyWallet !== null && Number.isFinite(Number(legacyWallet))) {
        const migrated = Math.max(0, Number(legacyWallet));
        localStorage.setItem(walletKey, String(migrated)); setFeathers(migrated);
      } else if (userId) {
        const claimedKey = "koyal-ai-welcome-bonus-claimed:" + userId;
        if (localStorage.getItem(claimedKey) !== "true") {
          localStorage.setItem(walletKey, "150"); localStorage.setItem(claimedKey, "true"); setFeathers(150);
        } else { localStorage.setItem(walletKey, "0"); setFeathers(0); }
      } else { localStorage.setItem(walletKey, "56"); setFeathers(56); }
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
        else {
          try {
            const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
            const synced = auth?.user?.user_metadata?.koyal_profile as Partial<Profile> | undefined;
            if (synced && typeof synced === "object") {
              const valid: Profile = {
                name: typeof synced.name === "string" ? synced.name : "",
                gender: typeof synced.gender === "string" ? synced.gender : "",
                phone: typeof synced.phone === "string" ? synced.phone : "",
                dob: typeof synced.dob === "string" ? synced.dob : "",
                photo: typeof synced.photo === "string" ? synced.photo : "",
              };
              setProfile(valid);
              localStorage.setItem("koyal-ai-profile-v2", JSON.stringify(valid));
            }
          } catch { /* Ignore malformed account profile metadata. */ }
        }
      }
    } catch {
      // Ignore invalid local data and keep defaults.
    }
    loadedRef.current = true;
    const bootTimer = window.setTimeout(() => setBooting(false), 2500);
    return () => window.clearTimeout(bootTimer);
  }, []);
  useEffect(() => {
    let active = true;
    async function syncServerWallet() {
      try {
        const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
        if (!auth?.access_token || !auth?.user?.id) return;
        const response = await fetch("/api/payments/wallet", {
          credentials: "omit",
          headers: { Authorization: `Bearer ${auth.access_token}` },
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        const balance = Math.max(0, Number(data.balance) || 0);
        if (active) setFeathers(balance);
        localStorage.setItem("koyal-ai-feather-balance:" + auth.user.id, String(balance));
      } catch {
        // Keep the last displayed value if the server is temporarily unavailable.
      }
    }
    void syncServerWallet();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function syncSubscription() {
      try {
        const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
        if (!auth?.access_token || !auth?.user?.id) return;
        const response = await fetch("/api/payments/subscription", { credentials: "omit", headers: { Authorization: `Bearer ${auth.access_token}` }, cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const validPlans: PlanName[] = ["Just", "Let It", "Care", "Elite", "Supreme"];
        const plan: PlanName = validPlans.includes(data.plan) ? data.plan : "Just";
        if (!active) return;
        setSelectedPlan(plan);
        localStorage.setItem("koyal-ai-subscription-plan", plan);
        if (data.expiresAt) localStorage.setItem("koyal-ai-subscription-expires-at", String(Date.parse(data.expiresAt)));
        else localStorage.removeItem("koyal-ai-subscription-expires-at");
        if (plan === "Supreme") setThinkingId("supreme");
      } catch { /* Keep the last confirmed plan if the server is temporarily unavailable. */ }
    }
    const handleSignIn = () => { void syncSubscription(); };
    window.addEventListener("koyal-account-signed-in", handleSignIn);
    void syncSubscription();
    return () => {
      active = false;
      window.removeEventListener("koyal-account-signed-in", handleSignIn);
    };
  }, []);

  useEffect(() => {
    const resetAccountProfile = () => {
      setProfile(EMPTY_PROFILE);
      setDraftProfile(EMPTY_PROFILE);
      setEditingProfile(false);
      setProfileError("");
      setSelectedPlan("Just");
      const guestWallet = Number(localStorage.getItem("koyal-ai-feather-balance:guest"));
      const guestBalance = Number.isFinite(guestWallet) && localStorage.getItem("koyal-ai-feather-balance:guest") !== null ? Math.max(0, guestWallet) : 56;
      localStorage.setItem("koyal-ai-feather-balance:guest", String(guestBalance));
      setFeathers(guestBalance);
      setSubscriptionOpen(false);
      setFeatherShopOpen(false);
    };
    window.addEventListener("koyal-account-signed-out", resetAccountProfile);
    return () => window.removeEventListener("koyal-account-signed-out", resetAccountProfile);
  }, []);

  useEffect(() => {
    if (!processingQueueRef.current && chatQueueRef.current.length === 0) conversationContextRef.current = messages;
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
    setCodeModeOpen(false);
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
    if (option.id === "supreme" && effectivePlan !== "Supreme") {
      if (requireSignIn("access subscription plans")) setSubscriptionOpen(true);
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
  function getAuthHeaders(): Record<string, string> {
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      return typeof auth?.access_token === "string" && auth.access_token ? { Authorization: `Bearer ${auth.access_token}` } : {};
    } catch { return {}; }
  }
  function walletStorageKey() {
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      return auth?.access_token && auth?.user?.id ? "koyal-ai-feather-balance:" + String(auth.user.id) : "koyal-ai-feather-balance:guest";
    } catch { return "koyal-ai-feather-balance:guest"; }
  }
  function isSignedIn() {
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      return Boolean(auth?.access_token && auth?.user?.id);
    } catch { return false; }
  }
  function requireSignIn(feature: string) {
    if (isSignedIn()) return true;
    window.alert(`Please log in or create a KOYAL account to ${feature}.`);
    return false;
  }
  function openProfile() {
    if (!requireSignIn("create or edit your profile")) return;
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
  async function saveProfile() {
    if (!requireSignIn("save your profile")) return;
    const name = draftProfile.name.trim();
    const digits = draftProfile.phone.replace(/\D/g, "");
    if (!name) { setProfileError("Please enter your name."); return; }
    if (draftProfile.phone && (digits.length < 7 || digits.length > 15)) {
      setProfileError("Enter a valid phone number (7–15 digits)."); return;
    }
    if (draftProfile.dob && draftProfile.dob > new Date().toISOString().slice(0, 10)) {
      setProfileError("Date of birth cannot be in the future."); return;
    }

    setProfileError("Saving your profile...");
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!auth?.access_token || !auth?.user?.id || !supabaseUrl || !supabaseKey) {
        throw new Error("Please sign in again before saving your profile.");
      }

      let photoUrl = draftProfile.photo || "";
      if (photoUrl.startsWith("data:image/")) {
        const imageResponse = await fetch(photoUrl);
        const imageBlob = await imageResponse.blob();
        const mime = imageBlob.type.toLowerCase();
        const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const objectPath = `${auth.user.id}/profile.${extension}`;
        const uploadResponse = await fetch(
          `${supabaseUrl}/storage/v1/object/koyal-profile-photos/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
          {
            method: "POST",
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${auth.access_token}`,
              "Content-Type": mime,
              "x-upsert": "true",
            },
            body: imageBlob,
          },
        );
        if (!uploadResponse.ok) {
          const detail = await uploadResponse.text().catch(() => "");
          throw new Error(detail || "Could not upload your profile photo to Supabase Storage.");
        }
        photoUrl = `${supabaseUrl}/storage/v1/object/public/koyal-profile-photos/${objectPath}?v=${Date.now()}`;
      }

      const saved = { ...draftProfile, name, photo: photoUrl };
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${auth.access_token}`,
        },
        body: JSON.stringify({ data: { koyal_profile: saved } }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || "Account profile sync failed.");
      }
      const updatedUser = await response.json();
      localStorage.setItem("koyal-ai-auth-session", JSON.stringify({ ...auth, user: updatedUser }));
      localStorage.setItem("koyal-ai-profile-v2", JSON.stringify(saved));
      localStorage.setItem("koyal-ai-profile-name", name);
      setProfile(saved);
      setDraftProfile(saved);
      setEditingProfile(false);
      setProfileError("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not save your profile. Please try again.");
    }
  }
  function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) {
      setProfileError("Choose a JPG, PNG, or WebP photo."); return;
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
    if (!requireSignIn("buy feathers")) return;
    setPurchaseNotice("");
    setCouponNotice("");
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      setCheckoutPhone(profile.phone || String(auth?.user?.user_metadata?.phone || ""));
    } catch {
      setCheckoutPhone(profile.phone || "");
    }
    setFeatherShopOpen(true);
    setMobileNav(false);
  }
  async function requestFeatherPurchase(amount: number) {
    if (!requireSignIn("buy feathers")) return;
    if (!Number.isSafeInteger(amount) || amount < 2 || amount > 100000) {
      setPurchaseNotice("Choose between 2 and 100,000 whole feathers.");
      return;
    }
    if (effectivePlan === "Supreme") {
      setPurchaseNotice("Your Supreme plan already includes unlimited feathers.");
      return;
    }
    let phoneDigits = checkoutPhone.replace(/\D/g, "");
    if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) phoneDigits = phoneDigits.slice(2);
    if (phoneDigits.length !== 10) {
      setPurchaseNotice("Enter a valid 10-digit Indian mobile number for Cashfree checkout.");
      return;
    }
    try {
      const auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null");
      if (!auth?.access_token) {
        setPurchaseNotice("Please log in again before purchasing.");
        return;
      }
      setPurchaseNotice("Creating your secure payment order…");
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token}` },
        body: JSON.stringify({ featherQuantity: amount, phone: phoneDigits }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.paymentSessionId) {
        throw new Error(result.error || "Could not start Cashfree checkout.");
      }
      if (!window.Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Cashfree checkout could not load. Please check your connection."));
          document.head.appendChild(script);
        });
      }
      if (!window.Cashfree) throw new Error("Cashfree checkout did not initialize. Please try again.");
      const cashfree = window.Cashfree({ mode: result.mode === "production" ? "production" : "sandbox" });
      setPurchaseNotice("Opening Cashfree’s secure checkout…");
      await cashfree.checkout({ paymentSessionId: result.paymentSessionId, redirectTarget: "_self" });
    } catch (error) {
      setPurchaseNotice(error instanceof Error ? error.message : "Payment could not be started. Please try again.");
    }
  }
  async function redeemCoupon() {
    const code = couponCode.trim();
    let auth: { access_token?: string; user?: { email?: string } } | null = null;
    try { auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null"); } catch { auth = null; }
    if (!auth?.access_token) {
      setCouponNotice("Please log in before redeeming a coupon.");
      return;
    }
    const normalized = code.toLowerCase();
    if (normalized === "cadet0131") {
      const email = typeof auth.user?.email === "string" ? auth.user.email.trim().toLowerCase() : "";
      if (!email) { setCouponNotice("Please log in with your email to redeem this coupon."); return; }
      const redeemedKey = `koyal-ai-redeemed-coupons:${email}`;
      let redeemed: string[] = [];
      try { redeemed = JSON.parse(localStorage.getItem(redeemedKey) || "[]"); } catch { redeemed = []; }
      if (redeemed.includes(normalized)) { setCouponNotice("This coupon has already been redeemed on this device for this email account."); return; }
      localStorage.setItem(redeemedKey, JSON.stringify([...redeemed, normalized]));
      setFeathers((current) => {
        const next = current + 180;
        localStorage.setItem(walletStorageKey(), String(next));
        return next;
      });
      setCouponNotice("Coupon applied! 180 feathers have been added.");
      setCouponCode("");
      return;
    }
    setCouponNotice("Checking coupon…");
    try {
      const response = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token}` },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Coupon could not be redeemed.");
      const plan = data.plan as PlanName;
      if (!["Let It", "Care", "Elite", "Supreme"].includes(plan)) throw new Error("The coupon response was invalid.");
      setSelectedPlan(plan);
      localStorage.setItem("koyal-ai-subscription-plan", plan);
      localStorage.setItem("koyal-ai-subscription-expires-at", String(Date.parse(data.expiresAt)));
      if (plan === "Supreme") setThinkingId("supreme");
      setCouponNotice(`Coupon applied! ${plan} is active for 1 month.`);
      setCouponCode("");
    } catch (error) {
      setCouponNotice(error instanceof Error ? error.message : "Coupon could not be redeemed. Please try again.");
    }
  }
  async function requestSubscriptionPurchase(plan: PlanName) {
    if (!requireSignIn("buy a subscription")) return;
    if (plan === "Just") {
      if (selectedPlan !== "Just") {
        setSubscriptionNotice("Your paid plan stays active until its expiry. It will not renew automatically.");
        return;
      }
      setSelectedPlan("Just"); localStorage.setItem("koyal-ai-subscription-plan", "Just");
      localStorage.removeItem("koyal-ai-subscription-expires-at"); setSubscriptionOpen(false);
      if (thinkingId === "supreme") setThinkingId("high"); return;
    }
    let auth: any = null;
    try { auth = JSON.parse(localStorage.getItem("koyal-ai-auth-session") || "null"); } catch { auth = null; }
    if (!auth?.access_token) { setSubscriptionNotice("Please log in again before purchasing."); return; }
    let phoneDigits = String(profile.phone || auth?.user?.user_metadata?.phone || checkoutPhone || "").replace(/\D/g, "");
    if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) phoneDigits = phoneDigits.slice(2);
    if (phoneDigits.length !== 10) {
      const entered = window.prompt("Enter your 10-digit Indian mobile number for Cashfree checkout:") || "";
      phoneDigits = entered.replace(/\D/g, "");
      if (phoneDigits.length === 12 && phoneDigits.startsWith("91")) phoneDigits = phoneDigits.slice(2);
    }
    if (phoneDigits.length !== 10) { setSubscriptionNotice("A valid 10-digit Indian mobile number is required."); return; }
    try {
      setSubscriptionNotice("Creating your secure subscription payment…");
      const response = await fetch("/api/payments/create-order", { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token}` }, body: JSON.stringify({ planName: plan, phone: phoneDigits }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.paymentSessionId) throw new Error(result.error || "Could not start Cashfree checkout.");
      if (!window.Cashfree) await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script"); script.src = "https://sdk.cashfree.com/js/v3/cashfree.js"; script.async = true;
        script.onload = () => resolve(); script.onerror = () => reject(new Error("Cashfree checkout could not load. Please check your connection.")); document.head.appendChild(script);
      });
      if (!window.Cashfree) throw new Error("Cashfree checkout did not initialize. Please try again.");
      const cashfree = window.Cashfree({ mode: result.mode === "production" ? "production" : "sandbox" });
      setSubscriptionNotice("Opening Cashfree’s secure checkout…");
      await cashfree.checkout({ paymentSessionId: result.paymentSessionId, redirectTarget: "_self" });
    } catch (error) { setSubscriptionNotice(error instanceof Error ? error.message : "Payment could not be started. Please try again."); }
  }
  function selectPlan(plan: PlanName) { void requestSubscriptionPurchase(plan); }
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
  async function runCodeMode() {
    if (!["Care", "Elite", "Supreme"].includes(effectivePlan)) {
      setCodeModeOpen(false); setSubscriptionOpen(true);
      setCodeError("Code Mode is available from the Care plan onwards."); return;
    }
    const prompt = codePrompt.trim();
    if (!prompt || codeLoading) return;
    setCodeLoading(true);
    setCodeError("");
    setCodeOutput("");
    try {
      const instruction = [
        "You are Koyal Code Mode, a careful senior software engineer and programming tutor.",
        "The requested programming language is " + codeLanguage + ".",
        "Understand whether the user wants code generated, explained, debugged, or improved.",
        "For code generation or fixes, return the complete, runnable code in a single code block, followed by concise setup or usage notes only when needed.",
        "For debugging, identify the likely cause and provide the corrected complete code when source is supplied.",
        "Never claim code was executed or tested unless it actually was.",
        "Preserve the user's existing framework and constraints; ask a short clarification only if essential information is missing."
      ].join(" ");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          message: instruction + "\n\nUser request:\n" + prompt,
          mode: "Code",
          thinkingLevel: currentThinking.name,
          language: "English by default",
          subscriptionPlan: effectivePlan,
          name: profile.name,
          preciseMode: true,
          webSearch: false
        })
      });
      const data: ChatApiResponse = await response.json();
      if (data.debug) console.error("[KOYAL CODE MODE DEBUG]", data.debug);
      if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) {
        throw new Error(data.error || "Koyal could not generate code. Please try again.");
      }
      setCodeOutput(data.reply);
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "Code Mode is temporarily unavailable.");
    } finally {
      setCodeLoading(false);
    }
  }

  async function processChatQueue() {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;
    setLoading(true);
    try {
      while (chatQueueRef.current.length > 0) {
        const job = chatQueueRef.current.shift()!;
        setQueuedCount(chatQueueRef.current.length);
        setQueuedQuestions(chatQueueRef.current.map((queued) => queued.message));
        setMessages((old) => [...old, { role: "user", content: job.message, fileName: job.attachment?.name, time: timestamp() }]);
        const history = conversationContextRef.current
          .filter((entry) => (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string")
          .map((entry) => ({ role: entry.role, content: entry.content })).slice(-20);
        conversationContextRef.current = [...conversationContextRef.current, { role: "user", content: job.message }];
        const requestPayload = {
          message: `${job.message}\n\n${job.systemDetails}`, history, mode: job.mode,
          thinkingLevel: job.thinkingLevel, language: "English by default", subscriptionPlan: job.subscriptionPlan,
          name: job.name, characterMode: job.characterMode, teacherMode: job.teacherMode,
          teacherClass: job.teacherClass, teacherSubject: job.teacherSubject, studyMode: job.studyMode,
          studyClass: job.teacherClass, studySubject: job.teacherSubject, studyFocus: job.studyFocus,
          preciseMode: job.preciseMode, philosophicalMode: job.philosophicalMode,
          webSearch: job.webSearch, urlContextUrl: job.urlContextUrl,
        };
        try {
          let requestBody: BodyInit;
          let requestHeaders: HeadersInit | undefined;
          if (job.attachment) {
            const formData = new FormData();
            for (const [key, value] of Object.entries(requestPayload)) {
              if (value !== undefined && value !== null) formData.append(key, key === "history" ? JSON.stringify(value) : String(value));
            }
            formData.append("file", job.attachment);
            requestHeaders = getAuthHeaders();
            requestBody = formData;
          } else {
            requestHeaders = { "Content-Type": "application/json", ...getAuthHeaders() };
            requestBody = JSON.stringify(requestPayload);
          }
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: requestHeaders,
            body: job.attachment ? requestBody : JSON.stringify({ ...requestPayload, stream: true }),
          });
          let finalReply = "";
          let finalSources: { title: string; url: string }[] = [];
          if (response.ok && response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
            const placeholder: Message = { role: "assistant", content: "", time: timestamp() };
            setMessages((old) => [...old, placeholder]);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const events = buffer.split("\n\n");
              buffer = events.pop() || "";
              for (const event of events) {
                const line = event.split("\n").find((item) => item.startsWith("data: "));
                if (!line) continue;
                const payload = JSON.parse(line.slice(6)) as { type: string; text?: string; reply?: string; sources?: { title: string; url: string }[]; message?: string };
                if (payload.type === "delta" && payload.text) {
                  finalReply += payload.text;
                  setMessages((old) => old.map((item, index) => index === old.length - 1 && item.role === "assistant" ? { ...item, content: finalReply } : item));
                } else if (payload.type === "done") {
                  finalReply = payload.reply || finalReply;
                  finalSources = Array.isArray(payload.sources) ? payload.sources : [];
                } else if (payload.type === "error") {
                  throw new Error(payload.message || ERROR_REPLY);
                }
              }
            }
            if (!finalReply.trim()) throw new Error(ERROR_REPLY);
          } else {
            const data: ChatApiResponse = await response.json();
            if (data.debug) console.error("[KOYAL API DEBUG]", data.debug);
            if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) throw new Error(ERROR_REPLY);
            finalReply = data.reply;
            finalSources = Array.isArray(data.sources) ? data.sources : [];
          }
          const assistantMessage: Message = { role: "assistant", content: finalReply, time: timestamp(), sources: finalSources };
          conversationContextRef.current = [...conversationContextRef.current, assistantMessage];
          setMessages((old) => old[old.length - 1]?.role === "assistant"
            ? [...old.slice(0, -1), assistantMessage]
            : [...old, assistantMessage]);
          setPendingMemorySuggestion(suggestMemoryFromMessage(job.originalText, memories));
          if (job.featherCost > 0) setFeathers((old) => {
            const value = Math.max(0, old - job.featherCost);
            localStorage.setItem(walletStorageKey(), String(value));
            return value;
          });
        } catch {
          const errorMessage: Message = { role: "assistant", content: ERROR_REPLY, time: timestamp() };
          conversationContextRef.current = [...conversationContextRef.current, errorMessage];
          setPendingMemorySuggestion("");
          setMessages((old) => {
            if (old[old.length - 1]?.role === "assistant" && old[old.length - 1]?.content === "") return [...old.slice(0, -1), errorMessage];
            if (old[old.length - 1]?.role === "assistant" && old[old.length - 1]?.content) return [...old.slice(0, -1), errorMessage];
            return [...old, errorMessage];
          });
        }
      }
    } finally {
      processingQueueRef.current = false;
      setLoading(false);
      setQueuedCount(0);
      setQueuedQuestions([]);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    const attachment = selectedFile;
    if (!text && !attachment && !(urlReaderEnabled && urlInput.trim())) return;
    if (studyMode && !["Care", "Elite", "Supreme"].includes(effectivePlan)) {
      setStudyMode(false); setSubscriptionOpen(true); return;
    }
    if (featherCost > feathers) { openFeatherShop(); return; }
    const message = text || (attachment ? (attachment.type === "application/pdf" ? "Please summarize the attached PDF." : "Please describe and read the attached image.") : urlReaderEnabled ? "Please summarize this webpage." : "Please help me with this attachment.");
    const systemDetails = [
      "Your name is Koyal. Keep your identity in the background; do not introduce yourself or say \"I am Koyal\" in ordinary replies. Only state your name when the user directly asks who you are, what your name is, or requests an introduction.",
      "Reply in English by default; use Hindi or another language only when explicitly requested.",
      characterMode !== "normal" ? `Character mode: ${currentCharacter.name}.` : "",
      teacherMode ? `Teacher mode: Class ${teacherClass}, ${teacherSubject}.` : "",
      studyMode ? `Study Mode: tutor me at Class ${teacherClass} level in ${teacherSubject}. Focus: ${studyFocus}.` : "",
      philosophicalMode ? "Philosophical mode: provide thoughtful reasoning." : "",
      buildMemoryContext(memories),
    ].filter(Boolean).join(" ");
    const job: ChatQueueJob = {
      message, originalText: text, attachment, urlContextUrl: urlReaderEnabled ? urlInput.trim() : undefined,
      systemDetails, mode: teacherMode ? "Teacher" : philosophicalMode ? "Philosophical" : preciseMode ? "Precise" : "Normal",
      thinkingLevel: currentThinking.name, subscriptionPlan: effectivePlan, name: profile.name, characterMode,
      teacherMode, teacherClass, teacherSubject, studyMode, studyFocus, preciseMode, philosophicalMode,
      webSearch: webSearchEnabled, featherCost,
    };
    chatQueueRef.current.push(job);
    setQueuedCount(chatQueueRef.current.length);
    setQueuedQuestions(chatQueueRef.current.map((queued) => queued.message));
    setInput("");
    setSelectedFile(null);
    if (fileInput.current) fileInput.current.value = "";
    if (!processingQueueRef.current) void processChatQueue();
  }

  async function summarizeCurrentChat() {
    if (summaryLoading) return;
    const conversation = messages.filter((entry) =>
      (entry.role === "user" || entry.role === "assistant") &&
      typeof entry.content === "string" &&
      entry.content.trim() &&
      !(entry.role === "assistant" && entry.content === WELCOME.content)
    );
    if (!conversation.some((entry) => entry.role === "user")) {
      setSummaryError("Start a conversation with Koyal first, then come back to summarise it.");
      setChatSummary("");
      setSummaryChatId(activeChatId);
      return;
    }

    setSummaryLoading(true);
    setSummaryError("");
    setChatSummary("");
    setSummaryChatId(activeChatId);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          message: "Summarise the conversation provided in the chat history. Write a concise summary in 3–5 short bullet points. Capture the main topics, important information, decisions or preferences, and any agreed next steps. Use only information actually present in the conversation. Do not invent details, do not add a greeting, and do not answer the original questions again.",
          history: conversation.slice(-80).map((entry) => ({
            role: entry.role,
            content: entry.content.slice(0, 5000),
          })),
          mode: "Normal",
          thinkingLevel: "Just",
          language: "English by default",
          subscriptionPlan: "Just",
          characterMode: "normal",
          teacherMode: false,
          preciseMode: false,
          philosophicalMode: false,
          webSearch: false,
        }),
      });
      const data: ChatApiResponse = await response.json();
      if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) {
        throw new Error("Koyal couldn't summarise this chat right now. Please try again.");
      }
      setChatSummary(data.reply.trim());
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "Unable to summarise this chat. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
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
            <div className={styles.credits}>Brought to you by<br/><strong>Divyansh Acharjee, Tejas Raj &amp; Kavya Patel</strong></div>
            <div className={styles.credits}>A product of <strong>Enrapture Philia PVT Ltd.</strong></div>
          </div>
          {isAdminAccount && <button type="button" onClick={() => { window.location.assign("/admin"); closeSidebar(); }} className={styles.adminNavButton}><Icon name="diamond"/><strong>Admin Panel</strong><span>›</span></button>}
          <nav className={styles.nav} aria-label="Koyal features">
            <button type="button" onClick={resetChat} className={`${styles.navItem} ${styles.navMain}`}><Icon name="chat"/><strong>New Chat</strong></button>
            <button type="button" onClick={openChatHistory} className={`${styles.navItem} ${historyOpen ? styles.navOn : ""}`}><Icon name="chat"/>Chat History<span className={styles.navSmall}>{chatSessions.length}</span></button>
            <button type="button" onClick={openProfile} className={`${styles.navItem} ${profileOpen ? styles.navOn : ""}`}><Icon name="user"/>Profile</button>
            <button type="button" onClick={openMemory} className={`${styles.navItem} ${memoryOpen ? styles.navOn : ""}`}><Icon name="memory"/>Memory<span className={styles.navSmall}>{memories.length}</span></button>
            <button type="button" onClick={openTasks} className={`${styles.navItem} ${tasksOpen ? styles.navOn : ""}`}><Icon name="tasks"/>Tasks<span className={styles.navSmall}>{tasks.filter((task) => !task.done).length}</span></button>
            <button type="button" onClick={() => { setFindUpOpen(true); setTravelOpen(false); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setRateReviewOpen(false); setDailyHubOpen(false); setCodeModeOpen(false); setHistoryOpen(false); closeSidebar(); }} className={`${styles.navItem} ${findUpOpen ? styles.navOn : ""}`}><Icon name="search"/>FIND UP<span className={styles.navSmall}>Discover</span></button>
            <button type="button" onClick={() => { setTravelOpen(true); setTravelTab("planner"); setFindUpOpen(false); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setRateReviewOpen(false); setDailyHubOpen(false); setCodeModeOpen(false); setHistoryOpen(false); setAiDetailsOpen(false); closeSidebar(); }} className={`${styles.navItem} ${travelOpen ? styles.navOn : ""}`}><Icon name="arrow"/>Tours &amp; Travels<span className={styles.navSmall}>Explore</span></button>
            <button type="button" onClick={() => { setDailyHubOpen(true); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setRateReviewOpen(false); setCodeModeOpen(false); closeSidebar(); }} className={`${styles.navItem} ${dailyHubOpen ? styles.navOn : ""}`}><Icon name="brain"/>Daily AI Hub<span className={styles.navSmall}>5</span></button>
            <button type="button" onClick={() => setPreciseMode((v) => !v)} className={`${styles.navItem} ${preciseMode ? styles.navOn : ""}`}><Icon name="brain"/>Precise Mode<span className={styles.navSmall}>{preciseMode ? "On" : ""}</span></button>
            <button type="button" onClick={() => { if (!["Care", "Elite", "Supreme"].includes(effectivePlan)) { setSubscriptionOpen(true); closeSidebar(); return; } setCodeModeOpen(true); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); closeSidebar(); }} className={`${styles.navItem} ${codeModeOpen ? styles.navOn : ""}`}><Icon name="code"/>Code Mode<span className={styles.navSmall}>{codeModeOpen ? "Open" : ""}</span></button>
            <div className={styles.characterPanel}>
              <button type="button" className={styles.characterHeading} onClick={() => setCharacterOpen((v) => !v)} aria-expanded={characterOpen}><Icon name="masks"/><strong>Character Mode</strong><span className={characterOpen ? styles.chevronUp : ""}><Icon name="chevron" size={16}/></span></button>
              {characterOpen && <div className={styles.characterList}>
                {characters.slice(1).filter((character) => character.id !== "school-friend").map((character) => <button key={character.id} type="button" className={`${styles.characterItem} ${characterMode === character.id ? styles.characterSelected : ""}`} onClick={() => setCharacterMode(character.id)}><span className={styles.characterIcon} style={{ backgroundColor: character.color }}>{character.icon}</span>{character.name}</button>)}
                <button type="button" className={`${styles.characterItem} ${["college-friend", "adult-friend"].includes(characterMode) ? styles.characterSelected : ""}`} onClick={() => setFriendSubcategoryOpen((open) => !open)} aria-expanded={friendSubcategoryOpen}>
                  <span className={styles.characterIcon} style={{ backgroundColor: "#3686d8" }}>✦</span>Friend
                  <span style={{ marginLeft: "auto", opacity: .7 }}>{friendSubcategoryOpen ? "▾" : "▸"}</span>
                </button>
                {friendSubcategoryOpen && <div className={styles.friendSubcategories}>
                  <button type="button" className={`${styles.characterItem} ${characterMode === "college-friend" ? styles.characterSelected : ""}`} onClick={() => setCharacterMode("college-friend")}><span className={styles.characterIcon} style={{ backgroundColor: "#3686d8" }}>🎓</span>College</button>
                  <button type="button" className={`${styles.characterItem} ${characterMode === "adult-friend" ? styles.characterSelected : ""}`} onClick={() => setCharacterMode("adult-friend")}><span className={styles.characterIcon} style={{ backgroundColor: "#b17a45" }}>☕</span>Adult</button>
                </div>}
                <button type="button" className={`${styles.characterItem} ${characterMode === "school-friend" ? styles.characterSelected : ""}`} onClick={() => setCharacterMode("school-friend")}><span className={styles.characterIcon} style={{ backgroundColor: "#11b8a4" }}>✦</span>School Friend</button>
                {characterMode !== "normal" && <button type="button" className={styles.normalMode} onClick={() => setCharacterMode("normal")}>Use normal Koyal</button>}
              </div>}
            </div>
            <button type="button" onClick={() => setTeacherMode((v) => !v)} className={`${styles.navItem} ${teacherMode ? styles.navOn : ""}`}><Icon name="book"/>Teacher Mode<span className={styles.navSmall}>{teacherMode ? "On" : ""}</span></button>
            <button type="button" onClick={() => { if (!["Care", "Elite", "Supreme"].includes(effectivePlan)) { setStudyMode(false); setSubscriptionOpen(true); closeSidebar(); return; } setStudyMode((v) => !v); }} className={`${styles.navItem} ${studyMode ? styles.navOn : ""}`}><Icon name="graduation"/>Study Mode<span className={styles.navSmall}>{studyMode ? "On" : "Off"}</span></button>
            {studyMode && ["Care", "Elite", "Supreme"].includes(effectivePlan) && <div className={styles.teacherSettings}>
              <label>Study class<select value={teacherClass} onChange={(e) => setTeacherClass(e.target.value)}>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1)}>{i+1}</option>)}</select></label>
              <label>Subject<select value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)}>{teacherSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
              <label>Learning focus<select value={studyFocus} onChange={(e) => setStudyFocus(e.target.value)}>{["Understand the topic","Homework help","Quiz practice","Exam preparation","Revision and notes"].map((s) => <option key={s}>{s}</option>)}</select></label>
            </div>}
            {teacherMode && <div className={styles.teacherSettings}>
              <label>Class<select value={teacherClass} onChange={(e) => setTeacherClass(e.target.value)}>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1)}>{i+1}</option>)}</select></label>
              <label>Subject<select value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)}>{teacherSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>}
            <button type="button" onClick={() => setPhilosophicalMode((v) => !v)} className={`${styles.navItem} ${philosophicalMode ? styles.navOn : ""}`}><Icon name="message"/>Philosophical Mode<span className={styles.navSmall}>{philosophicalMode ? "On" : ""}</span></button>
            <button type="button" onClick={() => { setRateReviewOpen(false); openFeatherShop(); }} className={styles.navItem}><Icon name="feather"/>Feather Balance<span className={styles.navSmall}>{effectivePlan === "Supreme" ? "∞" : feathers.toLocaleString("en-IN")}</span></button>
            <button type="button" onClick={() => { if (requireSignIn("access subscription plans")) setSubscriptionOpen(true); closeSidebar(); }} className={styles.navItem}><Icon name="diamond"/>Subscription</button>
            <button type="button" onClick={() => { setRateReviewOpen(true); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setCodeModeOpen(false); setHistoryOpen(false); closeSidebar(); }} className={`${styles.navItem} ${rateReviewOpen ? styles.navOn : ""}`}><Icon name="message"/>Rate &amp; Review<span className={styles.navSmall}>Feedback</span></button>
            <button type="button" onClick={() => { setAiDetailsOpen(true); setDownloadAppOpen(false); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setRateReviewOpen(false); setFindUpOpen(false); setDailyHubOpen(false); setCodeModeOpen(false); setHistoryOpen(false); closeSidebar(); }} className={`${styles.navItem} ${aiDetailsOpen ? styles.navOn : ""}`}><Icon name="message"/>AI Details<span className={styles.navSmall}>Contact</span></button>
            <button type="button" onClick={() => { setDownloadAppOpen(true); setAiDetailsOpen(false); setProfileOpen(false); setMemoryOpen(false); setTasksOpen(false); setRateReviewOpen(false); setFindUpOpen(false); setTravelOpen(false); setDailyHubOpen(false); setCodeModeOpen(false); setHistoryOpen(false); closeSidebar(); }} className={`${styles.navItem} ${downloadAppOpen ? styles.navOn : ""}`}><Icon name="arrow"/>Download App<span className={styles.navSmall}>Android</span></button>
          </nav>
          <div className={styles.policyLinks} aria-label="Legal policies">
            <span className={styles.policyLinksTitle}>LEGAL &amp; POLICIES</span>
            <a href="/policies/terms-and-conditions">Terms &amp; Conditions</a>
            <a href="/policies/privacy-policy">Privacy Policy</a>
            <a href="/policies/refund-and-cancellation">Refund &amp; Cancellation</a>
            <a href="/policies/subscription-and-renewal">Subscription &amp; Renewal</a>
          </div>
          <button type="button" className={`${styles.sidebarProfile} ${isAdminAccount ? styles.sidebarProfileAdmin : ""}`} onClick={openProfile} aria-label="Open your profile">
            <div className={styles.sidebarProfileTop}>
              {isAdminAccount ? <img className={styles.sidebarAdminBird} src="/koyal-bird.png" alt="KOYAL bird" /> : <WingedAvatar photo={profile.photo} supreme={effectivePlan === "Supreme"} variant="small" />}
              <span className={styles.sidebarProfileName}><strong>{isAdminAccount ? "Koyal Ai India" : profile.name || "Your Profile"}</strong>{isAdminAccount ? <small className={styles.sidebarAdminTag}>ADMIN</small> : <small>{selectedPlan === "Supreme" ? "♛ Supreme Plan" : `${selectedPlan} Plan`}</small>}</span>
              <Icon name="chevron" size={17}/>
            </div>
            <div className={styles.sidebarProfileStats}>
              <span>🪶 <strong>{effectivePlan === "Supreme" ? "∞" : feathers.toLocaleString("en-IN")}</strong><small>Feather balance</small></span>
              <span>◇ <strong>{isAdminAccount ? "Admin Access" : selectedPlan}</strong><small>{isAdminAccount ? "Paid features unlocked" : "Active plan"}</small></span>
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
                  {accountEmail && <div className={styles.overflowMenuAccount}>
                    <span>{accountEmail}</span>
                    <button type="button" onClick={() => { window.dispatchEvent(new Event("koyal-account-sign-out-request")); setMenuOpen(false); }}>Sign out</button>
                  </div>}
                  <button type="button" onClick={copyChat}><Icon name="copy" size={16}/>{copied ? "Copied" : "Copy conversation"}</button>
                  <button type="button" onClick={() => exportChat("txt")}>Download TXT</button>
                  <button type="button" onClick={() => exportChat("docx")}>Download Word (.docx)</button>
                  <button type="button" onClick={() => exportChat("pdf")}>Print / Save as PDF</button>
                  <button type="button" onClick={() => {resetChat();setMenuOpen(false);}}><Icon name="chat" size={16}/>Clear conversation</button>
                </div>}
              </div>
            </div>
          </header>

          {publicAnnouncements.filter((item) => !dismissedAnnouncements.includes(item.id)).slice(0, 5).map((item) => (
            <article key={item.id} role="status" style={{ margin: "12px 18px 0", padding: "13px 15px", borderRadius: 15, border: item.priority === "urgent" ? "1px solid rgba(255,75,100,.55)" : "1px solid rgba(255,120,155,.25)", background: item.priority === "urgent" ? "rgba(130,25,48,.20)" : "rgba(255,105,145,.07)", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1.3 }}>{item.priority === "urgent" ? "⚠️" : "📢"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 4 }}>
                  <strong style={{ fontSize: 14 }}>{item.title}</strong>
                  {item.priority === "urgent" && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#ff7189" }}>URGENT</span>}
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.message}</p>
              </div>
              <button type="button" onClick={() => dismissPublicAnnouncement(item.id)} aria-label={`Dismiss announcement: ${item.title}`} style={{ flex: "0 0 auto", border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 2 }}>×</button>
            </article>
          ))}

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
      {downloadAppOpen && <section className={styles.downloadAppSection} role="region" aria-label="Download KOYAL AI Android app">
        <div className={styles.downloadAppHeader}><div><div className={styles.aiDetailsEyebrow}>KOYAL AI · ANDROID</div><h2>Take Koyal <span>with you.</span></h2><p>Get the KOYAL AI Android app and access your AI assistant from your phone.</p></div><button type="button" className={styles.profileClose} aria-label="Close Download App" onClick={() => setDownloadAppOpen(false)}><Icon name="x" size={22}/></button></div>
        <div className={styles.downloadAppCard}><div className={styles.downloadAppLogo}><img src="/koyal-bird.png" alt="KOYAL AI"/></div><div className={styles.downloadAppCopy}><span>ANDROID APPLICATION</span><h3>KOYAL AI</h3><p>Version 1.0.0 · Android APK</p><a className={styles.downloadAppButton} href="https://github.com/itzithub-oss/KOYAL.AI/releases/download/v1.0.0/app-debug.1.apk" target="_blank" rel="noopener noreferrer" download>↓ Download for Android</a><small>If prompted, allow your browser to download the APK. Android may ask you to permit installation from this source.</small></div></div>
        <div className={styles.downloadAppSteps}><strong>How to install</strong><ol><li>Download the APK to your Android phone.</li><li>Open the downloaded file.</li><li>If Android asks, allow installation from your browser or file manager.</li><li>Tap Install, then open KOYAL AI.</li></ol><p>Only install the APK if you trust its source. Keep Android Play Protect enabled.</p></div>
        <button type="button" className={styles.reviewBack} onClick={() => setDownloadAppOpen(false)}>← Back to Chat</button>
      </section>}
      {aiDetailsOpen && <section className={styles.aiDetailsSection} role="region" aria-label="KOYAL AI details and contact">
        <div className={styles.aiDetailsHeader}>
          <div><div className={styles.aiDetailsEyebrow}>KOYAL AI · HERE TO HELP</div><h2>Contact <span>Us.</span></h2><p>Questions, support, feedback or collaboration ideas? Reach out through any of the channels below.</p></div>
          <button type="button" className={styles.profileClose} aria-label="Close AI Details" onClick={() => setAiDetailsOpen(false)}><Icon name="x" size={22}/></button>
        </div>
        <div className={styles.aiContactGrid}>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>✉</span><div><small>EMAIL SUPPORT</small><strong>koyalaiindia@gmail.com</strong><a href="mailto:koyalaiindia@gmail.com">Send an email ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>☎</span><div><small>CALL US · 1</small><strong>+91 9679004664</strong><a href="tel:+919679004664">Call this number ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>☎</span><div><small>CALL US · 2</small><strong>+91 9155537712</strong><a href="tel:+919155537712">Call this number ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>𝕏</span><div><small>FOLLOW ON X</small><strong>@koyalaiindia</strong><a href="https://x.com/koyalaiindia" target="_blank" rel="noopener noreferrer">Visit X profile ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>in</span><div><small>LINKEDIN</small><strong>KOYAL AI</strong><a href="https://www.linkedin.com/in/koyal-india-5b8664451/" target="_blank" rel="noopener noreferrer">Visit LinkedIn profile ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>f</span><div><small>FACEBOOK</small><strong>KOYAL AI</strong><a href="https://www.facebook.com/profile.php?id=61596528673216" target="_blank" rel="noopener noreferrer">Visit Facebook page ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>▶</span><div><small>YOUTUBE</small><strong>@KoyalAiIndia</strong><a href="https://www.youtube.com/@KoyalAiIndia" target="_blank" rel="noopener noreferrer">Visit YouTube channel ↗</a></div></article>
          <article className={styles.aiContactCard}><span className={styles.aiContactIcon}>◉</span><div><small>DISCORD</small><strong>koyalaiindia</strong><span className={styles.aiContactNote}>Find us on Discord using this username.</span></div></article>
        </div>
        <div className={styles.aiSupportHours}><span>◷</span><div><small>SUPPORT HOURS</small><strong>Monday – Saturday · 10:00 AM – 10:00 PM</strong><p>Sunday · Closed</p></div><span className={styles.aiSupportStatus}>SUPPORT WINDOW</span></div>
        <button type="button" className={styles.reviewBack} onClick={() => setAiDetailsOpen(false)}>← Back to Chat</button>
      </section>}
      {dailyHubOpen && <section className={styles.dailyHub} role="region" aria-label="Daily AI Hub">
        <div className={styles.dailyHubHead}>
          <div className={styles.dailyHubHeroCopy}>
            <div className={styles.dailyHubEyebrow}><span/> YOUR PERSONAL COMMAND CENTRE</div>
            <h2>Make today <span>count.</span></h2>
            <p>One hub. Five powerful ways to learn, focus and move forward.</p>
            <div className={styles.dailyHubMeta}><span><Icon name="diamond" size={14}/> MADE FOR YOUR EVERYDAY</span><span>✦ &nbsp;LEARN · PLAN · GROW</span></div>
          </div>
          <button type="button" className={styles.profileClose} aria-label="Close Daily AI Hub" onClick={() => setDailyHubOpen(false)}><Icon name="x" size={22}/></button>
        </div>
        <div className={styles.dailyThought} aria-live="polite">
          <div className={styles.dailyThoughtLabel}><span>✦</span> A THOUGHT TO CARRY WITH YOU <small>NEW THOUGHT EVERY 3 HOURS</small></div>
          <blockquote>“{dailyThought.text}”</blockquote>
          <div className={styles.dailyThoughtFooter}>— {dailyThought.author}</div>
        </div>
        <div className={styles.dailyHubGrid}>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setWebSearchEnabled(true); setInput("Give me today's important news and current affairs in a concise, student-friendly briefing. Include dates and reliable sources."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="book" size={22}/></span><span className={styles.dailyHubTag}>STAY INFORMED</span><strong>Daily News</strong><small>Get today's headlines and current affairs with sources.</small><span className={styles.dailyHubAction}>Explore news ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setStudyMode(true); setInput("Create a practical study plan for me for today. Ask what subjects and available time you need, then make a balanced timetable with breaks."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="tasks" size={22}/></span><span className={styles.dailyHubTag}>LEARN SMARTER</span><strong>Smart Study Planner</strong><small>Build a focused study timetable with breaks and goals.</small><span className={styles.dailyHubAction}>Plan study ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setInput("Create an interactive-style quiz for me. First ask which subject and topic, then ask one question at a time, check my answers and explain mistakes."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="brain" size={22}/></span><span className={styles.dailyHubTag}>TEST YOURSELF</span><strong>AI Quizzes</strong><small>Practise with questions, instant checking and explanations.</small><span className={styles.dailyHubAction}>Start a quiz ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); openMemory(); }}>
            <span className={styles.dailyHubGlyph}><Icon name="book" size={22}/></span><span className={styles.dailyHubTag}>KEEP THE GOOD IDEAS</span><strong>Saved Notes</strong><small>Save useful notes and revisit them whenever you need.</small><span className={styles.dailyHubAction}>Open notes ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); openTasks(); }}>
            <span className={styles.dailyHubGlyph}><Icon name="tasks" size={22}/></span><span className={styles.dailyHubTag}>MAKE PROGRESS</span><strong>Productivity Tracker</strong><small>Track tasks, due dates and completed work.</small><span className={styles.dailyHubAction}>Track progress ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setInput("Be my daily habit coach. Help me choose up to five realistic habits, make a simple daily check-in table, and review my consistency whenever I report my progress."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="check" size={22}/></span><span className={styles.dailyHubTag}>BUILD CONSISTENCY</span><strong>Habit Coach</strong><small>Choose healthy routines and check in on your progress with Koyal.</small><span className={styles.dailyHubAction}>Build better habits ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setInput("Act as my personal budget assistant. Help me record expenses I share, group them by category, calculate totals, and suggest a sensible budget. Never invent transactions."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="diamond" size={22}/></span><span className={styles.dailyHubTag}>SPEND MINDFULLY</span><strong>Expense Assistant</strong><small>Organise expenses, understand spending and plan a budget.</small><span className={styles.dailyHubAction}>Plan my budget ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={() => { setDailyHubOpen(false); setInput("Give me today's daily knowledge challenge: one surprising fact, one useful vocabulary word with an example, and one short general-knowledge question. Ask me to answer before revealing the answer."); }}>
            <span className={styles.dailyHubGlyph}><Icon name="brain" size={22}/></span><span className={styles.dailyHubTag}>GROW A LITTLE DAILY</span><strong>Daily Knowledge</strong><small>Discover a fact, learn a word and solve a quick challenge.</small><span className={styles.dailyHubAction}>Learn something new ↗</span>
          </button>
          <button type="button" className={styles.dailyHubCard} onClick={summarizeCurrentChat} disabled={summaryLoading}>
            <span className={styles.dailyHubGlyph}><Icon name="memory" size={22}/></span><span className={styles.dailyHubTag}>YOUR CONVERSATION, AT A GLANCE</span><strong>Summarise My Chat</strong><small>Turn this conversation into a few clear lines with key points and next steps.</small><span className={styles.dailyHubAction}>{summaryLoading ? "Summarising…" : "Create chat summary ↗"}</span>
          </button>
        </div>
        {(summaryLoading || summaryError || (chatSummary && summaryChatId === activeChatId)) && <section className={styles.chatSummaryPanel} aria-live="polite" aria-label="Chat summary">
          <div className={styles.chatSummaryHeading}><span><Icon name="memory" size={18}/> CHAT SUMMARY</span><small>THIS CONVERSATION</small></div>
          {summaryLoading ? <p className={styles.chatSummaryStatus}>Koyal is reading your conversation and preparing a short summary…</p> : summaryError ? <p className={styles.chatSummaryError}>{summaryError}</p> : <div className={styles.chatSummaryText}>{renderMessageContent(chatSummary)}</div>}
          {!summaryLoading && chatSummary && summaryChatId === activeChatId && <button type="button" className={styles.chatSummaryCopy} onClick={() => { void navigator.clipboard?.writeText(chatSummary); }}>Copy summary</button>}
        </section>}
        <button type="button" className={styles.reviewBack} onClick={() => setDailyHubOpen(false)}>← Back to Chat</button>
      </section>}
      {findUpOpen && <section className={styles.findUpSection} role="region" aria-label="FIND UP business search">
        <div className={styles.findUpHeader}><div><div className={styles.findUpEyebrow}>KOYAL DIRECTORY</div><h2>Find the right <span>service.</span></h2><p>Describe what you need. FIND UP searches verified business listings added to KOYAL.</p></div><button type="button" className={styles.profileClose} aria-label="Close FIND UP" onClick={() => setFindUpOpen(false)}><Icon name="x" size={22}/></button></div>
        <form className={styles.findUpSearch} onSubmit={async (event) => { event.preventDefault(); const query = findUpQuery.trim(); if (!query) return; setFindUpLoading(true); setFindUpError(""); setFindUpSearched(true); try { const response = await fetch(`/api/find-up?q=${encodeURIComponent(query)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Search could not be completed."); setFindUpResults(Array.isArray(data.results) ? data.results : []); } catch (error) { setFindUpResults([]); setFindUpError(error instanceof Error ? error.message : "Search could not be completed."); } finally { setFindUpLoading(false); } }}>
          <Icon name="search" size={20}/><input value={findUpQuery} onChange={(event) => setFindUpQuery(event.target.value)} placeholder="What service are you looking for?" aria-label="Describe the service you need" maxLength={180}/><button type="submit" disabled={findUpLoading || !findUpQuery.trim()}>{findUpLoading ? "Searching…" : "Search"}</button>
        </form>
        <div className={styles.findUpResults} aria-live="polite">
          {!findUpSearched && <div className={styles.findUpEmpty}><span>✦</span><strong>What are you looking for?</strong><p>Try “physiotherapy in Jalpaiguri” or “a clinic for back pain”.</p></div>}
          {findUpLoading && <div className={styles.findUpEmpty}>Searching business listings…</div>}
          {findUpError && <div className={styles.findUpEmpty} role="alert">{findUpError}</div>}
          {findUpSearched && !findUpLoading && !findUpError && findUpResults.length === 0 && <div className={styles.findUpEmpty}><strong>No matching business listing found.</strong><p>Try a different service or location.</p></div>}
          {findUpResults.map((business) => <article className={styles.findUpCard} key={business.id}>
            <div className={styles.findUpCardTop}><div><span className={styles.findUpCategory}>{business.category}</span><h3>{business.name}</h3><p>{business.description}</p></div><span className={styles.findUpVerified}>DATABASE LISTING</span></div>
            <div className={styles.findUpDetails}>
              <div><small>Location</small><strong>{business.location}</strong></div>
              <div><small>Starting price</small><strong>{business.startingPrice || "Not provided"}</strong></div>
              <div><small>Contact name</small><strong>{business.contactName || "Not provided"}</strong></div>
              <div><small>Operator name</small><strong>{business.operatorName || "Not provided"}</strong></div>
              {business.professionalName && <div><small>Healthcare professional</small><strong>{business.professionalName}</strong></div>}
              {business.qualifications?.length ? <div><small>Qualifications</small><strong>{business.qualifications.join(", ")}</strong></div> : null}
              {business.experience && <div><small>Experience</small><strong>{business.experience}</strong></div>}{business.serviceHours && <div><small>Service hours</small><strong>{business.serviceHours}</strong></div>}
              {business.services?.length ? <div className={styles.findUpServices}><small>Services</small><strong>{business.services.join(" · ")}</strong></div> : null}
            </div>
            <div className={styles.findUpLinks}>{business.phone && <a href={`tel:${business.phone}`}>Call {business.phone}</a>}{business.email && <a href={`mailto:${business.email}`}>Email</a>}{business.website && <a href={business.website} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}</div>
          </article>)}
        </div>
        <div className={styles.findUpPartnership}>
          <div><strong>Are you a service provider?</strong><p>Join the KOYAL FIND UP Partnership Program and get your business discovered.</p></div>
          <a className={styles.reviewButton} href="https://forms.gle/fkYk7NmocogpQMLw6" target="_blank" rel="noopener noreferrer"><Icon name="plus" size={18}/> Sign up for Partnership Program</a>
        </div>
        <button type="button" className={styles.reviewBack} onClick={() => setFindUpOpen(false)}>← Back to Chat</button>
      </section>}
      {travelOpen && <section className={styles.travelSection} role="region" aria-label="Tours and travels">
        <div className={styles.travelHeader}><div><div className={styles.findUpEyebrow}>KOYAL TRAVEL DESK</div><h2>Travel more. <span>Worry less.</span></h2><p>Plan a trip with Koyal or discover travel agencies listed in the KOYAL directory.</p></div><button type="button" className={styles.profileClose} aria-label="Close Tours and Travels" onClick={() => setTravelOpen(false)}><Icon name="x" size={22}/></button></div>
        <div className={styles.travelTabs} role="tablist" aria-label="Travel tools"><button type="button" role="tab" aria-selected={travelTab === "planner"} className={travelTab === "planner" ? styles.travelTabActive : ""} onClick={() => setTravelTab("planner")}>✦ AI Trip Planner</button><button type="button" role="tab" aria-selected={travelTab === "agencies"} className={travelTab === "agencies" ? styles.travelTabActive : ""} onClick={() => setTravelTab("agencies")}>⌖ Travel Agencies</button></div>
        {travelTab === "planner" ? <>
          {(!tripPlan || tripDetailsEditing) ? <form className={styles.travelForm} onSubmit={async (event) => {
            event.preventDefault();
            if (!tripDestination.trim() || tripPlanLoading) return;
            setTripPlanLoading(true); setTripPlanError("");
            const prompt = `Act as a professional travel planner. Generate the complete trip plan directly for display in the Tours & Travels page, not in chat. Destination: ${tripDestination.trim()}. Dates: ${tripStartDate || "not decided"} to ${tripEndDate || "not decided"}. Travellers: ${tripTravellers}. Total budget: ${tripBudget.trim() || "suggest a reasonable budget"}. Travel style: ${tripStyle}. Provide a day-by-day itinerary, estimated cost breakdown, transport options, accommodation areas, attractions, food suggestions, safety tips and booking checklist. Label estimates clearly and never invent live prices or availability. Use clear headings and concise bullets.`;
            try {
              const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ message: prompt, mode: "Normal", thinkingLevel: currentThinking.name, language: "English by default", subscriptionPlan: effectivePlan, name: profile.name, characterMode: "normal", teacherMode: false, preciseMode: false, philosophicalMode: false, webSearch: false }) });
              const data: ChatApiResponse = await response.json();
              if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) throw new Error(data.error || "Koyal could not create the trip plan. Please try again.");
              setTripPlan(data.reply); setTripDetailsEditing(false);
            } catch (error) { setTripPlanError(error instanceof Error ? error.message : "Unable to generate the trip plan."); }
            finally { setTripPlanLoading(false); }
          }}>
            <div className={styles.travelIntro}><span>✈</span><div><strong>{tripPlan ? "Change your trip details" : "Build your next journey"}</strong><small>Your itinerary will be generated on this page, not in your chat.</small></div></div>
            <label className={styles.travelField}>Where do you want to go?<input required value={tripDestination} onChange={(event) => setTripDestination(event.target.value)} placeholder="e.g. Darjeeling, Japan, Goa"/></label>
            <div className={styles.travelFieldGrid}><label className={styles.travelField}>Start date<input type="date" value={tripStartDate} onChange={(event) => setTripStartDate(event.target.value)}/></label><label className={styles.travelField}>End date<input type="date" min={tripStartDate || undefined} value={tripEndDate} onChange={(event) => setTripEndDate(event.target.value)}/></label></div>
            <div className={styles.travelFieldGrid}><label className={styles.travelField}>Travellers<select value={tripTravellers} onChange={(event) => setTripTravellers(event.target.value)}>{["1","2","3","4","5","6","7","8","9","10+"].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><label className={styles.travelField}>Total budget<input value={tripBudget} onChange={(event) => setTripBudget(event.target.value)} placeholder="e.g. ₹25,000"/></label></div>
            <label className={styles.travelField}>Travel style<select value={tripStyle} onChange={(event) => setTripStyle(event.target.value)}>{["Budget","Balanced","Comfort","Luxury","Adventure","Family-friendly"].map((style) => <option key={style}>{style}</option>)}</select></label>
            {tripPlanError && <p className={styles.travelPlanError} role="alert">{tripPlanError}</p>}
            <button type="submit" className={styles.travelSubmit} disabled={tripPlanLoading}>{tripPlanLoading ? "Creating your trip plan…" : tripPlan ? "Regenerate trip plan" : "Create my trip plan"} <Icon name="arrow" size={17}/></button>
          </form> : <section className={styles.travelPlanResult} aria-live="polite">
            <div className={styles.travelPlanTop}><div><span>YOUR PERSONAL ITINERARY</span><h3>{tripDestination} trip plan</h3><p>{tripStartDate || "Dates flexible"}{tripEndDate ? ` – ${tripEndDate}` : ""} · {tripTravellers} traveller(s) · {tripStyle}</p></div><button type="button" className={styles.travelEditButton} onClick={() => setTripDetailsEditing(true)}>✎ Change details</button></div>
            <div className={styles.travelPlanBody}>{tripPlan}</div>
            <button type="button" className={styles.travelSubmit} onClick={() => { setTripDetailsEditing(true); setTripPlanError(""); }}>Edit trip details &amp; regenerate</button>
          </section>}
        </> : <div className={styles.travelAgencyPanel}>
          <p>Search travel agencies and tour operators that have been added to the KOYAL directory. Listings show only information supplied to KOYAL.</p>
          <form className={styles.findUpSearch} onSubmit={async (event) => { event.preventDefault(); const query = travelAgencyQuery.trim(); if (!query) return; setTravelAgencyLoading(true); setTravelAgencyError(""); setTravelAgencySearched(true); try { const response = await fetch(`/api/find-up?q=${encodeURIComponent(query + " travel agency tour operator")}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Search could not be completed."); setTravelAgencyResults(Array.isArray(data.results) ? data.results : []); } catch (error) { setTravelAgencyResults([]); setTravelAgencyError(error instanceof Error ? error.message : "Search could not be completed."); } finally { setTravelAgencyLoading(false); } }}><Icon name="search" size={20}/><input value={travelAgencyQuery} onChange={(event) => setTravelAgencyQuery(event.target.value)} placeholder="Search by destination or agency location" aria-label="Search travel agencies" maxLength={150}/><button type="submit" disabled={travelAgencyLoading || !travelAgencyQuery.trim()}>{travelAgencyLoading ? "Searching…" : "Search"}</button></form>
          <div className={styles.findUpResults} aria-live="polite">{travelAgencyLoading && <div className={styles.findUpEmpty}>Searching listed travel providers…</div>}{travelAgencyError && <div className={styles.findUpEmpty} role="alert">{travelAgencyError}</div>}{travelAgencySearched && !travelAgencyLoading && !travelAgencyError && travelAgencyResults.length === 0 && <div className={styles.findUpEmpty}><span>✦</span><strong>No travel agency is listed yet.</strong><p>Try another location, or check back after travel partners join the KOYAL directory. Koyal will not display made-up agency details.</p></div>}{travelAgencyResults.map((business) => <article className={styles.findUpCard} key={business.id}><div className={styles.findUpCardTop}><div><span className={styles.findUpCategory}>{business.category}</span><h3>{business.name}</h3><p>{business.description}</p></div><span className={styles.findUpVerified}>DATABASE LISTING</span></div><div className={styles.findUpDetails}><div><small>Location</small><strong>{business.location}</strong></div><div><small>Starting price</small><strong>{business.startingPrice || "Not provided"}</strong></div><div><small>Contact</small><strong>{business.contactName || business.operatorName || "Not provided"}</strong></div></div><div className={styles.findUpLinks}>{business.phone && <a href={`tel:${business.phone}`}>Call {business.phone}</a>}{business.email && <a href={`mailto:${business.email}`}>Email</a>}{business.website && <a href={business.website} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}</div></article>)}</div>
          <div className={styles.travelAgencyNote}><strong>Are you a travel agency?</strong><span>Join the KOYAL FIND UP partnership programme to be discoverable here.</span><a href="https://forms.gle/fkYk7NmocogpQMLw6" target="_blank" rel="noopener noreferrer">Apply to partner ↗</a></div>
        </div>}
        <button type="button" className={styles.reviewBack} onClick={() => setTravelOpen(false)}>← Back to Chat</button>
      </section>}
      {rateReviewOpen && <div className={styles.reviewSection} role="region" aria-label="Rate and review Koyal">
          <div className={styles.reviewEyebrow}>YOUR FEEDBACK MATTERS</div>
          <div className={styles.reviewIcon} aria-hidden="true">★</div>
          <h2>Rate &amp; Review KOYAL</h2>
          <p>Help us make Koyal better. Share your experience, suggestions, and ideas through our feedback form.</p>
          <a className={styles.reviewButton} href="https://docs.google.com/forms/d/e/1FAIpQLSeMRHMoFQXxswcCUKGSgIu4q-m8fVfhLGFjGYnlpInq1ox0Fg/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer">Rate &amp; Review <span aria-hidden="true">↗</span></a>
          <button type="button" className={styles.reviewBack} onClick={() => setRateReviewOpen(false)}>← Back to Chat</button>
        </div>}
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
                <WingedAvatar photo={draftProfile.photo || profile.photo} supreme={effectivePlan === "Supreme"} variant="large" />
                {editingProfile && <>
                  <input ref={profilePhotoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadProfilePhoto} />
                  <button type="button" aria-label="Change profile photo" className={styles.cameraButton} onClick={() => profilePhotoInput.current?.click()}>📷</button>
                </>}
              </div>
              <div className={styles.profilePlanBadge}>{isAdminAccount ? "Administrator Access" : selectedPlan === "Supreme" ? "♛ Supreme Plan" : `${selectedPlan} Plan`}</div>
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
              <p className={styles.profilePrivacy}>Your profile and photo are saved to your KOYAL account and sync across devices.</p>
            </div>
          </div>
      </div>}
            {codeModeOpen && ["Care", "Elite", "Supreme"].includes(effectivePlan) && !profileOpen && !memoryOpen && !tasksOpen && <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", gap:16, width:"min(1100px,calc(100% - 32px))", height:"100%", minHeight:0, margin:"0 auto", padding:"28px 0 18px", overflowY:"auto" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                <div><h2 style={{ margin:0, fontSize:26 }}>⌘ Code Mode</h2><p style={{ margin:"6px 0 0", opacity:.7, fontSize:13 }}>Generate, explain, debug and improve code with Koyal.</p></div>
                <button type="button" onClick={() => setCodeModeOpen(false)} className={styles.editProfileButton}>← Back to Chat</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr)", gap:12, padding:16, border:"1px solid rgba(255,71,109,.3)", borderRadius:18, background:"rgba(18,12,25,.88)" }}>
                <label style={{ display:"grid", gap:7, fontSize:12, opacity:.9 }}>Programming language
                  <select value={codeLanguage} onChange={(event) => setCodeLanguage(event.target.value)} style={{ width:"100%", maxWidth:320, padding:11, borderRadius:10, color:"inherit", background:"#211827", border:"1px solid rgba(255,255,255,.18)" }}>
                    {["TypeScript","JavaScript","Python","HTML","CSS","Java","C","C++","C#","Go","Rust","PHP","SQL","Bash"].map((language) => <option key={language} value={language}>{language}</option>)}
                  </select>
                </label>
                <label style={{ display:"grid", gap:8, fontSize:13, fontWeight:650 }}>What should Koyal code?
                  <textarea value={codePrompt} onChange={(event) => setCodePrompt(event.target.value)} rows={5} placeholder="Describe what you want to build, paste code to explain, or share an error to debug..." style={{ width:"100%", resize:"vertical", minHeight:120, padding:14, borderRadius:12, color:"inherit", background:"#100d18", border:"1px solid rgba(255,255,255,.16)", font:"inherit", fontSize:14, lineHeight:1.55 }} />
                </label>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <button type="button" onClick={runCodeMode} disabled={codeLoading || !codePrompt.trim()} className={styles.saveProfileButton}>{codeLoading ? "Generating..." : "Generate / Fix Code"}</button>
                  <button type="button" onClick={() => { setCodePrompt(""); setCodeOutput(""); setCodeError(""); }} className={styles.editProfileButton}>Clear</button>
                  {codeError && <span role="alert" style={{ color:"#ff9db7", fontSize:12 }}>{codeError}</span>}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", flex:1, minHeight:260, border:"1px solid rgba(255,71,109,.3)", borderRadius:18, overflow:"hidden", background:"#0d0b13" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap", padding:"12px 15px", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
                  <strong style={{ fontSize:13 }}>Koyal's response</strong>
                  <div style={{ display:"flex", gap:8 }}>
                    <button type="button" disabled={!codeOutput} onClick={() => { void navigator.clipboard.writeText(codeOutput); }} className={styles.editProfileButton}>Copy</button>
                    <button type="button" disabled={!codeOutput} onClick={() => { const blob = new Blob([codeOutput],{type:"text/plain;charset=utf-8"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download="koyal-code-response.txt"; link.click(); URL.revokeObjectURL(url); }} className={styles.editProfileButton}>Download</button>
                  </div>
                </div>
                <textarea aria-label="Generated code and explanation" readOnly value={codeOutput} placeholder={codeLoading ? "Koyal is working on your code..." : "Your generated code and explanation will appear here."} spellCheck={false} style={{ flex:1, width:"100%", minHeight:230, resize:"vertical", border:0, outline:0, padding:17, color:"#f1eaf7", background:"transparent", fontFamily:"ui-monospace,SFMono-Regular,Consolas,monospace", fontSize:13, lineHeight:1.65, whiteSpace:"pre", overflow:"auto" }} />
              </div>
              <p style={{ margin:0, fontSize:11, opacity:.6 }}>Code is generated by AI and is not executed or security-tested inside this workspace. Review it before running.</p>
            </div>}
            {!codeModeOpen && !profileOpen && !memoryOpen && !tasksOpen && !rateReviewOpen && !findUpOpen && !travelOpen && !downloadAppOpen && <div className={styles.chatScroll}>
              <div className={styles.messages}>
                {visibleMessages.length === 0 && <div className={styles.noResults}>No matching messages found.</div>}
                {visibleMessages.map((message, index) => <div key={`${index}-${message.role}`} className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : styles.assistantRow}`}>
                  {message.role === "assistant" && <span className={styles.messageAvatar}><img src="/koyal-bird.png" alt="Koyal"/></span>}
                  <div className={styles.messageGroup}>
                    <div className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                      {message.fileName && <div className={styles.fileLabel}><Icon name="paperclip" size={14}/>{message.fileName}</div>}
                      <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{renderMessageContent(message.content)}</span>
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
              {loading && queuedCount > 0 && <div role="status" style={{ margin: "0 42px 12px", color: "var(--muted, #aaa)", fontSize: 12 }}><strong>{queuedCount} {queuedCount === 1 ? "question" : "questions"} waiting:</strong>{queuedQuestions.map((question, index) => <div key={`${index}-${question}`} style={{ marginTop: 5, color: "var(--text, inherit)", overflowWrap: "anywhere" }}>{index + 1}. {question}</div>)}<span>Koyal will answer in order.</span></div>}
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

          {!codeModeOpen && !profileOpen && !memoryOpen && !tasksOpen && !findUpOpen && !travelOpen && !downloadAppOpen && <div className={styles.bottomArea}>
            <div className={`${styles.effortCard} ${thinkingEffortOpen ? styles.effortCardOpen : ""}`}>
              <button className={styles.effortToggle} type="button" aria-expanded={thinkingEffortOpen} aria-controls="thinking-effort-controls" onClick={() => setThinkingEffortOpen((open) => !open)}>
                <span className={styles.effortHeading}>Thinking Effort</span>
                <span className={styles.effortCurrent}><span>{effectivePlan === "Supreme" ? "∞" : featherCost}</span><span className={styles.featherSymbol}>🪶</span><strong>{currentThinking.name}</strong></span>
                <Icon name="chevron" size={15}/>
              </button>
              {thinkingEffortOpen && <div className={styles.effortControls} id="thinking-effort-controls">
                <div className={styles.sliderOuter}>
                  <div className={styles.sliderTrack}><div className={styles.sliderFilled} style={{ width: `${indexThinking/6*100}%` }}/>{thinking.map((item,index) => <span key={item.id} className={styles.sliderMark} style={{ left: `${index/6*100}%` }}/>)}</div>
                  <div className={styles.birdThumb} style={{ left: `${indexThinking/6*100}%` }}><img src="/koyal-bird.png" alt=""/></div>
                  <input className={styles.sliderInput} aria-label={`Thinking effort: ${currentThinking.name}`} type="range" min={0} max={6} step={1} value={indexThinking} onChange={(event) => changeThinking(Number(event.target.value))} />
                </div>
              </div>}
            </div>
            <form className={styles.composer} onSubmit={sendMessage}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "0 12px 8px" }}>
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
                <div className={styles.voiceButton}><VoiceMode subscriptionPlan={effectivePlan}/></div>
                <button type="submit" className={styles.sendButton} disabled={!input.trim() && !selectedFile && !(urlReaderEnabled && urlInput.trim())} title={loading ? "Send another question to the queue" : "Send message"} aria-label="Send message"><Icon name="send" size={22}/></button>
              </div>
            </form>
          </div>}
        </section>
      </div>

      {featherShopOpen && <div className={styles.modalOverlay} onClick={() => setFeatherShopOpen(false)}><div className={styles.featherModal} role="dialog" aria-modal="true" aria-label="Feather store" onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}><h2>🪶 Feather Store</h2><button type="button" aria-label="Close feather store" onClick={() => setFeatherShopOpen(false)}><Icon name="x"/></button></div>
        <p className={styles.featherBalanceLine}>Current balance: <strong>{effectivePlan === "Supreme" ? "∞ Unlimited feathers" : `${feathers.toLocaleString("en-IN")} feathers`}</strong></p>
        <p className={styles.demoNotice}>Secure Cashfree checkout. Feathers are credited only after the payment is verified by KOYAL AI.</p>
        <label className={styles.customPack}>Phone number for payment <input type="tel" value={checkoutPhone} onChange={(e) => setCheckoutPhone(e.target.value)} placeholder="10-digit mobile number" autoComplete="tel" /></label>
        <div className={styles.packGrid}>{FEATHER_PACKS.map((pack) => <div className={styles.pack} key={pack.quantity}>
          <div className={styles.packCount}>🪶 {pack.quantity.toLocaleString("en-IN")}</div><div className={styles.packPrice}>₹{pack.rupees}</div><small>₹0.50 per feather</small>
          <button type="button" onClick={() => requestFeatherPurchase(pack.quantity)}>Buy</button>
        </div>)}</div>
        <div className={styles.customPack}><div><strong>Custom feather amount</strong><p>₹0.50 per feather</p></div>
          <label>Feathers <input type="number" min="2" max="100000" step="1" value={customFeathers} onChange={(e) => setCustomFeathers(e.target.value)} /></label>
          <div className={styles.customTotal}>₹{(Math.max(0,Number(customFeathers) || 0) * PRICE_PER_FEATHER).toLocaleString("en-IN",{maximumFractionDigits:2})}</div>
          <button type="button" onClick={() => requestFeatherPurchase(Number(customFeathers))}>Buy</button>
        </div>
        <div className={styles.customPack} style={{ marginTop: 18 }}>
          <div><strong>🎟️ Have a coupon?</strong><p>Log in to redeem each coupon once per account.</p></div>
          <label>Coupon code <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Enter coupon code" autoComplete="off" /></label>
          <button type="button" onClick={redeemCoupon} disabled={!couponCode.trim()}>Apply Coupon</button>
          {couponNotice && <p className={styles.purchaseNotice} role="status">{couponNotice}</p>}
        </div>
        {purchaseNotice && <div className={styles.purchaseNotice} role="status">{purchaseNotice}</div>}
      </div></div>}
      {subscriptionOpen && <div className={styles.modalOverlay} onClick={() => setSubscriptionOpen(false)}><div className={styles.modal} role="dialog" aria-modal="true" aria-label="Subscription plans" onClick={(e) => e.stopPropagation()}><div className={styles.modalHead}><h2>KOYAL Plans</h2><button onClick={() => setSubscriptionOpen(false)} type="button"><Icon name="x"/></button></div><p className={styles.demoNotice}>Pay once for 30 days of access. No automatic deductions — renew manually each month. Paid access starts only after Cashfree confirms payment.</p>{subscriptionNotice && <div className={styles.purchaseNotice} role="status">{subscriptionNotice}</div>}<div className={styles.planGrid}>{plans.map((plan) => <div key={plan.name} className={`${styles.planCard} ${selectedPlan === plan.name ? styles.planCurrent : ""}`}><h3>{plan.name}</h3><div className={styles.price}>₹{plan.price}<small>{plan.price === 0 ? " forever" : "/30 days"}</small></div><p>{plan.description}</p><button type="button" onClick={() => selectPlan(plan.name)}>{plan.name === "Just" ? (selectedPlan === plan.name ? "Selected" : "Select free plan") : selectedPlan === plan.name ? "Renew for 30 days" : "Choose plan"}</button></div>)}</div></div></div>}
    </main>
  );
}

export default function Home() {
  return <AuthGate><KoyalApp /></AuthGate>;
}

"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import VoiceMode from "./components/VoiceMode";
import styles from "./koyal-final.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  time?: string;
};
type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";
type CharacterMode =
  | "normal" | "mother" | "father" | "school-friend"
  | "school-female-friend" | "business-partner" | "enemy";
type ThinkingEffort =
  | "just" | "let-it" | "care" | "high" | "ultra-high" | "elite" | "supreme";
type ChatApiResponse = { reply?: string; error?: string };
type IconName =
  | "chat" | "user" | "brain" | "masks" | "book" | "message" | "feather"
  | "diamond" | "moon" | "sun" | "search" | "dots" | "plus" | "paperclip"
  | "send" | "chevron" | "x" | "volume" | "stop" | "menu" | "check"
  | "arrow" | "copy";

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
  };
  return <svg {...base}>{paths[name]}</svg>;
}

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
  const [profileName, setProfileName] = useState("Divyansh");
  const [profileOpen, setProfileOpen] = useState(false);
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
  const currentThinking = thinking.find((option) => option.id === thinkingId) || thinking[3];
  const indexThinking = thinking.findIndex((option) => option.id === thinkingId);
  const currentCharacter = characters.find((character) => character.id === characterMode) || characters[0];
  const featherCost = selectedPlan === "Supreme" ? 0 : currentThinking.feathers;
  const visibleMessages = search.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages;

  useEffect(() => {
    try {
      const saved = localStorage.getItem("koyal-ai-chat");
      if (saved) {
        const parsed: Message[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
      const plan = localStorage.getItem("koyal-ai-subscription-plan");
      if (plans.some((p) => p.name === plan)) setSelectedPlan(plan as PlanName);
      const featherStore = localStorage.getItem("koyal-ai-feather-balance");
      if (featherStore !== null && Number.isFinite(Number(featherStore))) setFeathers(Number(featherStore));
      const name = localStorage.getItem("koyal-ai-profile-name");
      if (name) setProfileName(name);
    } catch {
      // Ignore invalid local data and keep defaults.
    }
    loadedRef.current = true;
  }, []);
  useEffect(() => {
    if (loadedRef.current) localStorage.setItem("koyal-ai-chat", JSON.stringify(messages));
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  useEffect(() => () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }, []);

  function resetChat() {
    setMessages([{ ...WELCOME, time: timestamp() }]);
    setInput("");
    setSelectedFile(null);
    setSearch("");
    setSearchOpen(false);
    setMobileNav(false);
    window.speechSynthesis?.cancel();
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
    setSelectedFile(event.target.files?.[0] || null);
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
  async function copyChat() {
    const transcript = messages.map((m) => `${m.role === "assistant" ? "Koyal" : "You"}: ${m.content}`).join("\n\n");
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
    setMenuOpen(false);
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const text = input.trim();
    if (!text && !selectedFile) return;
    if (featherCost > feathers) { setSubscriptionOpen(true); return; }
    const message = text || `I attached a file named ${selectedFile?.name}.`;
    setMessages((old) => [...old, { role: "user", content: message, fileName: selectedFile?.name, time: timestamp() }]);
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
        philosophicalMode ? "Philosophical mode: provide thoughtful reasoning." : "",
        selectedFile ? "" : "",
      ].filter(Boolean).join(" ");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `${message}\n\n${systemDetails}${selectedFile ? `\nThe attached file is named ${selectedFile.name}; its contents have not been sent. Be transparent that you cannot read it.` : ""}`,
          mode: teacherMode ? "Teacher" : philosophicalMode ? "Philosophical" : preciseMode ? "Precise" : "Normal",
          thinkingLevel: currentThinking.name,
          language: "English by default",
          subscriptionPlan: selectedPlan,
          name: profileName,
          characterMode,
          teacherMode,
          teacherClass,
          teacherSubject,
          preciseMode,
          philosophicalMode,
        }),
      });
      const data: ChatApiResponse = await response.json();
      if (!response.ok || data.error || !data.reply || data.reply === ERROR_REPLY) throw new Error(ERROR_REPLY);
      setMessages((old) => [...old, { role: "assistant", content: data.reply || ERROR_REPLY, time: timestamp() }]);
      if (featherCost > 0) setFeathers((old) => {
        const value = Math.max(0, old - featherCost);
        localStorage.setItem("koyal-ai-feather-balance", String(value));
        return value;
      });
    } catch {
      setMessages((old) => [...old, { role: "assistant", content: ERROR_REPLY, time: timestamp() }]);
    } finally { setLoading(false); }
  }

  const closeSidebar = () => setMobileNav(false);

  return (
    <main className={`${styles.app} ${lightMode ? styles.light : ""}`}>
      <div className={styles.layout}>
        <button type="button" aria-label="Open navigation" className={styles.mobileMenuButton} onClick={() => setMobileNav(true)}><Icon name="menu"/></button>
        {mobileNav && <button type="button" aria-label="Close menu" className={styles.mobileDimmer} onClick={closeSidebar}/>}
        <aside className={`${styles.sidebar} ${mobileNav ? styles.sidebarOpen : ""}`}>
          <div className={styles.brand}>
            <img className={styles.brandBird} src="/koyal-bird.png" alt="KOYAL bird" />
            <div className={styles.brandName}>KOYAL <span>AI</span></div>
            <div className={styles.credits}>Brought to you by<br/><strong>Divyansh Acharjee &amp; Tejas Raj</strong></div>
          </div>
          <nav className={styles.nav} aria-label="Koyal features">
            <button type="button" onClick={resetChat} className={`${styles.navItem} ${styles.navMain}`}><Icon name="chat"/><strong>New Chat</strong></button>
            <button type="button" onClick={() => { setProfileOpen(true); closeSidebar(); }} className={styles.navItem}><Icon name="user"/>Profile</button>
            <button type="button" onClick={() => setPreciseMode((v) => !v)} className={`${styles.navItem} ${preciseMode ? styles.navOn : ""}`}><Icon name="brain"/>Precise Mode<span className={styles.navSmall}>{preciseMode ? "On" : ""}</span></button>
            <div className={styles.characterPanel}>
              <button type="button" className={styles.characterHeading} onClick={() => setCharacterOpen((v) => !v)} aria-expanded={characterOpen}><Icon name="masks"/><strong>Character Mode</strong><span className={characterOpen ? styles.chevronUp : ""}><Icon name="chevron" size={16}/></span></button>
              {characterOpen && <div className={styles.characterList}>
                {characters.slice(1).map((character) => <button key={character.id} type="button" className={`${styles.characterItem} ${characterMode === character.id ? styles.characterSelected : ""}`} onClick={() => setCharacterMode(character.id)}><span className={styles.characterIcon} style={{ backgroundColor: character.color }}>{character.icon}</span>{character.name}</button>)}
                {characterMode !== "normal" && <button type="button" className={styles.normalMode} onClick={() => setCharacterMode("normal")}>Use normal Koyal</button>}
              </div>}
            </div>
            <button type="button" onClick={() => setTeacherMode((v) => !v)} className={`${styles.navItem} ${teacherMode ? styles.navOn : ""}`}><Icon name="book"/>Teacher Mode<span className={styles.navSmall}>{teacherMode ? "On" : ""}</span></button>
            {teacherMode && <div className={styles.teacherSettings}>
              <label>Class<select value={teacherClass} onChange={(e) => setTeacherClass(e.target.value)}>{Array.from({length:12},(_,i) => <option key={i} value={String(i+1)}>{i+1}</option>)}</select></label>
              <label>Subject<select value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)}>{teacherSubjects.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            </div>}
            <button type="button" onClick={() => setPhilosophicalMode((v) => !v)} className={`${styles.navItem} ${philosophicalMode ? styles.navOn : ""}`}><Icon name="message"/>Philosophical Mode<span className={styles.navSmall}>{philosophicalMode ? "On" : ""}</span></button>
            <button type="button" onClick={() => setSubscriptionOpen(true)} className={styles.navItem}><Icon name="feather"/>Feather Balance<span className={styles.navSmall}>{feathers}</span></button>
            <button type="button" onClick={() => { setSubscriptionOpen(true); closeSidebar(); }} className={styles.navItem}><Icon name="diamond"/>Subscription</button>
          </nav>
          <div className={styles.sidebarFoot}><div className={styles.onlineDot}/><div>Koyal is ready</div><span>{selectedPlan} Plan</span></div>
        </aside>

        <section className={styles.mainPanel}>
          <header className={styles.topbar}>
            <div className={styles.headerBrand}>
              <span className={styles.headerAvatar}><img src="/koyal-bird.png" alt=""/></span>
              <span className={styles.headerText}><strong>KOYAL <em>AI</em></strong><small>INTELLIGENCE WITH A SOFTER SOUL</small></span>
            </div>
            <div className={styles.topActions}>
              {searchOpen && <input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus className={styles.searchInput} placeholder="Search this chat..." aria-label="Search messages"/>}
              <button type="button" className={styles.roundTop} title={lightMode ? "Dark theme" : "Light theme"} aria-label="Toggle theme" onClick={() => setLightMode((v) => !v)}><Icon name={lightMode ? "sun" : "moon"}/></button>
              <button type="button" className={styles.roundTop} title="Search messages" aria-label="Search messages" onClick={() => {setSearchOpen((v) => !v);setSearch("");}}><Icon name="search"/></button>
              <div className={styles.menuWrap}><button type="button" className={styles.roundTop} title="More options" aria-label="More options" onClick={() => setMenuOpen((v) => !v)}><Icon name="dots"/></button>
                {menuOpen && <div className={styles.overflowMenu}><button type="button" onClick={copyChat}><Icon name="copy" size={16}/>{copied ? "Copied" : "Copy conversation"}</button><button type="button" onClick={() => {resetChat();setMenuOpen(false);}}><Icon name="chat" size={16}/>Clear conversation</button></div>}
              </div>
            </div>
          </header>

          <section className={styles.chatSpace} aria-label="Conversation">
            <div className={styles.sceneBackdrop}/>
            <div className={styles.chatScroll}>
              <div className={styles.messages}>
                {visibleMessages.length === 0 && <div className={styles.noResults}>No matching messages found.</div>}
                {visibleMessages.map((message, index) => <div key={`${index}-${message.role}`} className={`${styles.messageRow} ${message.role === "user" ? styles.userRow : styles.assistantRow}`}>
                  {message.role === "assistant" && <span className={styles.messageAvatar}><img src="/koyal-bird.png" alt="Koyal"/></span>}
                  <div className={styles.messageGroup}>
                    <div className={`${styles.bubble} ${message.role === "user" ? styles.userBubble : styles.assistantBubble}`}>
                      {message.fileName && <div className={styles.fileLabel}><Icon name="paperclip" size={14}/>{message.fileName}</div>}
                      <span>{message.content}</span>
                      <div className={styles.bubbleFooter}><time>{message.time || ""}</time>{message.role === "user" && <span className={styles.checks}>✓✓</span>}</div>
                    </div>
                    {message.role === "assistant" && <button type="button" className={styles.listen} title="Read this message aloud" onClick={() => speakMessage(message.content,index)}><Icon name={speakingIndex === index ? "stop" : "volume"} size={15}/>{speakingIndex === index ? "Stop" : "Listen"}</button>}
                  </div>
                  {message.role === "user" && <span className={`${styles.messageAvatar} ${styles.userAvatar}`}><Icon name="user" size={23}/></span>}
                </div>)}
                {loading && <div className={styles.messageRow}><span className={styles.messageAvatar}><img src="/koyal-bird.png" alt=""/></span><div className={styles.loadingBubble}><span/><span/><span/> Koyal is thinking...</div></div>}
                <div ref={bottomRef} />
              </div>
            </div>
          </section>

          <div className={styles.bottomArea}>
            <div className={styles.effortCard}>
              <div className={styles.effortHeading}>Thinking Effort</div>
              <button className={styles.thinkingLabel} type="button" onClick={() => changeThinking((indexThinking + 1) % thinking.length)} title="Click to change thinking level"><span>{currentThinking.feathers === 0 && thinkingId === "supreme" ? "★" : currentThinking.feathers}</span><span className={styles.featherSymbol}>🪶</span><strong>{currentThinking.name}</strong><Icon name="chevron" size={14}/></button>
              <div className={styles.sliderOuter}>
                <div className={styles.sliderTrack}><div className={styles.sliderFilled} style={{ width: `${indexThinking/6*100}%` }}/>{thinking.map((item,index) => <span key={item.id} className={styles.sliderMark} style={{ left: `${index/6*100}%` }}/>)}</div>
                <div className={styles.birdThumb} style={{ left: `${indexThinking/6*100}%` }}><img src="/koyal-bird.png" alt=""/></div>
                <input className={styles.sliderInput} aria-label={`Thinking effort: ${currentThinking.name}`} type="range" min={0} max={6} step={1} value={indexThinking} onChange={(event) => changeThinking(Number(event.target.value))} />
              </div>
            </div>
            <form className={styles.composer} onSubmit={sendMessage}>
              {selectedFile && <div className={styles.attachment}><Icon name="paperclip" size={16}/>{selectedFile.name}<button type="button" aria-label="Remove attachment" onClick={() => {setSelectedFile(null);if(fileInput.current)fileInput.current.value="";}}><Icon name="x" size={14}/></button></div>}
              <div className={styles.composerRow}>
                <input ref={fileInput} type="file" hidden onChange={handleFile}/>
                <button type="button" className={styles.attachmentButton} title="Attach a file (file name only)" aria-label="Attach a file" onClick={() => fileInput.current?.click()}><Icon name="paperclip" size={24}/></button>
                <textarea value={input} placeholder={teacherMode ? `Ask your Class ${teacherClass} ${teacherSubject} teacher...` : characterMode !== "normal" ? `Message ${currentCharacter.name}...` : "Message Koyal..."} rows={1} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/>
                <div className={styles.voiceButton}><VoiceMode subscriptionPlan={selectedPlan}/></div>
                <button type="submit" className={styles.sendButton} disabled={loading || (!input.trim() && !selectedFile)} title="Send message" aria-label="Send message"><Icon name="send" size={22}/></button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {profileOpen && <div className={styles.modalOverlay} onClick={() => setProfileOpen(false)}><div className={styles.modalSmall} role="dialog" aria-modal="true" aria-label="Profile" onClick={(e) => e.stopPropagation()}><div className={styles.modalHead}><h2>Profile</h2><button onClick={() => setProfileOpen(false)} type="button"><Icon name="x"/></button></div><label className={styles.field}>Name<input value={profileName} onChange={(e) => {setProfileName(e.target.value);localStorage.setItem("koyal-ai-profile-name",e.target.value);}}/></label><p>Current plan: <b>{selectedPlan}</b></p><p>Feather balance: <b>{feathers} 🪶</b></p></div></div>}
      {subscriptionOpen && <div className={styles.modalOverlay} onClick={() => setSubscriptionOpen(false)}><div className={styles.modal} role="dialog" aria-modal="true" aria-label="Subscription plans" onClick={(e) => e.stopPropagation()}><div className={styles.modalHead}><h2>KOYAL Plans</h2><button onClick={() => setSubscriptionOpen(false)} type="button"><Icon name="x"/></button></div><p className={styles.demoNotice}>Demo plan selector only. Selecting a plan does not charge money or verify payment.</p><div className={styles.planGrid}>{plans.map((plan) => <div key={plan.name} className={`${styles.planCard} ${selectedPlan === plan.name ? styles.planCurrent : ""}`}><h3>{plan.name}</h3><div className={styles.price}>₹{plan.price}<small>/mo</small></div><p>{plan.description}</p><button type="button" onClick={() => selectPlan(plan.name)}>{selectedPlan === plan.name ? "Selected" : "Select demo plan"}</button></div>)}</div></div></div>}
    </main>
  );
}

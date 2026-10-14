"use client";

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import VoiceMode from "./components/VoiceMode";

type Message = {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
};

type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";

type CharacterMode =
  | "normal"
  | "mother"
  | "father"
  | "school-friend"
  | "school-female-friend"
  | "business-partner"
  | "enemy";

type ThinkingEffort =
  | "just"
  | "let-it"
  | "care"
  | "high"
  | "ultra-high"
  | "elite"
  | "supreme";

type TeacherClass =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12";

type TeacherSubject =
  | "general-science"
  | "mathematics"
  | "physics"
  | "chemistry"
  | "biology"
  | "history"
  | "geography"
  | "civics"
  | "economics"
  | "computer-science"
  | "english"
  | "social-science";

type ChatApiResponse = {
  reply?: string;
  error?: string;
  modelUsed?: string;
  providerUsed?: string;
  planUsed?: string;
};

type CharacterOption = {
  id: CharacterMode;
  icon: string;
  name: string;
};

type TeacherSubjectOption = {
  id: TeacherSubject;
  icon: string;
  name: string;
};

type ThinkingOption = {
  id: ThinkingEffort;
  name: string;
  feathers: number | "locked";
};

type Plan = {
  name: PlanName;
  price: number;
  tagline: string;
  benefits: string[];
};

const SERVER_ERROR_REPLY =
  "sorry,there is a problem in my server please try me later";

const starter: Message = {
  role: "assistant",
  content: "Hi! I’m Koyal. Ask me anything.",
};

const characterOptions: CharacterOption[] = [
  { id: "normal", icon: "💠", name: "Koyal" },
  { id: "mother", icon: "🌷", name: "Mother" },
  { id: "father", icon: "🛡️", name: "Father" },
  { id: "school-friend", icon: "🎒", name: "School Friend" },
  { id: "school-female-friend", icon: "💜", name: "Good School Female Friend" },
  { id: "business-partner", icon: "💼", name: "Business Partner" },
  { id: "enemy", icon: "😈", name: "Enemy" },
];

const teacherSubjects: TeacherSubjectOption[] = [
  { id: "general-science", icon: "🔬", name: "General Science" },
  { id: "mathematics", icon: "➗", name: "Mathematics" },
  { id: "physics", icon: "⚛️", name: "Physics" },
  { id: "chemistry", icon: "🧪", name: "Chemistry" },
  { id: "biology", icon: "🧬", name: "Biology" },
  { id: "history", icon: "🏛️", name: "History" },
  { id: "geography", icon: "🌍", name: "Geography" },
  { id: "civics", icon: "⚖️", name: "Civics" },
  { id: "economics", icon: "📈", name: "Economics" },
  { id: "computer-science", icon: "💻", name: "Computer Science" },
  { id: "english", icon: "📖", name: "English" },
  { id: "social-science", icon: "🌐", name: "Social Science" },
];

const thinkingOptions: ThinkingOption[] = [
  { id: "just", name: "Just", feathers: 0 },
  { id: "let-it", name: "Let It", feathers: 1 },
  { id: "care", name: "Care", feathers: 2 },
  { id: "high", name: "High", feathers: 3 },
  { id: "ultra-high", name: "Ultra High", feathers: 6 },
  { id: "elite", name: "Elite", feathers: 8 },
  { id: "supreme", name: "Supreme", feathers: "locked" },
];

const plans: Plan[] = [
  {
    name: "Just",
    price: 0,
    tagline: "Starter mode",
    benefits: ["Chat", "Voice", "Files"],
  },
  {
    name: "Let It",
    price: 70,
    tagline: "Better precision",
    benefits: ["Precise mode", "Lower feather cost"],
  },
  {
    name: "Care",
    price: 120,
    tagline: "Balanced thinking",
    benefits: ["Care thinking", "More detailed answers"],
  },
  {
    name: "Elite",
    price: 220,
    tagline: "Advanced mode",
    benefits: ["Elite thinking", "Code mode later"],
  },
  {
    name: "Supreme",
    price: 400,
    tagline: "Premium power",
    benefits: ["Supreme thinking", "Advanced answers", "Premium response quality"],
  },
];

const quickPrompts = [
  {
    icon: "💡",
    title: "Explain a concept",
    text: "Explain a concept like I’m 15",
  },
  {
    icon: "🪶",
    title: "Plan my goals",
    text: "Help me plan my goals step by step",
  },
  {
    icon: "📚",
    title: "Teach me",
    text: "Teach me today’s topic clearly",
  },
  {
    icon: "💭",
    title: "Think deeper",
    text: "Let’s have a deep philosophical discussion",
  },
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([starter]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<PlanName>("Just");
  const [featherBalance, setFeatherBalance] = useState(2480);
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>("high");
  const [preciseMode, setPreciseMode] = useState(true);
  const [philosophicalMode, setPhilosophicalMode] = useState(false);
  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherClass, setTeacherClass] = useState<TeacherClass>("8");
  const [teacherSubject, setTeacherSubject] =
    useState<TeacherSubject>("general-science");
  const [characterMode, setCharacterMode] =
    useState<CharacterMode>("normal");
  const [characterMenuOpen, setCharacterMenuOpen] = useState(true);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("Divyansh");
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const currentCharacter =
    characterOptions.find((item) => item.id === characterMode) ||
    characterOptions[0];

  const currentTeacherSubject =
    teacherSubjects.find((item) => item.id === teacherSubject) ||
    teacherSubjects[0];

  const currentThinking =
    thinkingOptions.find((item) => item.id === thinkingEffort) ||
    thinkingOptions[3];

  const currentFeatherCost =
    selectedPlan === "Supreme"
      ? 0
      : currentThinking.feathers === "locked"
      ? 0
      : currentThinking.feathers;

  const statusParts = [
    preciseMode ? "🎯 Precise" : "⚪ Normal",
    `🐦 ${currentThinking.name}`,
    selectedPlan !== "Just" ? `💎 ${selectedPlan}` : "💎 Just",
  ];

  if (teacherMode) {
    statusParts.push(
      `📚 Class ${teacherClass} ${currentTeacherSubject.name}`
    );
  }

  if (characterMode !== "normal") {
    statusParts.push(`🎭 ${currentCharacter.name}`);
  }

  if (philosophicalMode) {
    statusParts.push("💭 Philosophical");
  }

  useEffect(() => {
    const savedPlan = localStorage.getItem("koyal-ai-subscription-plan");
    const savedFeathers = localStorage.getItem("koyal-ai-feather-balance");
    const savedMessages = localStorage.getItem("koyal-ai-chat");

    if (
      savedPlan === "Just" ||
      savedPlan === "Let It" ||
      savedPlan === "Care" ||
      savedPlan === "Elite" ||
      savedPlan === "Supreme"
    ) {
      setSelectedPlan(savedPlan);
    }

    if (savedFeathers && !Number.isNaN(Number(savedFeathers))) {
      setFeatherBalance(Number(savedFeathers));
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {
        setMessages([starter]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("koyal-ai-chat", JSON.stringify(messages));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function newChat() {
    stopAudio();
    setMessages([starter]);
    setInput("");
    setSelectedFile(null);
    localStorage.setItem("koyal-ai-chat", JSON.stringify([starter]));
  }

  function buySubscription(plan: PlanName) {
    setSelectedPlan(plan);
    localStorage.setItem("koyal-ai-subscription-plan", plan);
    setSubscriptionOpen(false);

    if (plan === "Supreme") {
      setThinkingEffort("supreme");
    } else if (thinkingEffort === "supreme") {
      setThinkingEffort("high");
    }
  }

  function cycleThinkingEffort() {
    const availableOptions = thinkingOptions.filter(
      (option) => option.feathers !== "locked" || selectedPlan === "Supreme"
    );

    const currentIndex = availableOptions.findIndex(
      (option) => option.id === thinkingEffort
    );

    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    const nextOption = availableOptions[nextIndex % availableOptions.length];

    setThinkingEffort(nextOption.id);
  }

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadMenuOpen(false);
  }

  function removeFile() {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function stopAudio() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeakingIndex(null);
  }

  function speakMessage(text: string, index: number) {
    if (!("speechSynthesis" in window)) {
      alert("Speech is not supported in this browser.");
      return;
    }

    if (speakingIndex === index) {
      stopAudio();
      return;
    }

    stopAudio();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((item) => item.lang.toLowerCase().startsWith("en-in")) ||
      voices.find((item) => item.name.toLowerCase().includes("microsoft")) ||
      voices.find((item) => item.lang.toLowerCase().startsWith("en")) ||
      voices[0];

    if (voice) utterance.voice = voice;

    utterance.onstart = () => setSpeakingIndex(index);
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    window.speechSynthesis.speak(utterance);
  }

  function buildFinalMessage(message: string) {
    let finalMessage = message;

    finalMessage += `\n\nImportant language rule: Reply in English by default. Use Hindi only if I clearly ask for Hindi.`;

    if (selectedFile) {
      finalMessage += `\n\nThe user attached a file named ${selectedFile.name}. If you cannot inspect it directly, say so clearly.`;
    }

    if (characterMode !== "normal") {
      finalMessage += `\n\nCharacter mode: ${currentCharacter.name}. Reply in that character style.`;
    }

    if (teacherMode) {
      finalMessage += `\n\nTeacher Mode is enabled. Student class: ${teacherClass}. Subject: ${currentTeacherSubject.name}. Explain at the correct student level.`;
    }

    if (philosophicalMode) {
      finalMessage += `\n\nPhilosophical Mode is enabled. Give deeper and thoughtful answers when useful.`;
    }

    return finalMessage;
  }

  async function sendChatMessage(message: string) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: buildFinalMessage(message),
        mode: teacherMode
          ? "Teacher"
          : characterMode !== "normal"
          ? "Character"
          : philosophicalMode
          ? "Philosophical"
          : preciseMode
          ? "Precise"
          : "Normal",
        thinkingLevel: currentThinking.name,
        language: "English by default",
        subscriptionPlan: selectedPlan,
        selectedPlan,
        plan: selectedPlan,
        name: profileName,
        characterMode,
        philosophicalMode,
        preciseMode,
        teacherMode,
        teacherClass,
        teacherSubject,
        profile: {
          name: profileName,
        },
      }),
    });

    const raw = await response.text();

    let data: ChatApiResponse;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(SERVER_ERROR_REPLY);
    }

    if (!response.ok) {
      throw new Error(data.error || SERVER_ERROR_REPLY);
    }

    return data.reply || SERVER_ERROR_REPLY;
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const text = input.trim();

    if ((!text && !selectedFile) || loading) return;

    if (currentThinking.feathers === "locked" && selectedPlan !== "Supreme") {
      alert("Supreme Thinking needs Supreme Subscription.");
      return;
    }

    if (currentFeatherCost > featherBalance) {
      alert(`Not enough 🪶. You need ${currentFeatherCost} 🪶.`);
      return;
    }

    const messageToSend =
      text || `Please help me with the attached file: ${selectedFile?.name}`;

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: messageToSend,
        fileName: selectedFile?.name,
      },
    ]);

    setInput("");
    setLoading(true);

    const previousFeathers = featherBalance;

    if (currentFeatherCost > 0) {
      const next = featherBalance - currentFeatherCost;
      setFeatherBalance(next);
      localStorage.setItem("koyal-ai-feather-balance", String(next));
    }

    try {
      const reply = await sendChatMessage(messageToSend);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: reply,
        },
      ]);

      removeFile();
    } catch {
      setFeatherBalance(previousFeathers);
      localStorage.setItem(
        "koyal-ai-feather-balance",
        String(previousFeathers)
      );

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: SERVER_ERROR_REPLY,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={mainStyle}>
      <div style={backgroundGlowOneStyle} />
      <div style={backgroundGlowTwoStyle} />
      <div style={appShellStyle}>
        <aside style={sidebarStyle}>
          <div style={brandBlockStyle}>
            <img src="/koyal-logo.png" alt="Koyal logo" style={brandLogoStyle} />
            <div>
              <div style={brandTitleStyle}>KOYAL</div>
              <div style={brandSubtitleStyle}>Brought to you by</div>
              <div style={brandSmallStyle}>Divyansh Acharjee & Tejas Raj</div>
            </div>
          </div>

          <button type="button" onClick={newChat} style={activeNavButtonStyle}>
            <span>💬</span>
            <strong>New Chat</strong>
          </button>

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            style={navButtonStyle}
          >
            <span>👤</span>
            <strong>Profile</strong>
          </button>

          <button
            type="button"
            onClick={() => setPreciseMode((value) => !value)}
            style={preciseMode ? activeNavButtonStyle : navButtonStyle}
          >
            <span>🧠</span>
            <strong>Precise Mode</strong>
            <small>{preciseMode ? "On" : "Off"}</small>
          </button>

          <div style={sideGroupStyle}>
            <button
              type="button"
              onClick={() => setCharacterMenuOpen((value) => !value)}
              style={sideGroupHeaderStyle}
            >
              <span>🎭</span>
              <strong>Character Mode</strong>
              <span>{characterMenuOpen ? "⌃" : "⌄"}</span>
            </button>

            {characterMenuOpen && (
              <div style={characterListStyle}>
                {characterOptions.slice(1).map((character) => (
                  <button
                    key={character.id}
                    type="button"
                    onClick={() => setCharacterMode(character.id)}
                    style={
                      characterMode === character.id
                        ? activeCharacterButtonStyle
                        : characterButtonStyle
                    }
                  >
                    <span>{character.icon}</span>
                    {character.name}
                  </button>
                ))}

                {characterMode !== "normal" && (
                  <button
                    type="button"
                    onClick={() => setCharacterMode("normal")}
                    style={clearModeButtonStyle}
                  >
                    Clear character
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTeacherMode((value) => !value)}
            style={teacherMode ? activeNavButtonStyle : navButtonStyle}
          >
            <span>📚</span>
            <strong>Teacher Mode</strong>
          </button>

          {teacherMode && (
            <div style={teacherBoxStyle}>
              <select
                value={teacherClass}
                onChange={(event) =>
                  setTeacherClass(event.target.value as TeacherClass)
                }
                style={selectStyle}
              >
                {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(
                  (item) => (
                    <option key={item} value={item}>
                      Class {item}
                    </option>
                  )
                )}
              </select>

              <select
                value={teacherSubject}
                onChange={(event) =>
                  setTeacherSubject(event.target.value as TeacherSubject)
                }
                style={selectStyle}
              >
                {teacherSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.icon} {subject.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPhilosophicalMode((value) => !value)}
            style={philosophicalMode ? activeNavButtonStyle : navButtonStyle}
          >
            <span>💭</span>
            <strong>Philosophical Mode</strong>
          </button>

          <button type="button" style={navButtonStyle}>
            <span>🪶</span>
            <strong>Feather Balance</strong>
            <small>{featherBalance}</small>
          </button>

          <button
            type="button"
            onClick={() => setSubscriptionOpen(true)}
            style={navButtonStyle}
          >
            <span>💎</span>
            <strong>Subscription</strong>
          </button>

          <div style={profileCardStyle}>
            <div style={avatarStyle}>👤</div>
            <div style={{ flex: 1 }}>
              <strong>{profileName || "User"}</strong>
              <div style={profileBadgeStyle}>{selectedPlan} Plan</div>
            </div>
          </div>

          <div style={miniStatsStyle}>
            <div>
              <strong>🪶 {featherBalance}</strong>
              <small>Feathers</small>
            </div>
            <div>
              <strong>💎 {selectedPlan}</strong>
              <small>Active plan</small>
            </div>
          </div>
        </aside>

        <section style={mainPanelStyle}>
          <div style={heroStyle}>
            <div style={heroContentStyle}>
              <div style={welcomeStyle}>WELCOME TO</div>
              <h1 style={heroTitleStyle}>KOYAL</h1>
              <div style={heroLineStyle} />
              <div style={taglineStyle}>INTELLIGENCE WITH A SOFTER SOUL</div>

              <div style={introCardStyle}>
                <img
                  src="/koyal-logo.png"
                  alt="Koyal bird"
                  style={introBirdStyle}
                />
                <div>
                  <h2 style={introTitleStyle}>
                    Hi! I’m <span>Koyal.</span>
                  </h2>
                  <p style={introTextStyle}>Ask me anything.</p>
                  <p style={introSmallStyle}>
                    Your thoughtful friend, creative partner, and intelligent
                    assistant for learning, planning, problem solving, and deep
                    conversations.
                  </p>
                </div>
              </div>
            </div>

            <img src="/koyal-logo.png" alt="Koyal" style={heroBirdStyle} />
          </div>

          <div style={promptGridStyle}>
            {quickPrompts.map((prompt) => (
              <button
                key={prompt.title}
                type="button"
                onClick={() => setInput(prompt.text)}
                style={promptCardStyle}
              >
                <span style={promptIconStyle}>{prompt.icon}</span>
                <span>
                  <strong>{prompt.title}</strong>
                  <small>{prompt.text}</small>
                </span>
                <span style={{ marginLeft: "auto" }}>→</span>
              </button>
            ))}
          </div>

          <div style={chatAreaStyle}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  display: "flex",
                  justifyContent:
                    message.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 18,
                }}
              >
                <div
                  style={
                    message.role === "user"
                      ? userMessageWrapStyle
                      : assistantMessageWrapStyle
                  }
                >
                  {message.role === "assistant" && (
                    <img
                      src="/koyal-logo.png"
                      alt="Koyal"
                      style={messageAvatarStyle}
                    />
                  )}

                  <div style={messageBubbleStyle(message.role)}>
                    {message.fileName && (
                      <div style={filePillStyle}>📎 {message.fileName}</div>
                    )}
                    {message.content}
                  </div>

                  {message.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => speakMessage(message.content, index)}
                      style={listenButtonStyle}
                    >
                      {speakingIndex === index ? "⏹ Stop" : "🔊 Listen"}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={thinkingStyle}>
                🐦 Koyal is thinking...
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} style={composerPanelStyle}>
            <div style={thinkingPanelStyle}>
              <div style={thinkingInfoStyle}>
                <button
                  type="button"
                  onClick={cycleThinkingEffort}
                  style={thinkingBirdButtonStyle}
                  title={`Click to change thinking. Current: ${currentThinking.name}`}
                >
                  <img
                    src="/koyal-logo.png"
                    alt="Koyal thinking"
                    style={thinkingBirdImageStyle}
                  />
                </button>
                <span>
                  <strong>Thinking Effort</strong>
                  <small>Click the bird to change: {currentThinking.name}</small>
                </span>
              </div>

              <div style={thinkingButtonsStyle}>
                {thinkingOptions.map((option) => {
                  const locked = option.feathers === "locked";
                  const active = thinkingEffort === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (locked && selectedPlan !== "Supreme") {
                          alert("Supreme Thinking needs Supreme Subscription.");
                          return;
                        }

                        setThinkingEffort(option.id);
                      }}
                      style={active ? activeThinkingButtonStyle : thinkingButtonStyle}
                    >
                      {option.id === "supreme" && "👑 "}
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedFile && (
              <div style={attachmentPreviewStyle}>
                <span>📎 {selectedFile.name}</span>
                <button type="button" onClick={removeFile} style={closeButtonStyle}>
                  ✕
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              hidden
              type="file"
              onChange={chooseFile}
            />

            <div style={inputRowStyle}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setUploadMenuOpen((value) => !value)}
                  style={roundButtonStyle}
                  disabled={loading}
                >
                  ＋
                </button>

                {uploadMenuOpen && (
                  <div style={uploadMenuStyle}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={uploadMenuButtonStyle}
                    >
                      📎 Upload file
                    </button>
                  </div>
                )}
              </div>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  teacherMode
                    ? `Ask your Class ${teacherClass} ${currentTeacherSubject.name} teacher...`
                    : characterMode !== "normal"
                    ? `Message ${currentCharacter.name}...`
                    : philosophicalMode
                    ? "Ask Koyal something deeper..."
                    : "Message Koyal..."
                }
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                style={textareaStyle}
              />

              <VoiceMode subscriptionPlan={selectedPlan} />

              <button
                type="submit"
                disabled={loading || (!input.trim() && !selectedFile)}
                style={sendButtonStyle}
              >
                {loading ? "..." : "➤"}
              </button>
            </div>

            <div style={statusStyle}>{statusParts.join(" • ")}</div>
          </form>
        </section>
      </div>

      {subscriptionOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <h2>💎 Subscription</h2>
              <button
                type="button"
                onClick={() => setSubscriptionOpen(false)}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <div style={planGridStyle}>
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  style={
                    selectedPlan === plan.name ? activePlanCardStyle : planCardStyle
                  }
                >
                  <h3>{plan.name}</h3>
                  <div style={priceStyle}>₹{plan.price}</div>
                  <p>{plan.tagline}</p>
                  <ul>
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => buySubscription(plan.name)}
                    style={planButtonStyle(selectedPlan === plan.name)}
                  >
                    {selectedPlan === plan.name ? "Current Plan" : "Buy Plan"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {profileOpen && (
        <div style={modalOverlayStyle}>
          <div style={smallModalStyle}>
            <div style={modalHeaderStyle}>
              <h2>👤 Profile</h2>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <label style={labelStyle}>
              Name
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                style={inputStyle}
              />
            </label>

            <div style={profileSummaryStyle}>
              <strong>Plan:</strong> {selectedPlan}
              <br />
              <strong>Feathers:</strong> {featherBalance}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 75% 10%, rgba(255,45,85,0.22), transparent 34%), radial-gradient(circle at 12% 80%, rgba(168,85,247,0.18), transparent 35%), linear-gradient(135deg,#050507,#090812 45%,#17040a)",
  color: "#ffffff",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  overflow: "hidden",
  position: "relative",
};

const backgroundGlowOneStyle: CSSProperties = {
  position: "absolute",
  inset: "-25% auto auto -12%",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "rgba(255,47,88,0.12)",
  filter: "blur(70px)",
};

const backgroundGlowTwoStyle: CSSProperties = {
  position: "absolute",
  right: -180,
  bottom: -160,
  width: 620,
  height: 620,
  borderRadius: "50%",
  background: "rgba(147,51,234,0.16)",
  filter: "blur(90px)",
};

const appShellStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "315px 1fr",
  gap: 22,
  height: "100vh",
  padding: 20,
};

const sidebarStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 28,
  padding: 18,
  background: "rgba(8,8,15,0.78)",
  backdropFilter: "blur(24px)",
  boxShadow: "0 30px 80px rgba(0,0,0,0.38)",
  overflowY: "auto",
};

const brandBlockStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "4px 4px 20px",
};

const brandLogoStyle: CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 24,
  objectFit: "cover",
  boxShadow: "0 0 35px rgba(255,60,94,0.35)",
};

const brandTitleStyle: CSSProperties = {
  fontSize: 27,
  letterSpacing: 2,
  fontWeight: 900,
};

const brandSubtitleStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  marginTop: 4,
};

const brandSmallStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
};

const navButtonBaseStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: "13px 14px",
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
  marginBottom: 8,
};

const navButtonStyle: CSSProperties = {
  ...navButtonBaseStyle,
  background: "rgba(255,255,255,0.035)",
};

const activeNavButtonStyle: CSSProperties = {
  ...navButtonBaseStyle,
  background:
    "linear-gradient(135deg, rgba(255,47,88,0.22), rgba(147,51,234,0.14))",
  border: "1px solid rgba(255,75,105,0.55)",
  boxShadow: "0 0 28px rgba(255,47,88,0.16)",
};

const sideGroupStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,75,105,0.35)",
  background: "rgba(255,47,88,0.06)",
  marginBottom: 10,
  overflow: "hidden",
};

const sideGroupHeaderStyle: CSSProperties = {
  width: "100%",
  border: 0,
  background: "rgba(255,47,88,0.15)",
  padding: "13px 14px",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
};

const characterListStyle: CSSProperties = {
  padding: 10,
  display: "grid",
  gap: 7,
};

const characterButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "9px 10px",
  color: "#e8e0ff",
  background: "transparent",
  display: "flex",
  gap: 8,
  cursor: "pointer",
};

const activeCharacterButtonStyle: CSSProperties = {
  ...characterButtonStyle,
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
};

const clearModeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "9px 10px",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
};

const teacherBoxStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 10,
};

const selectStyle: CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#11111c",
  color: "#fff",
};

const profileCardStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginTop: 18,
  padding: 14,
  borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const avatarStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "rgba(255,255,255,0.08)",
};

const profileBadgeStyle: CSSProperties = {
  marginTop: 4,
  display: "inline-block",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 11,
  color: "#ffb4c4",
  background: "rgba(255,47,88,0.18)",
};

const miniStatsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 12,
  fontSize: 12,
};

const mainPanelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 30,
  background: "rgba(8,8,16,0.62)",
  backdropFilter: "blur(24px)",
  overflow: "hidden",
};

const heroStyle: CSSProperties = {
  position: "relative",
  minHeight: 310,
  padding: "34px 42px",
  overflow: "hidden",
  background:
    "linear-gradient(120deg, rgba(8,8,16,0.9), rgba(38,7,19,0.55)), radial-gradient(circle at 80% 30%, rgba(255,45,85,0.24), transparent 35%)",
};

const heroContentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  maxWidth: 660,
};

const welcomeStyle: CSSProperties = {
  letterSpacing: 12,
  color: "#ff8aa4",
  fontSize: 12,
  marginBottom: 10,
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 86,
  lineHeight: 0.95,
  letterSpacing: 10,
  fontWeight: 900,
};

const heroLineStyle: CSSProperties = {
  width: 460,
  maxWidth: "100%",
  height: 2,
  margin: "16px 0 12px",
  background: "linear-gradient(90deg, transparent, #ff355d, transparent)",
};

const taglineStyle: CSSProperties = {
  letterSpacing: 8,
  color: "rgba(255,255,255,0.62)",
  fontSize: 12,
};

const introCardStyle: CSSProperties = {
  marginTop: 28,
  display: "flex",
  alignItems: "center",
  gap: 18,
  maxWidth: 620,
  borderRadius: 28,
  padding: 22,
  background: "rgba(8,8,16,0.72)",
  border: "1px solid rgba(255,75,105,0.35)",
  boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
};

const introBirdStyle: CSSProperties = {
  width: 86,
  height: 86,
  objectFit: "cover",
  borderRadius: 22,
};

const introTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 34,
};

const introTextStyle: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 30,
  color: "#c6b8ff",
};

const introSmallStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "rgba(255,255,255,0.68)",
  lineHeight: 1.6,
};

const heroBirdStyle: CSSProperties = {
  position: "absolute",
  right: 34,
  top: 20,
  width: 310,
  height: 310,
  objectFit: "cover",
  borderRadius: 40,
  opacity: 0.85,
  filter: "drop-shadow(0 0 45px rgba(255,47,88,0.32))",
};

const promptGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  padding: "18px 24px 8px",
};

const promptCardStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 20,
  background: "rgba(255,255,255,0.055)",
  color: "#fff",
  padding: 16,
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  textAlign: "left",
};

const promptIconStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(255,47,88,0.14)",
  fontSize: 22,
};

const chatAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "22px 34px 10px",
};

const assistantMessageWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  maxWidth: "74%",
};

const userMessageWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  maxWidth: "74%",
};

const messageAvatarStyle: CSSProperties = {
  width: 52,
  height: 52,
  objectFit: "cover",
  borderRadius: "50%",
  marginBottom: 8,
  boxShadow: "0 0 24px rgba(255,47,88,0.35)",
};

function messageBubbleStyle(role: "user" | "assistant"): CSSProperties {
  return {
    padding: "15px 18px",
    borderRadius: role === "user" ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
    background:
      role === "user"
        ? "linear-gradient(135deg, rgba(92,108,255,0.28), rgba(255,255,255,0.08))"
        : "rgba(255,255,255,0.075)",
    border: "1px solid rgba(255,255,255,0.09)",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  };
}

const filePillStyle: CSSProperties = {
  display: "inline-block",
  marginBottom: 8,
  padding: "4px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.09)",
  fontSize: 12,
};

const listenButtonStyle: CSSProperties = {
  marginTop: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 999,
  padding: "7px 12px",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
};

const thinkingStyle: CSSProperties = {
  opacity: 0.72,
  marginBottom: 20,
};

const composerPanelStyle: CSSProperties = {
  padding: 18,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(8,8,16,0.72)",
};

const thinkingPanelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 12,
};

const thinkingInfoStyle: CSSProperties = {
  minWidth: 220,
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const thinkingBirdButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  padding: 4,
  display: "grid",
  placeItems: "center",
  borderRadius: 14,
  border: "1px solid rgba(255,80,120,0.5)",
  background: "rgba(255,255,255,0.07)",
  boxShadow: "0 0 18px rgba(255,47,88,0.18)",
  cursor: "pointer",
};

const thinkingBirdImageStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  objectFit: "cover",
};

const thinkingButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flex: 1,
  overflowX: "auto",
};

const thinkingButtonStyle: CSSProperties = {
  minWidth: 96,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.045)",
  color: "#fff",
  cursor: "pointer",
};

const activeThinkingButtonStyle: CSSProperties = {
  ...thinkingButtonStyle,
  border: "1px solid rgba(255,75,105,0.65)",
  background: "rgba(255,47,88,0.18)",
  boxShadow: "0 0 25px rgba(255,47,88,0.18)",
};

const attachmentPreviewStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  marginBottom: 10,
};

const inputRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 22,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.045)",
};

const roundButtonStyle: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 20,
};

const textareaStyle: CSSProperties = {
  flex: 1,
  border: 0,
  outline: 0,
  resize: "none",
  background: "transparent",
  color: "#fff",
  fontSize: 16,
  minHeight: 42,
  paddingTop: 11,
};

const sendButtonStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  border: "1px solid rgba(255,118,143,0.7)",
  background: "linear-gradient(135deg,#ff315d,#a855f7)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 21,
  boxShadow: "0 0 30px rgba(255,47,88,0.28)",
};

const uploadMenuStyle: CSSProperties = {
  position: "absolute",
  bottom: 50,
  left: 0,
  minWidth: 150,
  padding: 8,
  borderRadius: 14,
  background: "#11111c",
  border: "1px solid rgba(255,255,255,0.12)",
  zIndex: 10,
};

const uploadMenuButtonStyle: CSSProperties = {
  width: "100%",
  border: 0,
  background: "transparent",
  color: "#fff",
  textAlign: "left",
  padding: 10,
  cursor: "pointer",
};

const closeButtonStyle: CSSProperties = {
  border: 0,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  borderRadius: 999,
  width: 30,
  height: 30,
  cursor: "pointer",
};

const planBannerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginTop: 12,
  padding: "12px 16px",
  borderRadius: 18,
  border: "1px solid rgba(255,75,105,0.26)",
  background: "rgba(255,47,88,0.08)",
  fontSize: 13,
};

const statusStyle: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.7,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "rgba(0,0,0,0.62)",
  zIndex: 50,
  padding: 24,
};

const modalStyle: CSSProperties = {
  width: "min(920px, 96vw)",
  maxHeight: "86vh",
  overflowY: "auto",
  borderRadius: 28,
  padding: 22,
  background: "rgba(10,10,18,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
};

const smallModalStyle: CSSProperties = {
  width: "min(440px, 94vw)",
  borderRadius: 28,
  padding: 22,
  background: "rgba(10,10,18,0.98)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 18,
};

const planGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 14,
};

const planCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.09)",
};

const activePlanCardStyle: CSSProperties = {
  ...planCardStyle,
  border: "1px solid rgba(255,75,105,0.55)",
  background: "rgba(255,47,88,0.12)",
};

const priceStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#ff6b8c",
};

function planButtonStyle(active: boolean): CSSProperties {
  return {
    width: "100%",
    border: 0,
    borderRadius: 14,
    padding: "10px 12px",
    marginTop: 10,
    background: active ? "rgba(255,255,255,0.16)" : "#fff",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
    fontWeight: 800,
  };
}

const labelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
};

const profileSummaryStyle: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.06)",
};

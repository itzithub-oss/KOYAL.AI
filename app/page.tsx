"use client";

import {
  ChangeEvent,
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
  imageUrl?: string;
};

type Profile = {
  name: string;
  dob: string;
  gender: string;
  phone: string;
  photo?: string;
};

type CharacterMode =
  | "normal"
  | "mother"
  | "father"
  | "school-friend"
  | "school-female-friend"
  | "business-partner"
  | "enemy";

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
  | "mathematics"
  | "english"
  | "general-science"
  | "social-science"
  | "physics"
  | "chemistry"
  | "biology"
  | "history"
  | "geography"
  | "civics"
  | "computer-science"
  | "economics"
  | "general-knowledge";

type ThinkingEffort =
  | "just"
  | "let-it"
  | "care"
  | "high"
  | "ultra-high"
  | "elite"
  | "supreme";

type PlanName = "Just" | "Let It" | "Care" | "Elite" | "Supreme";

type Plan = {
  name: PlanName;
  price: number;
  benefits: string[];
};

type TeacherSubjectOption = {
  id: TeacherSubject;
  icon: string;
  name: string;
};

type ChatApiResponse = {
  reply?: string;
  error?: string;
};

type ImageApiResponse = {
  reply?: string;
  image?: string;
  mimeType?: string;
  error?: string;
};

const STARTING_FEATHER_BALANCE = 100;

const characterOptions: {
  id: CharacterMode;
  icon: string;
  name: string;
  description: string;
}[] = [
  {
    id: "normal",
    icon: "💠",
    name: "Normal KOYAL AI",
    description: "Standard AI assistant",
  },
  {
    id: "mother",
    icon: "🌷",
    name: "Mother",
    description: "Caring & supportive",
  },
  {
    id: "father",
    icon: "🛡️",
    name: "Father",
    description: "Calm & guiding",
  },
  {
    id: "school-friend",
    icon: "🎒",
    name: "School Friend",
    description: "Casual & friendly",
  },
  {
    id: "school-female-friend",
    icon: "🌸",
    name: "Good School Female Friend",
    description: "Friendly & supportive",
  },
  {
    id: "business-partner",
    icon: "💼",
    name: "Business Partner",
    description: "Strategic & professional",
  },
  {
    id: "enemy",
    icon: "⚔️",
    name: "Enemy",
    description: "Competitive fictional rival",
  },
];

const juniorTeacherSubjects: TeacherSubjectOption[] = [
  { id: "mathematics", icon: "➗", name: "Mathematics" },
  { id: "english", icon: "📖", name: "English" },
  { id: "general-science", icon: "🔬", name: "General Science" },
  { id: "social-science", icon: "🌐", name: "Social Science" },
  { id: "computer-science", icon: "💻", name: "Computer Science" },
  { id: "general-knowledge", icon: "🧠", name: "General Knowledge" },
];

const seniorTeacherSubjects: TeacherSubjectOption[] = [
  { id: "mathematics", icon: "➗", name: "Mathematics" },
  { id: "english", icon: "📖", name: "English" },
  { id: "general-science", icon: "🔬", name: "General Science" },
  { id: "social-science", icon: "🌐", name: "Social Science" },
  { id: "physics", icon: "⚛️", name: "Physics" },
  { id: "chemistry", icon: "🧪", name: "Chemistry" },
  { id: "biology", icon: "🧬", name: "Biology" },
  { id: "history", icon: "🏛️", name: "History" },
  { id: "geography", icon: "🗺️", name: "Geography" },
  { id: "civics", icon: "⚖️", name: "Civics" },
  { id: "computer-science", icon: "💻", name: "Computer Science" },
  { id: "economics", icon: "📈", name: "Economics" },
  { id: "general-knowledge", icon: "🧠", name: "General Knowledge" },
];

const allTeacherSubjects: TeacherSubjectOption[] = [...seniorTeacherSubjects];

const thinkingEffortOptions: {
  id: ThinkingEffort;
  name: string;
  feathers: number | "locked";
}[] = [
  { id: "just", name: "Just", feathers: 0 },
  { id: "let-it", name: "Let It", feathers: 1 },
  { id: "care", name: "Care", feathers: 2 },
  { id: "high", name: "High", feathers: 3 },
  { id: "ultra-high", name: "Ultra High", feathers: 6 },
  { id: "elite", name: "Elite", feathers: 8 },
  { id: "supreme", name: "Supreme", feathers: "locked" },
];

const subscriptionPlans: Plan[] = [
  {
    name: "Just",
    price: 0,
    benefits: [
      "Unlimited Files",
      "Unlimited Voice/Audio",
      "Image Generation - Coming Soon",
    ],
  },
  {
    name: "Let It",
    price: 70,
    benefits: [
      "Precise Mode unlock",
      "Let It thinking support",
      "Let It costs 50% less",
    ],
  },
  {
    name: "Care",
    price: 120,
    benefits: [
      "Precise Mode",
      "Let It 50% less",
      "Care 50% less",
    ],
  },
  {
    name: "Elite",
    price: 220,
    benefits: [
      "Code Mode unlock later",
      "Let It / Care / High / Ultra High 50% less",
      "Elite thinking support",
    ],
  },
  {
    name: "Supreme",
    price: 400,
    benefits: [
      "Supreme thinking unlock",
      "Personal mode later",
      "Infinite 🪶 later",
    ],
  },
];

const starter: Message = {
  role: "assistant",
  content: "Hi! I’m KOYAL AI V2.0. How can I help you today?",
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([starter]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [preciseMode, setPreciseMode] = useState(true);
  const [imageMode, setImageMode] = useState(false);
  const [philosophicalMode, setPhilosophicalMode] = useState(false);

  const [thinkingEffort, setThinkingEffort] =
    useState<ThinkingEffort>("high");
  const [thinkingBarOpen, setThinkingBarOpen] = useState(false);

  const [featherBalance, setFeatherBalance] = useState(
    STARTING_FEATHER_BALANCE
  );
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");

  const [selectedPlan, setSelectedPlan] = useState<PlanName>("Just");

  const [characterMode, setCharacterMode] =
    useState<CharacterMode>("normal");
  const [characterMenuOpen, setCharacterMenuOpen] = useState(false);

  const [teacherMode, setTeacherMode] = useState(false);
  const [teacherClass, setTeacherClass] = useState<TeacherClass>("5");
  const [teacherSubject, setTeacherSubject] =
    useState<TeacherSubject>("general-science");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"file" | "photo" | "video">(
    "file"
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    name: "",
    dob: "",
    gender: "",
    phone: "",
    photo: "",
  });

  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);

  const currentCharacter =
    characterOptions.find((character) => character.id === characterMode) ||
    characterOptions[0];

  const availableTeacherSubjects =
    Number(teacherClass) <= 5 ? juniorTeacherSubjects : seniorTeacherSubjects;

  const currentTeacherSubject =
    availableTeacherSubjects.find((subject) => subject.id === teacherSubject) ||
    availableTeacherSubjects[0];

  const rawThinkingIndex = thinkingEffortOptions.findIndex(
    (item) => item.id === thinkingEffort
  );

  const currentThinkingIndex = rawThinkingIndex >= 0 ? rawThinkingIndex : 3;

  const currentThinking =
    thinkingEffortOptions[currentThinkingIndex] || thinkingEffortOptions[3];

  const currentMessageFeatherCost =
    currentThinking.feathers === "locked" ? 0 : currentThinking.feathers;

  const statusParts: string[] = [];

  if (preciseMode) statusParts.push("🎯 Precise");

  statusParts.push(`🧠 ${currentThinking.name}`);

  if (selectedPlan !== "Just") {
    statusParts.push(`💎 ${selectedPlan}`);
  }

  if (teacherMode) {
    statusParts.push(
      `📚 Class ${teacherClass} • ${currentTeacherSubject.icon} ${currentTeacherSubject.name}`
    );
  } else if (characterMode !== "normal") {
    statusParts.push(`${currentCharacter.icon} ${currentCharacter.name}`);
  }

  if (philosophicalMode) statusParts.push("💭 Philosophical");

  if (!statusParts.length) statusParts.push("KOYAL AI");

  useEffect(() => {
    const saved =
      localStorage.getItem("koyal-ai-chat") ||
      localStorage.getItem("it-hub-ai-chat");

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
      }
    } catch (error) {
      console.error("Chat load error:", error);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-profile");

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      setProfile({
        name: parsed.name || "",
        dob: parsed.dob || "",
        gender: parsed.gender || "",
        phone: parsed.phone || "",
        photo: parsed.photo || "",
      });
    } catch (error) {
      console.error("Profile load error:", error);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-character");

    const valid: CharacterMode[] = [
      "normal",
      "mother",
      "father",
      "school-friend",
      "school-female-friend",
      "business-partner",
      "enemy",
    ];

    if (saved && valid.includes(saved as CharacterMode)) {
      setCharacterMode(saved as CharacterMode);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-philosophical-mode");
    setPhilosophicalMode(saved === "true");
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-subscription-plan");

    const validPlans: PlanName[] = ["Just", "Let It", "Care", "Elite", "Supreme"];

    if (saved && validPlans.includes(saved as PlanName)) {
      setSelectedPlan(saved as PlanName);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-thinking-effort");
    const savedPlan = localStorage.getItem("koyal-ai-subscription-plan");

    const valid: ThinkingEffort[] = [
      "just",
      "let-it",
      "care",
      "high",
      "ultra-high",
      "elite",
      "supreme",
    ];

    if (saved && valid.includes(saved as ThinkingEffort)) {
      if (saved === "supreme" && savedPlan !== "Supreme") {
        setThinkingEffort("high");
        localStorage.setItem("koyal-ai-thinking-effort", "high");
      } else {
        setThinkingEffort(saved as ThinkingEffort);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedPlan !== "Supreme" && thinkingEffort === "supreme") {
      setThinkingEffort("high");
      localStorage.setItem("koyal-ai-thinking-effort", "high");
    }
  }, [selectedPlan, thinkingEffort]);

  useEffect(() => {
    const saved = localStorage.getItem("koyal-ai-feather-balance");

    if (!saved) return;

    const value = Number(saved);

    if (!Number.isNaN(value) && value >= 0) {
      setFeatherBalance(value);
    }
  }, []);

  useEffect(() => {
    const savedMode = localStorage.getItem("koyal-ai-teacher-mode");
    const savedClass = localStorage.getItem("koyal-ai-teacher-class");
    const savedSubject = localStorage.getItem("koyal-ai-teacher-subject");

    const validClasses: TeacherClass[] = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ];

    let resolvedClass: TeacherClass = "5";

    if (savedClass && validClasses.includes(savedClass as TeacherClass)) {
      resolvedClass = savedClass as TeacherClass;
    }

    const allowed =
      Number(resolvedClass) <= 5
        ? juniorTeacherSubjects
        : seniorTeacherSubjects;

    const validSubject =
      savedSubject &&
      allTeacherSubjects.some((subject) => subject.id === savedSubject) &&
      allowed.some((subject) => subject.id === savedSubject);

    setTeacherMode(savedMode === "true");
    setTeacherClass(resolvedClass);
    setTeacherSubject(
      validSubject ? (savedSubject as TeacherSubject) : "general-science"
    );
  }, []);

  useEffect(() => {
    try {
      const safeMessages = messages.map((message) => ({
        role: message.role,
        content: message.content,
        fileName: message.fileName,
      }));

      localStorage.setItem("koyal-ai-chat", JSON.stringify(safeMessages));
    } catch (error) {
      console.error("Chat save error:", error);
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  function selectCharacter(mode: CharacterMode) {
    setCharacterMode(mode);
    localStorage.setItem("koyal-ai-character", mode);
    setCharacterMenuOpen(false);
  }

  function togglePhilosophicalMode() {
    setPhilosophicalMode((previous) => {
      const next = !previous;
      localStorage.setItem("koyal-ai-philosophical-mode", String(next));
      return next;
    });
  }

  function changeThinkingEffortByIndex(index: number) {
    const option = thinkingEffortOptions[index];

    if (!option) return;

    if (option.id === "supreme" && selectedPlan !== "Supreme") {
      alert("Supreme Thinking needs Supreme Subscription.");
      return;
    }

    setThinkingEffort(option.id);
    localStorage.setItem("koyal-ai-thinking-effort", option.id);
  }

  function buyFeathers() {
    const amount = Number(rechargeAmount);

    if (!Number.isInteger(amount) || amount <= 0) {
      alert("Please enter a valid 🪶 amount.");
      return;
    }

    if (amount > 100000) {
      alert("Maximum recharge is 100000 🪶 at once.");
      return;
    }

    const nextBalance = featherBalance + amount;

    setFeatherBalance(nextBalance);
    localStorage.setItem("koyal-ai-feather-balance", String(nextBalance));

    setRechargeAmount("");
    setRechargeOpen(false);

    alert(`${amount} 🪶 added successfully.`);
  }

  function buySubscription(plan: PlanName) {
    setSelectedPlan(plan);
    localStorage.setItem("koyal-ai-subscription-plan", plan);

    if (plan !== "Supreme" && thinkingEffort === "supreme") {
      setThinkingEffort("high");
      localStorage.setItem("koyal-ai-thinking-effort", "high");
    }

    alert(`${plan} plan activated successfully.`);
  }

  function toggleTeacherMode() {
    setTeacherMode((previous) => {
      const next = !previous;
      localStorage.setItem("koyal-ai-teacher-mode", String(next));
      return next;
    });
  }

  function changeTeacherClass(newClass: TeacherClass) {
    setTeacherClass(newClass);
    localStorage.setItem("koyal-ai-teacher-class", newClass);

    const subjects =
      Number(newClass) <= 5 ? juniorTeacherSubjects : seniorTeacherSubjects;

    const stillAvailable = subjects.some(
      (subject) => subject.id === teacherSubject
    );

    if (!stillAvailable) {
      setTeacherSubject("general-science");
      localStorage.setItem("koyal-ai-teacher-subject", "general-science");
    }
  }

  function changeTeacherSubject(subject: TeacherSubject) {
    setTeacherSubject(subject);
    localStorage.setItem("koyal-ai-teacher-subject", subject);
  }

  function newChat() {
    stopAudio();

    setMessages([starter]);
    setInput("");
    setSelectedFile(null);
    setImageMode(false);
    setUploadMenuOpen(false);
    setCharacterMenuOpen(false);
    setThinkingBarOpen(false);

    localStorage.removeItem("koyal-ai-chat");

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function saveProfile() {
    if (!profile.name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!profile.dob) {
      alert("Please enter your date of birth.");
      return;
    }

    if (!profile.gender) {
      alert("Please select your gender.");
      return;
    }

    if (!profile.phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    localStorage.setItem("koyal-ai-profile", JSON.stringify(profile));
    setProfileOpen(false);
  }

  function signOutProfile() {
    const confirmSignOut = confirm(
      "Sign out from this profile? This will clear profile, chat, plan and 🪶 balance."
    );

    if (!confirmSignOut) return;

    stopAudio();

    localStorage.removeItem("koyal-ai-profile");
    localStorage.removeItem("koyal-ai-chat");
    localStorage.removeItem("it-hub-ai-chat");
    localStorage.removeItem("koyal-ai-feather-balance");
    localStorage.removeItem("koyal-ai-subscription-plan");

    setProfile({
      name: "",
      dob: "",
      gender: "",
      phone: "",
      photo: "",
    });

    setMessages([starter]);
    setFeatherBalance(STARTING_FEATHER_BALANCE);
    setSelectedPlan("Just");

    if (thinkingEffort === "supreme") {
      setThinkingEffort("high");
      localStorage.setItem("koyal-ai-thinking-effort", "high");
    }

    setProfileOpen(false);
  }

  function chooseProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
      alert("Please use JPG, PNG or WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Profile photo must be under 5 MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setProfile((previous) => ({
        ...previous,
        photo: reader.result as string,
      }));
    };

    reader.readAsDataURL(file);
  }

  function openUpload(type: "file" | "photo" | "video") {
    setUploadType(type);
    setUploadMenuOpen(false);
    setImageMode(false);

    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }

  function getAcceptedFormats() {
    if (uploadType === "photo") return ".jpg,.jpeg,.png,.webp";

    if (uploadType === "video") return ".mp4,.webm,.mov";

    return ".pdf,.docx,.txt,.csv,.json,.md,.js,.jsx,.ts,.tsx,.html,.css,.py";
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const maxSize =
      uploadType === "video" ? 100 * 1024 * 1024 : 20 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        uploadType === "video"
          ? "Video must be under 100 MB."
          : "File must be under 20 MB."
      );

      event.target.value = "";
      return;
    }

    setSelectedFile(file);
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
    if (speakingIndex === index) {
      stopAudio();
      return;
    }
    stopAudio();
    if (!("speechSynthesis" in window)) {
      alert("Speech output is not supported in this browser.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find(v => v.lang.toLowerCase() === "en-in") || voices.find(v => v.lang.toLowerCase().startsWith("en")) || null;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  }

  async function sendChatMessage(message: string, file: File | null) {
    let mode = "Normal";

    if (teacherMode) {
      mode = "Teacher";
    } else if (characterMode !== "normal") {
      mode = "Character";
    } else if (philosophicalMode) {
      mode = "Philosophical";
    } else if (preciseMode) {
      mode = "Precise";
    }

    const thinkingNames: Record<ThinkingEffort, string> = {
      just: "Just",
      "let-it": "Let It",
      care: "Care",
      high: "High",
      "ultra-high": "Ultra High",
      elite: "Elite",
      supreme: "Supreme",
    };

    let finalMessage = message;

    if (file) {
      finalMessage += `

The user attached a file named: ${file.name}
File type: ${file.type || "unknown"}
File size: ${(file.size / 1024 / 1024).toFixed(2)} MB

Note: If you cannot directly inspect the file contents, say so clearly.`;
    }

    if (characterMode !== "normal") {
      finalMessage += `

Character mode: ${currentCharacter.name}.
Respond according to this character mode.`;
    }

    if (teacherMode) {
      finalMessage += `

Teacher Mode is enabled.
Student class: ${teacherClass}.
Subject: ${currentTeacherSubject.name}.
Explain at an appropriate Class ${teacherClass} level.`;
    }

    if (philosophicalMode) {
      finalMessage += `

Philosophical Mode is enabled.
Give a deeper and thoughtful answer when appropriate.`;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: finalMessage,
        thinkingLevel: thinkingNames[thinkingEffort],
        mode,
        name: profile.name,

        characterMode,
        philosophicalMode,
        preciseMode,
        teacherMode,
        teacherClass,
        teacherSubject: currentTeacherSubject.id,

        profile: {
          name: profile.name,
          dob: profile.dob,
          gender: profile.gender,
        },
      }),
    });

    const raw = await response.text();

    let data: ChatApiResponse;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid server response (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(data.error || "Chat request failed.");
    }

    if (!data.reply) {
      throw new Error("KOYAL AI returned no answer.");
    }

    return data.reply;
  }

  async function generateImage(prompt: string) {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const raw = await response.text();

    let data: ImageApiResponse;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid image server response.");
    }

    if (!response.ok) throw new Error(data.error || "Image generation failed.");

    if (!data.image) throw new Error("No image was returned.");

    const mimeType = data.mimeType || "image/png";

    return {
      imageUrl: `data:${mimeType};base64,${data.image}`,
      reply: data.reply || "Here is your generated image.",
    };
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();

    const text = input.trim();

    if ((!text && !selectedFile) || loading) return;

    if (imageMode && !text) return;

    if (currentThinking.feathers === "locked" && selectedPlan !== "Supreme") {
      alert("Supreme Thinking needs Supreme Subscription.");
      return;
    }

    if (featherBalance < currentMessageFeatherCost) {
      alert(
        `Not enough 🪶. You need ${currentMessageFeatherCost} 🪶 for this message.`
      );
      return;
    }

    const currentFile = selectedFile;

    const messageToSend =
      text ||
      (uploadType === "photo"
        ? "Please analyze this photo."
        : uploadType === "video"
        ? "Please analyze this video."
        : "Please analyze this file.");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: imageMode ? `✨ ${messageToSend}` : messageToSend,
        fileName: currentFile?.name,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      if (currentMessageFeatherCost > 0) {
        const nextBalance = featherBalance - currentMessageFeatherCost;

        setFeatherBalance(nextBalance);
        localStorage.setItem("koyal-ai-feather-balance", String(nextBalance));
      }

      if (imageMode) {
        const result = await generateImage(messageToSend);

        setMessages((previous) => [
          ...previous,
          {
            role: "assistant",
            content: result.reply,
            imageUrl: result.imageUrl,
          },
        ]);

        return;
      }

      const reply = await sendChatMessage(messageToSend, currentFile);

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: reply,
        },
      ]);

      removeFile();
    } catch (error) {
      if (currentMessageFeatherCost > 0) {
        setFeatherBalance(featherBalance);
        localStorage.setItem("koyal-ai-feather-balance", String(featherBalance));
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Error: ${error.message}`
              : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "22px" }}>KOYAL AI</h1>
          <div style={{ fontSize: "9px", opacity: 0.4 }}>V2.0</div>
        </div>

        <span
          style={{
            position: "absolute",
            right: "24px",
            fontSize: "12px",
            opacity: 0.7,
          }}
        >
          ● Online
        </span>
      </header>

      <div style={layoutStyle}>
        <aside style={sidebarStyle}>
          <div style={{ padding: "4px 10px 20px" }}>
            <strong style={{ fontSize: "18px" }}>KOYAL AI</strong>

            <div style={{ fontSize: "9px", opacity: 0.4 }}>V2.0</div>

            <div
              style={{
                marginTop: "7px",
                fontSize: "11px",
                lineHeight: 1.45,
                opacity: 0.55,
              }}
            >
              Brought to you by
              <br />
              Divyansh Acharjee & Tejas Raj
            </div>
          </div>

          <button type="button" onClick={newChat} style={newChatStyle}>
            ＋ New Chat
          </button>

          <div style={sectionTitleStyle}>DASHBOARD</div>

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            style={dashboardButtonStyle}
          >
            <span style={dashboardIconStyle}>
              {profile.photo ? (
                <img
                  src={profile.photo}
                  alt="Profile"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                "👤"
              )}
            </span>

            <span>
              <strong>Profile</strong>

              {profile.name && <small style={smallTextStyle}>{profile.name}</small>}
            </span>
          </button>

          <div style={featherBalanceBoxStyle}>
            <div>
              <div style={featherBalanceTitleStyle}>🪶 BALANCE</div>

              <div style={featherBalanceNumberStyle}>{featherBalance} 🪶</div>
            </div>

            <button
              type="button"
              onClick={() => setRechargeOpen(true)}
              style={rechargeButtonStyle}
            >
              Recharge
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPreciseMode((previous) => !previous)}
            style={{
              ...dashboardButtonStyle,
              background: preciseMode ? activeBackground : "transparent",
            }}
          >
            <span style={dashboardIconStyle}>🎯</span>

            <span style={{ flex: 1 }}>
              <strong>Precise Mode</strong>

              <small style={smallTextStyle}>
                {preciseMode ? "Enabled" : "Disabled"}
              </small>
            </span>

            <span>{preciseMode ? "●" : "○"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImageMode((previous) => !previous);
              setSelectedFile(null);
              setUploadMenuOpen(false);
            }}
            style={{
              ...dashboardButtonStyle,
              background: imageMode ? activeBackground : "transparent",
            }}
          >
            <span style={dashboardIconStyle}>✨</span>

            <span style={{ flex: 1 }}>
              <strong>Image Creation</strong>

              <small style={smallTextStyle}>
                {imageMode ? "Active" : "Create images"}
              </small>
            </span>

            <span>{imageMode ? "●" : "○"}</span>
          </button>

          <div style={sectionTitleStyle}>🎭 CHARACTER MODE</div>

          <button
            type="button"
            onClick={() => setCharacterMenuOpen((previous) => !previous)}
            style={{
              ...dashboardButtonStyle,
              background:
                characterMode !== "normal" ? activeBackground : "transparent",
            }}
          >
            <span style={dashboardIconStyle}>{currentCharacter.icon}</span>

            <span style={{ flex: 1 }}>
              <strong>{currentCharacter.name}</strong>

              <small style={smallTextStyle}>Choose character</small>
            </span>

            <span>{characterMenuOpen ? "▲" : "▼"}</span>
          </button>

          {characterMenuOpen && (
            <div style={menuBoxStyle}>
              {characterOptions.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => selectCharacter(character.id)}
                  style={{
                    ...menuButtonStyle,
                    background:
                      characterMode === character.id
                        ? activeBackground
                        : "transparent",
                  }}
                >
                  <span style={{ width: 28, fontSize: 18 }}>
                    {character.icon}
                  </span>

                  <span style={{ flex: 1 }}>
                    <strong style={{ display: "block", fontSize: "12px" }}>
                      {character.name}
                    </strong>

                    <small style={{ opacity: 0.45, fontSize: "10px" }}>
                      {character.description}
                    </small>
                  </span>

                  {characterMode === character.id && <span>✓</span>}
                </button>
              ))}
            </div>
          )}

          <div style={sectionTitleStyle}>📚 TEACHER MODE</div>

          <button
            type="button"
            onClick={toggleTeacherMode}
            style={{
              ...dashboardButtonStyle,
              background: teacherMode ? activeBackground : "transparent",
            }}
          >
            <span style={dashboardIconStyle}>📚</span>

            <span style={{ flex: 1 }}>
              <strong>Teacher Mode</strong>

              <small style={smallTextStyle}>
                {teacherMode ? "Teaching enabled" : "Class-based learning"}
              </small>
            </span>

            <span>{teacherMode ? "●" : "○"}</span>
          </button>

          {teacherMode && (
            <div style={teacherBoxStyle}>
              <label style={teacherLabelStyle}>
                🏫 Class

                <select
                  value={teacherClass}
                  onChange={(event) =>
                    changeTeacherClass(event.target.value as TeacherClass)
                  }
                  style={teacherSelectStyle}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (classNumber) => (
                      <option key={classNumber} value={String(classNumber)}>
                        Class {classNumber}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label style={teacherLabelStyle}>
                📚 Subject

                <select
                  value={currentTeacherSubject.id}
                  onChange={(event) =>
                    changeTeacherSubject(event.target.value as TeacherSubject)
                  }
                  style={teacherSelectStyle}
                >
                  {availableTeacherSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.icon} {subject.name}
                    </option>
                  ))}
                </select>
              </label>

              {Number(teacherClass) <= 5 && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    lineHeight: 1.4,
                    opacity: 0.45,
                  }}
                >
                  Specialized Physics, Chemistry, Biology, History, Geography,
                  Civics and Economics unlock from Class 6.
                </div>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: "15px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <button
              type="button"
              onClick={togglePhilosophicalMode}
              style={{
                ...dashboardButtonStyle,
                background: philosophicalMode ? activeBackground : "transparent",
              }}
            >
              <span style={dashboardIconStyle}>💭</span>

              <span style={{ flex: 1 }}>
                <strong>Philosophical Mode</strong>

                <small style={smallTextStyle}>
                  {philosophicalMode
                    ? "Deep thinking enabled"
                    : "Deep & thoughtful answers"}
                </small>
              </span>

              <span>{philosophicalMode ? "●" : "○"}</span>
            </button>
          </div>

          <div
            style={{
              marginTop: "auto",
              padding: 10,
              fontSize: 10,
              opacity: 0.35,
            }}
          >
            KOYAL AI V2.0
          </div>
        </aside>

        <section style={chatSectionStyle}>
          <div style={messagesStyle}>
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    message.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: "22px",
                }}
              >
                <div style={{ maxWidth: 760 }}>
                  {message.fileName && (
                    <div
                      style={{
                        marginBottom: 7,
                        fontSize: 12,
                        opacity: 0.65,
                      }}
                    >
                      📎 {message.fileName}
                    </div>
                  )}

                  <div
                    style={{
                      padding: "13px 16px",
                      borderRadius:
                        message.role === "user"
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                      background:
                        message.role === "user"
                          ? "rgba(255,255,255,0.12)"
                          : "rgba(255,255,255,0.06)",
                      lineHeight: "1.6",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {message.content}
                  </div>

                  {message.imageUrl && (
                    <img
                      src={message.imageUrl}
                      alt="Generated by KOYAL AI"
                      style={{
                        width: "100%",
                        maxWidth: 520,
                        borderRadius: 16,
                        marginTop: 10,
                      }}
                    />
                  )}

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
              <div style={{ opacity: 0.6, marginBottom: 20 }}>
                {teacherMode
                  ? `${currentTeacherSubject.icon} Class ${teacherClass} ${currentTeacherSubject.name} teacher is thinking...`
                  : philosophicalMode
                  ? "💭 KOYAL AI is thinking deeply..."
                  : characterMode !== "normal"
                  ? `${currentCharacter.icon} ${currentCharacter.name} is thinking...`
                  : "KOYAL AI is thinking..."}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} style={composerAreaStyle}>
            {!imageMode &&
              (teacherMode || characterMode !== "normal" || philosophicalMode) && (
                <div style={modeIndicatorStyle}>
                  {teacherMode ? (
                    <>
                      📚 <strong>Teacher Mode</strong> • Class {teacherClass} •{" "}
                      {currentTeacherSubject.icon} {currentTeacherSubject.name}
                    </>
                  ) : (
                    characterMode !== "normal" && (
                      <>
                        🎭 Talking as:{" "}
                        <strong>
                          {currentCharacter.icon} {currentCharacter.name}
                        </strong>
                      </>
                    )
                  )}

                  {philosophicalMode && (
                    <>
                      {(teacherMode || characterMode !== "normal") && " • "}
                      <strong>💭 Philosophical</strong>
                    </>
                  )}
                </div>
              )}

            {imageMode && (
              <div style={attachmentPreviewStyle}>
                <span>
                  ✨ <strong>Image Creation</strong>

                  <small style={{ display: "block", opacity: 0.55 }}>
                    Describe the image you want.
                  </small>
                </span>

                <button
                  type="button"
                  onClick={() => setImageMode(false)}
                  style={closeButtonStyle}
                >
                  ✕
                </button>
              </div>
            )}

            {selectedFile && (
              <div style={attachmentPreviewStyle}>
                <span>
                  📎 <strong>{selectedFile.name}</strong>

                  <small style={{ display: "block", opacity: 0.55 }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </small>
                </span>

                <button type="button" onClick={removeFile} style={closeButtonStyle}>
                  ✕
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept={getAcceptedFormats()}
              onChange={chooseFile}
            />

            {thinkingBarOpen && (
              <div style={thinkingPopupWrapStyle}>
                <div style={thinkingPopupStyle}>
                  <div style={thinkingPopupTopStyle}>
                    <span>
                      <strong>
                        {currentThinking.feathers === "locked"
                          ? selectedPlan === "Supreme"
                            ? "∞ 🪶"
                            : "🔒"
                          : `${currentThinking.feathers} 🪶`}
                      </strong>{" "}
                      <span
                        style={{
                          color: "#3b82f6",
                          fontWeight: 700,
                        }}
                      >
                        {currentThinking.name}
                      </span>{" "}
                      <span style={{ opacity: 0.5 }}>›</span>
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={thinkingEffortOptions.length - 1}
                    step={1}
                    value={currentThinkingIndex}
                    onChange={(event) =>
                      changeThinkingEffortByIndex(Number(event.target.value))
                    }
                    style={thinkingRangeStyle}
                  />

                  <div style={thinkingDotsStyle}>
                    {thinkingEffortOptions.map((item, index) => (
                      <span
                        key={item.id}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background:
                            index === currentThinkingIndex
                              ? "#ffffff"
                              : item.id === "supreme"
                              ? "rgba(255,255,255,0.45)"
                              : "rgba(255,255,255,0.25)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={composerStyle}>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setUploadMenuOpen((previous) => !previous)}
                  disabled={loading || imageMode}
                  style={composerButtonStyle}
                >
                  ＋
                </button>

                {uploadMenuOpen && (
                  <div style={uploadPopupStyle}>
                    <button
                      type="button"
                      onClick={() => openUpload("photo")}
                      style={uploadMenuButtonStyle}
                    >
                      📷 Photo
                    </button>

                    <button
                      type="button"
                      onClick={() => openUpload("video")}
                      style={uploadMenuButtonStyle}
                    >
                      🎬 Video
                    </button>

                    <button
                      type="button"
                      onClick={() => openUpload("file")}
                      style={uploadMenuButtonStyle}
                    >
                      📄 File
                    </button>
                  </div>
                )}
              </div>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  imageMode
                    ? "Describe an image..."
                    : selectedFile
                    ? `Ask about ${selectedFile.name}...`
                    : teacherMode
                    ? `Ask your Class ${teacherClass} ${currentTeacherSubject.name} teacher...`
                    : philosophicalMode
                    ? "Ask KOYAL AI something deeper..."
                    : characterMode !== "normal"
                    ? `Message ${currentCharacter.name}...`
                    : "Message KOYAL AI..."
                }
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                style={textAreaStyle}
              />

              <button
                type="submit"
                disabled={loading || (!input.trim() && !selectedFile)}
                style={composerButtonStyle}
              >
                {loading ? "..." : imageMode ? "✨" : "➤"}
              </button>

              <button
                type="button"
                onClick={() => setThinkingBarOpen((previous) => !previous)}
                style={thinkingPillStyle}
              >
                Thinking effort
                <span style={{ opacity: 0.65 }}>
                  {thinkingBarOpen ? "▲" : "▼"}
                </span>
              </button>

              <VoiceMode />
            </div>

            <div style={statusStyle}>
              {imageMode ? "✨ Image Creation" : statusParts.join(" • ")}
            </div>
          </form>
        </section>
      </div>

      {rechargeOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>Recharge 🪶</h2>

                <small style={{ opacity: 0.5 }}>
                  Type how many 🪶 you want and click Buy
                </small>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRechargeOpen(false);
                  setRechargeAmount("");
                }}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <label style={profileLabelStyle}>
              Type your wanted 🪶

              <input
                type="number"
                min="1"
                value={rechargeAmount}
                onChange={(event) => setRechargeAmount(event.target.value)}
                placeholder="Example: 100"
                style={profileInputStyle}
              />
            </label>

            <button type="button" onClick={buyFeathers} style={saveButtonStyle}>
              Buy 🪶
            </button>
          </div>
        </div>
      )}

      {profileOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0 }}>👤 Profile</h2>

                <small style={{ opacity: 0.5 }}>
                  KOYAL AI V2.0 • Plan: {selectedPlan}
                </small>
              </div>

              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                style={closeButtonStyle}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 22,
              }}
            >
              <button
                type="button"
                onClick={() => profilePhotoRef.current?.click()}
                style={profilePhotoStyle}
              >
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt="Profile"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "👤"
                )}
              </button>

              <input
                ref={profilePhotoRef}
                type="file"
                hidden
                accept=".jpg,.jpeg,.png,.webp"
                onChange={chooseProfilePhoto}
              />
            </div>

            <label style={profileLabelStyle}>
              Name

              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                style={profileInputStyle}
              />
            </label>

            <label style={profileLabelStyle}>
              Date of Birth

              <input
                type="date"
                value={profile.dob}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    dob: event.target.value,
                  }))
                }
                style={profileInputStyle}
              />
            </label>

            <label style={profileLabelStyle}>
              Gender

              <select
                value={profile.gender}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    gender: event.target.value,
                  }))
                }
                style={profileInputStyle}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>

            <label style={profileLabelStyle}>
              Phone Number

              <input
                type="tel"
                value={profile.phone}
                onChange={(event) =>
                  setProfile((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                style={profileInputStyle}
              />
            </label>

            <div style={subscriptionBoxStyle}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: 0.75,
                  marginBottom: 10,
                }}
              >
                💎 Subscription
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {subscriptionPlans.map((plan) => (
                  <div
                    key={plan.name}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background:
                        selectedPlan === plan.name
                          ? "rgba(59,130,246,0.18)"
                          : "rgba(255,255,255,0.055)",
                      border:
                        selectedPlan === plan.name
                          ? "1px solid rgba(59,130,246,0.45)"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <strong>{plan.name}</strong>
                      <strong>₹{plan.price}</strong>
                    </div>

                    <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                      {plan.benefits.map((benefit) => (
                        <div
                          key={benefit}
                          style={{ fontSize: 11, opacity: 0.65 }}
                        >
                          ✅ {benefit}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => buySubscription(plan.name)}
                      style={{
                        width: "100%",
                        padding: "9px 10px",
                        border: 0,
                        borderRadius: 10,
                        cursor: "pointer",
                        fontWeight: 700,
                        background:
                          selectedPlan === plan.name
                            ? "rgba(255,255,255,0.18)"
                            : "#ffffff",
                        color:
                          selectedPlan === plan.name ? "#ffffff" : "#111111",
                      }}
                    >
                      {selectedPlan === plan.name ? "Current Plan" : "Buy Plan"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button type="button" onClick={saveProfile} style={saveButtonStyle}>
              Save Profile
            </button>

            <button
              type="button"
              onClick={signOutProfile}
              style={signOutButtonStyle}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

const activeBackground = "rgba(255,255,255,0.10)";

const mainStyle: CSSProperties = {
  height: "100vh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "#0d0f14",
  color: "#fff",
};

const headerStyle: CSSProperties = {
  height: 64,
  minHeight: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#11141b",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  position: "relative",
};

const layoutStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
};

const sidebarStyle: CSSProperties = {
  width: 270,
  minWidth: 270,
  display: "flex",
  flexDirection: "column",
  padding: "20px 14px",
  background: "#11141b",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  overflowY: "auto",
};

const newChatStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  textAlign: "left",
  cursor: "pointer",
  fontWeight: 600,
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 22,
  marginBottom: 8,
  paddingLeft: 10,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.1,
  opacity: 0.45,
};

const dashboardButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 56,
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "10px 12px",
  marginBottom: 5,
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "#fff",
  textAlign: "left",
  cursor: "pointer",
};

const dashboardIconStyle: CSSProperties = {
  width: 30,
  minWidth: 30,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 20,
};

const smallTextStyle: CSSProperties = {
  display: "block",
  opacity: 0.5,
  marginTop: 2,
};

const featherBalanceBoxStyle: CSSProperties = {
  margin: "6px 0 12px",
  padding: "12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.055)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const featherBalanceTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  opacity: 0.55,
  marginBottom: 5,
};

const featherBalanceNumberStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1,
};

const rechargeButtonStyle: CSSProperties = {
  padding: "9px 12px",
  border: 0,
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  color: "white",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const subscriptionBoxStyle: CSSProperties = {
  marginTop: 8,
  marginBottom: 16,
  padding: 14,
  borderRadius: 16,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const menuBoxStyle: CSSProperties = {
  padding: 6,
  marginBottom: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.035)",
};

const menuButtonStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  border: "none",
  borderRadius: 10,
  color: "#fff",
  cursor: "pointer",
  textAlign: "left",
};

const teacherBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "rgba(255,255,255,0.035)",
  marginBottom: 8,
};

const teacherLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 12,
};

const teacherSelectStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 9px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#171a22",
  color: "#fff",
  outline: "none",
};

const chatSectionStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const messagesStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "28px max(25px, 8vw)",
};

const listenButtonStyle: CSSProperties = {
  marginTop: 7,
  border: 0,
  background: "transparent",
  color: "#fff",
  opacity: 0.55,
  cursor: "pointer",
  fontSize: 12,
};

const composerAreaStyle: CSSProperties = {
  padding: "12px 24px 18px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const modeIndicatorStyle: CSSProperties = {
  maxWidth: 950,
  margin: "0 auto 7px",
  paddingLeft: 6,
  fontSize: 11,
  opacity: 0.65,
};

const composerStyle: CSSProperties = {
  maxWidth: 950,
  margin: "0 auto",
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
  background: "#171a22",
};

const composerButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  minWidth: 40,
  border: "none",
  borderRadius: 12,
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 17,
};

const textAreaStyle: CSSProperties = {
  flex: 1,
  minHeight: 28,
  maxHeight: 120,
  resize: "none",
  border: 0,
  outline: 0,
  background: "transparent",
  color: "#fff",
  padding: "9px 5px",
  fontFamily: "inherit",
  fontSize: 14,
};

const uploadPopupStyle: CSSProperties = {
  position: "absolute",
  bottom: 52,
  left: 0,
  width: 190,
  padding: 8,
  borderRadius: 14,
  background: "#20232d",
  border: "1px solid rgba(255,255,255,0.1)",
  boxShadow: "0 15px 50px rgba(0,0,0,0.45)",
  zIndex: 100,
};

const uploadMenuButtonStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  border: 0,
  borderRadius: 9,
  background: "transparent",
  color: "#fff",
  textAlign: "left",
  cursor: "pointer",
};

const attachmentPreviewStyle: CSSProperties = {
  maxWidth: 950,
  margin: "0 auto 8px",
  padding: "10px 13px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 12,
};

const closeButtonStyle: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  fontSize: 17,
};

const statusStyle: CSSProperties = {
  textAlign: "center",
  fontSize: 10,
  opacity: 0.4,
  marginTop: 7,
};

const thinkingPopupWrapStyle: CSSProperties = {
  maxWidth: 950,
  margin: "0 auto 10px",
  display: "flex",
  justifyContent: "center",
};

const thinkingPopupStyle: CSSProperties = {
  width: 255,
  padding: "12px 14px 11px",
  borderRadius: 18,
  background: "linear-gradient(180deg, #2a2c31, #17191f)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
};

const thinkingPopupTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  position: "relative",
  fontSize: 14,
  marginBottom: 10,
};

const thinkingRangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#3b82f6",
  cursor: "pointer",
};

const thinkingDotsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "0 9px",
  marginTop: "-13px",
  pointerEvents: "none",
};

const thinkingPillStyle: CSSProperties = {
  minWidth: 145,
  height: 40,
  padding: "0 14px",
  border: 0,
  borderRadius: 999,
  background: "rgba(255,255,255,0.09)",
  color: "#d8d8d8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  cursor: "pointer",
  fontSize: 14,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0,0,0,0.72)",
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 430,
  maxHeight: "90vh",
  overflowY: "auto",
  padding: 28,
  borderRadius: 24,
  background: "#171a22",
  border: "1px solid rgba(255,255,255,0.1)",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 25,
};

const profilePhotoStyle: CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  cursor: "pointer",
  overflow: "hidden",
  fontSize: 32,
};

const profileLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 16,
  fontSize: 12,
  fontWeight: 600,
};

const profileInputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 7,
  padding: "12px 13px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "#101219",
  color: "#fff",
  outline: "none",
};

const saveButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 14,
  border: 0,
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const signOutButtonStyle: CSSProperties = {
  width: "100%",
  marginTop: 10,
  padding: 14,
  border: "1px solid rgba(255,80,80,0.35)",
  borderRadius: 12,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
  background: "rgba(255,80,80,0.10)",
  color: "#ff8a8a",
};
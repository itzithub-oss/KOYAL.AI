"use client";

import { useEffect, useRef, useState } from "react";

type ChatApiResponse = {
  reply?: string;
  error?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type OutputLanguage = {
  code: string;
  name: string;
  aiName: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const ENGLISH_LANGUAGE: OutputLanguage = {
  code: "en-IN",
  name: "English",
  aiName: "English",
};

const HINDI_LANGUAGE: OutputLanguage = {
  code: "hi-IN",
  name: "Hindi",
  aiName: "Hindi",
};

export default function VoiceMode({
  subscriptionPlan = "Just",
}: {
  subscriptionPlan?: string;
}) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState("Tap the bird to talk");
  const [heardText, setHeardText] = useState("");
  const [aiText, setAiText] = useState("");
  const [outputLanguage, setOutputLanguage] =
    useState<OutputLanguage>(ENGLISH_LANGUAGE);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [rate, setRate] = useState(0.95);
  const [pitch, setPitch] = useState(1.05);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepListeningRef = useRef(false);
  const micPausedForAiRef = useRef(false);
  const pendingTranscriptRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendingRef = useRef(false);
  const speakingRef = useRef(false);
  const speakingStoppedRef = useRef(false);
  const lastSentRef = useRef("");

  useEffect(() => {
    loadVoices();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
      setTimeout(loadVoices, 600);
    }

    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;

    const availableVoices = window.speechSynthesis.getVoices();

    setVoices(availableVoices);

    if (!selectedVoiceURI && availableVoices.length > 0) {
      const bestVoice =
        availableVoices.find((voice) =>
          voice.lang.toLowerCase().startsWith("en-in")
        ) ||
        availableVoices.find((voice) =>
          voice.name.toLowerCase().includes("microsoft")
        ) ||
        availableVoices.find((voice) =>
          voice.lang.toLowerCase().startsWith("en")
        ) ||
        availableVoices[0];

      setSelectedVoiceURI(bestVoice.voiceURI);
    }
  }

  async function askMicPermission() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone permission API is not available.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    stream.getTracks().forEach((track) => track.stop());
  }

  function userAskedForHindi(text: string) {
    const clean = text.toLowerCase();

    return (
      clean.includes("hindi me") ||
      clean.includes("hindi mein") ||
      clean.includes("hindi m") ||
      clean.includes("reply in hindi") ||
      clean.includes("answer in hindi") ||
      clean.includes("speak in hindi") ||
      clean.includes("say in hindi") ||
      clean.includes("tell in hindi") ||
      clean.includes("translate to hindi") ||
      clean.includes("हिंदी में") ||
      clean.includes("हिन्दी में") ||
      clean.includes("हिंदी मे") ||
      clean.includes("हिन्दी मे")
    );
  }

  function detectRequestedOutputLanguage(text: string): OutputLanguage {
    if (userAskedForHindi(text)) {
      return HINDI_LANGUAGE;
    }

    return ENGLISH_LANGUAGE;
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function clearRestartTimer() {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function getSelectedVoice(languageCode: string) {
    const availableVoices = window.speechSynthesis.getVoices();

    const selected = availableVoices.find(
      (voice) => voice.voiceURI === selectedVoiceURI
    );

    const matchingLanguage =
      availableVoices.find((voice) =>
        voice.lang.toLowerCase().startsWith(languageCode.toLowerCase())
      ) ||
      availableVoices.find((voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(languageCode.split("-")[0].toLowerCase())
      );

    if (matchingLanguage) return matchingLanguage;
    if (selected) return selected;

    return (
      availableVoices.find((voice) =>
        voice.name.toLowerCase().includes("microsoft")
      ) ||
      availableVoices.find((voice) =>
        voice.lang.toLowerCase().startsWith("en")
      ) ||
      availableVoices[0]
    );
  }

  function splitText(text: string) {
    return text
      .replace(/\n+/g, ". ")
      .split(/(?<=[.!?।])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  function stopSpeaking() {
    speakingStoppedRef.current = true;
    speakingRef.current = false;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }

  function pauseMicForAI() {
    micPausedForAiRef.current = true;

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    recognitionRef.current = null;
    setListening(false);
  }

  function stopEverything() {
    keepListeningRef.current = false;
    micPausedForAiRef.current = false;
    pendingTranscriptRef.current = "";

    clearSilenceTimer();
    clearRestartTimer();

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    recognitionRef.current = null;

    speakingStoppedRef.current = true;
    speakingRef.current = false;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setListening(false);
    setSpeaking(false);
    setThinking(false);
    setStatus("Stopped");
  }

  function restartListeningAfterAI() {
    clearRestartTimer();

    if (!keepListeningRef.current) return;

    micPausedForAiRef.current = false;

    restartTimerRef.current = setTimeout(() => {
      if (!keepListeningRef.current) return;
      if (speakingRef.current) return;

      startRecognitionLoop();
    }, 800);
  }

  function speakText(text: string, language: OutputLanguage) {
    if (!("speechSynthesis" in window)) {
      alert("Speech output is not supported in this browser.");
      return;
    }

    pauseMicForAI();

    window.speechSynthesis.cancel();

    speakingStoppedRef.current = false;
    speakingRef.current = true;

    const parts = splitText(text);

    if (parts.length === 0) {
      speakingRef.current = false;
      setSpeaking(false);
      restartListeningAfterAI();
      return;
    }

    let index = 0;

    const speakNext = () => {
      if (speakingStoppedRef.current) {
        speakingRef.current = false;
        setSpeaking(false);
        restartListeningAfterAI();
        return;
      }

      if (index >= parts.length) {
        speakingRef.current = false;
        setSpeaking(false);
        setStatus("Bird finished. Listening again...");
        restartListeningAfterAI();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(parts[index]);

      utterance.lang = language.code;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = 1;

      const voice = getSelectedVoice(language.code);

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        setListening(false);
        setStatus("🐦 Bird is speaking. Mic paused.");
      };

      utterance.onend = () => {
        index += 1;
        setTimeout(speakNext, 180);
      };

      utterance.onerror = () => {
        index += 1;
        setTimeout(speakNext, 180);
      };

      window.speechSynthesis.speak(utterance);

      const keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking || speakingStoppedRef.current) {
          clearInterval(keepAlive);
          return;
        }

        window.speechSynthesis.resume();
      }, 1000);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakNext();
      };

      setTimeout(speakNext, 700);
    } else {
      speakNext();
    }
  }

  async function sendVoiceMessage(userText: string) {
    const cleanText = userText.trim();

    if (!cleanText) {
      setStatus("No voice text received.");
      return;
    }

    const normalized = cleanText.toLowerCase();

    if (normalized === lastSentRef.current.toLowerCase()) {
      setStatus("Duplicate voice ignored.");
      return;
    }

    if (sendingRef.current) {
      setStatus("Bird is already thinking.");
      return;
    }

    const requestedLanguage = detectRequestedOutputLanguage(cleanText);

    setOutputLanguage(requestedLanguage);
    setHeardText(cleanText);
    lastSentRef.current = cleanText;

    try {
      sendingRef.current = true;
      setThinking(true);
      setStatus(`Bird thinking in ${requestedLanguage.name}...`);

      const voicePrompt = `
You are KOYAL AI represented as a friendly speaking bird.

Language rules:
- Reply in English by default.
- Use Hindi only if the user clearly asks for Hindi, such as "Hindi me bolo", "answer in Hindi", "reply in Hindi", or "हिंदी में बताओ".
- Do not automatically reply in Hindi just because the user used one Hindi word.
- Use another language only if the user clearly asks for that language.

Voice rules:
- Keep the answer short, clear, and natural for voice communication.
- Do not say "as an AI".
- Sound friendly like a helpful bird assistant.

User said:
${cleanText}
`.trim();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: voicePrompt,
          mode: "Voice",
          thinkingLevel: "Just",
          voiceMode: true,
          language: requestedLanguage.aiName,
          subscriptionPlan,
        }),
      });

      const raw = await response.text();

      let data: ChatApiResponse;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("Invalid AI server response.");
      }

      if (!response.ok) {
        throw new Error(data.error || "AI voice chat failed.");
      }

      const reply = data.reply || "I could not answer.";

      setAiText(reply);
      setStatus(`Bird replied in ${requestedLanguage.name}.`);

      speakText(reply, requestedLanguage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Voice message failed.";

      setAiText(`Error: ${message}`);
      setStatus(message);
      alert(message);
    } finally {
      sendingRef.current = false;
      setThinking(false);
    }
  }

  function scheduleSendAfterSilence() {
    clearSilenceTimer();

    silenceTimerRef.current = setTimeout(() => {
      const text = pendingTranscriptRef.current.trim();

      if (!text) return;

      pendingTranscriptRef.current = "";
      sendVoiceMessage(text);
    }, 1300);
  }

  function startRecognitionLoop() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported. Use Google Chrome or Microsoft Edge.");
      setStatus("Use Chrome or Edge.");
      return;
    }

    if (!keepListeningRef.current) return;
    if (speakingRef.current) return;

    micPausedForAiRef.current = false;

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    const recognition = new SpeechRecognition();

    // English by default. Hindi answer happens only when asked.
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setStatus("🐦 Listening... speak naturally.");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      const currentText = (finalText || interimText).trim();

      if (currentText) {
        setHeardText(currentText);
        setStatus("Voice detected.");
      }

      if (finalText.trim()) {
        pendingTranscriptRef.current =
          `${pendingTranscriptRef.current} ${finalText}`.trim();

        scheduleSendAfterSilence();
      }
    };

    recognition.onerror = (event: any) => {
      const errorName = event?.error || "unknown";

      if (errorName === "not-allowed") {
        keepListeningRef.current = false;
        setListening(false);
        setStatus("Microphone blocked.");
        alert("Microphone is blocked. Click lock icon near URL and allow mic.");
        return;
      }

      if (errorName === "audio-capture") {
        keepListeningRef.current = false;
        setListening(false);
        setStatus("No microphone found.");
        alert("No microphone found. Check Windows sound input.");
        return;
      }

      if (errorName === "network") {
        setStatus("Speech recognition network error.");
        alert("Speech recognition needs internet in Chrome or Edge.");
        return;
      }

      if (errorName === "no-speech") {
        setStatus("No speech detected. Still listening...");
        return;
      }

      setStatus(`Mic error: ${errorName}`);
    };

    recognition.onend = () => {
      setListening(false);

      if (micPausedForAiRef.current) return;
      if (!keepListeningRef.current) return;
      if (speakingRef.current) return;

      clearRestartTimer();

      restartTimerRef.current = setTimeout(() => {
        if (!keepListeningRef.current) return;
        if (speakingRef.current) return;

        startRecognitionLoop();
      }, 500);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setStatus("Mic already started. Wait and try again.");
    }
  }

  async function startBirdCommunication() {
    setOpen(true);
    setHeardText("");
    setAiText("");
    setStatus("Starting bird communication...");
    pendingTranscriptRef.current = "";
    lastSentRef.current = "";

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported. Use Google Chrome or Microsoft Edge.");
      setStatus("Use Chrome or Edge.");
      return;
    }

    try {
      await askMicPermission();
    } catch {
      alert("Microphone is blocked. Allow microphone permission.");
      setStatus("Microphone permission blocked.");
      return;
    }

    stopEverything();

    keepListeningRef.current = true;
    micPausedForAiRef.current = false;
    speakingStoppedRef.current = true;
    speakingRef.current = false;

    setOpen(true);
    setStatus("Bird is ready. Speak now.");

    startRecognitionLoop();
  }

  function sendHeardTextManually() {
    const text = (pendingTranscriptRef.current || heardText).trim();

    if (!text) {
      alert("No voice text captured yet.");
      return;
    }

    pendingTranscriptRef.current = "";
    clearSilenceTimer();
    sendVoiceMessage(text);
  }

  function testBirdVoice() {
    speakText(
      "Hello, I am the KOYAL bird. I will reply in Hindi only when you ask for Hindi.",
      ENGLISH_LANGUAGE
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={startBirdCommunication}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.14)",
          background: listening
            ? "rgba(34,197,94,0.28)"
            : speaking
            ? "rgba(59,130,246,0.28)"
            : "rgba(255,255,255,0.08)",
          color: "#ffffff",
          cursor: "pointer",
          fontSize: 22,
        }}
        title="Talk with KOYAL bird"
      >
        {speaking ? "🐦" : listening ? "🟢" : "🐦"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 54,
            width: 320,
            padding: 16,
            borderRadius: 24,
            background: "rgba(10,10,14,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              <strong>🐦 KOYAL Bird</strong>
              <div style={{ fontSize: 11, opacity: 0.55 }}>
                English default • Hindi only when asked
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                stopEverything();
                setOpen(false);
              }}
              style={{
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                borderRadius: 999,
                width: 28,
                height: 28,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "18px 10px",
              borderRadius: 20,
              background: speaking
                ? "rgba(59,130,246,0.16)"
                : listening
                ? "rgba(34,197,94,0.14)"
                : "rgba(255,255,255,0.06)",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 58,
                lineHeight: 1,
                transform: speaking ? "scale(1.08)" : "scale(1)",
                transition: "0.2s ease",
              }}
            >
              🐦
            </div>

            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
              {speaking
                ? "Speaking..."
                : thinking
                ? "Thinking..."
                : listening
                ? "Listening..."
                : "Ready"}
            </div>
          </div>

          <div
            style={{
              padding: 10,
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              fontSize: 12,
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            <strong>Status:</strong> {status}

            <div style={{ marginTop: 6 }}>
              <strong>Reply language:</strong> {outputLanguage.name}
            </div>

            {heardText && (
              <div style={{ marginTop: 6 }}>
                <strong>You:</strong> {heardText}
              </div>
            )}

            {aiText && (
              <div style={{ marginTop: 6 }}>
                <strong>Bird:</strong> {aiText}
              </div>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 10,
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            <label>
              Bird voice
              <select
                value={selectedVoiceURI}
                onChange={(event) => setSelectedVoiceURI(event.target.value)}
                style={{
                  width: "100%",
                  marginTop: 5,
                  padding: 8,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#111827",
                  color: "#ffffff",
                }}
              >
                {voices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} — {voice.lang}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Speed: {rate.toFixed(2)}
              <input
                type="range"
                min="0.7"
                max="1.25"
                step="0.05"
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              Tone: {pitch.toFixed(2)}
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={pitch}
                onChange={(event) => setPitch(Number(event.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={startBirdCommunication}
              disabled={listening}
              style={{
                flex: 1,
                minWidth: 120,
                border: "none",
                borderRadius: 999,
                padding: "10px 12px",
                background: listening
                  ? "rgba(34,197,94,0.35)"
                  : "linear-gradient(135deg,#2563eb,#7c3aed)",
                color: "#ffffff",
                cursor: listening ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {listening ? "Listening" : "Start"}
            </button>

            <button
              type="button"
              onClick={sendHeardTextManually}
              disabled={!heardText.trim() || thinking}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                cursor:
                  !heardText.trim() || thinking ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              Send
            </button>

            <button
              type="button"
              onClick={testBirdVoice}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Test
            </button>

            <button
              type="button"
              onClick={stopEverything}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: "10px 12px",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

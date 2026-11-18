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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      clearSilenceTimer();
      clearRestartTimer();
      try { recognitionRef.current?.abort(); } catch { /* ignore */ }
      audioAbortRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function splitText(text: string) {
    return text.replace(/\n+/g, ". ").split(/(?<=[.!?।])\s+/).map((part) => part.trim()).filter(Boolean).slice(0, 10);
  }

  function stopSpeaking() {
    speakingStoppedRef.current = true;
    speakingRef.current = false;
    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
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

    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
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

  async function speakText(text: string, language: OutputLanguage) {
    pauseMicForAI();
    stopSpeaking();
    speakingStoppedRef.current = false;
    speakingRef.current = true;
    setStatus("Generating natural voice...");
    const controller = new AbortController();
    audioAbortRef.current = controller;
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: splitText(text).join(" "), language: language.code }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || "Natural voice generation failed.");
      }
      const audioBlob = await response.blob();
      if (speakingStoppedRef.current || controller.signal.aborted) return;
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => {
        if (speakingStoppedRef.current) return;
        setSpeaking(true);
        setStatus("🐦 Koyal is speaking naturally.");
      };
      audio.onended = () => {
        if (audioUrlRef.current === audioUrl) { URL.revokeObjectURL(audioUrl); audioUrlRef.current = null; }
        audioRef.current = null;
        audioAbortRef.current = null;
        speakingRef.current = false;
        setSpeaking(false);
        setStatus("Bird finished. Listening again...");
        restartListeningAfterAI();
      };
      audio.onerror = () => {
        if (audioUrlRef.current === audioUrl) { URL.revokeObjectURL(audioUrl); audioUrlRef.current = null; }
        audioRef.current = null;
        audioAbortRef.current = null;
        speakingRef.current = false;
        setSpeaking(false);
        setStatus("Audio playback failed. Check your device volume and try again.");
        restartListeningAfterAI();
      };
      await audio.play();
    } catch (error) {
      if (controller.signal.aborted) return;
      speakingRef.current = false;
      setSpeaking(false);
      const message = error instanceof Error ? error.message : "Natural voice failed.";
      setStatus(message);
      setAiText((current) => current ? current + "\n\nVoice error: " + message : "Voice error: " + message);
      restartListeningAfterAI();
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

      void speakText(reply, requestedLanguage);
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

  return (
    <div style={{ position: "relative" }}>
      <style>{".koyal-voice-face{position:relative;display:inline-block;flex:0 0 auto;overflow:hidden;border-radius:50%;vertical-align:middle;isolation:isolate;background:radial-gradient(circle,rgba(130,12,43,.28),rgba(8,5,12,.96))}.koyal-voice-face img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}.koyal-voice-face .koyal-voice-open{opacity:0}.koyal-voice-face.is-speaking .koyal-voice-closed{animation:koyalBeakClosed 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking .koyal-voice-open{animation:koyalBeakOpen 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking{filter:drop-shadow(0 0 22px rgba(255,35,86,.85))}.koyal-voice-face.is-listening{filter:drop-shadow(0 0 18px rgba(80,220,150,.7))}@keyframes koyalBeakClosed{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes koyalBeakOpen{0%,49%{opacity:0}50%,100%{opacity:1}}"} </style>
      <button
        type="button"
        onClick={() => {
          if (open) {
            stopEverything();
            setOpen(false);
          } else {
            startBirdCommunication();
          }
        }}
        aria-label={open ? "Close KOYAL voice" : "Open KOYAL voice"}
        title={undefined}
        style={{
          width: 48,
          height: 48,
          padding: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: "1px solid rgba(255,65,105,.55)",
          background: "rgba(12,7,14,.9)",
          cursor: "pointer",
          boxShadow: speaking
            ? "0 0 22px rgba(255,35,86,.65)"
            : listening
            ? "0 0 18px rgba(80,220,150,.55)"
            : "0 0 12px rgba(255,35,86,.2)",
        }}
      >
        <span
          className={"koyal-voice-face " + (speaking ? "is-speaking" : "")}
          style={{ width: 42, height: 42 }}
        >
          <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="" />
          <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 58,
            width: "min(340px, calc(100vw - 28px))",
            minHeight: 390,
            boxSizing: "border-box",
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderRadius: 26,
            background: "linear-gradient(160deg,rgba(65,9,32,.98),rgba(9,6,13,.99) 72%)",
            border: "1px solid rgba(255,65,105,.35)",
            boxShadow: speaking
              ? "0 0 55px rgba(255,35,86,.28)"
              : listening
              ? "0 0 45px rgba(80,220,150,.2)"
              : "0 18px 55px rgba(0,0,0,.55)",
            zIndex: 100,
          }}
        >
          <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#fff", fontSize: 14, letterSpacing: ".05em" }}>KOYAL VOICE CALL</strong>
            <span style={{ color: listening ? "#7ce6a7" : speaking ? "#ff7896" : "#d7c5cf", fontSize: 11 }}>
              {listening ? "Listening" : speaking ? "Speaking" : thinking ? "Thinking" : "Paused"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (speaking) {
                stopSpeaking();
                setStatus("Interrupted. Listening again...");
                restartListeningAfterAI();
              } else if (listening) {
                stopEverything();
                setStatus("Microphone paused");
              } else {
                startBirdCommunication();
              }
            }}
            aria-label={speaking ? "Interrupt Koyal" : listening ? "Pause microphone" : "Resume call"}
            style={{
              width: 224,
              height: 224,
              padding: 0,
              border: "none",
              borderRadius: "50%",
              background: "transparent",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              transform: speaking ? "scale(1.045)" : "scale(1)",
              transition: "transform .22s ease, filter .22s ease",
              filter: speaking
                ? "drop-shadow(0 0 24px rgba(255,35,86,.8))"
                : listening
                ? "drop-shadow(0 0 20px rgba(80,220,150,.65))"
                : "none",
            }}
          >
            <span
              className={
                "koyal-voice-face " +
                (speaking ? "is-speaking" : listening ? "is-listening" : "")
              }
              style={{ width: 224, height: 224 }}
            >
              <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="" />
              <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
            </span>
          </button>
          <div aria-live="polite" style={{ width: "100%", minHeight: 32, textAlign: "center", color: "rgba(255,255,255,.78)", fontSize: 12, lineHeight: 1.45 }}>
            {status}
            {heardText && <div style={{ marginTop: 5, color: "rgba(255,255,255,.55)", overflowWrap: "anywhere" }}>You: {heardText}</div>}
            {aiText && <div style={{ marginTop: 5, color: "#ffb3c5", overflowWrap: "anywhere" }}>Koyal: {aiText}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={() => {
                if (speaking) {
                  stopSpeaking();
                  setStatus("You interrupted Koyal.");
                  restartListeningAfterAI();
                } else if (listening) {
                  stopEverything();
                  setStatus("Microphone paused");
                } else {
                  startBirdCommunication();
                }
              }}
              style={{ flex: 1, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)", color: "white", borderRadius: 24, padding: "11px 10px", cursor: "pointer", fontWeight: 600 }}
            >
              {speaking ? "Interrupt" : listening ? "Mute mic" : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => { stopEverything(); setOpen(false); }}
              aria-label="End call"
              style={{ flex: 1, border: 0, background: "#e53955", color: "white", borderRadius: 24, padding: "11px 10px", cursor: "pointer", fontWeight: 700 }}
            >
              End call
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

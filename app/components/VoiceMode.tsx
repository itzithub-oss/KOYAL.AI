"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};
type SpeechRecognitionErrorEvent = Event & { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function VoiceMode({ subscriptionPlan = "Just" }: { subscriptionPlan?: string }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("Tap the bird to talk to Koyal");
  const [heardText, setHeardText] = useState("");
  const [aiText, setAiText] = useState("");
  const [muted, setMuted] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);
  const busyRef = useRef(false);
  const restartRef = useRef(false);

  function stopListening() {
    restartRef.current = false;
    try { recognitionRef.current?.abort(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setListening(false);
  }

  function stopCall() {
    activeRef.current = false;
    busyRef.current = false;
    stopListening();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setOpen(false);
    setListening(false);
    setSpeaking(false);
    setConnecting(false);
    setMuted(false);
    setStatus("Voice session ended");
  }

  useEffect(() => () => {
    activeRef.current = false;
    restartRef.current = false;
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, []);

  async function speakWithElevenLabs(text: string) {
    const response = await fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en-IN" }),
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "ElevenLabs could not generate Koyal's voice.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeaking(true);
    setStatus("Koyal is speaking...");
    try {
      await audio.play();
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("Koyal's audio could not be played."));
      });
    } finally {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
      setSpeaking(false);
    }
  }

  async function answerUser(message: string) {
    if (!message.trim() || busyRef.current || !activeRef.current) return;
    busyRef.current = true;
    setHeardText(message);
    setAiText("");
    setConnecting(true);
    setStatus("Koyal is thinking...");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: [],
          voiceMode: true,
          subscriptionPlan,
          language: "English",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.reply !== "string") {
        throw new Error(data.error || "Koyal could not prepare a reply.");
      }
      const reply = data.reply.trim();
      setAiText(reply);
      setConnecting(false);
      await speakWithElevenLabs(reply);
      setStatus("Your turn — speak when ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Voice response failed.");
    } finally {
      busyRef.current = false;
      setConnecting(false);
      if (activeRef.current && !muted) {
        window.setTimeout(() => startListening(), 450);
      }
    }
  }

  function startListening() {
    if (!activeRef.current || busyRef.current || muted) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus("Speech recognition is unavailable in this browser. Try Chrome.");
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      restartRef.current = true;
      setStatus("Listening — speak naturally");
      setListening(true);
      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += result[0]?.transcript || "";
        }
        if (finalText.trim()) {
          restartRef.current = false;
          try { recognition.stop(); } catch { /* ignore */ }
          recognitionRef.current = null;
          setListening(false);
          void answerUser(finalText.trim());
        }
      };
      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setStatus("Microphone permission was denied. Allow microphone access in your browser.");
          restartRef.current = false;
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          setStatus("Speech recognition error. Please try speaking again.");
        }
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setListening(false);
        if (restartRef.current && activeRef.current && !busyRef.current && !muted) {
          restartRef.current = false;
          window.setTimeout(() => startListening(), 350);
        }
      };
      recognition.start();
    } catch {
      setListening(false);
      setStatus("Could not start the microphone. Check browser permissions.");
    }
  }

  function startCall() {
    setOpen(true);
    setHeardText("");
    setAiText("");
    setStatus("Starting Koyal's voice...");
    setConnecting(true);
    activeRef.current = true;
    busyRef.current = false;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setConnecting(false);
      setStatus("This browser does not support speech recognition. Please use Chrome.");
      return;
    }
    setConnecting(false);
    startListening();
  }

  function toggleMute() {
    if (!muted) {
      setMuted(true);
      stopListening();
      setStatus("Microphone paused");
    } else {
      setMuted(false);
      setStatus("Microphone on");
      window.setTimeout(() => startListening(), 150);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <style>{".koyal-voice-face{position:relative;display:inline-block;flex:0 0 auto;overflow:hidden;border-radius:50%;vertical-align:middle;isolation:isolate;background:radial-gradient(circle,rgba(130,12,43,.28),rgba(8,5,12,.96))}.koyal-voice-face img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}.koyal-voice-face .koyal-voice-open{opacity:0}.koyal-voice-face.is-speaking .koyal-voice-face-closed{animation:koyalBeakClosed 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking .koyal-voice-open{animation:koyalBeakOpen 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking{filter:drop-shadow(0 0 22px rgba(255,35,86,.85))}.koyal-voice-face.is-listening{filter:drop-shadow(0 0 18px rgba(80,220,150,.7))}@keyframes koyalBeakClosed{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes koyalBeakOpen{0%,49%{opacity:0}50%,100%{opacity:1}}"}</style>
      <button type="button" onClick={() => { if (open) stopCall(); else startCall(); }} aria-label={open ? "Close KOYAL voice" : "Open KOYAL voice"} style={{ width: 48, height: 48, padding: 0, display: "grid", placeItems: "center", borderRadius: "50%", border: "1px solid rgba(255,65,105,.55)", background: "rgba(12,7,14,.9)", cursor: "pointer", boxShadow: speaking ? "0 0 22px rgba(255,35,86,.65)" : listening ? "0 0 18px rgba(80,220,150,.55)" : "0 0 12px rgba(255,35,86,.2)" }}>
        <span className={"koyal-voice-face " + (speaking ? "is-speaking" : listening ? "is-listening" : "")} style={{ width: 42, height: 42 }}>
          <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="" />
          <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
        </span>
      </button>
      {open && <div style={{ position: "absolute", right: 0, bottom: 58, width: "min(340px, calc(100vw - 28px))", minHeight: 390, boxSizing: "border-box", padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 26, background: "linear-gradient(160deg,rgba(65,9,32,.98),rgba(9,6,13,.99) 72%)", border: "1px solid rgba(255,65,105,.35)", boxShadow: speaking ? "0 0 55px rgba(255,35,86,.28)" : listening ? "0 0 45px rgba(80,220,150,.2)" : "0 18px 55px rgba(0,0,0,.55)", zIndex: 100 }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#fff", fontSize: 14, letterSpacing: ".05em" }}>KOYAL VOICE</strong>
          <span style={{ color: listening ? "#79e2a8" : "#ff9bb0", fontSize: 11 }}>{connecting ? "THINKING" : speaking ? "SPEAKING" : listening ? (muted ? "PAUSED" : "LISTENING") : "READY"}</span>
        </div>
        <div style={{ display: "grid", placeItems: "center", flex: 1, width: "100%" }}>
          <div className={"koyal-voice-face " + (speaking ? "is-speaking" : listening && !muted ? "is-listening" : "")} style={{ width: 170, height: 170, boxShadow: "0 0 35px rgba(255,35,86,.18)" }}>
            <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="Koyal" />
            <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
          </div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 12 }}>{speaking ? "Koyal is speaking" : connecting ? "Thinking..." : muted ? "Microphone paused" : listening ? "Listening to you" : "Voice conversation"}</div>
          <div style={{ color: "rgba(255,255,255,.68)", fontSize: 11, textAlign: "center", marginTop: 6 }}>{status}</div>
        </div>
        <div style={{ width: "100%", maxHeight: 105, overflowY: "auto", display: "grid", gap: 7, fontSize: 11, color: "rgba(255,255,255,.8)" }}>
          {heardText && <div><strong style={{ color: "#8fe0b2" }}>You:</strong> {heardText}</div>}
          {aiText && <div><strong style={{ color: "#ff9bb0" }}>Koyal:</strong> {aiText}</div>}
          {!heardText && !aiText && <div style={{ opacity: .6, textAlign: "center" }}>Your conversation will appear here.</div>}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button type="button" disabled={!open || speaking || connecting} onClick={toggleMute} style={{ flex: 1, minHeight: 42, borderRadius: 14, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)", color: "#fff", cursor: "pointer" }}>{muted ? "Resume mic" : "Pause mic"}</button>
          <button type="button" onClick={stopCall} style={{ flex: 1, minHeight: 42, borderRadius: 14, border: "1px solid rgba(255,75,100,.6)", background: "#9e173a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>End call</button>
        </div>
        <div style={{ width: "100%", color: "rgba(255,255,255,.55)", fontSize: 10, textAlign: "center" }}>Powered by ElevenLabs Avani · {subscriptionPlan} plan</div>
      </div>}
    </div>
  );
}

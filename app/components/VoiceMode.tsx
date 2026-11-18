"use client";

import { useEffect, useRef, useState } from "react";
import { GoogleGenAI } from "@google/genai";

const LIVE_MODEL = "gemini-3.8-live";
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

type LiveSession = {
  sendRealtimeInput: (input: any) => void;
  close: () => void;
};

function toPcm16(input: Float32Array) {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

function resample(input: Float32Array, sourceRate: number) {
  if (sourceRate === INPUT_RATE) return toPcm16(input);
  const length = Math.max(1, Math.round(input.length * INPUT_RATE / sourceRate));
  const output = new Float32Array(length);
  const ratio = sourceRate / INPUT_RATE;
  for (let i = 0; i < length; i++) {
    const p = i * ratio;
    const left = Math.floor(p);
    const right = Math.min(left + 1, input.length - 1);
    output[i] = input[left] * (1 - (p - left)) + input[right] * (p - left);
  }
  return toPcm16(output);
}

function pcmBase64(pcm: Int16Array) {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 32768, bytes.length)));
  }
  return btoa(binary);
}

export default function VoiceMode({ subscriptionPlan = "Just" }: { subscriptionPlan?: string }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("Tap the bird to start a live conversation");
  const [heardText, setHeardText] = useState("");
  const [aiText, setAiText] = useState("");

  const sessionRef = useRef<LiveSession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const playingRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlayTimeRef = useRef(0);
  const activeRef = useRef(false);

  function clearPlayback() {
    playingRef.current.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
    playingRef.current.clear();
    nextPlayTimeRef.current = contextRef.current?.currentTime || 0;
    setSpeaking(false);
  }

  function playAudioChunk(base64: string) {
    const context = contextRef.current;
    if (!context) return;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (!pcm.length) return;
    const buffer = context.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.015, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    playingRef.current.add(source);
    source.onended = () => {
      playingRef.current.delete(source);
      if (!playingRef.current.size && context.currentTime >= nextPlayTimeRef.current - 0.04) setSpeaking(false);
    };
    setSpeaking(true);
  }

  function stopCall() {
    activeRef.current = false;
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
    try { muteGainRef.current?.disconnect(); } catch { /* ignore */ }
    processorRef.current = null;
    sourceRef.current = null;
    muteGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearPlayback();
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    sessionRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    setListening(false);
    setSpeaking(false);
    setMuted(false);
    setConnecting(false);
    setStatus("Call ended");
  }

  useEffect(() => () => {
    activeRef.current = false;
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    playingRef.current.forEach((source) => { try { source.stop(); } catch { /* ignore */ } });
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    const context = contextRef.current;
    if (context && context.state !== "closed") void context.close();
  }, []);

  async function startCall() {
    setOpen(true);
    setConnecting(true);
    setStatus("Requesting microphone access...");
    setHeardText("");
    setAiText("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS or localhost.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.resume();

      setStatus("Connecting to Koyal Live...");
      const tokenResponse = await fetch("/api/live-token", { method: "POST", cache: "no-store" });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || typeof tokenData.token !== "string") {
        throw new Error(tokenData.error || "Could not create a secure Gemini Live session.");
      }

      const ai = new GoogleGenAI({ apiKey: tokenData.token });
      const config = {
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
        realtimeInputConfig: { automaticActivityDetection: { disabled: false, prefixPaddingMs: 250, silenceDurationMs: 700 } },
      };
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config,
        callbacks: {
          onopen: () => {
            setStatus("Connected. Speak naturally — you can interrupt Koyal.");
            setListening(true);
            setConnecting(false);
          },
          onmessage: (message: any) => {
            const content = message?.serverContent;
            if (!content) return;
            if (content.interrupted) {
              clearPlayback();
              setStatus("Koyal was interrupted. Listening...");
            }
            if (content.inputTranscription?.text) {
              setHeardText((current) => (current + " " + content.inputTranscription.text).trim());
            }
            if (content.outputTranscription?.text) {
              setAiText((current) => (current + " " + content.outputTranscription.text).trim());
            }
            for (const part of content.modelTurn?.parts || []) {
              if (part.inlineData?.data && String(part.inlineData.mimeType || "").startsWith("audio/pcm")) {
                playAudioChunk(part.inlineData.data);
              }
            }
          },
          onerror: (event: any) => setStatus(event?.message || "Gemini Live connection error."),
          onclose: (event: any) => {
            if (activeRef.current) {
              activeRef.current = false;
              setStatus(event?.reason || "Live connection closed. End the call and reconnect.");
              setListening(false);
            }
          },
        },
      });
      sessionRef.current = session;
      activeRef.current = true;

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (!activeRef.current || !sessionRef.current) return;
        const pcm = resample(event.inputBuffer.getChannelData(0), context.sampleRate);
        try {
          sessionRef.current.sendRealtimeInput({
            audio: { data: pcmBase64(pcm), mimeType: "audio/pcm;rate=16000" },
          });
        } catch {
          setStatus("Live connection lost. Please end the call and reconnect.");
        }
      };
      source.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(context.destination);
      sourceRef.current = source;
      processorRef.current = processor;
      muteGainRef.current = silentOutput;
      setStatus("Connected. Speak naturally — you can interrupt Koyal.");
      setListening(true);
      setConnecting(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start live voice chat.";
      stopCall();
      setOpen(true);
      setStatus(message);
      setConnecting(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
    setStatus(next ? "Microphone muted" : "Microphone on — speak naturally");
  }

  return (
    <div style={{ position: "relative" }}>
      <style>{".koyal-voice-face{position:relative;display:inline-block;flex:0 0 auto;overflow:hidden;border-radius:50%;vertical-align:middle;isolation:isolate;background:radial-gradient(circle,rgba(130,12,43,.28),rgba(8,5,12,.96))}.koyal-voice-face img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none}.koyal-voice-face .koyal-voice-open{opacity:0}.koyal-voice-face.is-speaking .koyal-voice-closed{animation:koyalBeakClosed 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking .koyal-voice-open{animation:koyalBeakOpen 280ms steps(1,end) infinite}.koyal-voice-face.is-speaking{filter:drop-shadow(0 0 22px rgba(255,35,86,.85))}.koyal-voice-face.is-listening{filter:drop-shadow(0 0 18px rgba(80,220,150,.7))}@keyframes koyalBeakClosed{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes koyalBeakOpen{0%,49%{opacity:0}50%,100%{opacity:1}}"}</style>
      <button type="button" onClick={() => { if (open) { stopCall(); setOpen(false); } else { void startCall(); } }} aria-label={open ? "Close KOYAL voice" : "Open KOYAL voice"} style={{ width: 48, height: 48, padding: 0, display: "grid", placeItems: "center", borderRadius: "50%", border: "1px solid rgba(255,65,105,.55)", background: "rgba(12,7,14,.9)", cursor: "pointer", boxShadow: speaking ? "0 0 22px rgba(255,35,86,.65)" : listening ? "0 0 18px rgba(80,220,150,.55)" : "0 0 12px rgba(255,35,86,.2)" }}>
        <span className={"koyal-voice-face " + (speaking ? "is-speaking" : listening ? "is-listening" : "")} style={{ width: 42, height: 42 }}>
          <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="" />
          <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
        </span>
      </button>
      {open && <div style={{ position: "absolute", right: 0, bottom: 58, width: "min(340px, calc(100vw - 28px))", minHeight: 390, boxSizing: "border-box", padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 26, background: "linear-gradient(160deg,rgba(65,9,32,.98),rgba(9,6,13,.99) 72%)", border: "1px solid rgba(255,65,105,.35)", boxShadow: speaking ? "0 0 55px rgba(255,35,86,.28)" : listening ? "0 0 45px rgba(80,220,150,.2)" : "0 18px 55px rgba(0,0,0,.55)", zIndex: 100 }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ color: "#fff", fontSize: 14, letterSpacing: ".05em" }}>KOYAL LIVE VOICE</strong>
          <span style={{ color: listening ? "#79e2a8" : "#ff9bb0", fontSize: 11 }}>{connecting ? "CONNECTING" : listening ? (muted ? "MUTED" : "LIVE") : "OFFLINE"}</span>
        </div>
        <div style={{ display: "grid", placeItems: "center", flex: 1, width: "100%" }}>
          <div className={"koyal-voice-face " + (speaking ? "is-speaking" : listening && !muted ? "is-listening" : "")} style={{ width: 170, height: 170, boxShadow: "0 0 35px rgba(255,35,86,.18)" }}>
            <img className="koyal-voice-closed" src="/koyal-voice-closed.png" alt="Koyal" />
            <img className="koyal-voice-open" src="/koyal-voice-open.png" alt="" />
          </div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginTop: 12 }}>{speaking ? "Koyal is speaking" : connecting ? "Connecting..." : muted ? "Microphone muted" : listening ? "Listening to you" : "Live voice"}</div>
          <div style={{ color: "rgba(255,255,255,.68)", fontSize: 11, textAlign: "center", marginTop: 6 }}>{status}</div>
        </div>
        <div style={{ width: "100%", maxHeight: 105, overflowY: "auto", display: "grid", gap: 7, fontSize: 11, color: "rgba(255,255,255,.8)" }}>
          {heardText && <div><strong style={{ color: "#8fe0b2" }}>You:</strong> {heardText}</div>}
          {aiText && <div><strong style={{ color: "#ff9bb0" }}>Koyal:</strong> {aiText}</div>}
          {!heardText && !aiText && <div style={{ opacity: .6, textAlign: "center" }}>Your live conversation transcript will appear here.</div>}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button type="button" disabled={!listening} onClick={toggleMute} style={{ flex: 1, minHeight: 42, borderRadius: 14, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)", color: "#fff", cursor: listening ? "pointer" : "not-allowed" }}>{muted ? "Unmute mic" : "Mute mic"}</button>
          <button type="button" onClick={() => { stopCall(); setOpen(false); }} style={{ flex: 1, minHeight: 42, borderRadius: 14, border: "1px solid rgba(255,75,100,.6)", background: "#9e173a", color: "#fff", fontWeight: 700, cursor: "pointer" }}>End call</button>
        </div>
        <div style={{ width: "100%", color: "rgba(255,255,255,.55)", fontSize: 10, textAlign: "center" }}>Speak anytime to interrupt Koyal · {subscriptionPlan} plan</div>
      </div>}
    </div>
  );
}

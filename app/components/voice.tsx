"use client";

import { useRef, useState } from "react";

export default function KoyalVoice() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  async function playVoice() {
    const audio = audioRef.current;
    if (!audio) return;

    setError("");
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch {
      setSpeaking(false);
      setError("Could not play the voice. Please try again.");
    }
  }

  function stopVoice() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setSpeaking(false);
  }

  return (
    <div>
      <audio
        ref={audioRef}
        src="/voices/koyal-voice.mp3"
        preload="none"
        onPlay={() => setSpeaking(true)}
        onPause={() => setSpeaking(false)}
        onEnded={() => setSpeaking(false)}
        onError={() => {
          setSpeaking(false);
          setError("Voice file could not be loaded.");
        }}
      />

      <button
        type="button"
        onClick={speaking ? stopVoice : playVoice}
      >
        {speaking ? "⏹ Stop voice" : "▶ Play KOYAL voice"}
      </button>

      {error && <p role="alert">{error}</p>}
    </div>
  );
}
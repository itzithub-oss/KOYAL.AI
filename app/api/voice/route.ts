import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pq8ptAFvXx1MBHKzOrML";
const MAX_TEXT_LENGTH = 5000;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ElevenLabs is not configured. Add ELEVENLABS_API_KEY to the server environment." }, { status: 503 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid voice request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid voice request." }, { status: 400 });

  const { text, language } = body as { text?: unknown; language?: unknown };
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT_LENGTH) return NextResponse.json({ error: "Voice text must contain 1–5000 characters." }, { status: 400 });

  const supportedLanguage = language === "hi-IN" ? "hi" : "en";
  const upstream = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(VOICE_ID) + "?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.trim(), model_id: "eleven_flash_v2_5", language_code: supportedLanguage, voice_settings: { stability: 0.68, similarity_boost: 0.82, style: 0.08, use_speaker_boost: true, speed: 0.92 } }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("[KOYAL VOICE] ElevenLabs request failed", { status: upstream.status, detail: detail.slice(0, 1000) });
    const status = upstream.status === 401 || upstream.status === 402 || upstream.status === 403 ? upstream.status : upstream.status === 429 ? 429 : 502;
    const message = status === 401 ? "ElevenLabs API key is invalid." : status === 402 ? "ElevenLabs credits are insufficient." : status === 403 ? "Your ElevenLabs plan does not allow this voice or model." : status === 429 ? "ElevenLabs is busy. Please try again shortly." : "ElevenLabs could not generate speech.";
    return NextResponse.json({ error: message }, { status });
  }

  return new NextResponse(upstream.body, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

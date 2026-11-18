import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 15;

const LIVE_MODEL = "gemini-3.8-live";
const LIVE_SYSTEM_INSTRUCTION = `You are Koyal, the friendly voice assistant inside KOYAL AI.
Speak naturally, warmly, and clearly. Keep replies concise and easy to understand when spoken.
Reply in English by default. Use Hindi only when the user explicitly asks you to speak or reply in Hindi.
Do not switch to Hindi merely because the user uses an Indian name or a few Hindi words.
Understand and respond naturally to Hindi and English speech, including code-switching.
Do not repeatedly introduce yourself or say you are an AI. If asked your name, say Koyal.
You may be interrupted at any time. Stop speaking and listen when the user starts talking.
Do not invent facts, memories, or actions. Be honest about uncertainty.`;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini Live is not configured. Add GEMINI_API_KEY to the server environment." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
            sessionResumption: {},
          },
        },
      } as any,
    });

    if (!token.name) throw new Error("Gemini did not return a temporary Live token.");
    return NextResponse.json(
      { token: token.name, model: LIVE_MODEL },
      { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } }
    );
  } catch (error) {
    console.error("[KOYAL LIVE] Token creation failed", error);
    return NextResponse.json(
      { error: "Could not start Gemini Live. Check the Gemini API key and Live API access." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

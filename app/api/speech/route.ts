import { GoogleGenAI } from "@google/genai";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";

export const runtime = "nodejs";

function requestIp(request: Request) {
  return (request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 100) || "unknown";
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 40_000) {
      return Response.json({ error: "The speech text is too large." }, { status: 413 });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 40_000) {
      return Response.json({ error: "The speech text is too large." }, { status: 413 });
    }

    const body = JSON.parse(rawBody || "{}");
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ error: "No text was provided." }, { status: 400 });
    }
    if (text.length > 8_000) {
      return Response.json({ error: "Please keep speech text under 8,000 characters." }, { status: 413 });
    }

    const ip = requestIp(request);
    if (!await consumeKoyalRateLimit(`speech:ip:${ip}`, 10, 60)) {
      return Response.json(
        { error: "Speech generation is temporarily rate-limited. Please wait a minute and try again.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Speech generation is not configured on the server." }, { status: 503 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash-tts",
      input: [{
        type: "user_input",
        content: [{
          type: "text",
          text,
          annotations: [{
            type: "speech_metadata",
            style: "Natural, clear, warm and friendly AI assistant voice. Speak at a comfortable pace.",
          }],
        }],
      }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: "Kore" }] },
    });

    const audioData = interaction.output_audio?.data;
    if (!audioData) throw new Error("Speech provider returned no audio.");
    const audioBuffer = Buffer.from(audioData, "base64");
    return new Response(audioBuffer, {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[KOYAL SPEECH] Generation failed:", detail.slice(0, 300));
    return Response.json({ error: "Speech generation failed. Please try again later." }, { status: 500 });
  }
}
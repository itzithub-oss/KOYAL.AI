import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type ChatBody = {
  message?: string;
  mode?: string;
  thinkingLevel?: string;
  voiceMode?: boolean;
  language?: string;
  subscriptionPlan?: string;
  selectedPlan?: string;
  plan?: string;
};

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = "qwen2.5:3b";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

function getPlan(body: ChatBody) {
  return body.subscriptionPlan || body.selectedPlan || body.plan || "Just";
}

function isSupremePlan(plan: string) {
  return plan.trim().toLowerCase() === "supreme";
}

function buildSystemPrompt(body: ChatBody) {
  return `
You are KOYAL AI.
Answer clearly, naturally, and helpfully.

Mode: ${body.mode || "Normal"}
Thinking level: ${body.thinkingLevel || "Just"}
Language: ${body.language || "auto"}

Rules:
- If the user speaks Hindi, reply naturally in Hindi using Devanagari script.
- If the user speaks another language, reply in that language.
- Keep voice-mode answers short and natural.
- Do not repeatedly say "as an AI".
`.trim();
}

async function askGemini(message: string, body: ChatBody) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing in Vercel Environment Variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
${buildSystemPrompt(body)}

User message:
${message}
`.trim();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });

  return response.text || "I could not generate a reply.";
}

async function askOllama(message: string, body: ChatBody) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(body),
        },
        {
          role: "user",
          content: message,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Ollama request failed.");
  }

  const data = await response.json();

  return data?.message?.content || "I could not generate a reply.";
}

async function readBody(request: NextRequest): Promise<ChatBody> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    return {
      message: String(formData.get("message") || ""),
      mode: String(formData.get("mode") || ""),
      thinkingLevel: String(formData.get("thinkingLevel") || ""),
      voiceMode: String(formData.get("voiceMode") || "") === "true",
      language: String(formData.get("language") || ""),
      subscriptionPlan: String(formData.get("subscriptionPlan") || ""),
      selectedPlan: String(formData.get("selectedPlan") || ""),
      plan: String(formData.get("plan") || ""),
    };
  }

  return (await request.json()) as ChatBody;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);

    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const plan = getPlan(body);
    const supreme = isSupremePlan(plan);

    let reply = "";
    let providerUsed = "";
    let modelUsed = "";

    if (process.env.VERCEL === "1") {
      // Online Vercel version cannot use local Ollama.
      // So use Gemini online.
      reply = await askGemini(message, body);
      providerUsed = supreme ? "Gemini API Supreme" : "Gemini API Online";
      modelUsed = GEMINI_MODEL;
    } else {
      // Local laptop version:
      // Supreme uses Gemini, other plans use local Ollama.
      if (supreme) {
        reply = await askGemini(message, body);
        providerUsed = "Gemini API Supreme";
        modelUsed = GEMINI_MODEL;
      } else {
        reply = await askOllama(message, body);
        providerUsed = "Ollama Local";
        modelUsed = OLLAMA_MODEL;
      }
    }

    return NextResponse.json({
      reply,
      planUsed: plan,
      providerUsed,
      modelUsed,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}
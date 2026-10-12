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
  plan?: string;
  selectedPlan?: string;
};

const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const OLLAMA_MODEL = "qwen2.5:3b";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

function getPlan(body: ChatBody) {
  return (
    body.subscriptionPlan ||
    body.selectedPlan ||
    body.plan ||
    "Just"
  );
}

async function askGemini(message: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not found in .env.local");
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: message,
  });

  return response.text || "I could not generate a reply.";
}

async function askOllama(message: string) {
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
          content:
            "You are KOYAL AI. Give clear, helpful and natural answers.",
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;

    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        {
          status: 400,
        }
      );
    }

    const plan = getPlan(body);
    const isSupreme = plan.toLowerCase() === "supreme";

    let reply = "";

    if (isSupreme) {
      reply = await askGemini(message);
    } else {
      reply = await askOllama(message);
    }

    return NextResponse.json({
      reply,
      modelUsed: isSupreme ? GEMINI_MODEL : OLLAMA_MODEL,
      planUsed: plan,
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
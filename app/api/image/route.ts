import { GoogleGenAI } from "@google/genai";
import { getAuthenticatedUser } from "@/lib/cashfree-server";
import { consumeKoyalRateLimit } from "@/lib/koyal-rate-limit";

export const runtime = "nodejs";

function requestIp(request: Request) {
  return (request.headers.get("x-real-ip") || request.headers.get("x-vercel-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 100) || "unknown";
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8_192) {
      return Response.json({ error: "The image prompt is too large." }, { status: 413 });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8_192) {
      return Response.json({ error: "The image prompt is too large." }, { status: 413 });
    }

    const body = JSON.parse(rawBody || "{}");
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return Response.json({ error: "Please describe the image you want to generate." }, { status: 400 });
    }
    if (prompt.length > 4_000) {
      return Response.json({ error: "Please keep the image prompt under 4,000 characters." }, { status: 413 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Image generation is not configured on the server." }, { status: 503 });
    }

    const user = await getAuthenticatedUser(request).catch(() => null);
    const ip = requestIp(request);
    const ipLimit = user ? 8 : 3;
    if (!await consumeKoyalRateLimit(`image:ip:${ip}`, ipLimit, 60)) {
      return Response.json(
        { error: "Image generation is temporarily rate-limited. Please wait a minute and try again.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
      );
    }
    if (user?.id && !await consumeKoyalRateLimit(`image:user:${user.id}`, 8, 60)) {
      return Response.json(
        { error: "Your image-generation limit has been reached. Please try again shortly.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: "gemini-3.1-flash-image",
      input: prompt,
      response_format: { type: "image", aspect_ratio: "1:1", image_size: "1K" },
    });

    const generatedImage = interaction.output_image;
    if (!generatedImage?.data) {
      return Response.json({ error: "The image model did not return an image." }, { status: 502 });
    }

    return Response.json({
      reply: interaction.output_text || "Here is your generated image.",
      image: generatedImage.data,
      mimeType: generatedImage.mime_type || "image/png",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[KOYAL IMAGE] Generation failed:", detail.slice(0, 300));
    return Response.json({ error: "Image generation failed. Please try again later." }, { status: 500 });
  }
}
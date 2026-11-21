import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "@cf/black-forest-labs/flux-1-schnell";
const MAX_PROMPT_LENGTH = 1800;
const ALLOWED_STYLES = new Set([
  "Realistic", "Anime", "3D Art", "Cartoon", "Logo", "Poster", "Digital Art",
]);
const COMPOSITIONS: Record<string, string> = {
  square: "Use a balanced square composition.",
  portrait: "Compose the subject vertically, with a portrait-oriented arrangement.",
  landscape: "Compose this as a wide cinematic landscape scene.",
  story: "Compose the subject vertically for a full-screen mobile story layout.",
};
const STYLE_GUIDANCE: Record<string, string> = {
  Realistic: "Photorealistic, natural lighting, rich detail.",
  Anime: "High-quality anime illustration, expressive linework and polished cel shading.",
  "3D Art": "Polished 3D render, dimensional materials and cinematic lighting.",
  Cartoon: "Playful cartoon illustration, clean shapes and appealing colours.",
  Logo: "Professional, clean logo concept, simple shapes and a clear silhouette.",
  Poster: "Striking poster artwork, strong visual hierarchy and polished composition.",
  "Digital Art": "Detailed digital painting, intentional colour palette and refined texture.",
};

type RequestBody = {
  prompt?: unknown;
  style?: unknown;
  ratio?: unknown;
  count?: unknown;
};

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Cloudflare could not generate the image.";
  const data = payload as { errors?: Array<{ message?: string }>; messages?: Array<{ message?: string }> };
  return data.errors?.map((item) => item.message).filter(Boolean).join("; ")
    || data.messages?.map((item) => item.message).filter(Boolean).join("; ")
    || "Cloudflare could not generate the image.";
}

export async function POST(request: Request) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
    const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

    if (!accountId || !apiToken) {
      return NextResponse.json(
        { error: "Image Studio is not configured yet. Add the Cloudflare environment variables in Vercel and redeploy." },
        { status: 503 },
      );
    }

    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "This request origin is not allowed." }, { status: 403 });
    }

    let body: RequestBody;
    try {
      body = await request.json() as RequestBody;
    } catch {
      return NextResponse.json({ error: "Please send a valid image request." }, { status: 400 });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const style = typeof body.style === "string" ? body.style : "Realistic";
    const ratio = typeof body.ratio === "string" ? body.ratio : "square";
    const count = Number(body.count ?? 1);

    if (!prompt) {
      return NextResponse.json({ error: "Please describe the image you want to create." }, { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: `Please keep your prompt under ${MAX_PROMPT_LENGTH + 1} characters.` }, { status: 400 });
    }
    if (!ALLOWED_STYLES.has(style)) {
      return NextResponse.json({ error: "Please choose one of the available image styles." }, { status: 400 });
    }
    if (!Object.prototype.hasOwnProperty.call(COMPOSITIONS, ratio)) {
      return NextResponse.json({ error: "Please choose a valid composition." }, { status: 400 });
    }
    if (count !== 1) {
      return NextResponse.json({ error: "Generate one image per request." }, { status: 400 });
    }

    const fullPrompt = [
      STYLE_GUIDANCE[style],
      prompt,
      COMPOSITIONS[ratio],
      "Create a complete image. Do not add captions, watermarks, borders, or mockup frames unless requested.",
    ].join("\n\n");

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${MODEL}`;
    const images: Array<{ image: string; mimeType: string }> = [];

    // Generate sequentially to avoid a burst of GPU requests on the free daily allocation.
    for (let index = 0; index < count; index += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          steps: 4,
          seed: Math.floor(Math.random() * 2_000_000_000),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(50_000),
      });

      const payload = await response.json().catch(() => null) as {
        success?: boolean;
        result?: string | { image?: string };
      } | null;

      if (!response.ok || !payload?.success || !payload.result) {
        const message = errorMessage(payload);
        console.error("[Image Studio] Cloudflare request failed", {
          status: response.status,
          message,
        });
        const quotaMessage = response.status === 429
          ? "Cloudflare's free daily AI allowance may be used up, or the model is temporarily busy. Please try again later."
          : response.status === 403
            ? "Cloudflare denied this request. Check that your API token has Workers AI Read or Workers AI Write permission and that the model is available on your plan."
            : "Image generation failed. Please try again.";
        return NextResponse.json({ error: quotaMessage }, { status: response.status >= 400 && response.status < 600 ? response.status : 502 });
      }

      const image = typeof payload.result === "string"
        ? payload.result
        : payload.result.image;
      if (!image) {
        return NextResponse.json({ error: "Cloudflare returned an empty image. Please try again." }, { status: 502 });
      }
      images.push({ image, mimeType: "image/png" });
    }

    return NextResponse.json({ images });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[Image Studio] Request failed", error);
    return NextResponse.json(
      { error: timedOut ? "Image generation took too long. Please try again." : "Image generation is temporarily unavailable. Please try again." },
      { status: timedOut ? 504 : 500 },
    );
  }
}

import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error: "GEMINI_API_KEY NOT FOUND",
        },
        {
          status: 500,
        }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,

        expireTime: new Date(
          Date.now() + 30 * 60 * 1000
        ).toISOString(),

        newSessionExpireTime: new Date(
          Date.now() + 60 * 1000
        ),

        liveConnectConstraints: {
          model: "gemini-3.8-live",

          config: {
            responseModalities: ["AUDIO"],
          },
        },
      },
    });

    if (!token.name) {
      throw new Error(
        "Gemini did not return a Live API token."
      );
    }

    return Response.json({
      token: token.name,
      model: "gemini-3.8-live",
    });
  } catch (error) {
    console.error("LIVE TOKEN ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Live API token.",
      },
      {
        status: 500,
      }
    );
  }
}
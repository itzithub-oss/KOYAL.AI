import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    // ==============================
    // CHECK API KEY
    // ==============================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY was not found in .env.local",
        },
        { status: 500 }
      );
    }

    // ==============================
    // GET TEXT
    // ==============================

    const body = await request.json();

    const text =
      typeof body.text === "string"
        ? body.text.trim()
        : "";

    if (!text) {
      return Response.json(
        {
          error: "No text was provided.",
        },
        { status: 400 }
      );
    }

    // Limit very large answers
    const speechText = text.slice(0, 8000);

    // ==============================
    // GEMINI
    // ==============================

    const ai = new GoogleGenAI({
      apiKey,
    });

    console.log("Generating speech...");

    const interaction =
      await ai.interactions.create({
        model: "gemini-3.8-flash-tts",

        input: [
          {
            type: "user_input",

            content: [
              {
                type: "text",

                text: speechText,

                annotations: [
                  {
                    type: "speech_metadata",

                    style:
                      "Natural, clear, warm and friendly AI assistant voice. Speak at a comfortable pace.",
                  },
                ],
              },
            ],
          },
        ],

        response_format: {
          type: "audio",
        },

        generation_config: {
          speech_config: [
            {
              voice: "Kore",
            },
          ],
        },
      });

    // ==============================
    // GET GENERATED AUDIO
    // ==============================

    const audioData =
      interaction.output_audio?.data;

    if (!audioData) {
      throw new Error(
        "Gemini did not return audio."
      );
    }

    const audioBuffer = Buffer.from(
      audioData,
      "base64"
    );

    console.log(
      "Speech generated:",
      audioBuffer.length,
      "bytes"
    );

    // ==============================
    // RETURN WAV
    // ==============================

    return new Response(audioBuffer, {
      status: 200,

      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "SPEECH ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Speech generation failed.",
      },
      {
        status: 500,
      }
    );
  }
}
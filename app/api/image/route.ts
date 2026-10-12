import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY was not found. Check .env.local.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return Response.json(
        {
          error:
            "Please describe the image you want to generate.",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    console.log("Generating image...");
    console.log("Prompt:", prompt);

    const interaction =
      await ai.interactions.create({
        model: "gemini-3.1-flash-image",

        input: prompt,

        response_format: {
          type: "image",
          aspect_ratio: "1:1",
          image_size: "1K",
        },
      });

    const generatedImage =
      interaction.output_image;

    if (
      !generatedImage ||
      !generatedImage.data
    ) {
      return Response.json(
        {
          error:
            "The image model did not return an image.",
        },
        { status: 500 }
      );
    }

    console.log(
      "Image generated successfully."
    );

    return Response.json({
      reply:
        interaction.output_text ||
        "Here is your generated image.",

      image: generatedImage.data,

      mimeType:
        generatedImage.mime_type ||
        "image/png",
    });
  } catch (error) {
    console.error(
      "IMAGE GENERATION ERROR:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Image generation failed.",
      },
      { status: 500 }
    );
  }
}
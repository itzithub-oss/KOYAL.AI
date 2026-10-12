import mammoth from "mammoth";

export async function processFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  // TXT / CODE / DATA FILES
  const textExtensions = [
    ".txt",
    ".csv",
    ".md",
    ".json",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".py",
  ];

  if (textExtensions.some((ext) => name.endsWith(ext))) {
    const text = await file.text();

    if (!text.trim()) {
      throw new Error("The uploaded file is empty.");
    }

    return text;
  }

  // DOCX
  if (name.endsWith(".docx")) {
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await mammoth.extractRawText({
      buffer,
    });

    if (!result.value.trim()) {
      throw new Error("No readable text found in the DOCX.");
    }

    return result.value;
  }

  // PDF
  if (name.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");

    const buffer = new Uint8Array(
      await file.arrayBuffer()
    );

    const parser = new PDFParse({
      data: buffer,
    });

    try {
      const result = await parser.getText();

      if (!result.text?.trim()) {
        throw new Error(
          "No readable text found in the PDF."
        );
      }

      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(
    `Unsupported file type: ${file.name}`
  );
}
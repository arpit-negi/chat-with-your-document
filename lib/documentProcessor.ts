import { v4 as uuid } from "uuid";
import type { StoredDocument, DocumentChunk } from "@/types";

// --- Text Extraction ---

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf2json: pure JavaScript PDF parser, no canvas/DOM/worker dependencies.
  // pdfjs-dist was abandoned — it initialises its entire rendering pipeline
  // on startup (needing DOMMatrix, Path2D, canvas…) even for text-only reads,
  // which hangs indefinitely on Vercel's serverless Node.js environment.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);
    parser.on("pdfParser_dataError", (err: { parserError: Error }) => {
      reject(err.parserError);
    });
    parser.on("pdfParser_dataReady", () => {
      // Decode URI-encoded text that pdf2json produces
      const raw: string = parser.getRawTextContent();
      const text = decodeURIComponent(raw);
      resolve(text);
    });
    parser.parseBuffer(buffer);
  });
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return extractFromPdf(buffer);
  if (ext === "docx") return extractFromDocx(buffer);
  if (ext === "txt") return extractFromTxt(buffer);
  throw new Error(`Unsupported file type: .${ext}`);
}

// --- Chunking ---
// Splits text into overlapping windows. Tries to break at sentence/paragraph
// boundaries so chunks don't cut off mid-sentence.

function splitIntoChunks(text: string, chunkSize = 600, overlap = 80): string[] {
  const chunks: string[] = [];
  // Normalise whitespace
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    // Try to break at a natural boundary (paragraph, sentence, word)
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastSentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      const lastSpace = slice.lastIndexOf(" ");
      const breakAt = lastPara > chunkSize * 0.5
        ? lastPara
        : lastSentence > chunkSize * 0.4
          ? lastSentence + 1
          : lastSpace > 0 ? lastSpace : end;
      end = start + breakAt;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);

    start = end - overlap;
  }

  return chunks;
}

// --- Main pipeline ---
// No embedding step — BM25 similarity is computed at query time from raw text.

export async function processDocument(buffer: Buffer, filename: string): Promise<StoredDocument> {
  const text = await extractText(buffer, filename);
  const chunkTexts = splitIntoChunks(text);
  console.log(`[processor] ${filename}: ${chunkTexts.length} chunks`);

  const docId = uuid();
  const chunks: DocumentChunk[] = chunkTexts.map((chunkText, i) => ({
    id: uuid(),
    text: chunkText,
    metadata: { filename, docId, chunkIndex: i },
  }));

  return { id: docId, filename, uploadedAt: new Date().toISOString(), chunks };
}

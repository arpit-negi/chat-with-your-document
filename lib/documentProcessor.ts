import { v4 as uuid } from "uuid";
import type { StoredDocument, DocumentChunk } from "@/types";

// --- PDF text extraction ---
// Uses pdf2json: pure JavaScript, zero native/DOM/canvas dependencies.
// pdfjs-dist was dropped — it needs DOMMatrix, Path2D, and a worker thread
// (all browser APIs) even for text-only reads, so it hangs on Vercel serverless.

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require("pdf2json");
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1);

    parser.on("pdfParser_dataError", (err: { parserError: Error }) => {
      reject(new Error(err.parserError?.message ?? "PDF parsing failed"));
    });

    parser.on("pdfParser_dataReady", () => {
      try {
        // getRawTextContent() returns plain text — do NOT decodeURIComponent,
        // it crashes on any PDF containing % (e.g. "increased revenue by 90%").
        const text: string = parser.getRawTextContent();
        resolve(text);
      } catch (e) {
        reject(e);
      }
    });

    parser.parseBuffer(buffer);
  });
}

// --- DOCX text extraction ---

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// --- TXT text extraction ---

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

// --- Router ---

export async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return extractFromPdf(buffer);
  if (ext === "docx") return extractFromDocx(buffer);
  if (ext === "txt") return extractFromTxt(buffer);
  throw new Error(`Unsupported file type: .${ext}`);
}

// --- Chunking ---
// Splits text into overlapping windows and tries to break at natural boundaries
// (paragraph → sentence → word) so chunks don't cut off mid-thought.

function splitIntoChunks(text: string, chunkSize = 600, overlap = 80): string[] {
  const chunks: string[] = [];
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);

    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastSentence = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? ")
      );
      const lastSpace = slice.lastIndexOf(" ");
      const breakAt =
        lastPara > chunkSize * 0.5 ? lastPara :
        lastSentence > chunkSize * 0.4 ? lastSentence + 1 :
        lastSpace > 0 ? lastSpace : end;
      end = start + breakAt;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk.length > 20) chunks.push(chunk);
    start = end - overlap;
  }

  return chunks;
}

// --- Main pipeline ---
// extract → chunk → store (BM25 scoring happens at query time, no embeddings needed)

export async function processDocument(buffer: Buffer, filename: string): Promise<StoredDocument> {
  const text = await extractText(buffer, filename);
  if (!text.trim()) throw new Error("No text could be extracted from this file.");

  const chunkTexts = splitIntoChunks(text);
  console.log(`[processor] ${filename}: extracted ${chunkTexts.length} chunks`);

  const docId = uuid();
  const chunks: DocumentChunk[] = chunkTexts.map((chunkText, i) => ({
    id: uuid(),
    text: chunkText,
    metadata: { filename, docId, chunkIndex: i },
  }));

  return { id: docId, filename, uploadedAt: new Date().toISOString(), chunks };
}

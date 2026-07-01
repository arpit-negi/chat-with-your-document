import { v4 as uuid } from "uuid";
import type { StoredDocument, DocumentChunk } from "@/types";

// --- Text Extraction ---

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdfjs-dist needs two things to work in Node.js serverless:
  //
  // 1. DOMMatrix polyfill — Vercel has no browser DOM. pdfjs tries to get
  //    DOMMatrix from the `canvas` npm package (which isn't on Vercel), warns,
  //    then leaves DOMMatrix undefined. Text transform calls then throw/hang.
  //
  // 2. workerSrc — pdfjs dispatches all PDF operations to a worker thread.
  //    Without this path, getDocument().promise hangs forever waiting for a
  //    worker that never starts. This is the primary cause of the 504 timeout.
  if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
    (globalThis as Record<string, unknown>).DOMMatrix = class {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(_init?: unknown) {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transformPoint(p: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

  // Point pdfjs to its bundled worker file so it can spawn a worker_thread.
  // Only set once — the module is cached across warm invocations.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.js"
    );
  }

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf: any = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = content.items.map((item: any) => item.str ?? "").join(" ");
    pages.push(text);
  }
  return pages.join("\n");
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

import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { v4 as uuid } from "uuid";
import type { StoredDocument, DocumentChunk } from "@/types";

// --- Text Extraction ---
// Each function takes the raw file buffer and returns plain text.

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v1 is a plain CJS function — require() is the reliable way to load it
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export async function extractText(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return extractFromPdf(buffer);
  if (ext === "docx") return extractFromDocx(buffer);
  if (ext === "txt") return extractFromTxt(buffer);
  throw new Error(`Unsupported file type: .${ext}`);
}

// --- Chunking ---
// Split long text into overlapping pieces so the LLM gets focused context.
// chunkSize=500 chars keeps chunks small enough for the embedding model.
// chunkOverlap=50 prevents sentences from being cut at chunk boundaries.

async function splitIntoChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });
  const docs = await splitter.createDocuments([text]);
  return docs.map((d) => d.pageContent);
}

// --- Embedding ---
// We use Xenova/all-MiniLM-L6-v2 running locally via Transformers.js.
// It produces a 384-dimensional float32 vector for each input string.
// The first call downloads the model (~25MB) and caches it locally.

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Dynamic import avoids server-side bundling issues with Transformers.js
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  const embeddings: number[][] = [];
  for (const text of texts) {
    const output = await embedder(text, { pooling: "mean", normalize: true });
    // output.data is a Float32Array; convert to plain number[] for JSON storage
    embeddings.push(Array.from(output.data as Float32Array));
  }
  return embeddings;
}

// --- Main pipeline ---
// Combines extraction + chunking + embedding into one StoredDocument.

export async function processDocument(
  buffer: Buffer,
  filename: string
): Promise<StoredDocument> {
  // Step 1: Extract raw text from the file
  const text = await extractText(buffer, filename);

  // Step 2: Split text into overlapping chunks
  const chunkTexts = await splitIntoChunks(text);
  console.log(`[processor] ${filename}: ${chunkTexts.length} chunks`);

  // Step 3: Embed every chunk — this is the "encode into vector space" step
  const embeddings = await generateEmbeddings(chunkTexts);

  // Step 4: Pack everything into typed objects
  const docId = uuid();
  const chunks: DocumentChunk[] = chunkTexts.map((chunkText, i) => ({
    id: uuid(),
    text: chunkText,
    embedding: embeddings[i],
    metadata: { filename, docId, chunkIndex: i },
  }));

  return {
    id: docId,
    filename,
    uploadedAt: new Date().toISOString(),
    chunks,
  };
}

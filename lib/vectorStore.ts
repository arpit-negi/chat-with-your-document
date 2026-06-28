import type { DocumentChunk } from "@/types";
import { readDocumentStore } from "./storage";

// Cosine similarity measures how "aligned" two vectors are (range: -1 to 1).
// Two chunks with similar meaning will have vectors pointing in the same direction.
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// Embed the query using the same model used during ingestion.
// It's critical to use the SAME model — vectors only compare correctly
// when they live in the same embedding space.
async function embedQuery(query: string): Promise<number[]> {
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const output = await embedder(query, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

// Retrieve the top-k most relevant chunks for a given question.
// We load ALL stored chunks from documents.json, compute cosine similarity
// between the question vector and each chunk vector, then return the best ones.
export async function retrieveRelevantChunks(
  question: string,
  topK: number = 4
): Promise<DocumentChunk[]> {
  const store = readDocumentStore();
  const allChunks = store.documents.flatMap((doc) => doc.chunks);

  if (allChunks.length === 0) return [];

  // Embed the question so we can compare it to stored chunk embeddings
  const questionEmbedding = await embedQuery(question);

  // Score every chunk against the question
  const scored = allChunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(questionEmbedding, chunk.embedding),
  }));

  // Return the top-k highest-scoring chunks
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

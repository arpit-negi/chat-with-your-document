import type { DocumentChunk } from "@/types";
import { readDocumentStore } from "./storage";

// BM25 is the industry-standard text similarity algorithm used by Elasticsearch,
// Solr, and most search engines. It improves on TF-IDF by normalising for
// document length and using a saturation function on term frequency.
// k1 controls term frequency saturation; b controls length normalisation.
const BM25_K1 = 1.5;
const BM25_B = 0.75;

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","this","that","these",
  "those","i","you","he","she","it","we","they","what","which","who","how",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  idf: Map<string, number>
): number {
  const docLen = docTokens.length;
  const termCount: Record<string, number> = {};
  for (const t of docTokens) termCount[t] = (termCount[t] || 0) + 1;

  let score = 0;
  for (const term of queryTokens) {
    const tf = termCount[term] ?? 0;
    if (tf === 0) continue;
    const termIdf = idf.get(term) ?? 0;
    const tfNorm = (tf * (BM25_K1 + 1)) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * docLen / avgDocLen));
    score += termIdf * tfNorm;
  }
  return score;
}

export async function retrieveRelevantChunks(
  question: string,
  topK = 4
): Promise<DocumentChunk[]> {
  const store = readDocumentStore();
  const allChunks = store.documents.flatMap((doc) => doc.chunks);
  if (allChunks.length === 0) return [];

  const queryTokens = tokenize(question);
  const tokenizedChunks = allChunks.map((c) => tokenize(c.text));
  const avgDocLen = tokenizedChunks.reduce((s, t) => s + t.length, 0) / tokenizedChunks.length;
  const N = allChunks.length;

  // Compute IDF for each query term across the whole corpus
  const idf = new Map<string, number>();
  for (const term of queryTokens) {
    const df = tokenizedChunks.filter((t) => t.includes(term)).length;
    idf.set(term, Math.log((N - df + 0.5) / (df + 0.5) + 1));
  }

  return allChunks
    .map((chunk, i) => ({
      chunk,
      score: bm25Score(queryTokens, tokenizedChunks[i], avgDocLen, idf),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}

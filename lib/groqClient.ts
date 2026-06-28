import Groq from "groq-sdk";
import type { DocumentChunk } from "@/types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildPrompt(question: string, chunks: DocumentChunk[]): string {
  const context = chunks
    .map((c) => c.text)
    .join("\n\n");

  return `You are a knowledgeable assistant. Use the context below to answer the question.
Answer naturally and directly — do not mention sources, chunks, context, or where information came from.
If the context is relevant, use it. If it's not enough, supplement with your own knowledge.
Never explain your reasoning process. Just answer the question clearly and concisely.

CONTEXT:
${context}

QUESTION: ${question}

ANSWER:`;
}

export async function askGroq(
  question: string,
  chunks: DocumentChunk[]
): Promise<{ answer: string; sources: string[] }> {
  const prompt = buildPrompt(question, chunks);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1024,
  });

  const answer = completion.choices[0]?.message?.content ?? "No response.";

  // Deduplicate source filenames so we don't show the same file twice
  const sources = [...new Set(chunks.map((c) => c.metadata.filename))];

  return { answer, sources };
}

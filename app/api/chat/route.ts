import { NextRequest, NextResponse } from "next/server";
import { retrieveRelevantChunks } from "@/lib/vectorStore";
import { askGroq } from "@/lib/groqClient";
import { readChatHistory, writeChatHistory } from "@/lib/storage";
import { v4 as uuid } from "uuid";
import type { ChatRequest, ChatMessage } from "@/types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    console.log(`[chat] Question: "${question}"`);

    // Step 1: Find the most relevant chunks from all uploaded documents
    const relevantChunks = await retrieveRelevantChunks(question, 4);
    console.log(`[chat] Retrieved ${relevantChunks.length} relevant chunks`);

    // Step 2: Send chunks + question to Groq LLM
    const { answer, sources } = await askGroq(question, relevantChunks);

    // Step 3: Save both sides of the conversation to history.json
    const history = readChatHistory();
    const userMsg: ChatMessage = {
      id: uuid(),
      role: "user",
      content: question,
      timestamp: new Date().toISOString(),
    };
    const assistantMsg: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: answer,
      sources,
      timestamp: new Date().toISOString(),
    };
    history.messages.push(userMsg, assistantMsg);
    writeChatHistory(history);

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("[chat] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Load chat history for display when the page loads
export async function GET() {
  try {
    const history = readChatHistory();
    return NextResponse.json(history);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { processDocument } from "@/lib/documentProcessor";
import { readDocumentStore, writeDocumentStore } from "@/lib/storage";

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["pdf", "docx", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Convert the browser File object to a Node.js Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[upload] Processing: ${file.name} (${buffer.length} bytes)`);

    // Run the full RAG ingestion pipeline: extract → chunk → embed
    const storedDoc = await processDocument(buffer, file.name);

    // Load existing documents and append the new one
    const store = readDocumentStore();
    store.documents.push(storedDoc);
    writeDocumentStore(store);

    console.log(`[upload] Saved ${storedDoc.chunks.length} chunks for ${file.name}`);

    return NextResponse.json({
      success: true,
      docId: storedDoc.id,
      filename: storedDoc.filename,
      chunkCount: storedDoc.chunks.length,
    });
  } catch (err) {
    console.error("[upload] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

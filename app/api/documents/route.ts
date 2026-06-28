import { NextResponse } from "next/server";
import { readDocumentStore, writeDocumentStore } from "@/lib/storage";

// List all uploaded documents (without sending back the large embedding arrays)
export async function GET() {
  const store = readDocumentStore();
  const docs = store.documents.map((doc) => ({
    id: doc.id,
    filename: doc.filename,
    uploadedAt: doc.uploadedAt,
    chunkCount: doc.chunks.length,
  }));
  return NextResponse.json({ documents: docs });
}

// Delete a document by id
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const store = readDocumentStore();
  store.documents = store.documents.filter((d) => d.id !== id);
  writeDocumentStore(store);

  return NextResponse.json({ success: true });
}

"use client";

import { useState, useEffect, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import DocumentList from "@/components/DocumentList";
import ChatWindow from "@/components/ChatWindow";

interface Doc {
  id: string;
  filename: string;
  uploadedAt: string;
  chunkCount: number;
}

export default function Home() {
  const [documents, setDocuments] = useState<Doc[]>([]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } catch {
      // silently fail on network errors
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  async function handleDelete(id: string) {
    await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
    await fetchDocuments();
  }

  function handleUploadComplete() {
    fetchDocuments();
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-slate-800 flex flex-col overflow-y-auto bg-slate-900">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-800">
          <h1 className="text-base font-bold text-white">DocChat AI</h1>
          <p className="text-xs text-slate-500 mt-0.5">RAG-powered document Q&A</p>
        </div>

        {/* Upload area */}
        <FileUpload onUploadComplete={handleUploadComplete} />

        {/* Document list */}
        <DocumentList documents={documents} onDelete={handleDelete} />
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow />
      </main>
    </div>
  );
}

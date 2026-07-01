"use client";

import { useRef, useState } from "react";

interface Props {
  onUploadComplete: (filename: string, chunkCount: number) => void;
}

export default function FileUpload({ onUploadComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleFile(file: File) {
    setIsUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      setStatus({ type: "success", text: `✓ ${file.name} ready` });
      onUploadComplete(data.filename, data.chunkCount);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Upload Document
      </h2>

      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${isDragging ? "border-violet-400 bg-violet-500/10" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50"}
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={onFileChange}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Processing document...</p>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-slate-300 font-medium">Drop file here or click to browse</p>
            <p className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT supported</p>
          </>
        )}
      </div>

      {status && (
        <div className={`mt-3 p-3 rounded-lg text-xs ${
          status.type === "success"
            ? "bg-emerald-900/40 text-emerald-300 border border-emerald-800"
            : "bg-red-900/40 text-red-300 border border-red-800"
        }`}>
          {status.text}
        </div>
      )}
    </div>
  );
}

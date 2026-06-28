"use client";

interface Doc {
  id: string;
  filename: string;
  uploadedAt: string;
  chunkCount: number;
}

interface Props {
  documents: Doc[];
  onDelete: (id: string) => void;
}

export default function DocumentList({ documents, onDelete }: Props) {
  if (documents.length === 0) {
    return (
      <div className="px-4 pb-4">
        <p className="text-xs text-slate-600 text-center py-4">No documents yet</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Uploaded Documents
      </h2>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-start justify-between gap-2 bg-slate-800/60 rounded-lg p-3 border border-slate-700/50"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{doc.filename}</p>
            </div>
            <button
              onClick={() => onDelete(doc.id)}
              className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0 mt-0.5"
              title="Remove document"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

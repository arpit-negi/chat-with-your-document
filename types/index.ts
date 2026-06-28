// A single chunk of text from a document, plus its embedding vector
export interface DocumentChunk {
  id: string;           // unique id for this chunk
  text: string;         // the raw text content
  embedding: number[];  // 384-dimensional vector from all-MiniLM-L6-v2
  metadata: {
    filename: string;   // which file this came from
    docId: string;      // parent document id
    chunkIndex: number; // position in the document
  };
}

// One uploaded document — stored with all its chunks
export interface StoredDocument {
  id: string;
  filename: string;
  uploadedAt: string;
  chunks: DocumentChunk[];
}

// What we save to data/documents.json
export interface DocumentStore {
  documents: StoredDocument[];
}

// A single message in the chat
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];  // filenames used to answer (only on assistant messages)
  timestamp: string;
}

// What we save to data/history.json
export interface ChatHistory {
  messages: ChatMessage[];
}

// The body sent to POST /api/chat
export interface ChatRequest {
  question: string;
}

// The response from POST /api/chat
export interface ChatResponse {
  answer: string;
  sources: string[];
}

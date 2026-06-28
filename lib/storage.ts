import fs from "fs";
import path from "path";
import type { DocumentStore, ChatHistory } from "@/types";

// All JSON files live in ./data/ at the project root
const DATA_DIR = path.join(process.cwd(), "data");
const DOCUMENTS_FILE = path.join(DATA_DIR, "documents.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

// Make sure the data directory exists before any read/write
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function readDocumentStore(): DocumentStore {
  ensureDataDir();
  if (!fs.existsSync(DOCUMENTS_FILE)) return { documents: [] };
  const raw = fs.readFileSync(DOCUMENTS_FILE, "utf-8");
  return JSON.parse(raw) as DocumentStore;
}

export function writeDocumentStore(store: DocumentStore): void {
  ensureDataDir();
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function readChatHistory(): ChatHistory {
  ensureDataDir();
  if (!fs.existsSync(HISTORY_FILE)) return { messages: [] };
  const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
  return JSON.parse(raw) as ChatHistory;
}

export function writeChatHistory(history: ChatHistory): void {
  ensureDataDir();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

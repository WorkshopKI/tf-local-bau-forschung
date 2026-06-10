import type { GenerationStats } from '@/core/services/ai/generation-stats';

export interface ChatAttachment {
  id: string;
  filename: string;
  format: 'pdf' | 'docx' | 'md' | 'txt';
  /** Konvertiertes (ggf. gekürztes) Markdown — wird bei jedem Turn als Kontext mitgesendet. */
  markdown: string;
  /** Länge des gespeicherten Markdown. */
  charCount: number;
  originalCharCount: number;
  truncated: boolean;
  pages?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** Anzeige-Text. Bei User-Messages OHNE Attachment-Blöcke (werden beim API-Call injiziert). */
  content: string;
  createdAt: string; // ISO
  /** Nur User-Messages. */
  attachments?: ChatAttachment[];
  /** Nur Assistant: Reasoning-Text, getrennt vom Content — wird NIE re-gesendet. */
  thinking?: string;
  /** Nur Assistant. */
  stats?: GenerationStats;
  /** Per Stop abgebrochen — Partial-Content. */
  aborted?: boolean;
  /** Generierung mid-stream gescheitert, Partial behalten. */
  error?: string;
  /** RAG-Quellen-Chips. */
  ragSources?: string[];
}

export interface ConversationMeta {
  id: string;
  /** Erste User-Message, auf 60 Zeichen gekürzt. */
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationFull extends ConversationMeta {
  messages: ChatMessage[];
}

export interface ChatSettings {
  systemPrompt: string;
  /** Reasoning-/Denkprozess-Phase des Modells (Qwen-Thinking). Default true;
   *  aus = schnellere Antworten, aber weniger gründlich bei komplexen Prompts. */
  thinkingEnabled?: boolean;
}

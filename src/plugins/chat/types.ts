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

/**
 * Strukturierte RAG-Quelle, pro Assistant-Antwort gespeichert. Treibt die
 * Quellen-Chips, das „Verwendeter Kontext"-Panel, die Inline-[n]-Zitate und
 * das Slide-over-Quellen-Panel. Abgeleitet aus OramaSearchResult.
 */
export interface ChatSource {
  /** 1-basiert; mappt auf das [n]-Zitat im Antworttext. */
  n: number;
  title: string;
  /** Dateiname/Quellpfad (OramaSearchResult.source). */
  sourcePath: string;
  /** 0..100, aus score abgeleitet. */
  relevance: number;
  method: string;
  type: string;
  /** Einzeilige, ellipsierte Kurzfassung (Kontext-Liste). */
  contextLine: string;
  /** Längeres Exzerpt mit «term»-Highlights (Quellen-Panel). */
  snippet: string;
  /** Falls aus sourcePath parsebar → „Antrag öffnen"-Deeplink. */
  antragFkz?: string;
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
  /** Nur Assistant: strukturierte RAG-Quellen. */
  sources?: ChatSource[];
  /** RAG-Quellen-Chips (Legacy/Abwärtskompat; neue Antworten nutzen `sources`). */
  ragSources?: string[];
  /** Lokales Daumen-Feedback (kein Backend-Submit). */
  feedback?: 'up' | 'down';
}

export interface ConversationMeta {
  id: string;
  /** Erste User-Message, auf 60 Zeichen gekürzt. */
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  /** Angeheftet — sortiert in eigene Gruppe. */
  pinned?: boolean;
  /** Verknüpftes Förderkennzeichen (Konversation↔Antrag), treibt „Anträge"-Filter + FKZ-Unterzeile. */
  fkz?: string;
  /** Manuell umbenannt → persistActive überschreibt den Titel nicht mehr automatisch. */
  titleCustom?: boolean;
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

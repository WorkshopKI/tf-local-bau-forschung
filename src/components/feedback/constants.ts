// Feedback-System UI-Konstanten

import type { FeedbackCategory, FeedbackStatus } from '@/core/types/feedback';

export interface TeamflowArea {
  ref: string;
  label: string;
}

export const TEAMFLOW_AREAS: readonly TeamflowArea[] = [
  { ref: 'dashboard', label: 'Dashboard / Home' },
  { ref: 'bauantraege', label: 'Bauanträge' },
  { ref: 'forschung', label: 'Forschungsanträge' },
  { ref: 'dokumente', label: 'Dokumente' },
  { ref: 'dokumentendetail', label: 'Dokumentendetail / Metadaten' },
  { ref: 'suche', label: 'Suche' },
  { ref: 'chat', label: 'Chat / KI-Assistent' },
  { ref: 'einstellungen', label: 'Einstellungen' },
  { ref: 'suchindex', label: 'Suchindex' },
  { ref: 'sonstiges', label: 'Sonstiges' },
] as const;

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  praise: 'Lob',
  problem: 'Problem',
  idea: 'Idee',
  question: 'Frage',
};

export const CATEGORY_ICONS: Record<FeedbackCategory, string> = {
  praise: 'Sparkles',
  problem: 'Zap',
  idea: 'Lightbulb',
  question: 'HelpCircle',
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  neu: 'Neu',
  geplant: 'Geplant',
  in_bearbeitung: 'In Bearbeitung',
  umgesetzt: 'Umgesetzt',
  abgelehnt: 'Abgelehnt',
  archiviert: 'Archiviert',
};

/** Tailwind-Klassen für Status-Badges. */
export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  neu: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  geplant: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  in_bearbeitung: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  umgesetzt: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  abgelehnt: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  archiviert: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]',
};

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  praise: 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]',
  problem: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  idea: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  question: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

/** Mapping LLM-Klassifikation → Feedback-Kategorie (für ConfirmCard). */
export const LLM_CATEGORY_MAP: Record<string, FeedbackCategory> = {
  bug: 'problem',
  feature: 'idea',
  ux: 'idea',
  praise: 'praise',
  question: 'question',
};

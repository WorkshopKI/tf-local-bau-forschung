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

/** Status-Badges — Theme-Vars (pastell, Dark-Mode-kompatibel via --tf-*). */
export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  neu: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  geplant: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  in_bearbeitung: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  umgesetzt: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  abgelehnt: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  archiviert: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]',
};

export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  praise: 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]',
  problem: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  idea: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  question: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
};

/** Mapping LLM-Klassifikation → Feedback-Kategorie (für ConfirmCard). */
export const LLM_CATEGORY_MAP: Record<string, FeedbackCategory> = {
  bug: 'problem',
  feature: 'idea',
  ux: 'idea',
  praise: 'praise',
  question: 'question',
};

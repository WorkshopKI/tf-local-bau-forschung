// Feedback-System UI-Konstanten

import type { EffortEstimate, FeedbackCategory, FeedbackStatus } from '@/core/types/feedback';

export interface TeamflowArea {
  ref: string;
  label: string;
}

export const TEAMFLOW_AREAS: readonly TeamflowArea[] = [
  { ref: 'dashboard', label: 'Dashboard / Home' },
  { ref: 'bauantraege', label: 'Bauanträge' },
  { ref: 'antraege', label: 'Förderanträge' },
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
  idea: 'Diamond',
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

/**
 * Status-Badges — Theme-Vars (dark-on-light, Dark-Mode-kompatibel via --tf-*).
 * Light: z.B. text-red-800 auf bg-red-50 Äquivalent.
 * Dark: --tf-*-bg/text passen sich automatisch an.
 */
export const STATUS_COLORS: Record<FeedbackStatus, string> = {
  neu: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  geplant: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  in_bearbeitung: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  umgesetzt: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  abgelehnt: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  archiviert: 'bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)]',
};

/**
 * Kategorie-Badges — eindeutige Farben pro Typ:
 * Problem=rot, Idee=blau, Lob=grün, Frage=amber.
 */
export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  problem: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  idea: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  praise: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  question: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
};

/** Mapping LLM-Klassifikation → Feedback-Kategorie (für ConfirmCard). */
export const LLM_CATEGORY_MAP: Record<string, FeedbackCategory> = {
  bug: 'problem',
  feature: 'idea',
  ux: 'idea',
  praise: 'praise',
  question: 'question',
};

/** Quick-Tags unter dem Feedback-Textfeld: Klick füllt Textarea vor + gibt Hint an Auto-Klassifikation. */
export interface QuickTag {
  label: string;
  prefix: string;
  /** Hint für autoClassifyFeedback — entspricht LLM-Kategorien (bug/feature/ux/praise/question). */
  hint: 'bug' | 'feature' | 'praise';
}

export const QUICK_TAGS: readonly QuickTag[] = [
  { label: 'Etwas funktioniert nicht', prefix: 'Etwas funktioniert nicht: ', hint: 'bug' },
  { label: 'Ich wünsche mir…', prefix: 'Ich wünsche mir ', hint: 'feature' },
  { label: 'Finde ich gut!', prefix: 'Ich finde gut, dass ', hint: 'praise' },
] as const;

/** Kurze Aufwand-Labels für kompakte Badge-Darstellung (Board-Cards + Listen). */
export const EFFORT_SHORT_LABELS: Record<EffortEstimate, string> = {
  S: 'S ~2h',
  M: 'M ~8h',
  L: 'L ~16h',
  XL: 'XL ~40h',
};

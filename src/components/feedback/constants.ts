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
  ux: 'UX',
  question: 'Frage',
};

export const CATEGORY_ICONS: Record<FeedbackCategory, string> = {
  praise: 'Sparkles',
  problem: 'Zap',
  idea: 'Diamond',
  ux: 'Wand2',
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
 * Problem=rot, Idee=blau, UX=violett, Lob=grün, Frage=amber.
 */
export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  problem: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  idea: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  ux: 'bg-[var(--tf-accent-bg)] text-[var(--tf-accent-text)]',
  praise: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  question: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
};

/** Mapping LLM-Klassifikation → Feedback-Kategorie (für ConfirmCard). */
export const LLM_CATEGORY_MAP: Record<string, FeedbackCategory> = {
  bug: 'problem',
  feature: 'idea',
  ux: 'ux',
  praise: 'praise',
  question: 'question',
};

/**
 * @deprecated Seit v2.41 ersetzt durch das typ-abhängige Mini-Formular
 * (`FEEDBACK_TYPES` + `FeedbackInputStep`). Bleibt vorerst für eventuelle
 * Alt-Consumer erhalten — nicht für neuen Code verwenden.
 *
 * Quick-Tags unter dem Feedback-Textfeld: Klick füllt Textarea vor + gibt Hint an Auto-Klassifikation.
 */
export interface QuickTag {
  label: string;
  prefix: string;
  /** Hint für autoClassifyFeedback — entspricht LLM-Kategorien (bug/feature/ux/praise/question). */
  hint: 'bug' | 'feature' | 'praise';
}

/** @deprecated siehe {@link QuickTag} — ersetzt durch {@link FEEDBACK_TYPES}. */
export const QUICK_TAGS: readonly QuickTag[] = [
  { label: 'Etwas funktioniert nicht', prefix: 'Etwas funktioniert nicht: ', hint: 'bug' },
  { label: 'Ich wünsche mir…', prefix: 'Ich wünsche mir ', hint: 'feature' },
  { label: 'Finde ich gut!', prefix: 'Ich finde gut, dass ', hint: 'praise' },
] as const;

// ── Typ-Schema für das strukturierte Feedback-Formular (v2.41) ────────────────
// Deterministisch + LLM-unabhängig: der User wählt einen Typ und füllt 2–3
// typspezifische Felder. Die Kategorie steht damit ohne LLM fest; die Felder
// landen als FeedbackItem.structured und fließen in den promptGenerator.

export interface FeedbackFieldDef {
  /** Key im FeedbackItem.structured-Record. */
  key: string;
  /** Feld-Label im Formular. */
  label: string;
  placeholder?: string;
  /** Genau EIN Feld pro Typ ist required (das Kern-Feld). */
  required?: boolean;
  /** true = textarea (rows=3), false/undefined = einzeiliges input. */
  multiline?: boolean;
}

export interface FeedbackTypeDef {
  /** Deterministisch gesetzte Kategorie (kein LLM). */
  category: FeedbackCategory;
  /** Button-Label in der Typ-Auswahl. */
  label: string;
  /** lucide-Icon-Name (vgl. CATEGORY_ICONS). */
  icon: string;
  /** Feldsatz; bei Lob/Frage ein einzelnes `text`-Feld. */
  fields: FeedbackFieldDef[];
  /** Optionaler Hint an autoClassifyFeedback (LLM-Code), wenn doch ein LLM läuft. */
  llmHint?: 'bug' | 'feature' | 'ux' | 'praise' | 'question';
  /** true = prominenter Button (Bug/Feature/UX), false = dezenter (Frage/Lob). */
  primary?: boolean;
}

export const FEEDBACK_TYPES: readonly FeedbackTypeDef[] = [
  {
    category: 'problem', label: 'Etwas funktioniert nicht', icon: 'Zap', llmHint: 'bug', primary: true,
    fields: [
      { key: 'steps', label: 'Was hast du gemacht?', multiline: true },
      { key: 'actual', label: 'Was ist passiert?', multiline: true, required: true },
      { key: 'expected', label: 'Was hättest du erwartet?', multiline: true },
    ],
  },
  {
    category: 'idea', label: 'Ich wünsche mir etwas', icon: 'Diamond', llmHint: 'feature', primary: true,
    fields: [
      { key: 'goal', label: 'Was möchtest du tun können?', multiline: true, required: true },
      { key: 'reason', label: 'Warum / in welcher Situation brauchst du das?', multiline: true },
      { key: 'idea', label: 'Wie stellst du es dir vor? (optional)', multiline: true },
    ],
  },
  {
    category: 'ux', label: 'Etwas ist umständlich', icon: 'Wand2', llmHint: 'ux', primary: true,
    fields: [
      { key: 'pain', label: 'Was ist gerade umständlich?', multiline: true, required: true },
      { key: 'better', label: 'Was würde es leichter machen?', multiline: true },
    ],
  },
  {
    category: 'question', label: 'Ich habe eine Frage', icon: 'HelpCircle', llmHint: 'question', primary: false,
    fields: [
      { key: 'text', label: 'Deine Frage', multiline: true, required: true },
    ],
  },
  {
    category: 'praise', label: 'Mir gefällt etwas', icon: 'Sparkles', llmHint: 'praise', primary: false,
    fields: [
      { key: 'text', label: 'Was gefällt dir?', multiline: true, required: true },
    ],
  },
] as const;

/**
 * Baut aus den Formular-Feldwerten einen lesbaren Fließtext für `FeedbackItem.text`
 * (Board/Liste/Suche rendern darauf). Leere Felder werden weggelassen. Bei
 * Ein-Feld-Typen (`text`) ist das Ergebnis schlicht der Feldwert.
 */
export function composeFeedbackText(
  typeDef: FeedbackTypeDef,
  values: Record<string, string>,
): string {
  // Ein-Feld-Typen (Lob/Frage): nur der reine Feldwert, kein Label-Präfix.
  if (typeDef.fields.length === 1 && typeDef.fields[0]?.key === 'text') {
    return (values.text ?? '').trim();
  }
  return typeDef.fields
    .map(f => ({ label: f.label, value: (values[f.key] ?? '').trim() }))
    .filter(f => f.value.length > 0)
    .map(f => `${f.label}\n${f.value}`)
    .join('\n\n');
}

/** Kurze Aufwand-Labels für kompakte Badge-Darstellung (Board-Cards + Listen). */
export const EFFORT_SHORT_LABELS: Record<EffortEstimate, string> = {
  S: 'S ~2h',
  M: 'M ~8h',
  L: 'L ~16h',
  XL: 'XL ~40h',
};

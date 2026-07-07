// Feedback-System UI-Konstanten

import type { EffortEstimate, FeedbackCategory, FeedbackStatus } from '@/core/types/feedback';

export interface TeamflowArea {
  ref: string;
  label: string;
}

// Refs sind APPEND-ONLY: sie persistieren als FeedbackContext.screenRef in bereits
// gespeicherten Tickets. Bestehende Refs nie umbenennen/löschen (auch wenn ein Label
// nicht mehr 1:1 zu einem aktuellen Plugin passt) — nur Labels korrigieren + fehlende
// reale Bereiche ergänzen (v2.165: auslastung/anfragen/feedback gegen plugins.config.ts).
export const TEAMFLOW_AREAS: readonly TeamflowArea[] = [
  { ref: 'dashboard', label: 'Dashboard / Home' },
  { ref: 'antraege', label: 'Förderanträge' },
  { ref: 'dokumente', label: 'Dokumente' },
  { ref: 'dokumentendetail', label: 'Dokumentendetail / Metadaten' },
  { ref: 'suche', label: 'Suche' },
  { ref: 'chat', label: 'Chat / KI-Assistent' },
  { ref: 'einstellungen', label: 'Einstellungen' },
  { ref: 'suchindex', label: 'Suchindex' },
  { ref: 'auslastung', label: 'Auslastung' },
  { ref: 'anfragen', label: 'E-Mail-Anfragen' },
  { ref: 'feedback', label: 'Feedback-System' },
  { ref: 'sonstiges', label: 'Sonstiges' },
] as const;

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  praise: 'Lob',
  problem: 'Problem',
  idea: 'Idee',
  ux: 'UX',
  question: 'Frage',
};

/**
 * Anzeige-Reihenfolge der Kategorien für die gruppierte Board-Ansicht
 * (Bug → Idee → UX → Lob → Frage). Unklassifizierte Tickets hängt die Page
 * separat hinten an. Single Source of Truth für die Gruppen-Reihenfolge.
 */
export const CATEGORY_ORDER: readonly FeedbackCategory[] = [
  'problem',
  'idea',
  'ux',
  'praise',
  'question',
];

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

// ── Typ-Schema für das strukturierte Feedback-Formular (v2.41) ────────────────
// Deterministisch + LLM-unabhängig: der User wählt einen Typ und füllt 2–3
// typspezifische Felder. Die Kategorie steht damit ohne LLM fest; die Felder
// landen als FeedbackItem.structured und fließen in den promptGenerator.

export interface FeedbackFieldDef {
  /** Key im FeedbackItem.structured-Record. */
  key: string;
  /** Feld-Label im Formular. */
  label: string;
  /** Kurz-Label für die kompakte Karten-Vorschau (Redesign v2.199, uppercase per
   *  CSS). Fehlt bei Ein-Feld-Typen (Lob/Frage) → dort kein Frage-Präfix. */
  shortLabel?: string;
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
      { key: 'steps', label: 'Was hast du gemacht?', shortLabel: 'Gemacht', multiline: true },
      { key: 'actual', label: 'Was ist passiert?', shortLabel: 'Passiert', multiline: true, required: true },
      { key: 'expected', label: 'Was hättest du erwartet?', shortLabel: 'Erwartet', multiline: true },
    ],
  },
  {
    category: 'idea', label: 'Ich wünsche mir etwas', icon: 'Diamond', llmHint: 'feature', primary: true,
    fields: [
      { key: 'goal', label: 'Was möchtest du tun können?', shortLabel: 'Möchte', multiline: true, required: true },
      { key: 'reason', label: 'Warum / in welcher Situation brauchst du das?', shortLabel: 'Wofür', multiline: true },
      { key: 'idea', label: 'Wie stellst du es dir vor? (optional)', shortLabel: 'Idee', multiline: true },
    ],
  },
  {
    category: 'ux', label: 'Etwas ist umständlich', icon: 'Wand2', llmHint: 'ux', primary: true,
    fields: [
      { key: 'pain', label: 'Was ist gerade umständlich?', shortLabel: 'Umständlich', multiline: true, required: true },
      { key: 'better', label: 'Was würde es leichter machen?', shortLabel: 'Leichter', multiline: true },
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
  XS: 'XS 2h',
  S: 'S 4h',
  M: 'M 8h',
  L: 'L 2T',
  XL: 'XL 4T',
  XXL: 'XXL 1Wo',
  Epic: 'Epic >2Wo',
};

/** Ausgeschriebene Aufwand-Größen für den Detail-Drawer (Redesign v2.199),
 *  z.B. „Small · 4 h". Größe + Zeit kombiniert der Aufrufer aus EFFORT_LABELS. */
export const EFFORT_SIZE_LABELS: Record<EffortEstimate, string> = {
  XS: 'Extra Small',
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'Extra Large',
  XXL: '2XL',
  Epic: 'Epic',
};

/**
 * Kräftige Punkt-Farbe je Kategorie (Redesign v2.199) — für den Farb-Dot der
 * Typ-Filter-Chips. Nutzt die vorhandenen semantischen `-text`-Tokens (dark-aware),
 * KEINE Hex-Werte (theme-token-contract). Deckungsgleich mit CATEGORY_COLORS.
 */
export const CATEGORY_DOT: Record<FeedbackCategory, string> = {
  problem: 'var(--tf-danger-text)',
  idea: 'var(--tf-info-text)',
  ux: 'var(--tf-accent-text)',
  praise: 'var(--tf-success-text)',
  question: 'var(--tf-warning-text)',
};

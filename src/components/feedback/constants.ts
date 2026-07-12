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
 *
 * Verwendet von den Kurator-Bausteinen (FeedbackTicketRow etc.). Das öffentliche
 * Board (Redesign v2.208) nutzt die handoff-treue `STATUS_TINT`/`STATUS_DOT`.
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
 * Status-Pill-Farben des öffentlichen Boards (Handoff feedback-optimiert):
 * Neu=blau-grau, Geplant=amber(Frage), In Bearbeitung=violett(UX), Umgesetzt=grün(Lob),
 * Abgelehnt=grau. Bewusst NICHT identisch mit STATUS_COLORS (dort abgelehnt=rot) —
 * das Board deckt sich mit dem Stepper (STATUS_DOT).
 */
export const STATUS_TINT: Record<FeedbackStatus, string> = {
  neu: 'bg-[var(--tf-fb-status-neu-bg)] text-[var(--tf-fb-status-neu-text)]',
  geplant: 'bg-[var(--tf-fb-frage-bg)] text-[var(--tf-fb-frage)]',
  in_bearbeitung: 'bg-[var(--tf-fb-ux-bg)] text-[var(--tf-fb-ux)]',
  umgesetzt: 'bg-[var(--tf-fb-lob-bg)] text-[var(--tf-fb-lob)]',
  abgelehnt: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
  archiviert: 'bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)]',
};

/** Weicher Tint je Status (`-bg`-Token) — Ring der aktiven Stepper-Station. */
export const STATUS_SOFT: Record<FeedbackStatus, string> = {
  neu: 'var(--tf-fb-status-neu-bg)',
  geplant: 'var(--tf-fb-frage-bg)',
  in_bearbeitung: 'var(--tf-fb-ux-bg)',
  umgesetzt: 'var(--tf-fb-lob-bg)',
  abgelehnt: 'var(--tf-bg-secondary)',
  archiviert: 'var(--tf-hover)',
};

/** Farb-Dot je Status (Stepper-Punkte + Status-Pill-Dot, Board-Spaltenkopf). */
export const STATUS_DOT: Record<FeedbackStatus, string> = {
  neu: 'var(--tf-fb-status-neu-text)',
  geplant: 'var(--tf-fb-frage)',
  in_bearbeitung: 'var(--tf-fb-ux)',
  umgesetzt: 'var(--tf-fb-lob)',
  abgelehnt: 'var(--tf-text-tertiary)',
  archiviert: 'var(--tf-text-tertiary)',
};

/**
 * Lane-Akzent je Status — Kanban-Spaltenfarben (v2.225, Handoff feedback-kanban).
 * Kräftiger als STATUS_DOT: „Neu" + „Abgelehnt" haben eigene Lane-Tokens, die
 * Pipeline-Status teilen sich die Typ-Akzente (frage/ux/lob). Tönungen (Kopf,
 * Rand, Badge) mischt FeedbackKanban per color-mix aus diesem Akzent.
 */
export const STATUS_LANE_ACCENT: Record<FeedbackStatus, string> = {
  neu: 'var(--tf-fb-lane-neu)',
  geplant: 'var(--tf-fb-frage)',
  in_bearbeitung: 'var(--tf-fb-ux)',
  umgesetzt: 'var(--tf-fb-lob)',
  abgelehnt: 'var(--tf-fb-lane-abgelehnt)',
  archiviert: 'var(--tf-text-tertiary)', // nie als Spalte gerendert
};

/** Status-Glyphe je Kanban-Spaltenkopf (lucide-Namen, Auflösung via getLucideIcon). */
export const STATUS_COLUMN_ICONS: Record<FeedbackStatus, string> = {
  neu: 'CirclePlus',
  geplant: 'Calendar',
  in_bearbeitung: 'Clock',
  umgesetzt: 'CircleCheck',
  abgelehnt: 'CircleX',
  archiviert: 'Archive', // nie als Spalte gerendert
};

/**
 * Kategorie-Badges — eindeutige, gesättigte Farben pro Typ (Handoff-Palette
 * `--tf-fb-*`, v2.208): Problem=rot, Idee=blau, UX=violett, Lob=grün, Frage=amber.
 */
export const CATEGORY_COLORS: Record<FeedbackCategory, string> = {
  problem: 'bg-[var(--tf-fb-problem-bg)] text-[var(--tf-fb-problem)]',
  idea: 'bg-[var(--tf-fb-idee-bg)] text-[var(--tf-fb-idee)]',
  ux: 'bg-[var(--tf-fb-ux-bg)] text-[var(--tf-fb-ux)]',
  praise: 'bg-[var(--tf-fb-lob-bg)] text-[var(--tf-fb-lob)]',
  question: 'bg-[var(--tf-fb-frage-bg)] text-[var(--tf-fb-frage)]',
};

/** Reine Textfarbe (`var(--tf-fb-*)`) je Kategorie — Icon-Tint / Chip-Dot. */
export const CATEGORY_TEXT_VAR: Record<FeedbackCategory, string> = {
  problem: 'var(--tf-fb-problem)',
  idea: 'var(--tf-fb-idee)',
  ux: 'var(--tf-fb-ux)',
  praise: 'var(--tf-fb-lob)',
  question: 'var(--tf-fb-frage)',
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
 * Kräftige Punkt-Farbe je Kategorie — für den Farb-Dot der Typ-Filter-Chips.
 * Handoff-Palette `--tf-fb-*` (v2.208, dark-aware), KEINE Hex-Werte
 * (theme-token-contract). Deckungsgleich mit CATEGORY_COLORS / CATEGORY_TEXT_VAR.
 */
export const CATEGORY_DOT: Record<FeedbackCategory, string> = CATEGORY_TEXT_VAR;

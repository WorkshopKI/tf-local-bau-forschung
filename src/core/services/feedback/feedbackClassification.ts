/**
 * Helper + Type-Guard für FeedbackItem.classification.
 *
 * Siehe FeedbackClassification in src/core/types/feedback.ts für Hintergrund.
 * Ziel: Compiler zwingt UI-Code, den Pending-Fall (LLM noch nicht durch /
 * Streamlit-Transport / LLM-Fehler) explizit zu handhaben.
 */

import type {
  FeedbackCategory,
  FeedbackClassification,
  FeedbackItem,
} from '@/core/types/feedback';

/** Leitet den Klassifikations-Status aus dem optionalen `category`-Feld ab. */
export function getFeedbackClassification(item: FeedbackItem): FeedbackClassification {
  return item.category
    ? { state: 'classified', category: item.category }
    : { state: 'pending' };
}

/**
 * Type-Guard: schmälert FeedbackItem auf eine Variante mit garantiertem
 * `category`-Feld. Praktisch bei Filtern.
 *
 * Beispiel:
 * ```ts
 * const features = items.filter(isClassifiedAs('idea'));
 * // features hat den Typ FeedbackItem mit category === 'idea'
 * ```
 */
export function isClassifiedFeedback(
  item: FeedbackItem,
): item is FeedbackItem & { category: FeedbackCategory } {
  return item.category !== undefined;
}

/**
 * Currying-Variante für Array.filter — schließt alle Pending- und nicht-passenden
 * Tickets aus. Liest sich an Aufrufstelle als Domain-Filter, nicht als
 * `=== 'idea'`-Vergleich der Pending übersieht.
 */
export function isClassifiedAs(category: FeedbackCategory) {
  return (item: FeedbackItem): item is FeedbackItem & { category: FeedbackCategory } =>
    item.category === category;
}

/**
 * Plugin-id des Auslastungs-Moduls. Muss mit `id: 'auslastung'` in
 * src/plugins/auslastung/index.tsx übereinstimmen — `captureFeedbackContext`
 * legt diese id beim Erfassen als `context.route` ab.
 */
export const AUSLASTUNG_PLUGIN_ID = 'auslastung';

/**
 * True, wenn das Feedback im Auslastungs-Modul erfasst wurde (`context.route`).
 * Genutzt um modul-spezifisches Feedback in Varianten OHNE Auslastungs-Modul
 * (prod, kurator) aus der Übersicht auszublenden — sonst leakt es über die
 * geteilte feedback.json aus der pl-Variante in fremde Boards.
 */
export function isAuslastungFeedback(item: FeedbackItem): boolean {
  return item.context?.route === AUSLASTUNG_PLUGIN_ID;
}

// ── Deterministische Klassifikation ohne LLM ─────────────────────────────────

/** Schlüsselwort-Cues je Kategorie — bewusst konservativ (Lob ohne bloßes „gut"). */
const KEYWORD_CUES: { category: FeedbackCategory; cues: string[] }[] = [
  {
    category: 'problem',
    cues: [
      'funktioniert nicht', 'geht nicht', 'klappt nicht', 'kaputt', 'fehler',
      'stürzt ab', 'absturz', 'bug', 'defekt', 'hängt', 'lädt nicht', 'fehlerhaft',
    ],
  },
  {
    // 'idea' deckt seit v2.289 auch die ehemaligen UX-Cues ab (Kategorie 'ux'
    // ist entfallen) — Wunsch nach Neuem und „ist umständlich" landen beide hier.
    category: 'idea',
    cues: [
      'wünsche mir', 'wäre toll', 'wäre gut', 'wäre schön', 'könnte man',
      'sollte man', 'fehlt', 'bräuchte', 'vorschlag', 'einbauen', 'hinzufügen',
      'ergänzen', 'feature', 'wäre praktisch', 'sortieren', 'filter',
      'umständlich', 'unübersichtlich', 'verwirrend', 'kompliziert',
      'zu viele klicks', 'unintuitiv', 'nicht intuitiv', 'mühsam', 'fummelig',
    ],
  },
  {
    category: 'praise',
    cues: [
      'sehr gut', 'finde gut', 'gefällt', 'super', 'toll', 'klasse', 'prima',
      'danke', 'spitze', 'gut gemacht',
    ],
  },
];

/**
 * Deterministische Klassifikation eines Feedback-Texts OHNE LLM. Fallback wenn
 * kein LLM-Transport läuft (z.B. prod/pl-Builds) — sonst bliebe alles
 * „Unklassifiziert" und unsichtbar im Bugs/Features-Board.
 *
 * Reihenfolge: Defekt-Signale (bug) > Wunsch-/Umständlich-Signale (feature/idea)
 * > Frage (endet auf „?") > Lob. Kein Treffer → undefined (bleibt unklassifiziert,
 * erscheint aber unter „Sonstige" im Board). Bewusst simpel + konservativ;
 * ein laufendes LLM verfeinert anschließend via autoClassifyFeedback.
 */
export function classifyByKeywords(text: string): FeedbackCategory | undefined {
  const t = text.toLowerCase();
  for (const { category, cues } of KEYWORD_CUES) {
    if (category === 'praise') break; // Lob erst nach der Frage-Prüfung
    if (cues.some(c => t.includes(c))) return category;
  }
  if (t.trim().endsWith('?')) return 'question';
  const praise = KEYWORD_CUES.find(k => k.category === 'praise');
  if (praise && praise.cues.some(c => t.includes(c))) return 'praise';
  return undefined;
}

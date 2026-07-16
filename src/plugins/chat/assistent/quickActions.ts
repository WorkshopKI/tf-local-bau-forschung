/**
 * Assistent-Panel v1.1 — routen-sensitiver Quick-Action-Katalog (Topf 1).
 *
 * Eine Quick Action ist NICHTS WEITER als ein vorformulierter Fragetext: der
 * Klick schickt `frage` durch denselben `c.send()`-Pfad wie eine getippte Frage
 * (ein Aufruf pro Turn, resetChat, nur interner Transport, deterministische Fakten
 * im Prompt). KEIN neuer LLM-/Transport-Mechanismus, KEINE eigene Turn-Logik.
 *
 * Reine Funktion (node-testbar): welche Aktionen sichtbar sind, hängt AUSSCHLIESSLICH
 * deterministisch vom Snapshot (Entitätsart, Route) + der Orama-Index-Präsenz ab —
 * nie entscheidet ein LLM, WELCHE Aktionen erscheinen.
 *
 * „Voraussetzung nicht erfüllt → ausblenden, nicht ausgrauen": es gibt kein
 * `disabled`-Feld; `quickActionsFuer` filtert nicht-sichtbare Aktionen schlicht heraus.
 *
 * Weggelassen (bewusst): „Plan bis Bewilligung". Die Aktion bräuchte eine
 * Spine-Restschritt-Ableitung (verbleibende Workflow-Stationen bis zur Bewilligung),
 * die es als reinen Helfer nicht gibt und die nicht-trivial wäre — statt dafür eine
 * neue Statusmaschine zu bauen, bleibt sie außen vor (v1.1). Die fünf übrigen reichen.
 */
import type { AssistentTurnKontext } from './turn';

/** Snapshot + die (unrein ermittelte) Orama-Index-Präsenz. Der Host reicht
 *  `hatIndex = getOramaDB() !== null` herein, damit dieses Modul rein bleibt. */
export interface QuickActionKontext extends AssistentTurnKontext {
  hatIndex: boolean;
}

export interface QuickAction {
  /** Stabile ID (Reihenfolge + React-`key` + Tests). */
  id: string;
  /** Button-Beschriftung. */
  label: string;
  /** Vorformulierte Frage — genau dieser Text geht in `c.send()`. */
  frage: string;
  /** Rein deterministische Sichtbarkeit (Entität/Route/Index). */
  sichtbarWenn: (k: QuickActionKontext) => boolean;
}

/**
 * Katalog in STABILER Reihenfolge — die gefilterte Leiste behält diese Ordnung,
 * damit sie beim Entitäts-/Routenwechsel nicht springt.
 *
 * Träger je Aktion (die deterministische Quelle liefert die Fakten, das LLM
 * formuliert nur aus):
 * - `naechster-schritt` / `wo-stehe-ich`: `naechsterSchritt()` + Status/Kategorie
 *   stehen bereits im Faktenblock der selektierten Entität.
 * - `fristen`: der Entitäts-Frist-Hinweis (mit Entität) bzw. der
 *   Arbeitsvorrat-Übersichtsblock (ohne Entität) — beide deterministisch.
 * - `heute-dran`: der Arbeitsvorrat-Übersichtsblock (nur ohne selektierte Entität).
 * - `zusammenfassen`: echter Retrieval-/LLM-Fall — braucht den Orama-Index.
 */
const KATALOG: readonly QuickAction[] = [
  {
    id: 'naechster-schritt',
    label: 'Nächster Schritt',
    frage: 'Was ist mein nächster Schritt?',
    sichtbarWenn: k => k.entitaet !== null,
  },
  {
    id: 'wo-stehe-ich',
    label: 'Wo stehe ich?',
    frage: 'Wo im Verfahren steht dieser Vorgang?',
    sichtbarWenn: k => k.entitaet !== null,
  },
  {
    id: 'fristen',
    label: 'Fristen',
    frage: 'Welche Fristen stehen an?',
    sichtbarWenn: () => true,
  },
  {
    id: 'heute-dran',
    label: 'Was ist heute dran?',
    frage: 'Was ist heute in meinem Arbeitsvorrat dran?',
    sichtbarWenn: k => k.entitaet === null,
  },
  {
    id: 'zusammenfassen',
    label: 'Zusammenfassen',
    frage: 'Fasse den aktuellen Vorgang zusammen.',
    sichtbarWenn: k => k.entitaet !== null && k.hatIndex,
  },
];

/**
 * Die sichtbaren Quick Actions für den aktuellen Kontext (Katalogreihenfolge).
 * Nie leer: `fristen` ist überall sichtbar → die Leiste hat immer mindestens
 * eine Aktion.
 */
export function quickActionsFuer(k: QuickActionKontext): QuickAction[] {
  return KATALOG.filter(a => a.sichtbarWenn(k));
}

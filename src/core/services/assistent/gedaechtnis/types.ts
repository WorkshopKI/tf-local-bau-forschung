/**
 * Assistent-Gedächtnis — Datenmodell (Schema v1).
 *
 * Phase 2 des persönlichen Assistenten: aus dem rohen Ereignisprotokoll (Phase 0)
 * destilliert ein Hintergrund-Konsolidierungslauf per INTERNEM Modell wenige
 * benannte, größenbegrenzte Memory-Blocks. Das rohe Protokoll bleibt die Wahrheit;
 * jeder Gedächtnis-Eintrag ist Cache und trägt Belege (Ereignis-IDs).
 *
 * Harte Invarianten (siehe docs/architecture/assistent-gedaechtnis.md):
 *  1. STRIKT LOKAL — Einträge + Opt-in + Lauf-Metadaten leben ausschließlich in
 *     der Varianten-IndexedDB. NIE auf den SMB-Share, NIE in registry.json, NIE in
 *     Snapshot-/Export-Pfade. Der Store steht in KEINER Snapshot-Allowlist
 *     (Guard: gedaechtnis/__tests__/store.test.ts „Snapshot-Ausschluss").
 *  2. DOPPELTES OPT-IN — Default aus; aktivierbar nur, wenn das Protokoll-Opt-in
 *     aktiv ist. Der Konsolidierungslauf schreibt NUR bei Flag + beiden Opt-ins.
 *  3. OPERATIONEN STATT NEUSCHRIEB — das LLM liefert diskrete Operationen
 *     (ADD/UPDATE/INVALIDATE/NOOP), nie einen Block als Ganzes. Invalidieren statt
 *     löschen; harte Löschung nur durch Nutzer oder deterministische Retention.
 *  4. DETERMINISTISCHE WERTE NIE VOM LLM — IDs, Zeitstempel, Belege-Prüfung erzeugt/
 *     validiert der Code (`wendeOperationenAn`); das LLM liefert nur Faktensätze +
 *     Operationstypen.
 *  5. Schema-Evolution NUR ADDITIV (`version` + optionale Felder).
 */

/** Die drei fixen Memory-Blocks (v1). Erweiterung nur bewusst + additiv. */
export type GedaechtnisBlock = 'arbeitskontext' | 'praeferenzen' | 'offene_faeden';

/** Iterierbare Block-Liste (stabile Reihenfolge für Anzeige + Prompt). */
export const GEDAECHTNIS_BLOECKE: readonly GedaechtnisBlock[] = [
  'arbeitskontext',
  'praeferenzen',
  'offene_faeden',
] as const;

/** Menschliche Labels je Block (UI + Prompt). */
export const BLOCK_LABELS: Record<GedaechtnisBlock, string> = {
  arbeitskontext: 'Arbeitskontext',
  praeferenzen: 'Präferenzen',
  offene_faeden: 'Offene Fäden',
};

export type EintragStatus = 'aktiv' | 'invalidiert';

/** Ein Gedächtnis-Eintrag: genau ein deutscher Faktensatz mit Belegen. */
export interface GedaechtnisEintrag {
  /** Eindeutige ID (vom Code, crypto.randomUUID mit Fallback). */
  id: string;
  /** Schema-Version — aktuell 1. Additive Erweiterungen bumpen NICHT. */
  version: 1;
  block: GedaechtnisBlock;
  /** Genau ein deutscher Faktensatz, max. MAX_TEXT_LEN Zeichen. */
  text: string;
  status: EintragStatus;
  /** Epoch-Millisekunden (vom Code). */
  erstellt: number;
  /** Epoch-Millisekunden (vom Code). */
  aktualisiert: number;
  /** Bei UPDATE: Kette zur invalidierten Vorversion. */
  vorgaengerId?: string;
  /** Ereignis-IDs aus dem Protokoll, min. 1, vom Code validiert. */
  belege: string[];
}

// ── Operationen (LLM-Ausgabe) ────────────────────────────────────────────────

export type OperationTyp = 'ADD' | 'UPDATE' | 'INVALIDATE' | 'NOOP';

export interface AddOperation {
  op: 'ADD';
  block: GedaechtnisBlock;
  text: string;
  belege: string[];
}
export interface UpdateOperation {
  op: 'UPDATE';
  id: string;
  text: string;
  belege: string[];
}
export interface InvalidateOperation {
  op: 'INVALIDATE';
  id: string;
  grund?: string;
}
export interface NoopOperation {
  op: 'NOOP';
}

export type GedaechtnisOperation =
  | AddOperation
  | UpdateOperation
  | InvalidateOperation
  | NoopOperation;

/**
 * Warum eine Operation verworfen wurde — entscheidet über das Wasserzeichen.
 *
 * `defekt`      — das Modell lieferte Unbrauchbares (malformt, fehlende/ungültige
 *                 Belege, unbekannter Block/Typ, Textprüfung). Die Ereignisse sind
 *                 faktisch NICHT verarbeitet worden.
 * `gesaettigt`  — die Operation war wohlgeformt, hatte aber keinen Platz oder
 *                 keinen Neuigkeitswert (Duplikat, Blockkapazität). Inhaltlich
 *                 erledigt. Das ist ein DAUERZUSTAND: als Defekt gewertet, stünde
 *                 das Wasserzeichen bei vollem Block für immer still.
 */
export type VerwurfsArt = 'defekt' | 'gesaettigt';

/** Eine verworfene Operation samt Grund (Eval + „letzter Lauf"-Anzeige). */
export interface VerworfeneOperation {
  /** Roh-Op wie vom Modell geliefert (zur Diagnose). */
  op: unknown;
  grund: string;
  art: VerwurfsArt;
}

/** Ergebnis eines Konsolidierungslaufs (LLM-frei aus `wendeOperationenAn`). */
export interface LaufErgebnis {
  /** Resultierender VOLL-Bestand (aktive + invalidierte Einträge). */
  eintraege: GedaechtnisEintrag[];
  /** Zähler je angewandter Operationsart. */
  hinzugefuegt: number;
  aktualisiert: number;
  invalidiert: number;
  /** Verworfene Operationen mit Grund. */
  verworfen: VerworfeneOperation[];
}

/** kv-Record über den letzten Lauf (Anzeige + 12-h-Trigger + Wasserzeichen). */
export interface LaufMeta {
  /** Zeitpunkt des letzten (erfolgreichen ODER fehlerhaften) Laufs. */
  letzterLauf: number;
  /** Wasserzeichen = Zeitstempel des jüngsten konsolidierten Ereignisses.
   *  Nur fortgeschrieben, wenn der Lauf die Ereignisse tatsächlich verarbeitet
   *  hat (siehe `MAX_DEFEKT_WIEDERHOLUNGEN`). */
  wasserzeichen: number | null;
  angewandt: number;
  verworfen: number;
  fehler: boolean;
  fehlerMeldung?: string;
  /** Wie viele Läufe in Folge ausschließlich Defekte lieferten. Zurückgesetzt,
   *  sobald ein Lauf das Wasserzeichen fortschreibt. Optional: Bestands-Records
   *  aus der Zeit vor v2.286 haben das Feld nicht (⇒ `?? 0`). */
  defektLaeufe?: number;
}

// ── Store / Grenzwert-Konstanten (mit Begründung) ───────────────────────────

/** Name des dedizierten Object-Stores (IDBStore v10). Steht bewusst in KEINER
 *  Snapshot-Allowlist → nie auf den Share (Invariante 1). */
export const GEDAECHTNIS_STORE = 'assistent_gedaechtnis';

/** kv-Key des gerätelokalen Gedächtnis-Opt-in-Flags (NICHT share-synchronisiert). */
export const GEDAECHTNIS_OPTIN_KEY = 'assistent-gedaechtnis-optin';

/** kv-Key des Lauf-Metadaten-Records (NICHT share-synchronisiert). */
export const GEDAECHTNIS_LAUF_META_KEY = 'assistent-gedaechtnis-lauf-meta';

/** Max. aktive Einträge je Block. Bei Erreichen wird eine weitere ADD-Operation
 *  VERWORFEN (nicht verdrängt) — hält den Kontext knapp + verhindert Wildwuchs. */
export const MAX_EINTRAEGE_PRO_BLOCK = 15;

/** Max. Zeichen je `text` — ein Faktensatz, keine Textwand. */
export const MAX_TEXT_LEN = 300;

/** Invalidierte Einträge werden nach so vielen Tagen deterministisch entfernt
 *  (Retention wie Phase 0 — Historie bleibt kurzfristig prüfbar, altert dann aus). */
export const INVALID_RETENTION_TAGE = 30;

/**
 * Nach so vielen Läufen in Folge, die NUR Defekte lieferten, rückt das
 * Wasserzeichen trotzdem vor.
 *
 * Ohne diese Obergrenze wäre der Schutz gefährlicher als die Lücke, die er
 * schließt: liefert das Modell dauerhaft unbrauchbare Operationen (so wie vor
 * v2.285 wegen der fehlenden `belege`-Ausnahme), stünde der Fortschritt für
 * immer still, der Ereignis-Stau wüchse mit jedem Lauf und die Konsolidierung
 * käme nie wieder in Gang. Zwei Versuche fangen den Ausrutscher ab; ein
 * struktureller Fehler wird sichtbar (`fehler: true`), statt alles zu blockieren.
 */
export const MAX_DEFEKT_WIEDERHOLUNGEN = 2;

/** Max. Anzahl neuer Ereignisse, die einem Lauf als Volltext übergeben werden;
 *  der Überhang geht als deterministische Zähl-Zusammenfassung je Typ ein
 *  (keine LLM-Vorverdichtung). */
export const MAX_EREIGNISSE_EINGABE = 300;

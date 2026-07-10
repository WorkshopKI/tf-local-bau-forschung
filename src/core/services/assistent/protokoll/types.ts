/**
 * Assistent-Ereignisprotokoll — Datenmodell (Schema v1).
 *
 * Phase 0 des persönlichen Assistenten: ein rein deterministisches, STRIKT
 * gerätelokales Protokoll app-semantischer Aktionen des Nutzers. Das rohe
 * Ereignisprotokoll ist die Wahrheit; alles später Destillierte (Konsolidierung,
 * Memory-Blocks) ist Cache und entsteht in späteren Phasen.
 *
 * Harte Invarianten (siehe docs/architecture/assistent-protokoll.md + Pitfall #37):
 *  1. STRIKT LOKAL — Daten + Opt-in-Zustand leben ausschließlich in der Varianten-
 *     IndexedDB. NIE auf den SMB-Share, NIE in registry.json, NIE in Snapshot-/
 *     Export-Pfade. Der dedizierte Store steht in KEINER Snapshot-Allowlist
 *     (src/core/services/csv/snapshot.ts + snapshot-sync.ts) → per Default
 *     ausgeschlossen (Guard: recorder.test.ts „Snapshot-Ausschluss").
 *  2. STRIKT OPT-IN — Default aus; die EINZIGE Schreib-Gate-Stelle ist
 *     `protokolliereEreignis` in recorder.ts (Flag + Opt-in), keine verstreuten
 *     Checks.
 *  3. KEINE Verhaltens-/Leistungsmetriken — nur app-semantische Aktionen. NIE
 *     Tastenanschläge, Mausbewegungen, Scroll, Verweildauern, Idle-Erkennung,
 *     Dokument-/Gutachtentexte. Zeitstempel je Ereignis sind erlaubt; abgeleitete
 *     Zeitmetriken NICHT.
 *  4. KEIN LLM / KEIN Netzwerk in Phase 0.
 *  5. Schema-Evolution NUR ADDITIV (`version` + optionale Felder) — wie
 *     AufbereitungRun.
 *
 * Ereignis-Katalog v1 (bewusst klein — ABSCHLIESSEND, nicht eigenmächtig
 * erweitern):
 *
 * | Typ                         | Auslöser                                   | detail                        |
 * |-----------------------------|--------------------------------------------|-------------------------------|
 * | antrag_geoeffnet            | Detailansicht Antrag/Verbund geöffnet      | status/vb_phase (falls da)    |
 * | dokument_geoeffnet          | Dokument-/VB-Ansicht geöffnet              | dokumentArt                   |
 * | suche_ausgefuehrt           | Orama-Suche abgesetzt                       | query, trefferanzahl          |
 * | skill_gestartet             | Skill-Lauf gestartet                        | skillId                       |
 * | skill_abgeschlossen         | Skill-Lauf beendet                          | skillId, erfolg: boolean      |
 * | gutachten_abschnitt_editiert| Abschnitt im Editor übernommen (entprellt)  | abschnittId — NIE Textinhalt  |
 * | frist_angesehen             | Fristen-/Arbeitsvorrat-Interaktion          | (view/sort-Key)               |
 * | einstellung_geaendert       | Protokoll-relevante Einstellung geändert    | schluessel (nur Assistent)    |
 *
 * Datenschutz-Hinweis zu `suche_ausgefuehrt.query`: Suchanfragen können Namen/
 * Antragsbezüge enthalten. Bewusste Entscheidung: wird gespeichert, weil (a)
 * strikt lokal auf demselben Gerät, auf dem die Dokumente ohnehin in IndexedDB
 * liegen, und (b) hoher Nutzwert für spätere Assistenz. In der Einstellungs-UI
 * transparent gemacht.
 */

export type AssistentEreignisTyp =
  | 'antrag_geoeffnet'
  | 'dokument_geoeffnet'
  | 'suche_ausgefuehrt'
  | 'skill_gestartet'
  | 'skill_abgeschlossen'
  | 'gutachten_abschnitt_editiert'
  | 'frist_angesehen'
  | 'einstellung_geaendert';

export type EntitaetArt =
  | 'antrag'
  | 'verbund'
  | 'tv'
  | 'dokument'
  | 'skill'
  | 'workflowSchritt';

/** Ein aufgezeichnetes Ereignis. Additiv erweiterbar (neue OPTIONALE Felder). */
export interface AssistentEreignis {
  /** Eindeutige ID (crypto.randomUUID mit Fallback). */
  id: string;
  /** Schema-Version — aktuell 1. Additive Erweiterungen bumpen NICHT. */
  version: 1;
  /** Epoch-Millisekunden. */
  zeitstempel: number;
  typ: AssistentEreignisTyp;
  /** Hash-Route zum Zeitpunkt des Ereignisses (optional). */
  route?: string;
  /** Bezogene App-Entität (optional). */
  entitaet?: { art: EntitaetArt; id: string };
  /**
   * Flache, kleine Zusatzinfo. NUR Primitive; Strings werden auf
   * MAX_DETAIL_WERT_LEN gekürzt, verschachtelte Objekte/Arrays werden verworfen
   * (Schema-Guard im Recorder) — verhindert versehentliches Abkippen von
   * Dokumenttext.
   */
  detail?: Record<string, string | number | boolean>;
}

/** Eingabe an `protokolliereEreignis` — id/version/zeitstempel füllt der Recorder. */
export interface NeuesEreignis {
  typ: AssistentEreignisTyp;
  route?: string;
  entitaet?: { art: EntitaetArt; id: string };
  /** Wird defensiv sanitisiert (Nicht-Primitive verworfen, Strings gekürzt). */
  detail?: Record<string, unknown>;
}

/** Aggregat für die „Meine Daten"-Ansicht. */
export interface ProtokollStatistik {
  gesamt: number;
  jeTyp: Record<string, number>;
  aeltester: number | null;
  neuester: number | null;
}

// ── Store / Retention / Guard-Konstanten ────────────────────────────────────

/** Name des dedizierten Object-Stores (IDBStore v9). Steht bewusst in KEINER
 *  Snapshot-Allowlist → nie auf den Share. */
export const EREIGNISPROTOKOLL_STORE = 'assistent_ereignisprotokoll';

/** kv-Key des gerätelokalen Opt-in-Flags (NICHT share-synchronisiert). */
export const ASSISTENT_OPTIN_KEY = 'assistent-protokoll-optin';

/** Auto-Löschung: Ereignisse älter als 90 Tage werden entfernt (auch nach
 *  Opt-out — Bestandsdaten altern aus). */
export const RETENTION_TAGE = 90;

/** Harte Obergrenze — ältester zuerst wird gekappt. */
export const MAX_EREIGNISSE = 50_000;

/** Längenlimit je `detail`-Stringwert (Schutz vor Dokumenttext-Abkippen). */
export const MAX_DETAIL_WERT_LEN = 500;

/** Retention läuft periodisch alle N Writes (zusätzlich einmalig beim Start). */
export const RETENTION_WRITE_INTERVALL = 200;

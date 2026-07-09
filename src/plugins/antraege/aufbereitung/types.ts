/**
 * Datenmodell der Antrag-Aufbereitung. Ein Run-Objekt pro Antrag, persistiert im
 * IDB-`kv`-Store unter `aufbereitung:<antragKey>` (KEIN neuer Object-Store,
 * Pitfall #29). Quell-Hashes liegen IM Objekt; getrennte Cache-Keys pro
 * LLM-Baustein kommen erst mit Paket 2.
 */
import type { VbSektion } from './gliederung';
import type { ApZeile, Befund, KlassifizierteTabelle } from './tabellen';

/** Gestempelte Quelle (Muster `VorlageRef`, aber mit Rolle statt Pfad-Semantik). */
export interface QuelleRef {
  /** Dateiname/Titel der gelesenen Quelle. */
  name: string;
  /** Inhalts-Hash (`hashText`, djb2) — Grundlage für `istVeraltet`. */
  hash: string;
  /** ISO-Zeitstempel des Lesens/Stempelns. */
  gelesenAm: string;
  rolle: 'vb' | 'anlage5';
}

/** Klassifizierte Tabelle mit ihrer Quelle-Rolle (für die Ansicht). */
export type RunTabelle = KlassifizierteTabelle & { rolle: 'vb' | 'anlage5' };

/**
 * Ein aus einer `klasse:'risiko'`-Tabelle geerntetes technisches Risiko (Paket 3,
 * deterministisch). `sektionId` = die VB-Sektion, in deren Zeichen-Span die
 * Herkunfts-Tabelle beginnt (tiefste Ebene) — fehlt bei Risiken aus einer separaten
 * Anlage-5-Datei. Die Zuordnung zum Lösungsweg (Aspekt C) passiert erst im UI
 * (`zuordneRisiken`), weil sie das LLM-Aspekt-Mapping braucht.
 */
export interface RisikoEintrag {
  titel: string;
  beschreibung: string;
  sektionId?: string;
}

export interface AufbereitungRun {
  version: 1;
  antragKey: string;
  erzeugtAm: string;
  quellen: QuelleRef[];
  gliederung: VbSektion[];
  tabellen: RunTabelle[];
  /**
   * Angezeigter Zeitplan (Anlage 5 gewinnt); `herkunft` = welche Quelle(n)
   * beitrugen; `achseMax` = Monat, bis zu dem die X-Achse reicht (max über BEIDE
   * Quellen — so bleibt die Leerfläche „ab M x keine APs terminiert" sichtbar).
   */
  zeitplan: { zeilen: ApZeile[]; herkunft: 'anlage5' | 'vb' | 'beide'; achseMax: number } | null;
  befunde: Befund[];
  /** Vom Nutzer als offen markierte Befunde (stabile `befundKey`-Referenzen). */
  offenePunkte: string[];
  /**
   * Deterministisch geerntete technische Risiken (Paket 3, optional — alte Runs ohne
   * das Feld bleiben ladbar, `version` bleibt 1). NUR die Ernte; die Zuordnung zum
   * Lösungsweg rechnet das UI (`zuordneRisiken`, braucht das Aspekt-Mapping).
   */
  risiken?: RisikoEintrag[];
  /** Gesetzt, wenn keine VB auffindbar war (definierter Zustand statt Fehler). */
  hinweis?: string;
}

export type { VbSektion } from './gliederung';
export type { ApZeile, Befund, KlassifizierteTabelle, RohTabelle, TabellenKlasse } from './tabellen';

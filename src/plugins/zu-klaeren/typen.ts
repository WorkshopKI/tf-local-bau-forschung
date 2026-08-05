/**
 * Das Datenmodell einer Klärung: Punkte (die Fragen) und Einträge (die Antworten).
 *
 * Eine **Klärung** ist ein Fragebogen, den die Kollegen asynchron beantworten.
 * Die Punkte sind Seed-Daten im Code — eine neue Klärung anzulegen ist ein
 * Zweizeiler im Seed, kein Bedienelement. Die Einträge liegen auf dem Daten-Share.
 *
 * **Kein `null` im Drahtformat.** `JSON.stringify` verschluckt `undefined` und
 * behält `null`; ein `urteil?: Urteil | null` hätte deshalb zwei unsichtbar
 * verschiedene „leer"-Arme, und ein per Spread gebauter Eintrag schriebe „sagt
 * nichts dazu", wo „zurückgezogen" gemeint war. Zurückziehen ist darum ein
 * **Wert** (`'zurueckgezogen'`), kein Fehlen: jedes optionale Feld ist entweder
 * mit Wert da oder gar nicht da, und der Round-Trip durch JSON ist total.
 *
 * Rein: keine IO, keine Uhr.
 */
import type { ZahPhaseId } from '@/core/status/typen';

/**
 * Die Marker-Gruppe als vergleichbarer Wert. `zahPhasenVon()` kennt nur die sechs
 * echten Phasen; „gehört zu keiner" braucht trotzdem etwas, das man gleichsetzen
 * kann — sonst könnte `konsens` nicht sagen, dass zwei Leute dasselbe meinen.
 */
export const OHNE_PHASE = 'ohne-phase';

/** Zielwert einer Phasenzuordnung: eine der sechs Phasen oder ausdrücklich keine. */
export type ZielWert = ZahPhaseId | typeof OHNE_PHASE;

/**
 * Das Urteil zu einem Punkt.
 *
 * - `passt` — die ausgelieferte Zuordnung stimmt
 * - `andere` — gehört woandershin; dann trägt der Eintrag einen `zielWert`
 * - `unklar` — kann ich nicht beurteilen (**keine** Gegenstimme, siehe `konsens.ts`)
 * - `zurueckgezogen` — ich hatte geurteilt und nehme es zurück
 */
export type Urteil = 'passt' | 'andere' | 'unklar' | 'zurueckgezogen';

/**
 * Art eines Punktes — zugleich die Art seiner Antwort. Bewusst **ein** Feld:
 * eine getrennte `antwortTyp`-Achse stimmte über alle Punkte 1:1 mit dieser
 * überein, und zwei Felder, die immer übereinstimmen, stimmen irgendwann nicht
 * mehr überein.
 */
export type PunktArt = 'phasenzuordnung' | 'freitext';

/** Ein Punkt der Klärung: eine Zeile der Zuordnungstabelle oder eine Grundsatzfrage. */
export interface KlaerungPunkt {
  /** Stabil über Neubauten des Seeds — die Einträge auf dem Share zeigen darauf. */
  id: string;
  klaerungId: string;
  art: PunktArt;
  /** Vollständige Beschriftung, z. B. „38 · techn geprüft" — für Export und Fragen. */
  titel: string;
  /**
   * Nur die Bezeichnung ohne den Code. Steht als **eigenes Feld** da, damit die
   * Tabelle sie nicht per Muster aus `titel` herausschneiden muss — ein Regex
   * über eine fertige Zeichenkette rät, wo eine Grenze liegt.
   */
  bezeichnung?: string;
  /** Begründung/Kontext; bei den Grundsatzfragen die Frage hinter der Frage. */
  zusatz?: string;
  /** Nur bei `phasenzuordnung`: der Status-Code, um den es geht. */
  code?: number;
  /** Nur bei `phasenzuordnung`: was der ausgelieferte Schnitt heute sagt. */
  seedZiel?: ZielWert;
}

/** Der Kopf einer Klärung. Das Datum ist ein Feld, nicht Teil des Titels. */
export interface Klaerung {
  klaerungId: string;
  titel: string;
  /** ISO-Kalendertag, an dem die Klärung gestellt wurde. */
  datum: string;
}

/**
 * Eine Zeile der JSONL-Datei — eine Äußerung einer Person zu einem Punkt.
 *
 * Ein Eintrag darf Urteil **und** Kommentar tragen: „gehört nach Prüfung, weil …"
 * ist eine Handlung, und sie in zwei Anhänge zu zerlegen verdoppelte den
 * Schreibvorgang ohne Gewinn.
 */
export interface KlaerungEintrag {
  /**
   * ISO-Zeitstempel — **nur Anzeige**. Die Reihenfolge in der Datei entscheidet,
   * nicht diese Zahl (siehe Modulkopf von `fold.ts`).
   */
  ts: string;
  /**
   * Der **Name der Person** (`UserProfile.name`) in der Schreibweise ihres
   * Profils — nicht ihr Bearbeiter-Kürzel. Siehe `normalisiereAutor`.
   */
  autor: string;
  punktId: string;
  urteil?: Urteil;
  /** Nur sinnvoll bei `urteil === 'andere'`. */
  zielWert?: ZielWert;
  kommentar?: string;
  /** Zieht den jüngsten noch stehenden eigenen Beitrag zu diesem Punkt zurück. */
  kommentarZurueck?: true;
}

/** Ein Kommentar, wie ihn die Anzeige braucht. */
export interface Beitrag {
  autor: string;
  ts: string;
  text: string;
}

/** Das gefaltete Urteil einer Person zu einem Punkt. */
export interface UrteilStand {
  urteil: Urteil;
  zielWert?: ZielWert;
  ts: string;
}

/**
 * Der gefaltete Stand einer Klärung.
 *
 * `urteile` ist nach `autor|punktId` gekeyt, weil genau das die Einheit ist, die
 * ein späteres Urteil ersetzt. `kommentare` sammelt je Punkt alle Beiträge.
 * `namen` hält zu jeder Vergleichsform die zuletzt gesehene Schreibweise — sonst
 * stünde in Spaltenköpfen und Tooltips „THOMAS HÜBSCH" statt „Thomas Hübsch".
 */
export interface KlaerungStand {
  urteile: Map<string, UrteilStand>;
  kommentare: Map<string, Beitrag[]>;
  /** Vergleichsform → Anzeigename. Siehe `normalisiereAutor` / `anzeigeAutor`. */
  namen: Map<string, string>;
}

/**
 * Die **Vergleichsform** eines Autornamens — nur Schlüssel, nie Anzeige.
 *
 * NFC zuerst (Pitfall #22): sonst zerfällt `ü` in u + Kombizeichen, und
 * „Hübsch" aus zwei Quellen wäre zweimal derselbe Mensch mit zwei
 * Faltungsfächern. Großschreibung, damit auch eine getippte Kleinschreibung
 * dasselbe Fach trifft; innere Mehrfach-Leerzeichen fallen zusammen, weil ein
 * Doppelblank im Profilnamen sonst eine zweite Person erzeugte.
 *
 * Die Anzeige läuft über {@link anzeigeAutor} und `KlaerungStand.namen`.
 */
export function normalisiereAutor(name: string): string {
  return anzeigeAutor(name).toUpperCase();
}

/** Die **Anzeigeform**: getrimmt, NFC, innere Leerzeichen vereinheitlicht. */
export function anzeigeAutor(name: string): string {
  return name.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Der Schlüssel, unter dem ein Urteil im Stand liegt. */
export function urteilSchluessel(autor: string, punktId: string): string {
  return `${normalisiereAutor(autor)}|${punktId}`;
}

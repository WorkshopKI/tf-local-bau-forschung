/**
 * Reine Berechnungen fürs Cockpit: Feld-Extraktion je Verbund, Vorkommen,
 * Spalten-Herkunft, „zuletzt gesehen". Alles ohne IO — die Daten reicht der
 * Hook rein (testbar).
 */
import type { CsvSchema } from '@/core/services/csv/types';
import type { MappingVersion } from './typen';
import { wertId } from './typen';
import { sammleVorkommen, type FeldAufloesung, type FeldVorkommen } from './feld-aufloesung';
import type { StatusEvent } from './event-typen';

export interface VerbundFelder {
  verbundId: string;
  felder: Record<string, string>;
  tvFelder: Record<string, Record<string, string>>;
}

/**
 * Baut die Engine-Eingabe eines Verbunds aus Verbund- + Antrag-Records.
 *
 * Die Ebene/Herkunft-Regel liegt in `sammleVorkommen` — hier wird sie nur in die
 * beiden Eimer einsortiert, die die Engine erwartet. `aufloesung` optional: ohne
 * sie gilt der Record-Key gleich der `feldId` (Verhalten wie vor dem
 * Code-Katalog, für Aufrufer ohne Schema-Zugriff).
 */
export function baueVerbundFelder(
  version: MappingVersion,
  verbundId: string,
  verbundRecord: Record<string, unknown>,
  antraege: { aktenzeichen: string; record: Record<string, unknown> }[],
  aufloesung?: FeldAufloesung,
): VerbundFelder {
  const felder: Record<string, string> = {};
  const tvFelder: Record<string, Record<string, string>> = {};
  for (const v of sammleVorkommen(version.felder, verbundRecord, antraege, aufloesung)) {
    if (v.tvId === undefined) {
      felder[v.feld.feldId] = v.wert;
      continue;
    }
    const rec = tvFelder[v.tvId] ?? (tvFelder[v.tvId] = {});
    rec[v.feld.feldId] = v.wert;
  }
  return { verbundId, felder, tvFelder };
}

/**
 * Der Rückweg: `VerbundFelder` → `FeldVorkommen[]`.
 *
 * Der Bestand liegt im Cockpit bereits flachgeklopft vor; wer darauf eine
 * Funktion anwenden will, die auf Vorkommen rechnet (etwa
 * `letzteAktivitaetVon`), braucht die Feld-Einträge zurück. Unbekannte feldIds
 * fallen weg — sie tragen auch in der Hinrichtung nichts bei. Rein.
 */
export function vorkommenAus(
  version: MappingVersion, vf: VerbundFelder,
): FeldVorkommen[] {
  const nachId = new Map(version.felder.map(f => [f.feldId, f]));
  const out: FeldVorkommen[] = [];
  const sammle = (rec: Record<string, string>, tvId?: string): void => {
    for (const [feldId, wert] of Object.entries(rec)) {
      const feld = nachId.get(feldId);
      if (!feld || !wert) continue;
      out.push({ feld, wert, ...(tvId ? { tvId } : {}) });
    }
  };
  sammle(vf.felder);
  for (const [tvId, rec] of Object.entries(vf.tvFelder)) sammle(rec, tvId);
  return out;
}

/**
 * Herkunft eines Katalog-Feldes: feldId → die CSV-Spalten, aus denen es gefüllt
 * wird (`status` → `STATUS`). Der Spaltenname ist für die Kuration der
 * verlässlichste Bezeichner — die feldId ist unsere Erfindung, die Spalte steht
 * so im Export des Fachsystems.
 *
 * Ist eine Spalte auf ein kanonisches Feld gemappt, zählt der kanonische Key;
 * ungemappte Spalten sind ihr eigener Key (dieselbe Regel wie im Spalten-Vorrat
 * der Meilensteine). Mehrere Programme können dasselbe Feld aus verschieden
 * benannten Spalten füllen — daher eine Liste, sortiert und doppelfrei. Rein.
 *
 * **Und zusätzlich unter dem rohen Spaltennamen.** Die Code-Felder des
 * Fachsystems tragen als `feldId` genau diesen Rohnamen (`D_AAE`) — mappt ein
 * Programm die Spalte kanonisch (`D_AAE` → `antragsdatum`), stünde sie sonst nur
 * unter `antragsdatum` und das Kürzel-Feld fände sich nirgends. Die Anzeige
 * behauptete dann „nicht im Export", obwohl die Spalte da ist. Beobachtet an
 * `D_AAE` und `D_ABB` — beide kanonisch gemappt, beide Kernspalten
 * (Antragseingang, Bewilligung).
 *
 * Der Zweit-Eintrag ist gefahrlos: gelesen wird die Map ausschließlich per
 * `feldId`, und ein Rohname, den kein Katalog-Feld trägt, wird nie nachgeschlagen.
 */
export function csvSpaltenJeFeld(schemas: readonly CsvSchema[]): Map<string, string[]> {
  const roh = new Map<string, Set<string>>();
  const merke = (feldId: string, spalte: string): void => {
    const set = roh.get(feldId);
    if (set) set.add(spalte);
    else roh.set(feldId, new Set([spalte]));
  };
  for (const schema of schemas) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const kanonisch = entry.canonical?.trim();
      merke(kanonisch || spalte, spalte);
      if (kanonisch) merke(spalte, spalte);
    }
  }
  return new Map(
    [...roh].map(([feldId, spalten]) => [feldId, [...spalten].sort((a, b) => a.localeCompare(b, 'de'))]),
  );
}

/** Zählt, in wie vielen Verbünden ein (feldId, wert) aktuell vorkommt.
 *  Schlüssel = `wertId(feldId, wert)`. Rein. */
export function zaehleVorkommen(alle: readonly VerbundFelder[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const vf of alle) {
    const gesehen = new Set<string>();
    const add = (feldId: string, wert: string): void => {
      const id = wertId(feldId, wert);
      if (gesehen.has(id)) return;
      gesehen.add(id);
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const [f, w] of Object.entries(vf.felder)) add(f, w);
    for (const rec of Object.values(vf.tvFelder)) for (const [f, w] of Object.entries(rec)) add(f, w);
  }
  return m;
}

// Hier stand bis v2.385 die Simulation: „welche Phase bekäme jeder Verbund mit
// diesem Entwurf?". Sie war das Werkzeug, um Rang-Änderungen abzuschätzen — und
// mit den Rängen ist die Frage weg. Was die PL am Katalog ändert, sind
// ZAH-Phase und Zieltage; deren Wirkung steht in der Diagnose, nicht in einer
// Vorher/Nachher-Leiste.

/** Jüngstes `erfasstAm` je (feldId, wert) aus dem Event-Log. Rein. */
export function zuletztGesehen(events: readonly StatusEvent[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    const id = wertId(e.feldId, e.wert);
    const bisher = m.get(id);
    if (!bisher || e.erfasstAm > bisher) m.set(id, e.erfasstAm);
  }
  return m;
}

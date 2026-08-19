/**
 * Gespeicherte Suchen — gerätelokal.
 *
 * Bewusst im Browser des Nutzers, nicht auf dem Team-Share: eine gespeicherte
 * Suche ist eine persönliche Arbeitsgewohnheit, und ein weiterer Sidecar mit
 * Schreibprofil und Freigabe wäre für „ich schaue jeden Montag nach X" ein
 * unangemessener Apparat.
 *
 * **„+2 seit zuletzt", nicht „2 neu".** Gespeichert wird die Trefferzahl des
 * letzten Ausführens; angezeigt wird die Differenz zur heutigen. Das ist etwas
 * anderes als „zwei neue Anträge": ein zurückgezogener und zwei neue ergäben
 * ebenfalls +1. Die Beschriftung sagt deshalb genau das, was gemessen wurde —
 * ein Benachrichtigungsweg (Mail, Intervall) existiert in dieser App nicht und
 * wird auch nicht vorgetäuscht.
 *
 * Toleranter Leser: alles, was nicht passt, fällt still weg. Ein kaputter
 * Eintrag darf die Liste nicht mitnehmen.
 */
import type { SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { parseVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import { parseSuchbereich, type Suchbereich } from '@/core/services/search/suchbereich';

const KEY = 'teamflow_suche_gespeichert';

/** Obergrenze. Eine Liste, die nicht mehr auf den Startbildschirm passt, ist
 *  keine Merkliste mehr. */
export const MAX_GESPEICHERT = 12;

export interface GespeicherteSuche {
  /** Stabile Id — die Anfrage selbst, klein geschrieben. */
  id: string;
  name: string;
  query: string;
  verknuepfung: SuchVerknuepfung;
  stammSuche: boolean;
  bereich: Suchbereich;
  /** Trefferzahl beim letzten Ausführen. `null` = noch nie ausgeführt. */
  letzteTrefferzahl: number | null;
  /** ISO-Datum des letzten Ausführens. */
  zuletzt: string | null;
}

export function ladeGespeicherte(): GespeicherteSuche[] {
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return [];
    const geparst: unknown = JSON.parse(roh);
    if (!Array.isArray(geparst)) return [];
    return geparst
      .map(leseEintrag)
      .filter((e): e is GespeicherteSuche => e !== null)
      .slice(0, MAX_GESPEICHERT);
  } catch {
    return [];
  }
}

export function speichereGespeicherte(liste: readonly GespeicherteSuche[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(liste.slice(0, MAX_GESPEICHERT)));
  } catch { /* ignore */ }
}

function leseEintrag(roh: unknown): GespeicherteSuche | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const o = roh as Record<string, unknown>;
  const query = typeof o.query === 'string' ? o.query.trim() : '';
  if (query.length === 0) return null;
  return {
    id: typeof o.id === 'string' && o.id.length > 0 ? o.id : query.toLowerCase(),
    name: typeof o.name === 'string' && o.name.trim().length > 0 ? o.name.trim() : query,
    query,
    verknuepfung: parseVerknuepfung(typeof o.verknuepfung === 'string' ? o.verknuepfung : null),
    stammSuche: o.stammSuche === true,
    bereich: parseSuchbereich(typeof o.bereich === 'string' ? o.bereich : null),
    letzteTrefferzahl: typeof o.letzteTrefferzahl === 'number' && Number.isFinite(o.letzteTrefferzahl)
      ? o.letzteTrefferzahl
      : null,
    zuletzt: typeof o.zuletzt === 'string' && o.zuletzt.length > 0 ? o.zuletzt : null,
  };
}

/**
 * Der heutige Tag, wie ihn die Uhr des Nutzers zeigt.
 *
 * NICHT `toISOString().slice(0,10)`: das ist der Tag in UTC. In Deutschland
 * stempelte eine um 01:48 gemerkte Suche dadurch den Vortag („zuletzt
 * 2026-08-18", gemessen) — jede Speicherung zwischen Mitternacht und 02:00
 * (Sommerzeit) beziehungsweise 01:00 (Winterzeit) traf den falschen Tag.
 *
 * Von Hand zusammengesetzt statt über `toLocaleDateString`: das Format bleibt
 * sortierbares `YYYY-MM-DD`, unabhängig von der Spracheinstellung des Browsers.
 */
export function heuteLokal(d: Date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Legt an oder ersetzt die gleichnamige Suche. Neueste zuerst. */
export function merkeSuche(
  liste: readonly GespeicherteSuche[],
  neu: GespeicherteSuche,
): GespeicherteSuche[] {
  const ohne = liste.filter(e => e.id !== neu.id);
  return [neu, ...ohne].slice(0, MAX_GESPEICHERT);
}

export function entferneSuche(
  liste: readonly GespeicherteSuche[],
  id: string,
): GespeicherteSuche[] {
  return liste.filter(e => e.id !== id);
}

/**
 * Schreibt das Ergebnis eines Laufs an die gespeicherte Suche zurück.
 * `zuletzt` kommt vom Aufrufer (die App stempelt Zeiten an einer Stelle).
 */
export function vermerkeLauf(
  liste: readonly GespeicherteSuche[],
  id: string,
  trefferzahl: number,
  zeitpunkt: string,
): GespeicherteSuche[] {
  return liste.map(e => (
    e.id === id ? { ...e, letzteTrefferzahl: trefferzahl, zuletzt: zeitpunkt } : e
  ));
}

/**
 * Die Veränderung seit dem letzten Ausführen, als Text.
 *
 * `null`, wenn es nichts zu sagen gibt — nie „±0" oder „unverändert": eine
 * Zeile, die in 90 % der Fälle dasselbe sagt, liest bald niemand mehr.
 */
export function veraenderungText(
  eintrag: GespeicherteSuche,
  aktuell: number | null,
): string | null {
  if (aktuell === null || eintrag.letzteTrefferzahl === null) return null;
  const diff = aktuell - eintrag.letzteTrefferzahl;
  if (diff === 0) return null;
  return diff > 0 ? `+${diff} seit zuletzt` : `${diff} seit zuletzt`;
}

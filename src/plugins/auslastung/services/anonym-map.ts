/**
 * AnonymMap — deterministisches Mapping echtes TIB-Kuerzel -> "MA01"..."MAxx".
 *
 * Wird zur Laufzeit aus allen historischen Antraegen neu berechnet. NIE
 * persistiert — Live-Map existiert nur als React-Context-Wert. Die Inverse
 * (MA01 -> echtes Kuerzel) wird ausschliesslich im Export-Moment im RAM
 * erzeugt (kommt in Prompt 2).
 *
 * Stabilitaets-Eigenschaft: gleiche Eingabe-Antraege -> gleiche Mapping
 * (sortiert nach Kuerzel + uppercase-normalisiert). Damit bleibt MA07
 * ueber App-Reloads hinweg derselbe MA, solange die Kuerzel-Menge stabil
 * ist. Neues Kuerzel reiht sich alphabetisch ein — kann bestehende
 * MA-Nummern verschieben.
 */
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { CANONICAL_TIB_KUERZ } from '../types';

export interface AnonymMap {
  /** echtes (uppercase) Kuerzel -> "MA01" */
  toAnon: Map<string, string>;
  /** "MA01" -> echtes (uppercase) Kuerzel */
  toReal: Map<string, string>;
}

/** Normalisiert ein Kuerzel: trim + uppercase. Leere Strings -> null. */
export function normalizeKuerzel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/** Padding: 1 -> "MA01", 12 -> "MA12", 100 -> "MA100". */
function anonId(idx: number): string {
  return `MA${String(idx).padStart(2, '0')}`;
}

/**
 * Sammelt alle unique TIB-Kuerzel aus den Antraegen, sortiert sie
 * alphabetisch und vergibt MA-Nummern.
 *
 * Akzeptiert sowohl `Antrag[]` (voller Record, key per `[CANONICAL_TIB_KUERZ]`)
 * als auch `AntragListItem[]` (Slim, key direkt als `.tib_kuerz`).
 *
 * @deprecated Drift-prone: alphabetischer Sort verschiebt anonIds wenn neue
 * Kuerzel in der Mitte einsortieren — die Store-Keys (mitarbeiter[anonId])
 * folgen aber nicht mit und es entsteht Identitaets-Drift. Verwende
 * stattdessen die persistente Map ueber `useKuerzelMap` /
 * `buildAnonymMapFromKuerzelMap` (siehe `services/kuerzel-map.ts`).
 *
 * Bleibt hier nur als Fallback im Bootstrap-Pfad (`bootstrapKuerzelMap`
 * nutzt dieselbe Sort-Logik fuer Initial-Befuellung), fuer Unit-Tests
 * existierender Matching-Logik mit expliziten Fixture-Maps, und falls in
 * Edge-Cases (z.B. App-Start ohne SMB-Share-Handle) keine persistente Map
 * verfuegbar ist.
 */
export function buildAnonymMap(
  antraege: Array<Antrag | AntragListItem>,
): AnonymMap {
  const set = new Set<string>();
  for (const a of antraege) {
    const raw = (a as Record<string, unknown>)[CANONICAL_TIB_KUERZ];
    const k = normalizeKuerzel(raw);
    if (k) set.add(k);
  }
  const sorted = [...set].sort((a, b) => a.localeCompare(b, 'de'));
  const toAnon = new Map<string, string>();
  const toReal = new Map<string, string>();
  sorted.forEach((kuerzel, i) => {
    const aid = anonId(i + 1);
    toAnon.set(kuerzel, aid);
    toReal.set(aid, kuerzel);
  });
  return { toAnon, toReal };
}

/**
 * Schlaegt das echte Kuerzel des Users (aus Profile) gegen die AnonymMap nach.
 * Mehrfach-Kuerzel ("MUE,SCH") werden gesplittet — gibt das ERSTE matchende
 * zurueck. "alle" (Spezialwert fuer Disable des Filters) -> null.
 */
export function resolveAnonIdForUser(
  bearbeiterKuerzel: string | undefined | null,
  map: AnonymMap,
): string | null {
  if (!bearbeiterKuerzel) return null;
  if (bearbeiterKuerzel.trim().toLowerCase() === 'alle') return null;
  for (const part of bearbeiterKuerzel.split(',')) {
    const k = normalizeKuerzel(part);
    if (k && map.toAnon.has(k)) return map.toAnon.get(k)!;
  }
  return null;
}

/** Gibt die naechste freie MA-Nummer zurueck. Fuer "MA hinzufuegen" im Admin. */
export function nextFreeAnonId(existingIds: Iterable<string>): string {
  const taken = new Set<number>();
  for (const id of existingIds) {
    const m = /^MA(\d+)$/.exec(id);
    if (m) taken.add(Number(m[1]));
  }
  let n = 1;
  while (taken.has(n)) n++;
  return anonId(n);
}

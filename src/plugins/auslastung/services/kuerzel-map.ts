/**
 * KuerzelMap — persistente, append-only Map `TIB-Kuerzel ↔ anonId`.
 *
 * Lebt als Sidecar-Datei `_intern/auslastung-kuerzel-map.json` neben
 * `_intern/auslastung.json`. Ersetzt das alte ephemeral-alphabetisch-Sort
 * Modell aus `buildAnonymMap(antraege)` — dieses produzierte einen
 * Identitaets-Drift, sobald neue TIB-Kuerzel alphabetisch in der Mitte
 * einsortierten (siehe CLAUDE.md Common-Pitfall "Auslastungs-Modul: nie
 * ohne persistierte kuerzel-map arbeiten").
 *
 * Invariante: entries sind append-only, `entries[i].anonId === MA{i+1}`.
 * Einmal vergebene anonIds werden nie geaendert oder geloescht.
 *
 * Wer schreibt: jeder User der antraege laedt (via `useAntraegeCache` →
 * `syncWithAntraege`). Read+Write fuer alle erlaubt — die Konsistenz
 * folgt aus dem append-only-Schema (neue Kuerzel haengen hinten an,
 * Reihenfolge alphabetisch deterministisch falls mehrere auf einmal).
 *
 * Sicherheit: Klartext-Mapping. Sicherheits-Effekt vs. dem alten ephemeral-
 * Sort-Modell unveraendert — die antraege selbst enthalten `tib_kuerz` als
 * Klartext-Spalte, das ephemeral-Mapping war daraus trivial ableitbar.
 */
import type { StorageService } from '@/core/services/storage';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { CANONICAL_TIB_KUERZ } from '../types';
import { normalizeKuerzel } from './anonym-map';
import type { AnonymMap } from './anonym-map';

export const KUERZEL_MAP_PATH = '_intern/auslastung-kuerzel-map.json';

export interface KuerzelMapEntry {
  /** Uppercase, normalisiert. */
  kuerzel: string;
  /** "MA01"..."MAxx". */
  anonId: string;
  /** ISO — wann zum ersten Mal gesehen. */
  createdAt: string;
}

export interface KuerzelMapFile {
  version: 1;
  updatedAt: string;
  entries: KuerzelMapEntry[];
}

export function emptyKuerzelMap(): KuerzelMapFile {
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
}

function anonIdFor(idx0: number): string {
  return `MA${String(idx0 + 1).padStart(2, '0')}`;
}

function isValidEntry(e: unknown): e is KuerzelMapEntry {
  return typeof e === 'object' && e != null
    && typeof (e as KuerzelMapEntry).kuerzel === 'string'
    && typeof (e as KuerzelMapEntry).anonId === 'string'
    && typeof (e as KuerzelMapEntry).createdAt === 'string';
}

/** Re-canonicalize: erzwingt `entries[i].anonId === MA{i+1}`. Repariert
 *  Dateien die manuell editiert wurden und die Invariante verletzen. */
export function normalizeKuerzelMap(raw: Partial<KuerzelMapFile> | null | undefined): KuerzelMapFile {
  const entries = Array.isArray(raw?.entries) ? raw!.entries.filter(isValidEntry) : [];
  const canon = entries.map((e, i) => ({ ...e, anonId: anonIdFor(i) }));
  return {
    version: 1,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    entries: canon,
  };
}

/** Liest die Sidecar-Datei. Datei fehlt → leeres Default. */
export async function loadKuerzelMap(storage: StorageService): Promise<KuerzelMapFile> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return emptyKuerzelMap();
  const text = await readText(handle, KUERZEL_MAP_PATH);
  if (text == null) return emptyKuerzelMap();
  try {
    const parsed = JSON.parse(text) as Partial<KuerzelMapFile>;
    return normalizeKuerzelMap(parsed);
  } catch {
    console.warn('[kuerzel-map] JSON-Parse fehlgeschlagen, leere Map zurueckgegeben.');
    return emptyKuerzelMap();
  }
}

/** Schreibt atomar via .tmp + rename + 1-Gen-Backup. Wirft falls Daten-Share
 *  nicht verbunden. */
export async function saveKuerzelMap(
  storage: StorageService,
  map: KuerzelMapFile,
): Promise<KuerzelMapFile> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) throw new Error('Daten-Share nicht verbunden — bitte im Welcome-Screen einrichten.');
  const next: KuerzelMapFile = { ...map, updatedAt: new Date().toISOString() };
  await atomicWrite(handle, KUERZEL_MAP_PATH, JSON.stringify(next, null, 2));
  return next;
}

/** Baut eine in-memory `AnonymMap` aus der persistenten KuerzelMapFile.
 *  Ersatz fuer `buildAnonymMap(antraege)` aus `anonym-map.ts`. */
export function buildAnonymMapFromKuerzelMap(file: KuerzelMapFile): AnonymMap {
  const toAnon = new Map<string, string>();
  const toReal = new Map<string, string>();
  for (const e of file.entries) {
    const k = normalizeKuerzel(e.kuerzel);
    if (!k) continue;
    toAnon.set(k, e.anonId);
    toReal.set(e.anonId, k);
  }
  return { toAnon, toReal };
}

/**
 * Scannt antraege nach noch nicht gemappten TIB-Kuerzeln, haengt sie hinten
 * an und gibt die aktualisierte Map + die Liste neu hinzugefuegter Kuerzel
 * zurueck. Bei identischer Eingabe → derselbe `current`-Pointer (idempotent).
 *
 * Neue Kuerzel werden alphabetisch sortiert vor dem Append — deterministisch
 * falls mehrere gleichzeitig erscheinen.
 */
export function syncKuerzelMapWithAntraege(
  current: KuerzelMapFile,
  antraege: Array<Antrag | AntragListItem>,
): { map: KuerzelMapFile; added: string[] } {
  const known = new Set(current.entries.map(e => e.kuerzel));
  const newKuerzel = new Set<string>();
  for (const a of antraege) {
    const raw = (a as Record<string, unknown>)[CANONICAL_TIB_KUERZ];
    const k = normalizeKuerzel(raw);
    if (k && !known.has(k)) newKuerzel.add(k);
  }
  if (newKuerzel.size === 0) return { map: current, added: [] };
  const sortedNew = [...newKuerzel].sort((a, b) => a.localeCompare(b, 'de'));
  const baseIdx = current.entries.length;
  const now = new Date().toISOString();
  const nextEntries: KuerzelMapEntry[] = [
    ...current.entries,
    ...sortedNew.map((kuerzel, i) => ({
      kuerzel,
      anonId: anonIdFor(baseIdx + i),
      createdAt: now,
    })),
  ];
  return {
    map: { version: 1, updatedAt: now, entries: nextEntries },
    added: sortedNew,
  };
}

/**
 * Initial-Bootstrap: wenn die Map leer ist aber antraege existieren, befuelle
 * sie mit dem aktuellen alphabetischen Sort. Damit ist das Initial-Mapping
 * IDENTISCH zum bisherigen ephemeral-Verhalten — keine Identitaets-Verschiebung
 * zwischen Pre- und Post-Patch-Zustand. Ab da bleibt es stabil.
 */
export function bootstrapKuerzelMap(antraege: Array<Antrag | AntragListItem>): KuerzelMapFile {
  const set = new Set<string>();
  for (const a of antraege) {
    const raw = (a as Record<string, unknown>)[CANONICAL_TIB_KUERZ];
    const k = normalizeKuerzel(raw);
    if (k) set.add(k);
  }
  const sorted = [...set].sort((a, b) => a.localeCompare(b, 'de'));
  const now = new Date().toISOString();
  return {
    version: 1,
    updatedAt: now,
    entries: sorted.map((kuerzel, i) => ({ kuerzel, anonId: anonIdFor(i), createdAt: now })),
  };
}

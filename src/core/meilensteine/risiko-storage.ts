/**
 * Risiko-Meldungen: „Ich weiß, dass ich diesen Meilenstein nicht halten kann."
 *
 * Der Bearbeiter hat kein Schreibrecht auf `_intern/*` (Pitfall #24), deshalb
 * geht die Meldung in seinen **persönlichen Ordner**; die PL sammelt sie über
 * den User-Folders-Root ein — 1:1 das Muster der Übernahme-Wünsche
 * (Pitfall #26). Kein Daten-Share-Write, kein Kurator-Passwort.
 *
 * Cross-Browser-Strategie wie beim Profil: geschrieben wird IMMER in den
 * IDB-Cache und zusätzlich in den persönlichen Ordner, wenn ein Handle da ist.
 * Gelesen wird Ordner zuerst (Quelle der Wahrheit), sonst der Cache.
 *
 * Meldungen werden nie gelöscht, nur auf `erledigt` gesetzt — eine verschwundene
 * Warnung wäre schlimmer als eine veraltete.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { PERSOENLICH_MEILENSTEIN_RISIKO_FILE } from '@/core/services/infrastructure/types';
import type { MeilensteinRisiko } from './typen';

export const RISIKO_CACHE_KEY = 'meilenstein-risiken:cache';

export interface RisikoDatei {
  version: 1;
  kuerzel: string;
  risiken: MeilensteinRisiko[];
  updatedAt: string;
}

function istRisiko(raw: unknown): raw is MeilensteinRisiko {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return typeof r.id === 'string'
    && typeof r.verbundId === 'string'
    && typeof r.knotenId === 'string'
    && typeof r.kuerzel === 'string'
    && typeof r.text === 'string'
    && typeof r.gemeldetAm === 'string';
}

/** Strukturelle Validierung einer roh gelesenen Datei. */
export function istRisikoDatei(raw: unknown): raw is RisikoDatei {
  if (!raw || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  return d.version === 1
    && typeof d.kuerzel === 'string'
    && Array.isArray(d.risiken)
    && d.risiken.every(istRisiko)
    && typeof d.updatedAt === 'string';
}

/**
 * Liest die Datei aus einem User-Home-Root — funktioniert für den eigenen
 * Persönlich-Handle wie für einen fremden User-Ordner (Einsammel-Schritt), weil
 * der Pfad in beiden Fällen relativ zum User-Home identisch ist.
 */
export async function leseRisikenAusOrdner(
  handle: FileSystemDirectoryHandle,
): Promise<RisikoDatei | null> {
  const txt = await readText(handle, PERSOENLICH_MEILENSTEIN_RISIKO_FILE);
  if (!txt) return null;
  try {
    const parsed: unknown = JSON.parse(txt);
    return istRisikoDatei(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Eigene Meldungen: persönlicher Ordner zuerst, sonst der lokale Cache. */
export async function leseEigeneRisiken(idb: IDBStore): Promise<MeilensteinRisiko[]> {
  const handle = await getPersoenlichHandle(idb).catch(() => null);
  if (handle) {
    const datei = await leseRisikenAusOrdner(handle).catch(() => null);
    if (datei) {
      await idb.set(RISIKO_CACHE_KEY, datei);
      return datei.risiken;
    }
  }
  const cached = await idb.get<RisikoDatei>(RISIKO_CACHE_KEY);
  return cached && istRisikoDatei(cached) ? cached.risiken : [];
}

/**
 * Schreibt die Meldungen. Der IDB-Cache wird immer aktualisiert; der persönliche
 * Ordner nur, wenn er verbunden ist. Gibt zurück, ob die PL die Meldung sehen
 * kann — ohne persönlichen Ordner bleibt sie lokal, und genau das muss die
 * Oberfläche dem Melder sagen.
 */
export async function schreibeEigeneRisiken(
  idb: IDBStore, kuerzel: string, risiken: readonly MeilensteinRisiko[], jetzt: string,
): Promise<{ lokal: true; imOrdner: boolean }> {
  const datei: RisikoDatei = { version: 1, kuerzel, risiken: [...risiken], updatedAt: jetzt };
  await idb.set(RISIKO_CACHE_KEY, datei);

  const handle = await getPersoenlichHandle(idb).catch(() => null);
  if (!handle) return { lokal: true, imOrdner: false };
  try {
    await atomicWrite(handle, PERSOENLICH_MEILENSTEIN_RISIKO_FILE, JSON.stringify(datei, null, 2));
    return { lokal: true, imOrdner: true };
  } catch (err) {
    console.warn('[meilensteine] Risiko-Meldung konnte nicht in den persönlichen Ordner:', err);
    return { lokal: true, imOrdner: false };
  }
}

/**
 * Fügt eine Meldung hinzu bzw. ersetzt die vorhandene zu demselben
 * (Verbund, Meilenstein). Rein — die ID reicht der Aufrufer herein.
 */
export function ergaenzeRisiko(
  bestand: readonly MeilensteinRisiko[], neu: MeilensteinRisiko,
): MeilensteinRisiko[] {
  const ohne = bestand.filter(r => !(r.verbundId === neu.verbundId && r.knotenId === neu.knotenId));
  return [neu, ...ohne];
}

/** Setzt eine Meldung auf erledigt. Gelöscht wird nie. */
export function erledigeRisiko(
  bestand: readonly MeilensteinRisiko[], id: string,
): MeilensteinRisiko[] {
  return bestand.map(r => (r.id === id ? { ...r, erledigt: true } : r));
}

/** Offene Meldungen je (Verbund, Meilenstein) — Datenbasis der Anzeige. */
export function offeneRisiken(
  bestand: readonly MeilensteinRisiko[],
): Map<string, MeilensteinRisiko> {
  const m = new Map<string, MeilensteinRisiko>();
  for (const r of bestand) {
    if (r.erledigt) continue;
    m.set(`${r.verbundId}::${r.knotenId}`, r);
  }
  return m;
}

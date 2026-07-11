/**
 * Recorder — die EINZIGE Schreib-Gate-Stelle des Ereignisprotokolls.
 *
 * Zentrale Gate-Regel (Invariante 2): geschrieben wird NUR, wenn
 *   (a) das Feature-Flag `assistentProtokoll` an ist  UND
 *   (b) der Nutzer die Aufzeichnung per Opt-in aktiviert hat.
 * Beide Bedingungen werden hier — nicht verstreut in den Features — geprüft.
 *
 * Instrumentierungs-Call-Sites rufen nur `protokolliereEreignis(...)` (fire-and-
 * forget: `void protokolliereEreignis(...)`). Der IDBStore wird einmalig beim
 * App-Start über `initProtokoll(storage.idb)` injiziert, damit Nicht-React-Pfade
 * (z.B. der Skill-Runner) ohne React-Context aufzeichnen können.
 *
 * Best-effort: kein Aufruf darf je die App stören → alles in try/catch,
 * Fehler nur `console.warn`, nie werfen.
 */

import type { IDBStore } from '../../storage/idb-store';
import { isAssistentProtokollEnabled } from '@/config/feature-flags';
import {
  ASSISTENT_OPTIN_KEY,
  MAX_DETAIL_WERT_LEN,
  MAX_EREIGNISSE,
  RETENTION_TAGE,
  RETENTION_WRITE_INTERVALL,
} from './types';
import type {
  AssistentEreignis,
  NeuesEreignis,
  ProtokollStatistik,
} from './types';
import {
  appendEreignis,
  kapazitaetKappen,
  ladeSeit,
  listeNachZeit,
  loescheAelterAls,
  loescheAlle,
  statistik,
} from './store';

// Modul-Zustand: injizierter Store + In-Memory-Opt-in-Cache (damit Hot-Handler
// synchron & billig gaten, ohne pro Ereignis async in die IDB zu lesen).
let idbRef: IDBStore | null = null;
let aktivCache = false;
let schreibZaehler = 0;

const TAG_MS = 24 * 60 * 60 * 1000;

function neueId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback (ältere Umgebungen): zeit- + zähler-basiert, kollisionsarm genug.
  return `ev-${Date.now().toString(36)}-${(schreibZaehler++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Schema-Guard: nur Primitive; Strings gekürzt; Nicht-Primitive verworfen. */
function sanitizeDetail(
  detail?: Record<string, unknown>,
): Record<string, string | number | boolean> | undefined {
  if (!detail) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (typeof v === 'string') {
      out[k] = v.length > MAX_DETAIL_WERT_LEN ? v.slice(0, MAX_DETAIL_WERT_LEN) : v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
    // Nested Objects/Arrays/null/undefined werden bewusst verworfen.
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function laufRetention(idb: IDBStore): Promise<void> {
  const cutoff = Date.now() - RETENTION_TAGE * TAG_MS;
  await loescheAelterAls(idb, cutoff);
  await kapazitaetKappen(idb, MAX_EREIGNISSE);
}

/**
 * Einmalig beim App-Start (nach `storage.init()`): injiziert den Store,
 * hydratisiert den Opt-in-Cache und läuft — falls das Feature aktiv ist — die
 * Retention einmal (Bestandsdaten altern auch nach Opt-out aus). Best-effort.
 */
export async function initProtokoll(idb: IDBStore): Promise<void> {
  idbRef = idb;
  try {
    aktivCache = (await idb.get<boolean>(ASSISTENT_OPTIN_KEY)) === true;
  } catch {
    aktivCache = false;
  }
  if (isAssistentProtokollEnabled()) {
    try {
      await laufRetention(idb);
    } catch (e) {
      console.warn('[protokoll] Retention beim Start fehlgeschlagen', e);
    }
  }
}

/**
 * EINZIGE Schreibstelle. No-op, wenn Flag aus ODER Opt-in aus ODER noch nicht
 * initialisiert. Fire-and-forget an den Call-Sites; nie werfend.
 */
export async function protokolliereEreignis(neu: NeuesEreignis): Promise<void> {
  if (!isAssistentProtokollEnabled() || !aktivCache || !idbRef) return;
  try {
    const ereignis: AssistentEreignis = {
      id: neueId(),
      version: 1,
      zeitstempel: Date.now(),
      typ: neu.typ,
    };
    if (neu.route) ereignis.route = neu.route;
    if (neu.entitaet) ereignis.entitaet = neu.entitaet;
    const detail = sanitizeDetail(neu.detail);
    if (detail) ereignis.detail = detail;

    await appendEreignis(idbRef, ereignis);

    schreibZaehler++;
    if (schreibZaehler % RETENTION_WRITE_INTERVALL === 0) {
      await laufRetention(idbRef);
    }
  } catch (e) {
    console.warn('[protokoll] Ereignis konnte nicht gespeichert werden', e);
  }
}

/** Synchroner Opt-in-Status (Cache) — für UI + Gate. */
export function istProtokollAktiv(): boolean {
  return aktivCache;
}

/** Setzt den Opt-in-Status: persistiert gerätelokal (kv) + aktualisiert Cache. */
export async function setzeProtokollAktiv(aktiv: boolean): Promise<void> {
  aktivCache = aktiv;
  if (idbRef) await idbRef.set(ASSISTENT_OPTIN_KEY, aktiv);
}

/** Aggregat für die „Meine Daten"-Ansicht. */
export async function ladeStatistik(): Promise<ProtokollStatistik> {
  if (!idbRef) return { gesamt: 0, jeTyp: {}, aeltester: null, neuester: null };
  return statistik(idbRef);
}

/** Letzte N Ereignisse (neueste zuerst) für die Transparenz-Tabelle. */
export async function ladeLetzteEreignisse(limit = 100): Promise<AssistentEreignis[]> {
  if (!idbRef) return [];
  return listeNachZeit(idbRef, limit, 'prev');
}

/**
 * Neue Ereignisse seit Wasserzeichen (aufsteigend) — für die Gedächtnis-
 * Konsolidierung (Phase 2). Leeres Array, wenn nicht initialisiert.
 */
export async function ladeEreignisseSeit(wasserzeichen: number | null): Promise<AssistentEreignis[]> {
  if (!idbRef) return [];
  return ladeSeit(idbRef, wasserzeichen);
}

/** Löscht alle Protokolldaten. Liefert die Anzahl gelöschter Einträge. */
export async function loescheProtokollVollstaendig(): Promise<number> {
  if (!idbRef) return 0;
  return loescheAlle(idbRef);
}

/**
 * JSON-Export als Download (Transparenz/DSGVO-Selbstauskunft). Blob + Anchor —
 * funktioniert unter `file://`. Kein Netzwerk.
 */
export async function exportiereProtokoll(): Promise<void> {
  if (!idbRef) return;
  const ereignisse = await listeNachZeit(idbRef, undefined, 'next');
  const inhalt = JSON.stringify(
    { schema: 'assistent-ereignisprotokoll', version: 1, exportiertAm: new Date().toISOString(), ereignisse },
    null,
    2,
  );
  const blob = new Blob([inhalt], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistent-protokoll-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Nur für Tests: setzt den Modul-Zustand zurück. */
export function __resetProtokollFuerTests(): void {
  idbRef = null;
  aktivCache = false;
  schreibZaehler = 0;
}

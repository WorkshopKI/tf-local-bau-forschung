/**
 * Gedächtnis-Facade — Modul-Zustand (injizierter Store + Opt-in-Cache) und die
 * high-level Lade-/Lösch-/Persistenz-Helfer. Die eigentliche Konsolidierung
 * (LLM-Anbindung) lebt in konsolidierung.ts; die reine Operations-Logik in
 * operationen.ts. Vorbild: assistent/protokoll/recorder.ts.
 *
 * Best-effort: kein Aufruf darf je die App stören → alles in try/catch,
 * Fehler nur `console.warn`, nie werfen.
 */

import type { IDBStore } from '../../storage/idb-store';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import {
  GEDAECHTNIS_LAUF_META_KEY,
  GEDAECHTNIS_OPTIN_KEY,
  INVALID_RETENTION_TAGE,
} from './types';
import type { GedaechtnisEintrag, LaufMeta } from './types';
import {
  alleEintraege,
  entferneInvalidierteAelterAls,
  loescheAlle,
  loescheEintrag,
  schreibeStapel,
} from './store';
import { MS_TAG } from '@/core/utils/zeitEinheiten';

let idbRef: IDBStore | null = null;
let aktivCache = false;
let idZaehler = 0;


/** ID-Fabrik für neue Gedächtnis-Einträge (crypto.randomUUID mit Fallback). */
export function neueGedaechtnisId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `gm-${Date.now().toString(36)}-${(idZaehler++).toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function laufInvalidiertenRetention(idb: IDBStore): Promise<void> {
  const cutoff = Date.now() - INVALID_RETENTION_TAGE * MS_TAG;
  await entferneInvalidierteAelterAls(idb, cutoff);
}

/**
 * Einmalig beim App-Start (nach `storage.init()`): injiziert den Store,
 * hydratisiert den Opt-in-Cache und läuft — falls das Feature aktiv ist — die
 * Retention invalidierter Einträge einmal. Best-effort.
 */
export async function initGedaechtnis(idb: IDBStore): Promise<void> {
  idbRef = idb;
  try {
    aktivCache = (await idb.get<boolean>(GEDAECHTNIS_OPTIN_KEY)) === true;
  } catch {
    aktivCache = false;
  }
  if (isAssistentGedaechtnisEnabled()) {
    try {
      await laufInvalidiertenRetention(idb);
    } catch (e) {
      console.warn('[gedaechtnis] Retention beim Start fehlgeschlagen', e);
    }
  }
}

/** Synchroner Opt-in-Status (Cache) — für UI + Gate. */
export function istGedaechtnisAktiv(): boolean {
  return aktivCache;
}

/** Setzt den Gedächtnis-Opt-in: persistiert gerätelokal (kv) + aktualisiert Cache. */
export async function setzeGedaechtnisAktiv(aktiv: boolean): Promise<void> {
  aktivCache = aktiv;
  if (idbRef) await idbRef.set(GEDAECHTNIS_OPTIN_KEY, aktiv);
}

/** Zugriff auf den injizierten Store (für konsolidierung.ts). Null vor Init. */
export function getGedaechtnisIdb(): IDBStore | null {
  return idbRef;
}

/** Alle Einträge (aktive + invalidierte). */
export async function ladeAlleEintraege(): Promise<GedaechtnisEintrag[]> {
  if (!idbRef) return [];
  return alleEintraege(idbRef);
}

/** Nur aktive Einträge (für Assembler + Anzeige). */
export async function ladeAktiveEintraege(): Promise<GedaechtnisEintrag[]> {
  const alle = await ladeAlleEintraege();
  return alle.filter(e => e.status === 'aktiv');
}

/** Persistiert einen berechneten Ziel-Bestand (put — legt an/überschreibt). */
export async function persistiereEintraege(eintraege: GedaechtnisEintrag[]): Promise<void> {
  if (!idbRef) return;
  await schreibeStapel(idbRef, eintraege);
}

/** Löscht EINEN Eintrag hart. */
export async function loescheGedaechtnisEintrag(id: string): Promise<void> {
  if (!idbRef) return;
  await loescheEintrag(idbRef, id);
}

/** Löscht ALLE Einträge („Alles vergessen"). Liefert die Anzahl. */
export async function loescheAllesGedaechtnis(): Promise<number> {
  if (!idbRef) return 0;
  return loescheAlle(idbRef);
}

/** Lauf-Metadaten (kv) — letzter Lauf, Wasserzeichen, Zähler, Fehlerstatus. */
export async function ladeLaufMeta(): Promise<LaufMeta | null> {
  if (!idbRef) return null;
  try {
    return (await idbRef.get<LaufMeta>(GEDAECHTNIS_LAUF_META_KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function schreibeLaufMeta(meta: LaufMeta): Promise<void> {
  if (!idbRef) return;
  await idbRef.set(GEDAECHTNIS_LAUF_META_KEY, meta);
}

/** Nur für Tests: setzt den Modul-Zustand zurück. */
export function __resetGedaechtnisFuerTests(): void {
  idbRef = null;
  aktivCache = false;
  idZaehler = 0;
}

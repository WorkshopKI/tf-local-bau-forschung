/**
 * Die Kurator-Festlegung auf dem Daten-Share.
 *
 * Schreib-Profil: **idempotent-overwrite** (Pitfall #23) über `schreibeSidecar`
 * — eine kleine Datei, ein Schreiber (der Kurator), Backup-Rotation erwünscht.
 *
 * Gespeichert werden **nur Abweichungen** von der Code-Vorbelegung, je Eintrag
 * der VOLLE Marken-Satz (nicht ein Delta). Damit schlagen spätere Änderungen am
 * Katalog überall dort durch, wo der Kurator nichts entschieden hat — und wo er
 * etwas entschieden hat, steht es vollständig da, statt aus zwei Quellen
 * zusammengerechnet werden zu müssen.
 */
import type { IDBStore } from '@/core/services/storage';
import { leseSidecarLage, schreibeSidecar, type SidecarLage } from '@/core/status/sidecar-datei';
import type { MarkenListe } from './types';

/** Konvention `_intern/<sache>.json`; nie unter `programm/` (das ist für Antrags-Artefakte). */
export const SICHTBARKEIT_SIDECAR_PATH = '_intern/sichtbarkeit.json';

/** Gerätelokaler Cache derselben Datei — damit die Marken auch offline und vor dem Grant gelten. */
export const SICHTBARKEIT_IDB_KEY = 'sichtbarkeit-overlay';

export interface SichtbarkeitSidecar {
  version: 1;
  updatedAt: string;
  /** Nur Notiz, keine Berechtigung. */
  autor?: string;
  /** Id → voller Marken-Satz. Leeres Array = „ausdrücklich Standard". */
  abweichungen: Record<string, MarkenListe>;
}

export function leererStand(): SichtbarkeitSidecar {
  return { version: 1, updatedAt: new Date().toISOString(), abweichungen: {} };
}

function istMarkenListe(raw: unknown): raw is MarkenListe {
  return Array.isArray(raw) && raw.every(m => m === 'beta' || m === 'experte');
}

export function istSichtbarkeitSidecar(raw: unknown): raw is SichtbarkeitSidecar {
  if (typeof raw !== 'object' || raw === null) return false;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (typeof o.abweichungen !== 'object' || o.abweichungen === null) return false;
  return Object.values(o.abweichungen as Record<string, unknown>).every(istMarkenListe);
}

/**
 * Lage statt Wert, weil jeder Schreiber vorher liest (Regel v4.12): „Datei gibt
 * es nicht" und „Datei ließ sich nicht lesen" dürfen nicht auf dasselbe `null`
 * fallen — sonst schriebe der nächste Kurator die fremde Kuration platt.
 */
export function leseSichtbarkeitLage(idb: IDBStore): Promise<SidecarLage<SichtbarkeitSidecar>> {
  return leseSidecarLage(idb, SICHTBARKEIT_SIDECAR_PATH, istSichtbarkeitSidecar);
}

export function schreibeSichtbarkeit(idb: IDBStore, stand: SichtbarkeitSidecar): Promise<boolean> {
  return schreibeSidecar(idb, SICHTBARKEIT_SIDECAR_PATH, stand);
}

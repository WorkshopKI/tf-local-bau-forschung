/**
 * Umzugs-Gate für den Daten-Share (v4.0).
 *
 * Ein FSAPI-Handle hängt am Dateisystem-Objekt, nicht am Anzeigepfad. Zieht der
 * Daten-Share auf einen neuen Ordner um, bewirkt ein Config-Rollout für eine
 * bestehende Installation deshalb NICHTS: `App.tsx` wertet `fixedDataSharePath`
 * nur aus, solange gar kein Handle in der IDB liegt, und `isSmbAvailable` prüft
 * nur, ob `_intern/` existiert — der alte Ordner erfüllt beides. Die Folge wäre
 * ein halbes Team auf dem neuen und ein halbes auf dem alten Ordner, bei live
 * geteilter `registry.json`.
 *
 * Deshalb trägt die Config eine `shareGeneration`, die beim Umzug zusammen mit
 * dem Pfad hochgezählt wird. Die App merkt sich die zuletzt VERBUNDENE
 * Generation und erzwingt einen Re-Pick, solange sie zurückliegt.
 *
 * Bewusst zwei getrennte Funktionen: der Vergleich ist rein und damit ohne
 * React/IDB testbar, das Lesen ist der einzige IDB-Zugriff.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import { SHARE_GENERATION_IDB_KEY } from './types';

/** Generation einer Installation, die noch nie gestempelt wurde. */
export const SHARE_GENERATION_BASIS = 1;

/**
 * Liest die zuletzt verbundene Generation. Fehlt der Wert (oder steht dort
 * Unsinn aus einer alten Fassung), gilt die Basis — jede Installation, die vor
 * v4.0 verbunden wurde, ist per Definition Generation 1.
 */
export async function leseShareGeneration(idb: IDBStore): Promise<number> {
  const roh = await idb.get<number>(SHARE_GENERATION_IDB_KEY);
  return normalisiere(roh);
}

/**
 * Muss der Anwender den Datenordner neu verbinden? Nur wenn die gespeicherte
 * Generation ECHT kleiner ist als die konfigurierte. Eine gespeicherte
 * Generation, die vorauseilt (Rückstufung des Builds), löst bewusst nichts aus:
 * der Anwender ist bereits auf dem neueren Ordner, ein erzwungener Re-Pick
 * würde ihn dort nur wieder herunterholen.
 */
export function brauchtShareUmzug(
  gespeichert: number | null | undefined,
  konfiguriert: number | null | undefined,
): boolean {
  return normalisiere(gespeichert) < normalisiere(konfiguriert);
}

function normalisiere(wert: number | null | undefined): number {
  return typeof wert === 'number' && Number.isFinite(wert) && wert >= SHARE_GENERATION_BASIS
    ? Math.floor(wert)
    : SHARE_GENERATION_BASIS;
}

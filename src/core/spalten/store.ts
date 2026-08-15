/**
 * Persistenz der PERSÖNLICHEN Spalten-Definitionen — gerätelokal, sonst nichts.
 *
 * **Gerätelokal ist keine Bequemlichkeit, sondern die Funktionsbedingung**: in
 * prod hat ein normaler Nutzer keine Schreibrechte auf den Daten-Share, eine
 * geteilte Ablage wäre dort tot. Die Definitionen stehen in keiner
 * Snapshot-Allowlist, werden nicht gespiegelt und nicht exportiert. Maschinell
 * gehalten vom Guard `eigene-spalten-lokal`.
 *
 * **Team-Spalten sind der andere Weg** und wohnen in `team-store.ts` (Sidecar
 * auf dem Share, Schreiben nur mit Recht). Diese Datei kennt ihn nicht.
 *
 * Gelesen wird über den geteilten toleranten Leser (`lesen.ts`) — beide Ablagen
 * führen dieselbe Struktur und dürfen sie nicht verschieden auslegen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { leseSpaltenListe, nurHerkunft } from './lesen';
import type { EigeneSpalte } from './typen';

/** IDB-Key (kv-Store). Steht in KEINER Snapshot-Allowlist. */
export const EIGENE_SPALTEN_IDB_KEY = 'eigene-spalten:personal';

export async function ladePersoenlicheSpalten(idb: IDBStore): Promise<EigeneSpalte[]> {
  const roh = await idb.get<unknown>(EIGENE_SPALTEN_IDB_KEY).catch(() => null);
  return nurHerkunft(leseSpaltenListe(roh), 'ich');
}

export async function speicherePersoenlicheSpalten(
  idb: IDBStore, spalten: readonly EigeneSpalte[],
): Promise<void> {
  // Nur die eigenen: eine Team-Definition, die hier landete, wäre eine zweite,
  // stille Fassung neben der Sidecar — und würde beim nächsten Speichern der
  // Liste die geteilte überstimmen, ohne dass es jemand sieht.
  const eigene = nurHerkunft(spalten, 'ich');
  if (eigene.length === 0) {
    await idb.delete(EIGENE_SPALTEN_IDB_KEY);
    return;
  }
  await idb.set(EIGENE_SPALTEN_IDB_KEY, eigene);
}

/**
 * Rückweg zu bereits berechneten Bausteinen eines Antrags.
 *
 * Der Baustein-Cache (`bausteine.ts`) ist zugleich die Persistenz der LLM-Anteile:
 * `getOrComputeBaustein` legt jedes Ergebnis unter `<name>:<vbHash>` ab. Ohne einen
 * reinen Lesepfad käme man nur über einen Compute-Aufruf wieder heran — und der
 * braucht einen Transport. Die Folge wäre, dass die Ergebnisse nach jedem
 * Seitenwechsel unsichtbar sind, obwohl sie im Store liegen.
 *
 * Gekeyt wird auf dem Hash des KORPUS (VB + narrative Zusatzdokumente), genau wie
 * beim Schreiben in `laufBausteine`. Nicht auf `korpus.vb.markdown` — das ist der
 * Hash der Veraltet-Prüfung, mit ihm griffe kein einziger Cache-Eintrag.
 *
 * Welche Bausteine es gibt und wo ihr Cache liegt, sagt `BAUSTEIN_KATALOG` — diese
 * Datei zählt sie nicht mehr selbst auf. Kein IO ausser den kv-Lesezugriffen, kein
 * React, kein Transport.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { leseBausteinCache } from './bausteine';
import {
  BAUSTEIN_IDS, BAUSTEIN_KATALOG,
  type AufbereitungBausteinId, type BausteinDatenMap,
} from './baustein-katalog';

/** Was aus dem Cache zurückkam — je Baustein `null`, wenn nichts Passendes da war. */
export type GecachteBausteine = { [K in AufbereitungBausteinId]: BausteinDatenMap[K] | null };

/**
 * Liest alle Bausteine des Antrags zum gegebenen Korpus-Hash. Jeder steht für sich:
 * ein Teil-Treffer ist ein gültiger Zustand, weil die Läufe einzeln bewertet werden
 * und einzelne degradiert (und damit ungecacht) sein können. Wirft nie.
 */
export async function leseGecachteBausteine(
  idb: IDBStore, antragKey: string, vbHash: string,
): Promise<GecachteBausteine> {
  const paare = await Promise.all(BAUSTEIN_IDS.map(async id => [
    id,
    await leseBausteinCache(idb, BAUSTEIN_KATALOG[id].cacheKey(antragKey, vbHash), vbHash),
  ] as const));
  return Object.fromEntries(paare) as GecachteBausteine;
}

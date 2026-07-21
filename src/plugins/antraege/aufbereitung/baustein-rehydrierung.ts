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
 * Kein IO ausser den kv-Lesezugriffen, kein React, kein Transport.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  aspekteCacheKey, glossarCacheKey, leseBausteinCache, recherchePromptCacheKey,
  steckbriefCacheKey, verwertungCacheKey, zahlenCacheKey,
} from './bausteine';
import type { AspektMapping } from './aspekte';
import type { SteckbriefDaten } from './steckbrief';
import type { ZahlenDaten } from './zahlen';
import type { GlossarDaten } from './glossar';
import type { VerwertungDaten } from './verwertung';
import type { RecherchePromptDaten } from './recherche-prompt';

/** Was aus dem Cache zurückkam — je Baustein `null`, wenn nichts Passendes da war. */
export interface GecachteBausteine {
  aspekte: AspektMapping | null;
  steckbrief: SteckbriefDaten | null;
  zahlen: ZahlenDaten | null;
  glossar: GlossarDaten | null;
  verwertung: VerwertungDaten | null;
  recherchePrompt: RecherchePromptDaten | null;
}

/**
 * Liest alle sechs Bausteine des Antrags zum gegebenen Korpus-Hash. Jeder steht für
 * sich: ein Teil-Treffer ist ein gültiger Zustand, weil die Läufe einzeln bewertet
 * werden und einzelne degradiert (und damit ungecacht) sein können. Wirft nie.
 */
export async function leseGecachteBausteine(
  idb: IDBStore, antragKey: string, vbHash: string,
): Promise<GecachteBausteine> {
  const [aspekte, steckbrief, zahlen, glossar, verwertung, recherchePrompt] = await Promise.all([
    leseBausteinCache<AspektMapping>(idb, aspekteCacheKey(antragKey, vbHash), vbHash),
    leseBausteinCache<SteckbriefDaten>(idb, steckbriefCacheKey(antragKey, vbHash), vbHash),
    leseBausteinCache<ZahlenDaten>(idb, zahlenCacheKey(antragKey, vbHash), vbHash),
    leseBausteinCache<GlossarDaten>(idb, glossarCacheKey(antragKey, vbHash), vbHash),
    leseBausteinCache<VerwertungDaten>(idb, verwertungCacheKey(antragKey, vbHash), vbHash),
    leseBausteinCache<RecherchePromptDaten>(idb, recherchePromptCacheKey(antragKey, vbHash), vbHash),
  ]);
  return { aspekte, steckbrief, zahlen, glossar, verwertung, recherchePrompt };
}

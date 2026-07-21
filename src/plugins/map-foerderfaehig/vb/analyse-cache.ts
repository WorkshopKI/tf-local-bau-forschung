/**
 * Cache-Schlüssel und Rückweg zu den KI-Analyse-Ergebnissen einer Einreichung.
 *
 * Die drei Bausteine (Steckbrief, Aspekt-Mapping, Infografik) werden von
 * `getOrComputeBaustein` im generischen `kv`-Store abgelegt — der Cache ist damit
 * zugleich die Persistenz. Ohne einen Lesepfad käme man an ein bereits berechnetes
 * Ergebnis nur über einen Compute-Aufruf heran (der einen Transport braucht), und
 * die Ergebnisse wirkten nach jedem Seitenwechsel verloren, obwohl sie im Store
 * liegen. Diese Datei ist dieser Lesepfad.
 *
 * Gekeyt wird auf dem Hash des KORPUS, nicht des Hauptdokuments: ein zugeordnetes
 * Zusatzdokument ändert den Korpus und damit fachlich das Ergebnis. Der Hash ist
 * die Invalidierung — ein geänderter Korpus liefert einen Miss, nie ein veraltetes
 * Ergebnis.
 *
 * Rein bis auf die `idb`-Lesezugriffe; kein React, kein Transport, kein LLM.
 */
import type { IDBStore } from '@/core/services/storage';
// Direkt aus den Modulen statt über das Aufbereitungs-Barrel: das Barrel zieht den
// Recherche-Import und damit `pdfjs-dist` mit, was diese Datei node-untestbar machte
// (gleicher Grund wie beim Deep-Import in `korpus.ts`).
import {
  aspekteCacheKey, leseBausteinCache, steckbriefCacheKey,
} from '@/plugins/antraege/aufbereitung/bausteine';
import type { AspektMapping } from '@/plugins/antraege/aufbereitung/aspekte';
import type { SteckbriefDaten } from '@/plugins/antraege/aufbereitung/steckbrief';
import type { InfografikDaten } from '../infografik/schema';

/**
 * Cache-Präfix der Einreichung. `getOrComputeBaustein` keyt auf dem übergebenen
 * Schlüssel — ohne dieses Präfix kollidierten die MAP-Bausteine mit denen echter
 * Anträge.
 */
export const mapCacheSchluessel = (einreichungId: string): string => `map:${einreichungId}`;

/** Die drei kv-Keys einer Einreichung bei gegebenem Korpus-Hash. */
export interface MapBausteinKeys {
  steckbrief: string;
  aspekte: string;
  infografik: string;
}

/**
 * Steckbrief und Aspekte nutzen die Key-Bauer der Aufbereitung (daher das
 * `aufbereitung:`-Präfix vor dem MAP-Schlüssel), die Infografik ist MAP-eigen und
 * wird hier gebaut. Die beiden Schemata sind historisch gewachsen und bleiben
 * bewusst wie sie sind: ein umbenannter Key liesse alle vorhandenen Ergebnisse
 * verwaisen.
 */
export function mapBausteinKeys(einreichungId: string, vbHash: string): MapBausteinKeys {
  const schluessel = mapCacheSchluessel(einreichungId);
  return {
    steckbrief: steckbriefCacheKey(schluessel, vbHash),
    aspekte: aspekteCacheKey(schluessel, vbHash),
    infografik: `${schluessel}:infografik:${vbHash}`,
  };
}

/** Was aus dem Cache zurückkam — je Baustein `null`, wenn nichts (Passendes) da war. */
export interface MapAnalyse {
  steckbrief: SteckbriefDaten | null;
  aspekte: AspektMapping | null;
  infografik: InfografikDaten | null;
}

/**
 * Liest alle drei Bausteine der Einreichung. Jeder Baustein steht für sich: ein
 * Teil-Treffer (etwa Steckbrief da, Infografik nicht) ist ein gültiger Zustand,
 * weil `starteAnalyse` die drei Läufe einzeln bewertet und einer davon degradiert
 * sein kann. Wirft nie.
 */
export async function leseMapAnalyse(
  idb: IDBStore, einreichungId: string, vbHash: string,
): Promise<MapAnalyse> {
  const keys = mapBausteinKeys(einreichungId, vbHash);
  const [steckbrief, aspekte, infografik] = await Promise.all([
    leseBausteinCache<SteckbriefDaten>(idb, keys.steckbrief, vbHash),
    leseBausteinCache<AspektMapping>(idb, keys.aspekte, vbHash),
    leseBausteinCache<InfografikDaten>(idb, keys.infografik, vbHash),
  ]);
  return { steckbrief, aspekte, infografik };
}

/**
 * Präfixe aller KI-Ergebnisse einer Einreichung — über ALLE Korpus-Hashes, denn
 * beim Löschen ist auch der Ertrag früherer Korpus-Stände wertlos.
 *
 * Der abschliessende Doppelpunkt ist wesentlich: ohne ihn würde das Präfix der
 * Einreichung `E1` auch die Keys von `E10` treffen.
 */
export function mapBausteinPraefixe(einreichungId: string): string[] {
  const schluessel = mapCacheSchluessel(einreichungId);
  return [`aufbereitung:${schluessel}:`, `${schluessel}:infografik:`];
}

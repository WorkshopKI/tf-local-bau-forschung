/**
 * Liest die MAP-Fachbewertung eines Vorgangs für die RNE/ABL-Konsistenz-Checks —
 * über dieselbe Rückwärtssuche wie der Zeitplan (`map-verknuepfung.ts`): die VB-Datei
 * führt zur Einreichung, die Einreichung zur Prüfung.
 *
 * Bewusst eine schmale LESE-Schicht (nur `kv`-Keys + Typ-Importe aus dem MAP-Plugin).
 * Fehlt eine MAP-Prüfung, ist `gefunden: false` — der Tor zeigt dann den ehrlichen
 * „Konsistenz übersprungen"-Hinweis, statt stillschweigend nichts zu prüfen.
 */
import type { IDBStore } from '@/core/services/storage';
import type { MapChecklistenDefinition, MapPruefung, MapStufe } from '@/plugins/map-foerderfaehig/checkliste/typen';
import { ladeEinreichungsBezug } from '../aufbereitung/map-verknuepfung';
import { aspektBewertung } from '../nachforderungen/bescheid-freigabe';
import type { KurzfassungContext } from '../kurzfassung/types';

const PRUEFUNG_PRAEFIX = 'map-pruefung:';
const CHECKLISTE_KEY = 'map-checkliste:aktuell';

export interface MapBewertung {
  /** Beste MAP-Stufe je Prüfaspekt A–J (leer, wenn keine bewertet ist). */
  bewertung: Record<string, MapStufe>;
  /** True, sobald eine MAP-Prüfung samt Checkliste vorliegt (Checks liefen). */
  gefunden: boolean;
}

export async function ladeMapBewertung(
  idb: IDBStore, ctx: Pick<KurzfassungContext, 'key' | 'knownIds'>,
): Promise<MapBewertung> {
  const leer: MapBewertung = { bewertung: {}, gefunden: false };
  const bezug = await ladeEinreichungsBezug(idb, ctx).catch(() => null);
  if (!bezug) return leer;
  const [pruefung, checkliste] = await Promise.all([
    idb.get<MapPruefung>(`${PRUEFUNG_PRAEFIX}${bezug.einreichungId}`),
    idb.get<MapChecklistenDefinition>(CHECKLISTE_KEY),
  ]);
  if (!pruefung || !checkliste) return leer;
  return { bewertung: aspektBewertung(pruefung, checkliste), gefunden: true };
}

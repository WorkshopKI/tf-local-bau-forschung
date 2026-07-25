/**
 * Post-Import-Pflege der Meilenstein-Projektion (ein Aufruf
 * `nachImportMeilensteinPflege`) — Schwester von `nachImportStatusPflege`.
 *
 * Bewusst ein EIGENER Pass statt in den Status-Pass gehängt: der eine ist
 * gerätelokal und hängt am `statusCockpit`-Flag, der andere liest den Team-Plan
 * vom Share und hängt am `meilensteinMonitoring`-Flag. Ein gemeinsamer Durchlauf
 * würde beide Flags aneinanderketten. Die Zusammenlegung ist als Optimierung
 * vorgemerkt, sobald beide Pässe stabil laufen.
 *
 * Best-effort: Fehler werden geschluckt, ein Import darf an der Projektion nie
 * scheitern. Die Projektion ist ein Cache — sie kann jederzeit neu entstehen.
 */
import type { IDBStore } from '@/core/services/storage';
import { listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { ladePlan, freigegebeneFassung } from './plan-storage';
import { baueSignatur, berechneProjektion, speichereProjektion } from './projektion';

/**
 * Rechnet die Projektion für ein Programm neu und legt sie ab. Läuft nur mit
 * aktivem Flag und nur mit einer FREIGEGEBENEN Plan-Fassung — ein Entwurf darf
 * die team-weit sichtbaren Zahlen nicht verschieben.
 *
 * Gibt die Anzahl bewerteter Verbünde zurück, oder `null` wenn nichts lief.
 */
export async function nachImportMeilensteinPflege(
  idb: IDBStore, programmId: string, jetztIso: string,
): Promise<number | null> {
  if (!isMeilensteinMonitoringEnabled()) return null;
  try {
    const { plan } = await ladePlan(idb);
    const gueltig = freigegebeneFassung(plan);
    if (!gueltig) return null;

    const schemas = await listSchemasByProgramm(idb, programmId);
    const verbuende = await berechneProjektion(idb, programmId, gueltig, schemas, jetztIso);
    await speichereProjektion(idb, {
      signatur: baueSignatur(gueltig, schemas, jetztIso),
      erstelltAm: jetztIso,
      programmId,
      verbuende,
    });
    return verbuende.length;
  } catch (err) {
    console.warn('[meilensteine] nachImportMeilensteinPflege failed:', err);
    return null;
  }
}

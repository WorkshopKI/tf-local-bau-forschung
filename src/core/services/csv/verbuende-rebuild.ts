/**
 * Self-Heal des abgeleiteten `verbuende`-Caches.
 *
 * Der `verbuende`-Object-Store ist KEINE eigene Source of Truth — er ist ein
 * Aggregat der Anträge (gruppiert nach `verbund_id`), das Merge + Snapshot als
 * Cache pflegen. Ist dieser Cache leer (leere/veraltete `verbuende.jsonl` im
 * Snapshot ODER ein durch transienten Read-Fail gestrandeter lokaler Store,
 * den der idempotente Sync nicht nachlädt), zeigt JEDE Verbund-Detailseite
 * „Verbund … nicht gefunden", obwohl die TVs vorhanden sind.
 *
 * `healMissingVerbuende` rekonstruiert die fehlenden Verbund-Records aus der
 * schlanken List-View-Projektion (Source of Truth = Anträge). Billig im
 * Normalfall: ist der Cache gefüllt, kostet es nur einen `verbuende`-Index-Read
 * und bricht ab — der teure Anträge-Read passiert nur, wenn wirklich geheilt
 * werden muss (danach ist der Cache da → nächster Start wieder billig).
 */

import type { IDBStore } from '../storage/idb-store';
import { CSV_STORES } from '../storage/idb-store';
import { listAntraegeListViewByProgramm, listVerbuendeByProgramm } from './idb-csv';
import type { AntragListItem, Verbund } from './types';

function strOrUndef(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Stellt fehlende Verbund-Records aus der List-View wieder her. Lässt
 * vorhandene Records unangetastet (keine kuratierten Verbund-Level-Felder
 * überschreiben). Liefert die Anzahl neu erzeugter Records (0 = nichts zu tun).
 */
export async function healMissingVerbuende(idb: IDBStore, programmId: string): Promise<number> {
  const existing = await listVerbuendeByProgramm(idb, programmId);
  const have = new Set(existing.map(v => v.verbund_id));

  const items = await listAntraegeListViewByProgramm(idb, programmId);
  // Gruppiere nach verbund_id (nur echte, nicht-leere IDs).
  const groups = new Map<string, AntragListItem[]>();
  for (const it of items) {
    const vid = strOrUndef(it.verbund_id);
    if (!vid || have.has(vid)) continue;
    let g = groups.get(vid);
    if (!g) {
      g = [];
      groups.set(vid, g);
    }
    g.push(it);
  }
  if (groups.size === 0) return 0;

  const now = new Date().toISOString();
  const toCreate: Verbund[] = [];
  for (const [vid, tvs] of groups) {
    const lead = tvs[0]!;
    toCreate.push({
      verbund_id: vid,
      programm_id: programmId,
      akronym: strOrUndef(lead.akronym),
      titel: strOrUndef(lead.verbund_titel) ?? strOrUndef(lead.titel),
      // Verbund-Status aus dem Lead-TV (Backward-Compat zu buildPseudoVerbund);
      // Konsumenten leiten ihn ansonsten ohnehin aus den TV-Status ab.
      status: lead.status,
      teilantrags_ids: tvs.map(t => t.aktenzeichen),
      _updated_at: now,
    });
  }

  // Eine einzige readwrite-Transaktion (statt N) — der Heal-Fall hat ggf.
  // hunderte Verbünde.
  await new Promise<void>((resolve, reject) => {
    const t = idb.getDb().transaction(CSV_STORES.VERBUENDE, 'readwrite');
    const s = t.objectStore(CSV_STORES.VERBUENDE);
    for (const v of toCreate) s.put(v);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

  console.info(
    `[verbuende-heal] ${toCreate.length} fehlende Verbund-Record(s) aus der List-View rekonstruiert (Programm ${programmId})`,
  );
  return toCreate.length;
}

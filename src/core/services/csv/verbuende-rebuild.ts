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
 * überschreiben). Liefert die Anzahl geschriebener Records (0 = nichts zu tun).
 *
 * **Was der Heal NICHT tut: raten.** Verbund-Ebenen-Felder gehen im Merge nie
 * auf den Antrag (`getCanonicalLevel(...) === 'verbund'` leitet sie um), also
 * kennt die List-View den echten VB-Titel gar nicht und `status` ist der des
 * Teilvorhabens. Beides bleibt hier offen — die Konsumenten fallen von sich aus
 * auf den Lead-TV zurück (`verbund?.titel ?? rep?.titel`), und die Detailseite
 * leitet den Verbund-Status ohnehin aus den TV-Status ab. Ein Fallback zur
 * Lesezeit ist reparierbar, ein persistierter Falschwert wandert über
 * `verbuende.jsonl` ins ganze Team.
 *
 * `akronym` bleibt dagegen: es ist antrag-level (VB_KURZNAM landet am Antrag),
 * also gelesen und nicht geraten.
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

  // Eine einzige readwrite-Transaktion (statt N) — der Heal-Fall hat ggf.
  // hunderte Verbünde. Innerhalb der TX wird je Verbund erst per KEY gelesen:
  // `listVerbuendeByProgramm` oben liest über den `programm_id`-Index, ein
  // mis-filed Record gilt dort als fehlend. Ohne den Key-Lookup ERSETZTE der
  // Heal einen inhaltlich korrekten Record durch TV-Werte.
  let neu = 0;
  let repariert = 0;
  await new Promise<void>((resolve, reject) => {
    const t = idb.getDb().transaction(CSV_STORES.VERBUENDE, 'readwrite');
    const s = t.objectStore(CSV_STORES.VERBUENDE);
    for (const [vid, tvs] of groups) {
      const req = s.get(vid);
      req.onsuccess = () => {
        const vorhanden = req.result as Verbund | undefined;
        if (vorhanden) {
          // Nur die Ablage reparieren, den Inhalt behalten.
          const ids = new Set(vorhanden.teilantrags_ids);
          for (const tv of tvs) ids.add(tv.aktenzeichen);
          s.put({
            ...vorhanden,
            programm_id: programmId,
            teilantrags_ids: [...ids],
            _updated_at: now,
          });
          repariert++;
          return;
        }
        const lead = tvs[0]!;
        s.put({
          verbund_id: vid,
          programm_id: programmId,
          akronym: strOrUndef(lead.akronym),
          titel: strOrUndef(lead.verbund_titel),
          teilantrags_ids: tvs.map(tv => tv.aktenzeichen),
          _updated_at: now,
        } satisfies Verbund);
        neu++;
      };
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });

  console.info(
    `[verbuende-heal] ${neu} fehlende Verbund-Record(s) aus der List-View rekonstruiert`
    + `${repariert > 0 ? `, ${repariert} mis-filed Record(s) auf programm_id ${programmId} korrigiert` : ''}`
    + ` (Programm ${programmId})`,
  );
  return neu + repariert;
}

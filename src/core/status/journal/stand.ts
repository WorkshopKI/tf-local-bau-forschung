/**
 * Lesen und Schreiben des Journal-Stands auf dem Share.
 *
 * **Nie in IndexedDB.** Eine gerätelokale Historie erzeugte exakt die Divergenz,
 * die das ganze Vorgangssystem beseitigt hat: zwei Rechner, zwei Verläufe,
 * keine Möglichkeit zu entscheiden, welcher stimmt.
 *
 * Schreib-Profile (Pitfall #23):
 * - `stand.json` — **idempotent-overwrite mit Backup**. Er ist die einzige nicht
 *   rekonstruierbare Datei des Journals: geht er verloren, folgt ein neuer
 *   Baseline-Lauf und die Diff-Kette reißt einmalig. Deshalb die Backup-Kopie,
 *   trotz Größe. Geschrieben wird gestreamt, damit kein Mehr-MB-String entsteht.
 * - `journal-YYYY-MM.jsonl` — **append-only**, monatliche Rotation.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  haengeAnSidecar, leseSidecar, schreibeSidecarGestreamt,
} from '../sidecar-datei';
import { JOURNAL_STAND_PATH, journalMonatsPfad } from './pfade';
import { VERARBEITET_MAX, type JournalEintrag, type JournalStand } from './typen';

function istStand(roh: unknown): roh is JournalStand {
  if (typeof roh !== 'object' || roh === null) return false;
  const s = roh as Partial<JournalStand>;
  return s.schema === 1
    && typeof s.journalAb === 'string'
    && typeof s.letzterStempel === 'object' && s.letzterStempel !== null
    && Array.isArray(s.verarbeitet)
    && Array.isArray(s.bereich)
    && typeof s.werte === 'object' && s.werte !== null;
}

/** Der Stand vom Share; `null` = keiner da (dann folgt ein Baseline-Lauf). */
export async function leseStand(idb: IDBStore): Promise<JournalStand | null> {
  return leseSidecar(idb, JOURNAL_STAND_PATH, istStand);
}

/**
 * Schreibt den Stand. `false` = kein Schreibrecht (Selbst-Gate wie bei jeder
 * Sidecar) oder kein Handle — dann läuft das Gerät lesend mit.
 *
 * Gestreamt statt als ein String: der Stand wiegt über tausende Anträge mehrere
 * MB, und `JSON.stringify` baute ihn zusätzlich am Stück im Speicher auf.
 */
export async function schreibeStand(idb: IDBStore, stand: JournalStand): Promise<boolean> {
  return schreibeSidecarGestreamt(idb, JOURNAL_STAND_PATH, async sink => {
    await sink.write('{"schema":1');
    await sink.write(`,"journalAb":${JSON.stringify(stand.journalAb)}`);
    await sink.write(`,"letzterStempel":${JSON.stringify(stand.letzterStempel)}`);
    await sink.write(`,"verarbeitet":${JSON.stringify(stand.verarbeitet)}`);
    await sink.write(`,"bereich":${JSON.stringify(stand.bereich)}`);
    await sink.write(',"werte":{');
    let erstes = true;
    for (const [antragId, felder] of Object.entries(stand.werte)) {
      await sink.write(`${erstes ? '' : ','}${JSON.stringify(antragId)}:${JSON.stringify(felder)}`);
      erstes = false;
    }
    await sink.write('}}');
  });
}

/** Hängt Einträge an die Monatsdatei an. `false` = kein Schreibrecht. */
export async function haengeEintraegeAn(
  idb: IDBStore, eintraege: readonly JournalEintrag[], isoTag: string,
): Promise<boolean> {
  if (eintraege.length === 0) return true;
  return haengeAnSidecar(
    idb, journalMonatsPfad(isoTag), eintraege.map(e => JSON.stringify(e)).join('\n'),
  );
}

/** Den Ringpuffer fortschreiben: neuester zuerst, gedeckelt. */
export function merkeStempel(verarbeitet: readonly string[], id: string): string[] {
  return [id, ...verarbeitet.filter(x => x !== id)].slice(0, VERARBEITET_MAX);
}

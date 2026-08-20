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
import { bestandGeneration } from '@/core/services/bestand-generation';
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

/**
 * Sitzungs-Cache des Stands, entwertet von der Bestands-Generation.
 *
 * Der Stand wiegt über tausende Anträge mehrere MB und wurde bei JEDEM
 * Board-Aufruf und jedem Öffnen einer Antragsseite neu über SMB gelesen und
 * geparst (gemessen ~0,7 s kalt). Entwertet wird er von derselben Generation wie
 * die Bestands-Seiten: ein neuer Export kommt über den Import herein, und der
 * bumpt sie. `schreibeStand` schreibt zusätzlich durch — der Nachtlauf hat die
 * Datei dann gerade selbst ersetzt.
 *
 * **`null` wird mitgecacht**: eine Installation ohne Journal zahlte sonst je
 * Aufruf einen fehlschlagenden SMB-Zugriff, und genau dort ist er am teuersten.
 *
 * **Aber nur befristet** (v4.124). Ein `null` heißt „kein Handle ODER kein
 * Journal", und die beiden sind beim Kaltstart nicht unterscheidbar: wer per
 * Deep-Link auf eine Antragsseite lädt, liest, bevor `getDatenShareHandle`
 * aufgelöst hat. `useJournalChroniken` fasst dafür bis zu viermal über ~11 s
 * nach — die Versuche 2 bis 4 liefen aber gegen diesen Cache und gaben
 * dasselbe `null` zurück, ohne den Share überhaupt anzufassen. Die Seite
 * behauptete dann für die ganze Sitzung „kein Änderungs-Journal". Ein
 * gecachtes `null` verfällt deshalb nach {@link NULL_TTL_MS}; ein gefundener
 * Stand bleibt unbefristet (er kann nur durch einen Import falsch werden, und
 * den fängt die Generation).
 */
let standCache: { generation: number; stand: JournalStand | null; zeit: number } | null = null;

/**
 * Wie lange ein „kein Stand"-Ergebnis gilt. Kürzer als die Nachfass-Kette des
 * Hooks (0/1/3/7 s), damit jeder Versuch wirklich liest; lang genug, dass eine
 * Installation ohne Journal nicht bei jedem Seitenwechsel über SMB stolpert.
 */
const NULL_TTL_MS = 500;

/** Nur für Tests + `schreibeStand`: den Sitzungs-Cache verwerfen. */
export function leereStandCache(): void {
  standCache = null;
}

/** Der Stand vom Share; `null` = keiner da (dann folgt ein Baseline-Lauf). */
export async function leseStand(idb: IDBStore): Promise<JournalStand | null> {
  const gen = bestandGeneration();
  const jetzt = Date.now();
  if (standCache && standCache.generation === gen) {
    // Ein gefundener Stand gilt bis zum nächsten Import; ein `null` nur kurz
    // (siehe `NULL_TTL_MS`).
    if (standCache.stand !== null || jetzt - standCache.zeit < NULL_TTL_MS) return standCache.stand;
  }
  const stand = await leseSidecar(idb, JOURNAL_STAND_PATH, istStand);
  standCache = { generation: gen, stand, zeit: jetzt };
  return stand;
}

/**
 * Schreibt den Stand. `false` = kein Schreibrecht (Selbst-Gate wie bei jeder
 * Sidecar) oder kein Handle — dann läuft das Gerät lesend mit.
 *
 * Gestreamt statt als ein String: der Stand wiegt über tausende Anträge mehrere
 * MB, und `JSON.stringify` baute ihn zusätzlich am Stück im Speicher auf.
 */
export async function schreibeStand(idb: IDBStore, stand: JournalStand): Promise<boolean> {
  // Wir ersetzen die Datei gerade selbst — der gecachte Stand ist ab hier alt.
  leereStandCache();
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

/**
 * Wo das Journal liegt.
 *
 * Unter `_intern/`, wie jede geteilte Sidecar der App (auch zweistufig, vgl.
 * `_intern/skills/feedback/<user>.jsonl`). `programm/` ist für Antrags-Artefakte
 * reserviert, und ein eigener Top-Level-Ordner neben `programm/`, `_intern/` und
 * `backups/` wäre der erste seiner Art.
 *
 * Zwischenverzeichnisse legen `atomicWrite` und `appendToFile` selbst an — es
 * braucht keinen Ordner-Helfer.
 */

/** Wurzel des Journals auf dem Daten-Share. */
export const JOURNAL_DIR = '_intern/vorgangssystem/journal';

/** Der mitgeführte Stand (idempotent-overwrite mit Backup, Pitfall #23). */
export const JOURNAL_STAND_PATH = `${JOURNAL_DIR}/stand.json`;

/** Monatsdatei der Einträge (append-only, Pitfall #23). */
export function journalMonatsPfad(isoTag: string): string {
  return `${JOURNAL_DIR}/journal-${isoTag.slice(0, 7)}.jsonl`;
}

/** Die Monate zwischen zwei ISO-Tagen, aufsteigend (`2026-06`, `2026-07`, …). */
export function monateZwischen(vonIso: string, bisIso: string): string[] {
  const [vj, vm] = [Number(vonIso.slice(0, 4)), Number(vonIso.slice(5, 7))];
  const [bj, bm] = [Number(bisIso.slice(0, 4)), Number(bisIso.slice(5, 7))];
  if (!Number.isFinite(vj) || !Number.isFinite(bj)) return [];
  const out: string[] = [];
  let j = vj;
  let m = vm;
  // Deckel gegen eine kaputte Grenze: 10 Jahre sind 120 Dateien, alles darüber
  // wäre ein Datenfehler und kein Lesewunsch.
  for (let i = 0; i < 120 && (j < bj || (j === bj && m <= bm)); i++) {
    out.push(`${j}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; j += 1; }
  }
  return out;
}

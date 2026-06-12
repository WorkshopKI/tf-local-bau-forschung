/**
 * EINZIGE Quelle für das Layout des persönlichen Antrags-/Eingang-Bereichs.
 * Alles unter dem bestehenden `ZAH/`-Namespace (konsistent mit `ZAH/gutachten/`,
 * `ZAH/skill-tweaks.json`). Von Teil A (Dokumente, Eingang) UND Teil B
 * (Gutachten-Spiegel) genutzt — Pfade nirgends verstreuen.
 *
 * Wer auf Wurzel-Ebene (ohne ZAH-Prefix) ablegen will, ändert nur `BASE`.
 */
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';

const BASE = PERSOENLICH_ZAH_DIR; // 'ZAH'

/** Ersetzt alles außer Wort-/Punkt-/Leer-/Bindestrich-Zeichen durch '_'. */
export function sanitizeSegment(s: string): string {
  return s.replace(/[^\p{L}\p{N}._ -]/gu, '_');
}

/** Original-Stamm behalten, Endung durch `.md` ersetzen, Segment sanitisieren. */
export function mdFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.');
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${sanitizeSegment(stem)}.md`;
}

export const antragDir = (fkz: string): string => `${BASE}/antraege/${sanitizeSegment(fkz)}`;
export const dokumenteDir = (fkz: string): string => `${antragDir(fkz)}/dokumente`;
export const dokumentMdPath = (fkz: string, originalName: string): string =>
  `${dokumenteDir(fkz)}/${mdFilename(originalName)}`;
export const gutachtenDir = (fkz: string): string => `${antragDir(fkz)}/gutachten`;
export const gutachtenMdPath = (fkz: string, stepId: string, slug: string): string =>
  `${gutachtenDir(fkz)}/${sanitizeSegment(stepId)}-${sanitizeSegment(slug)}.md`;

// State-Spiegel (Browser-Wechsel-Durabilität): die Workflow-/Kurzfassung-Records
// liegen als JSON neben den Batch-`.md`-Spiegeln im Gutachten-Ordner; der EINE
// aktive Batch-Job ist ein Singleton auf Wurzel-Ebene. `key` = Store-Key
// (= Verbund-/Aktenzeichen), symmetrisch zu Schreiben + Hydrieren.
export const workflowRunPath = (key: string): string => `${gutachtenDir(key)}/workflow-run.json`;
export const kurzfassungPath = (key: string): string => `${gutachtenDir(key)}/kurzfassung.json`;
export const batchJobPath = (): string => `${BASE}/gutachten-batch-job.json`;

export const EINGANG_DIR = `${BASE}/eingang`;
export const eingangZipPath = (zipname: string): string => `${EINGANG_DIR}/${sanitizeSegment(zipname)}.zip`;
export const eingangManifestPath = (zipname: string): string =>
  `${EINGANG_DIR}/${sanitizeSegment(zipname)}.manifest.json`;

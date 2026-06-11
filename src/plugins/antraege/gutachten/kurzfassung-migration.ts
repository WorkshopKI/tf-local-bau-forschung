/**
 * Übernahme eines alten Einzel-Kurzfassungs-Laufs (`gutachten-kurzfassung:<key>`)
 * als Schritt A des Gutachten-Workflows. LESEND: der Original-Record bleibt
 * unangetastet (alte Stände bleiben lesbar; keine Migration bestehender Stores).
 * Läuft genau einmal — beim ersten Öffnen der Gutachten-Sektion ohne WorkflowRun.
 */
import type { IDBStore } from '@/core/services/storage';
import type { KurzfassungRecord } from '../kurzfassung/types';
import { getKurzfassung } from '../kurzfassung/kurzfassung-store';
import { emptyRun, hashText } from './runner';
import { getWorkflowRun, putWorkflowRun } from './workflow-store';
import type { StepRun, WorkflowRun } from './types';

/** Baut einen WorkflowRun aus einem Kurzfassungs-Record (reine Funktion, testbar). */
export function buildRunFromKurzfassung(record: KurzfassungRecord, now: string): WorkflowRun {
  const istFrei = record.status === 'freigegeben';
  const stepA: StepRun = {
    quellenanalyse: record.quellenanalyse,
    entwurf: record.entwurf,
    finalerText: record.finalerText,
    checks: record.checks,
    status: record.status,
    erstellt_am: record.erstellt_am,
    modell: record.modell,
    ...(record.freigegeben_am ? { freigegeben_am: record.freigegeben_am } : {}),
    ...(record.skillId ? { skillId: record.skillId } : {}),
    ...(record.skillVersion !== undefined ? { skillVersion: record.skillVersion } : {}),
    ...(record.vbGekuerzt ? { vbGekuerzt: record.vbGekuerzt } : {}),
    ...(record.warnung ? { warnung: record.warnung } : {}),
    ...(record.modifier ? { modifier: record.modifier } : {}),
    ...(record.verlauf ? { verlauf: record.verlauf } : {}),
    ...(record.mitTweak ? { mitTweak: record.mitTweak } : {}),
    ...(record.tweakGeaendertAm ? { tweakGeaendertAm: record.tweakGeaendertAm } : {}),
    ...(istFrei ? { freigabeHash: hashText(record.finalerText) } : {}),
  };
  return {
    aktenzeichen: record.key,
    schritte: { A: stepA },
    aktiverSchritt: istFrei ? 'B' : 'A',
    erstellt_am: record.erstellt_am,
    geaendert_am: now,
    ausKurzfassungUebernommen: true,
    schemaVersion: 1,
  };
}

/**
 * Lädt den WorkflowRun für einen Verbund; existiert keiner, wird (einmalig) ein
 * Alt-Kurzfassungs-Lauf als Schritt A übernommen und der neue Run persistiert
 * (lokaler `kv`-Store). Ohne Alt-Lauf → leerer Run. Der Original-Kurzfassungs-
 * Record wird NICHT verändert/gelöscht.
 */
export async function loadOrMigrateWorkflowRun(
  idb: IDBStore,
  aktenzeichen: string,
  now: string,
): Promise<WorkflowRun> {
  const existing = await getWorkflowRun(idb, aktenzeichen);
  if (existing) return existing;
  const alt = await getKurzfassung(idb, aktenzeichen);
  if (alt) {
    const run = buildRunFromKurzfassung(alt, now);
    await putWorkflowRun(idb, run);
    return run;
  }
  return emptyRun(aktenzeichen, now);
}

/**
 * Sequenzieller Batch-Runner. Fährt einen `BatchJob` ab `aktiverIndex` ab — ein
 * Antrag nach dem anderen, je Antrag die gewünschten Abschnitte in A–G-Reihen-
 * folge. KEINE parallelen LLM-Aufrufe. Die eigentliche Abschnitts-Erzeugung
 * (LLM + Checks + Persist + Disk-Spiegel) ist als `erzeugeAbschnitt` injiziert →
 * Tests laufen ohne LLM. Idempotenz (vorhandene Stände überspringen) liegt
 * vollständig in `erzeugeAbschnitt` (gibt dann `uebersprungen` zurück).
 *
 * Regeln: Transport weg ⇒ Job PAUSIERT (nicht abgebrochen), Wiederaufnahme ab
 * `aktiverIndex`. Fehler bei einem Antrag ⇒ markieren + weiter. Abbruch-Signal ⇒
 * Job abgebrochen.
 */
import type { StepId } from '@/plugins/antraege/gutachten/types';
import type { BatchJob } from './types';
import { gewuenschteSchritte } from './types';
import { setEintragStatus, setJobStatus, pausieren, abbrechen } from './job-state';

export interface AbschnittErgebnis {
  erzeugt: boolean;
  uebersprungen: boolean;
  /** Anzahl „Hinweis"-Checks des erzeugten Abschnitts (für die Kurzform). */
  hinweise: number;
}

export interface ErzeugeArgs {
  aktenzeichen: string;
  fkz: string;
  stepId: StepId;
  signal: AbortSignal;
}

export interface BatchDeps {
  /** Interner Transport erreichbar? (Default real: `bridge.getActiveTransport().ping()`). */
  transportVerfuegbar: () => Promise<boolean>;
  /**
   * Erzeugt EINEN Abschnitt (resolve skill/vb, runSkill, Checks, applyGeneration,
   * putWorkflowRun, Disk-Spiegel). WIRFT bei LLM-/Transport-/Kontext-Fehler;
   * gibt `uebersprungen` zurück, wenn der Abschnitt schon einen Stand hat.
   */
  erzeugeAbschnitt: (args: ErzeugeArgs) => Promise<AbschnittErgebnis>;
  persistJob: (job: BatchJob) => Promise<void>;
  onUpdate: (job: BatchJob) => void;
  signal: AbortSignal;
}

function checkKurz(erzeugt: number, hinweise: number, letzterStep: StepId | null): string {
  const basis = `${erzeugt}× erzeugt ✓`;
  if (!hinweise || !letzterStep) return basis;
  return `${basis} (${hinweise} Hinweis${hinweise === 1 ? '' : 'e'} ${letzterStep})`;
}

export async function runBatch(start: BatchJob, deps: BatchDeps): Promise<BatchJob> {
  let job = setJobStatus(start, 'laeuft');
  const schritte = gewuenschteSchritte(job.abschnitte);

  const commit = async (next: BatchJob): Promise<void> => {
    job = next;
    deps.onUpdate(job);
    await deps.persistJob(job);
  };

  await commit(job); // jobStatus 'laeuft' sofort sichtbar/persistiert

  for (let i = job.aktiverIndex; i < job.eintraege.length; i++) {
    job = { ...job, aktiverIndex: i };
    const e = job.eintraege[i]!;
    if (e.status === 'fertig' || e.status === 'uebersprungen' || e.status === 'fehler') continue;

    if (deps.signal.aborted) { await commit(abbrechen(job)); return job; }
    if (!(await deps.transportVerfuegbar())) { await commit(pausieren(job)); return job; }

    await commit(setEintragStatus(job, i, 'in_arbeit', { fehlerText: undefined }));
    try {
      let erzeugt = 0;
      let hinweiseLetzter = 0;
      let letzterStep: StepId | null = null;
      for (const stepId of schritte) {
        if (deps.signal.aborted) { await commit(abbrechen(setEintragStatus(job, i, 'wartet'))); return job; }
        const r = await deps.erzeugeAbschnitt({ aktenzeichen: e.aktenzeichen, fkz: e.fkz, stepId, signal: deps.signal });
        if (r.erzeugt) { erzeugt++; hinweiseLetzter = r.hinweise; letzterStep = stepId; }
      }
      if (erzeugt === 0) {
        await commit(setEintragStatus(job, i, 'uebersprungen', { grund: 'bereits Gutachten-Stand' }));
      } else {
        await commit(setEintragStatus(job, i, 'fertig', { checkKurz: checkKurz(erzeugt, hinweiseLetzter, letzterStep) }));
      }
    } catch (err) {
      if (deps.signal.aborted) { await commit(abbrechen(setEintragStatus(job, i, 'wartet'))); return job; }
      // Transport mitten im Antrag verloren → pausieren (Antrag zurück auf wartet), nicht als Fehler werten.
      if (!(await deps.transportVerfuegbar())) { await commit(pausieren(setEintragStatus(job, i, 'wartet'))); return job; }
      await commit(setEintragStatus(job, i, 'fehler', { fehlerText: err instanceof Error ? err.message : String(err) }));
    }
  }

  await commit(setJobStatus(job, 'fertig'));
  return job;
}

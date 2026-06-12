/**
 * Reine Zustandsübergänge auf `BatchJob` — `(job, …) → job`, kein IO. Die
 * sequenzielle Index-Progression liegt im Runner (runner.ts); hier nur die
 * atomaren Setter, damit beide Seiten trivial testbar bleiben.
 */
import type { BatchJob, BatchEintrag, EintragStatus, JobStatus } from './types';

function patch(job: BatchJob, i: number, p: Partial<BatchEintrag>): BatchJob {
  return { ...job, eintraege: job.eintraege.map((e, idx) => (idx === i ? { ...e, ...p } : e)) };
}

export function setEintragStatus(
  job: BatchJob, i: number, status: EintragStatus, extra: Partial<BatchEintrag> = {},
): BatchJob {
  return patch(job, i, { status, ...extra });
}

export function setJobStatus(job: BatchJob, jobStatus: JobStatus): BatchJob {
  return { ...job, jobStatus };
}

export const pausieren = (job: BatchJob): BatchJob => setJobStatus(job, 'pausiert');
export const fortsetzen = (job: BatchJob): BatchJob => setJobStatus(job, 'laeuft');
export const abbrechen = (job: BatchJob): BatchJob => setJobStatus(job, 'abgebrochen');

/** Kein Eintrag mehr `wartet`/`in_arbeit` → der Job ist durchgelaufen. */
export function istFertig(job: BatchJob): boolean {
  return job.eintraege.every(e => e.status !== 'wartet' && e.status !== 'in_arbeit');
}

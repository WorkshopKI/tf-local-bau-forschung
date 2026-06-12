/**
 * Datenmodell der Batch-Generierung von Gutachten-Entwürfen. EIN aktiver Job,
 * sequenziell. Persistiert im generischen `kv`-Store (siehe batch-store.ts) —
 * kein dedizierter Object-Store/Version-Bump (Pitfall #29).
 */
import type { StepId } from '@/plugins/antraege/gutachten/types';

export type BatchAbschnitte = 'nur_a' | 'a_bis_g';
export type EintragStatus = 'wartet' | 'in_arbeit' | 'fertig' | 'fehler' | 'uebersprungen';
export type JobStatus = 'laeuft' | 'pausiert' | 'fertig' | 'abgebrochen';

export interface BatchEintrag {
  /** Verbund-Key = WorkflowRun-Key + VB-Tag (bei Solo das Aktenzeichen). */
  aktenzeichen: string;
  /** FKZ-Ordnername für den Disk-Spiegel (der von Teil A genutzte FKZ). */
  fkz: string;
  /** Anzeige (Akronym/Kurztitel). */
  titel: string;
  status: EintragStatus;
  fehlerText?: string;
  /** Grund bei 'uebersprungen' ('keine VB' | 'bereits Gutachten-Stand'). */
  grund?: string;
  /** Kurzform letzter Abschnitt, z.B. „2× erzeugt ✓ (1 Hinweis B)". */
  checkKurz?: string;
}

export interface BatchJob {
  id: string;
  erstellt_am: string;
  abschnitte: BatchAbschnitte;
  eintraege: BatchEintrag[];
  aktiverIndex: number;
  jobStatus: JobStatus;
  schemaVersion: 1;
}

/** Welche StepIds ein Job generiert. */
export function gewuenschteSchritte(a: BatchAbschnitte): StepId[] {
  return a === 'nur_a' ? ['A'] : ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
}

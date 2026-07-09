/**
 * Aktivitätsbasierte Deadline für Transport-Antworten (Streamlit-Bridge).
 *
 * Ersetzt starre `setTimeout`-Deckel: solange die Gegenseite Aktivität zeigt
 * (`touch()` — z. B. eingehende `tf-stream`-Snapshots oder `tf-progress`-
 * Heartbeats), wird der Idle-Timer neu aufgezogen; erst `idleMs` OHNE Aktivität
 * lässt `onExpire` feuern. Der harte Deckel `hardMs` begrenzt die Gesamtdauer
 * unabhängig von Aktivität (Schutz gegen endlos „aktive" Läufe).
 *
 * `onExpire` feuert höchstens einmal; `cancel()` (Erfolgsfall) unterdrückt es.
 */
export interface ActivityDeadlineOptions {
  /** Max. Zeit OHNE `touch()`-Aktivität, bis `onExpire` feuert. */
  idleMs: number;
  /** Absolute Obergrenze ab Erstellung — feuert auch bei laufender Aktivität. */
  hardMs: number;
  onExpire: () => void;
}

export interface ActivityDeadline {
  /** Aktivität melden → Idle-Timer neu aufziehen. No-op nach expire/cancel. */
  touch: () => void;
  /** Deadline beenden (Erfolgs-/Cleanup-Pfad) — `onExpire` feuert nicht mehr. */
  cancel: () => void;
}

export function createActivityDeadline(opts: ActivityDeadlineOptions): ActivityDeadline {
  let done = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let hardTimer: ReturnType<typeof setTimeout> | undefined;

  const fire = (): void => {
    if (done) return;
    done = true;
    clearTimeout(idleTimer);
    clearTimeout(hardTimer);
    opts.onExpire();
  };

  hardTimer = setTimeout(fire, opts.hardMs);
  idleTimer = setTimeout(fire, opts.idleMs);

  return {
    touch: (): void => {
      if (done) return;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(fire, opts.idleMs);
    },
    cancel: (): void => {
      done = true;
      clearTimeout(idleTimer);
      clearTimeout(hardTimer);
    },
  };
}

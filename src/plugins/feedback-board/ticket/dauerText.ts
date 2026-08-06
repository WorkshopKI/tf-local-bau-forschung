/**
 * „Was ist mit meinem Ticket, und wie lange dauert es?" — die Übersetzung von
 * Status + Aufwand in einen Satz, den der Ersteller ohne Vorwissen versteht
 * (v3.12, Handoff feedback-redesign §3).
 *
 * Rein und getestet, weil hier die eine Aussage entsteht, auf die sich der
 * Melder verlässt. Der Entwickler setzt eine T-Shirt-Größe; was ankommt, ist
 * Zeit.
 */
import type { FeedbackItem } from '@/core/types/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback';

/** Tönung des Streifens — bildet auf die `.fb-eta`-Modifier ab. */
export type DauerTon = 'info' | 'warnung' | 'wartet' | 'fertig' | 'neutral';

export interface DauerAussage {
  ton: DauerTon;
  /** Fett vorangestellter Teil, z.B. „Wartet auf dich." — kann fehlen. */
  betont?: string;
  text: string;
}

/**
 * Reihenfolge der Prüfung ist die Reihenfolge der Dringlichkeit: erst die
 * Endzustände, dann „du bist dran", dann „noch nichts bekannt", zuletzt die
 * eigentliche Schätzung. Wer eine Rückfrage offen hat, will nicht zuerst lesen,
 * wie lange die Umsetzung dauern würde.
 */
export function dauerAussage(t: FeedbackItem): DauerAussage {
  const s = t.kurator_status;

  if (s === FEEDBACK_STATUS.umgesetzt) {
    return { ton: 'fertig', betont: 'Umgesetzt.', text: 'Die Änderung ist in der App.' };
  }
  if (s === FEEDBACK_STATUS.abgelehnt) {
    return {
      ton: 'neutral',
      text: t.kurator_response
        ? 'Wird nicht umgesetzt — die Begründung steht in der Antwort des Teams.'
        : 'Wird nicht umgesetzt.',
    };
  }
  if (s === FEEDBACK_STATUS.archiviert) {
    return { ton: 'neutral', text: 'Archiviert — dieses Ticket wird nicht weiterverfolgt.' };
  }
  if (s === FEEDBACK_STATUS.rueckfrage) {
    return {
      ton: 'wartet',
      betont: 'Wartet auf dich.',
      text: 'Das Team hat eine Rückfrage gestellt — erst danach geht es weiter.',
    };
  }
  if (!t.effort_estimate) {
    return {
      ton: 'neutral',
      text: 'Noch nicht geschätzt. Sobald jemand den Aufwand setzt, siehst du hier, wie lange es dauert.',
    };
  }

  const dauer = EFFORT_LABELS[t.effort_estimate];
  const einplanung =
    s === FEEDBACK_STATUS.in_bearbeitung ? 'wird gerade umgesetzt'
      : s === FEEDBACK_STATUS.geplant ? 'ist eingeplant'
        : 'ist noch nicht eingeplant';
  return {
    ton: s === FEEDBACK_STATUS.in_bearbeitung ? 'info' : 'warnung',
    text: `Aufwand ${t.effort_estimate} · Umsetzung ${dauer} · ${einplanung}.`,
  };
}

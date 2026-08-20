/**
 * Guard für die Stepper-Position (v4.129).
 *
 * Der Stepper ist die Antwort auf „was ist mit meinem Ticket?" — er darf keinen
 * Fortschritt behaupten, den es nicht gibt. `abgelehnt` UND `archiviert` sind
 * Endzustände auf einem Seitenpfad, nicht die letzte Pipeline-Station.
 */
import { describe, expect, it } from 'vitest';
import { FEEDBACK_PIPELINE, feedbackStepperPosition } from '../feedbackStepper';
import { FEEDBACK_STATUS } from '../feedback-status';

describe('feedbackStepperPosition', () => {
  it('archiviert ist ein Seitenpfad, KEINE erreichte Endstation', () => {
    const pos = feedbackStepperPosition(FEEDBACK_STATUS.archiviert);
    expect(pos.archiviert).toBe(true);
    expect(pos.rejected).toBe(false);
    // Der eigentliche Befund: bis v4.128 stand hier der letzte Pipeline-Index,
    // und das Detail zeigte alle vier Stationen als erreicht — inklusive
    // „Umgesetzt" — direkt über „wird nicht weiterverfolgt".
    expect(pos.index).toBe(0);
    expect(pos.index).not.toBe(FEEDBACK_PIPELINE.length - 1);
  });

  it('abgelehnt bleibt der eigene Seitenpfad', () => {
    const pos = feedbackStepperPosition(FEEDBACK_STATUS.abgelehnt);
    expect(pos).toEqual({ index: 0, rejected: true, archiviert: false });
  });

  it('rueckfrage haelt auf „Neu" an, statt weiterzuzaehlen', () => {
    expect(feedbackStepperPosition(FEEDBACK_STATUS.rueckfrage))
      .toEqual({ index: 0, rejected: false, archiviert: false });
  });

  it('die Pipeline-Status behalten ihren Index', () => {
    for (const [i, s] of FEEDBACK_PIPELINE.entries()) {
      expect(feedbackStepperPosition(s), s).toEqual({ index: i, rejected: false, archiviert: false });
    }
  });

  it('genau EIN Seitenpfad je Status — nie beide zugleich', () => {
    for (const s of Object.values(FEEDBACK_STATUS)) {
      const pos = feedbackStepperPosition(s);
      expect(pos.rejected && pos.archiviert, s).toBe(false);
    }
  });
});

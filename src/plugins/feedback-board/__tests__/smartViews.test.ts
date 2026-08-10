/**
 * Guard für den Status-Raum der Sichten (v3.39).
 *
 * Anlass: In der Startsicht des Entwicklers („Alles offen") verschwand ein auf
 * „umgesetzt" gesetztes Ticket spurlos — es wanderte nicht in die Bahn
 * UMGESETZT, sondern aus der SICHT. Die Bahn stand daneben und meldete „0",
 * während drei Tickets in diesem Status lagen. Diese Tests halten fest, WELCHE
 * Sicht welchen Status überhaupt enthalten kann.
 */
import { describe, expect, it } from 'vitest';
// Direkt an den Quellmodulen statt am Barrel: das Barrel zieht den Share-/IDB-
// Zweig mit, und im nicht-isolierten `fast`-Projekt kippte das den Modul-Mock
// von `feedbackOutboxCollect.test.ts` (CLAUDE.md → Tests). Der Nachbar
// `boardFilter.test.ts` importiert aus demselben Grund direkt.
import { FEEDBACK_STATUS, istOffen } from '@/core/services/feedback/feedback-status';
import { baueIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import type { FeedbackStatus } from '@/core/types/feedback';
import {
  SICHT_ALLE, SMART_VIEWS_ENTWICKLER, SMART_VIEWS_NUTZER, findeView, sichtKannStatus,
  type SmartViewKontext,
} from '../smartViews';

const ALLE_STATUS = Object.values(FEEDBACK_STATUS);
const KTX: SmartViewKontext = {
  ich: baueIdentitaet('THU'), heute: '2026-08-10', istUngelesen: () => false,
};

describe('sichtKannStatus', () => {
  it('„Alles offen" kann keinen Endzustand enthalten — das war der gemeldete Fehler', () => {
    const offen = findeView('entwickler', 'offen');
    expect(sichtKannStatus(offen, FEEDBACK_STATUS.umgesetzt)).toBe(false);
    expect(sichtKannStatus(offen, FEEDBACK_STATUS.abgelehnt)).toBe(false);
    expect(sichtKannStatus(offen, FEEDBACK_STATUS.neu)).toBe(true);
    expect(sichtKannStatus(offen, FEEDBACK_STATUS.in_bearbeitung)).toBe(true);
  });

  it('eine Sicht ohne Status-Bezug schließt nichts aus — 0 heißt dort wirklich 0', () => {
    for (const key of ['mir', 'top', 'alle']) {
      const view = findeView('entwickler', key);
      for (const status of ALLE_STATUS) {
        expect(sichtKannStatus(view, status), `${key} / ${status}`).toBe(true);
      }
    }
  });

  it('deckt sich mit dem Prädikat der Sicht: was der Raum ausschließt, lässt `passt` nicht durch', () => {
    for (const view of [...SMART_VIEWS_ENTWICKLER, ...SMART_VIEWS_NUTZER]) {
      for (const status of ALLE_STATUS) {
        if (sichtKannStatus(view, status)) continue;
        // Ein Ticket, das ALLE anderen Bedingungen der Sicht erfüllt, darf allein
        // am Status scheitern — sonst deklariert der Raum mehr, als er trägt.
        const t = {
          id: 'X', created_at: '2026-08-10T08:00:00Z', user_id: 'THU', text: 'x',
          category: 'idea' as const, kurator_status: status, assignee: 'THU',
          votes: ['A'], effort_estimate: undefined,
        };
        expect(view.passt(t as never, KTX), `${view.key} / ${status}`).toBe(false);
      }
    }
  });

  it('das Sprungziel SICHT_ALLE gibt es in beiden Rollen und es grenzt keinen Status aus', () => {
    for (const rolle of ['entwickler', 'nutzer'] as const) {
      const ziel = findeView(rolle, SICHT_ALLE);
      // `findeView` fällt auf die erste Sicht zurück — ein falscher Schlüssel
      // fiele hier also auf, statt still in die Startsicht zu springen.
      expect(ziel.key, rolle).toBe(SICHT_ALLE);
      expect(ziel.statusRaum, rolle).toBeUndefined();
    }
  });

  it('der Raum von „Alles offen" folgt `istOffen` statt einer zweiten Handliste', () => {
    const offen = findeView('entwickler', 'offen');
    for (const status of ALLE_STATUS) {
      expect(sichtKannStatus(offen, status), status).toBe(istOffen(status as FeedbackStatus));
    }
  });
});

/**
 * Die vier Chip-Menüs: Status · Aufwand · Zuständig · Bereich (v3.12).
 *
 * Bewusst Funktionen statt Komponenten — sie werden als Render-Prop an
 * `InlineChip` gereicht und existieren nur, solange das Popover offen ist.
 *
 * Jede Auswahl geht durch `ctx.aendere` und erzeugt damit automatisch einen
 * Toast mit „Rückgängig". Die Meldung nennt IMMER Ticket-Handle und Zielwert:
 * bei sechs Spalten und Mehrfachauswahl (E2) ist „Gespeichert" wertlos.
 */
import { Clock, UserRound } from 'lucide-react';
import type { EffortEstimate, FeedbackItem } from '@/core/types/feedback';
import { EFFORT_LABELS, EFFORT_ORDER } from '@/core/types/feedback';
import { FEEDBACK_LANE_STATUS } from '@/components/feedback/feedbackLanes';
import { STATUS_DOT, STATUS_LABELS, TEAMFLOW_AREAS } from '@/components/feedback/constants';
import { bereichLabel, feedbackNummer, ticketBereich } from '@/components/feedback/feedbackUi';
import { EFFORT_HOURS } from '@/core/types/feedback';
import { PopLabel, PopTrenner, PopZeile } from './InlineChip';
import type { TicketKontext } from './typen';

/** `#A7K2 → Geplant` — Handle + Zielwert, damit der Toast auch bei sechs
 *  gleichzeitig bewegten Karten noch etwas aussagt. */
function meldung(t: FeedbackItem, was: string): string {
  return `#${feedbackNummer(t)} → ${was}`;
}

export function statusMenue(t: FeedbackItem, ctx: TicketKontext, schliessen: () => void): React.ReactNode {
  return (
    <>
      <PopLabel>Status setzen</PopLabel>
      {FEEDBACK_LANE_STATUS.map(s => (
        <PopZeile
          key={s}
          label={STATUS_LABELS[s]}
          dot={STATUS_DOT[s]}
          aktiv={t.kurator_status === s}
          onClick={() => { ctx.aendere(t, { kurator_status: s }, meldung(t, STATUS_LABELS[s])); schliessen(); }}
        />
      ))}
    </>
  );
}

export function aufwandMenue(t: FeedbackItem, ctx: TicketKontext, schliessen: () => void): React.ReactNode {
  const setze = (e: EffortEstimate | undefined): void => {
    // `effort_hours` immer mitschreiben — die beiden Felder driften sonst
    // auseinander, und die Spaltensumme rechnet auf den Stunden.
    ctx.aendere(
      t,
      { effort_estimate: e, effort_hours: e ? EFFORT_HOURS[e] : undefined },
      e ? meldung(t, `Aufwand ${e} · ${EFFORT_LABELS[e]}`) : `#${feedbackNummer(t)} · Schätzung entfernt`,
    );
    schliessen();
  };
  return (
    <>
      <PopLabel>Aufwand · sichtbar für den Ersteller</PopLabel>
      {EFFORT_ORDER.map(e => (
        <PopZeile
          key={e}
          label={e}
          sub={EFFORT_LABELS[e]}
          aktiv={t.effort_estimate === e}
          onClick={() => setze(e)}
        />
      ))}
      {t.effort_estimate && (
        <>
          <PopTrenner />
          <PopZeile label="Schätzung entfernen" onClick={() => setze(undefined)} />
        </>
      )}
    </>
  );
}

export function zustaendigMenue(t: FeedbackItem, ctx: TicketKontext, schliessen: () => void): React.ReactNode {
  const setze = (wer: string | undefined, text: string): void => {
    ctx.aendere(t, { assignee: wer }, text);
    schliessen();
  };
  // Ich selbst stehe oben und komme in der Liste darunter nicht noch einmal vor.
  const andere = ctx.personen.filter(p => p !== ctx.meineId);
  return (
    <>
      <PopLabel>Zuständig</PopLabel>
      {ctx.meineId && (
        <PopZeile
          label="Mir zuweisen"
          icon={UserRound}
          aktiv={t.assignee === ctx.meineId}
          onClick={() => setze(ctx.meineId, `#${feedbackNummer(t)} dir zugewiesen`)}
        />
      )}
      {andere.map(p => (
        <PopZeile
          key={p}
          label={p}
          aktiv={t.assignee === p}
          onClick={() => setze(p, meldung(t, p))}
        />
      ))}
      {andere.length === 0 && !ctx.meineId && (
        <div className="px-[9px] py-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Noch niemand im Bestand.
        </div>
      )}
      {t.assignee && (
        <>
          <PopTrenner />
          <PopZeile
            label="Zuweisung aufheben"
            onClick={() => setze(undefined, `#${feedbackNummer(t)} · Zuweisung aufgehoben`)}
          />
        </>
      )}
    </>
  );
}

export function bereichMenue(t: FeedbackItem, ctx: TicketKontext, schliessen: () => void): React.ReactNode {
  const aktuell = ticketBereich(t);
  return (
    <>
      <PopLabel>Bereich</PopLabel>
      {TEAMFLOW_AREAS.map(a => (
        <PopZeile
          key={a.ref}
          label={a.label}
          aktiv={aktuell === a.ref}
          onClick={() => { ctx.aendere(t, { bereich: a.ref }, meldung(t, a.label)); schliessen(); }}
        />
      ))}
    </>
  );
}

/** Der Aufwand-Chip zeigt auf der Karte nur die Größe, im Detail Größe + Dauer. */
export function aufwandChipLabel(t: FeedbackItem, lang: boolean): string {
  if (!t.effort_estimate) return lang ? 'Aufwand schätzen' : 'Aufwand';
  return lang ? `${t.effort_estimate} · ${EFFORT_LABELS[t.effort_estimate]}` : t.effort_estimate;
}

export const AufwandIcon = Clock;
export const ZustaendigIcon = UserRound;

/** Anzeigename des Bereichs eines Tickets (kuratiert → gemeldet → „Sonstiges"). */
export function ticketBereichLabel(t: FeedbackItem): string {
  return bereichLabel(ticketBereich(t));
}

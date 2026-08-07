/**
 * „Board anpassen"-Popover der Feedback-Kanban-Ansicht — das Pendant zum
 * Stift-Popover der Home-Widgets (WidgetQuickEdit): gleiche Optik, gleiche
 * Lane-Auswahl (LaneListe), gleiche Fußzeile „nur lokal auf diesem Gerät".
 *
 * Read-modify-write auf der `BoardKanbanConfig` — die Seite persistiert
 * (localStorage), diese Komponente hält keinen eigenen Zustand.
 */
// `Pencil` statt `SlidersHorizontal`: der Dateikopf nennt `WidgetQuickEdit` als
// Vorbild, und der trägt einen Stift. `SlidersHorizontal` heißt app-weit
// „Darstellung" und sitzt seit v3.24 am Darstellungs-Menü der Toolbar daneben —
// zweimal dasselbe Icon in einer Leiste wäre nicht zu unterscheiden.
import { Lock, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LaneListe } from '@/components/ui/LaneListe';
import { FarbmodusToggle } from '@/components/kanban/FarbmodusToggle';
import { STATUS_LABELS, STATUS_LANE_ACCENT } from './constants';
import { FEEDBACK_LANE_STATUS, type FeedbackLane } from './feedbackLanes';
import type { BoardKanbanConfig } from './boardKanbanConfig';

export function FeedbackKanbanEinstellungen({ config, onChange }: {
  config: BoardKanbanConfig;
  onChange: (cfg: BoardKanbanConfig) => void;
}): React.ReactElement {
  const spaltenProKey = new Map<string, 1 | 2>(
    config.lanes.map(l => [l.status as string, l.spalten]),
  );

  const toggleLane = (key: string): void => {
    const status = key as FeedbackLane['status'];
    const lanes = spaltenProKey.has(key)
      ? config.lanes.filter(l => l.status !== status)
      : // Neue Lane hinten anhängen (wie im Home-Widget), einspaltig starten.
        [...config.lanes, { status, spalten: 1 as const }];
    onChange({ ...config, lanes });
  };

  const setSpalten = (key: string, spalten: 1 | 2): void => {
    onChange({
      ...config,
      lanes: config.lanes.map(l => (l.status === key ? { ...l, spalten } : l)),
    });
  };

  const ausgeblendet = FEEDBACK_LANE_STATUS.length - config.lanes.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Board anpassen"
          title="Board anpassen — Lanes, Kartenspalten, Farben"
          className="h-8 w-8 grid place-items-center rounded-[var(--tf-radius)] cursor-pointer transition-colors text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
          style={{ border: '0.5px solid var(--tf-border-hover)' }}
        >
          <Pencil size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-4">
        <p className="text-[13px] font-semibold text-[var(--tf-text)] mb-3">
          Board anpassen — Kanban
        </p>

        <div className="space-y-4">
          <div>
            <FeldLabel>Lanes (aus Feedback-Status)</FeldLabel>
            <LaneListe
              options={FEEDBACK_LANE_STATUS.map(s => ({
                key: s,
                label: STATUS_LABELS[s],
                akzent: STATUS_LANE_ACCENT[s],
              }))}
              spaltenProKey={spaltenProKey}
              onToggle={toggleLane}
              onSpalten={setSpalten}
            />
            {ausgeblendet > 0 ? (
              <p className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
                {ausgeblendet === 1 ? '1 Lane ausgeblendet' : `${ausgeblendet} Lanes ausgeblendet`}
                {' '}— die Tickets bleiben in der Listen-Ansicht sichtbar.
              </p>
            ) : null}
          </div>

          <div>
            <FeldLabel>Farben der Köpfe</FeldLabel>
            <FarbmodusToggle
              value={config.farbmodus}
              onChange={m => { if (config.farbmodus !== m) onChange({ ...config, farbmodus: m }); }}
              buntDots={['var(--tf-fb-lane-neu)', 'var(--tf-fb-ux)', 'var(--tf-fb-lob)']}
            />
          </div>
        </div>

        <div
          className="mt-4 pt-3 flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)]"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          <Lock size={11} className="shrink-0" aria-hidden />
          nur lokal auf diesem Gerät
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FeldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="mb-1.5 text-[11px] font-medium text-[var(--tf-text-secondary)]">{children}</p>
  );
}


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
import type { TfBahnSpalten } from '@/components/kanban/tfBoardBahn';
import type { FeedbackStatus } from '@/core/types/feedback';
import { STATUS_LABELS, STATUS_LANE_ACCENT } from './constants';
import { verschiebeLane, type BoardKanbanConfig } from './boardKanbanConfig';

export function FeedbackKanbanEinstellungen({ config, onChange }: {
  config: BoardKanbanConfig;
  onChange: (cfg: BoardKanbanConfig) => void;
}): React.ReactElement {
  // Nur sichtbare Lanes gelten als „gewählt" — die ausgeblendeten stehen
  // weiterhin in der Liste, damit ihr Platz in der Folge sichtbar bleibt.
  const spaltenProKey = new Map<string, TfBahnSpalten>(
    config.lanes.filter(l => l.sichtbar).map(l => [l.status as string, l.spalten]),
  );

  // Ein-/Ausblenden verschiebt NICHT: bis v3.40 hängte das Wiedereinblenden die
  // Lane hinten an, und „Geplant" landete rechts von „Abgelehnt".
  const toggleLane = (key: string): void => {
    onChange({
      ...config,
      lanes: config.lanes.map(l => (l.status === key ? { ...l, sichtbar: !l.sichtbar } : l)),
    });
  };

  const setSpalten = (key: string, spalten: TfBahnSpalten): void => {
    onChange({
      ...config,
      lanes: config.lanes.map(l => (l.status === key ? { ...l, spalten } : l)),
    });
  };

  const verschiebe = (key: string, richtung: -1 | 1): void => {
    const lanes = verschiebeLane(config.lanes, key as FeedbackStatus, richtung);
    // Am Rand liefert der Helfer dieselbe Liste zurück — dann kein Schreibvorgang.
    if (lanes !== config.lanes) onChange({ ...config, lanes });
  };

  const ausgeblendet = config.lanes.filter(l => !l.sichtbar).length;

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
            {/* Zeilenfolge = Spaltenfolge des Boards, ausgeblendete mitten drin. */}
            <LaneListe
              options={config.lanes.map(l => ({
                key: l.status,
                label: STATUS_LABELS[l.status],
                akzent: STATUS_LANE_ACCENT[l.status],
              }))}
              spaltenProKey={spaltenProKey}
              onToggle={toggleLane}
              onSpalten={setSpalten}
              onVerschiebe={verschiebe}
            />
            {/* Die Regel steht dort, wo sie entschieden wird: automatisch
                einklappen betrifft nur LEERE Lanes, das Häkchen schlägt sie. */}
            <p className="mt-1.5 text-[11px] leading-[1.45] text-[var(--tf-text-tertiary)]">
              Leere Lanes klappen von selbst zur Schiene ein, volle per Klick auf den Spaltenkopf; abgewählte bleiben weg, auch mit Tickets.
              {ausgeblendet > 0
                ? ` Zurzeit ausgeblendet: ${ausgeblendet} — in der Listen-Ansicht sind die Tickets weiterhin sichtbar.`
                : null}
            </p>
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


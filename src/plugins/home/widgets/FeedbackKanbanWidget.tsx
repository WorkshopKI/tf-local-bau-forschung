/**
 * Feedback-Kanban-Widget (Home, Hauptbereich — v1.1). Zweite Quelle des
 * Kanban-Typs: Lanes aus Feedback-STATUS statt Antrags-Kategorien.
 *
 * Read-only + Navigation: Karten öffnen das Feedback-Board mit selektiertem
 * Ticket (transienter Nav-Slot), „+ N weitere →" das Board. KEIN Vote-Toggle,
 * keine Anhänge (bewusst schlanker als die Board-MiniCard). Lob erscheint nicht
 * (kein Workflow — buildFeedbackKanbanLanes filtert es raus).
 */
import { useEffect, useMemo, useState } from 'react';
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn } from '@/components/kanban/tf-board-types';
import { LanePills, type LanePill } from '@/components/kanban/LanePills';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { getFeedbackList } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
// Direktimporte statt Barrel: das Barrel zieht `FeedbackPanel` mit, und das laedt
// `@/plugins.config` — ueber die Plugin-Kette fuehrte der Weg zurueck in die
// Home-Widgets (Laufzeit-Zyklus). Hier werden ohnehin nur Daten/Helfer gebraucht.
import {
  CATEGORY_LABELS,
  CATEGORY_TEXT_VAR,
  STATUS_COLUMN_ICONS,
  STATUS_LABELS,
} from '@/components/feedback/constants';
import { getLucideIcon } from '@/components/feedback/feedbackUi';
import { useFeedbackNavStore } from '@/components/feedback/feedbackNavStore';
import {
  buildFeedbackKanbanLanes,
  defaultFeedbackKanbanLanes,
  feedbackLaneAccent,
  type FeedbackKanbanKarte,
} from './feedbackKanbanLanes';
import type { FeedbackKanbanWidgetConfig } from './types';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const FALLBACK_CONFIG: FeedbackKanbanWidgetConfig = {
  art: 'kanban',
  quelle: 'feedback',
  lanes: defaultFeedbackKanbanLanes(),
  farbmodus: 'bunt',
  maxKartenProLane: 4,
};

export function FeedbackKanbanWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();

  const cfg: FeedbackKanbanWidgetConfig =
    instanz.config.art === 'kanban' && instanz.config.quelle === 'feedback'
      ? instanz.config
      : FALLBACK_CONFIG;

  // Feedback-Menge ist klein → immer laden (auch eingeklappt), damit der
  // Zähler-Slot die Lane-Pills zeigen kann.
  const [items, setItems] = useState<FeedbackItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    getFeedbackList(storage)
      .then(list => { if (!cancelled) setItems(list); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [storage]);

  const { lanes, gesamt } = useMemo(
    () => buildFeedbackKanbanLanes(items, cfg.lanes, cfg.maxKartenProLane),
    [items, cfg.lanes, cfg.maxKartenProLane],
  );

  const pills = useMemo(
    (): LanePill[] => lanes.map((lane, i) => ({
      key: lane.status,
      label: STATUS_LABELS[lane.status],
      accent: feedbackLaneAccent(cfg.farbmodus, lane.status, i),
      gesamt: lane.gesamt,
    })),
    [lanes, cfg.farbmodus],
  );

  const openBoard = (ticketId?: string): void => {
    if (ticketId) useFeedbackNavStore.getState().requestOpenTicket(ticketId);
    navigate('feedback-board');
  };

  return (
    <WidgetShell
      titel="Feedback — Kanban"
      meta="Quelle: Feedback"
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        instanz.eingeklappt
          ? <LanePills pills={pills} />
          : (
            <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
              {gesamt.toLocaleString('de-DE')} {gesamt === 1 ? 'Feedback' : 'Feedbacks'}
            </span>
          )
      }
    >
      <TfBoard
        label="Feedback nach Status"
        layout="geteilt"
        // Wie im Feedback-Board: der Bahnkopf ist der Einklapp-Schalter, und die
        // leere Schiene wird bedienbar. Ohne das Flag ist sie im Widget stumm —
        // 44 px, die aussehen wie ein Knopf und keiner sind. Der Zustand bleibt
        // fluechtig (Widget-Collapse haengt den Body ohnehin aus dem DOM).
        features={{ einklappbar: true }}
        bahnen={lanes.map((lane, i): TfBoardBahn<FeedbackKanbanKarte> => ({
          key: lane.status,
          label: STATUS_LABELS[lane.status],
          icon: getLucideIcon(STATUS_COLUMN_ICONS[lane.status]),
          accent: feedbackLaneAccent(cfg.farbmodus, lane.status, i),
          items: lane.karten,
          gesamt: lane.gesamt,
          spalten: lane.spalten,
          fuss: lane.gesamt > lane.karten.length ? (
            <button type="button" onClick={() => openBoard()} className="tfb-fuss">
              + {lane.gesamt - lane.karten.length} weitere →
            </button>
          ) : undefined,
        }))}
        renderCard={k => (
          <FeedbackKarteView key={k.id} karte={k} onOpen={() => openBoard(k.id)} />
        )}
      />
    </WidgetShell>
  );
}

/** Kompakt-Karte (read-only): Typ-Badge, Titel, Autor · Stimmen. Keine Anhänge,
 *  kein Vote-Toggle — Klick öffnet das Board-Ticket. */
function FeedbackKarteView({ karte, onOpen }: { karte: FeedbackKanbanKarte; onOpen: () => void }): React.ReactElement {
  const accent = karte.kategorie ? CATEGORY_TEXT_VAR[karte.kategorie] : 'var(--tf-text-tertiary)';
  const typLabel = karte.kategorie ? CATEGORY_LABELS[karte.kategorie] : 'Feedback';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left rounded-[10px] bg-[var(--tf-bg)] shadow-sm hover:shadow-md hover:-translate-y-px transition cursor-pointer px-3 py-2.5"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: '3px solid var(--tfb-c)' }}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.07em] truncate" style={{ color: accent }}>
        {typLabel}
      </span>
      <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--tf-text)] line-clamp-2" title={karte.titel}>
        {karte.titel}
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
        {karte.autor ?? '—'} · {karte.stimmen} {karte.stimmen === 1 ? 'Stimme' : 'Stimmen'}
      </p>
    </button>
  );
}

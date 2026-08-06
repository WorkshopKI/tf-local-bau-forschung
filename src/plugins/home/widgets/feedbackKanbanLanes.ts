/**
 * Reine Lane-Ableitung für die FEEDBACK-Quelle des Kanban-Widgets (v1.1),
 * testbar ohne React/IDB — Schwester der antrags-seitigen kanbanLanes.ts.
 *
 * Lanes binden an Feedback-STATUS (FEEDBACK_STATUS, Pitfall #21 — nie Roh-
 * Literale). Lob (`category === 'praise'`) hat keinen Workflow und wird wie im
 * Board ausgeschlossen. Karten sind read-only View-Modelle (kein Vote-Toggle im
 * Widget — Stimmen werden nur ANGEZEIGT).
 */
import type { FeedbackCategory, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
// Sub-Modul-Importe (nicht das @/components/feedback-Barrel): dieses Modul ist
// rein + node-testbar, das Barrel zöge pdfjs u.a. schwere Deps herein.
import { FEEDBACK_LANE_STATUS, feedbackLaneAccent } from '@/components/feedback/feedbackLanes';
import { feedbackAuthorLabel, feedbackTitle } from '@/components/feedback/feedbackUi';
import { defaultAntragKanbanLanes } from './kanbanLanes';
import type {
  FeedbackKanbanLane,
  FeedbackKanbanWidgetConfig,
  KanbanWidgetConfig,
} from './types';

/** Lane-Katalog + Akzent-Ableitung leben geteilt in
 *  @/components/feedback/feedbackLanes (Board + Widget); hier re-exportiert,
 *  damit Bestands-Importe der Widget-Seite gültig bleiben. */
export { FEEDBACK_LANE_STATUS, feedbackLaneAccent };

export interface FeedbackKanbanKarte {
  /** Ticket-ID — Navigations-Ziel (Deep-Link ins Board). */
  id: string;
  titel: string;
  kategorie: FeedbackCategory | undefined;
  /** Stimmen-Anzahl (votes.length) — nur Anzeige, kein Toggle im Widget. */
  stimmen: number;
  /** Autor-Kürzel/-Name (feedbackAuthorLabel), undefined bei anonym. */
  autor: string | undefined;
  createdAt: string;
}

export interface FeedbackKanbanLaneDaten {
  status: FeedbackStatus;
  spalten: 1 | 2;
  karten: FeedbackKanbanKarte[];
  gesamt: number;
}

export interface FeedbackKanbanLanesErgebnis {
  lanes: FeedbackKanbanLaneDaten[];
  gesamt: number;
}

function zuKarte(t: FeedbackItem): FeedbackKanbanKarte {
  return {
    id: t.id,
    titel: feedbackTitle(t, 120),
    kategorie: t.category,
    stimmen: t.votes?.length ?? 0,
    autor: feedbackAuthorLabel(t),
    createdAt: t.created_at,
  };
}

/**
 * Baut die konfigurierten Feedback-Lanes aus der Ticket-Menge: Bucketing nach
 * `kurator_status` (Lob raus), Sortierung neueste zuerst, Kappung. Leere Lanes
 * bleiben ERHALTEN (Schmalschiene im Board).
 */
export function buildFeedbackKanbanLanes(
  items: FeedbackItem[],
  lanes: FeedbackKanbanLane[],
  maxKartenProLane: number,
): FeedbackKanbanLanesErgebnis {
  const proStatus = new Map<FeedbackStatus, FeedbackKanbanKarte[]>();
  for (const t of items) {
    if (t.category === 'praise') continue; // Lob hat keinen Workflow → nur Liste
    const arr = proStatus.get(t.kurator_status);
    const karte = zuKarte(t);
    if (arr) arr.push(karte); else proStatus.set(t.kurator_status, [karte]);
  }

  const cap = Math.max(1, maxKartenProLane);
  let gesamt = 0;
  const ergebnis = lanes.map(lane => {
    const alle = (proStatus.get(lane.status) ?? [])
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    gesamt += alle.length;
    return {
      status: lane.status,
      spalten: lane.spalten,
      karten: alle.slice(0, cap),
      gesamt: alle.length,
    };
  });
  return { lanes: ergebnis, gesamt };
}

/**
 * Default-Lanes eines Feedback-Kanbans (Quellenwechsel-Reset). `rueckfrage`
 * steht bewusst weit vorn: das Widget soll zeigen, wo jemand auf eine Antwort
 * wartet. BESTEHENDE Widget-Instanzen behalten ihre gespeicherte Lane-Liste —
 * dort bleiben Rückfrage-Tickets unsichtbar, bis der Nutzer die Spur zuschaltet.
 * Das ist gewollt: die Widget-Config ist eine persönliche Entscheidung und wird
 * nicht von einem Release überschrieben (anders als die Board-Ansicht, die einen
 * Key-Bump bekommt).
 */
export function defaultFeedbackKanbanLanes(): FeedbackKanbanLane[] {
  return [
    { status: FEEDBACK_STATUS.neu, spalten: 1 },
    { status: FEEDBACK_STATUS.rueckfrage, spalten: 1 },
    { status: FEEDBACK_STATUS.in_bearbeitung, spalten: 2 },
    { status: FEEDBACK_STATUS.geplant, spalten: 1 },
    { status: FEEDBACK_STATUS.umgesetzt, spalten: 1 },
  ];
}

/** Default-Config eines Feedback-Kanbans (Quellenwechsel im Config-Formular). */
export function defaultFeedbackKanbanConfig(
  basis: Pick<FeedbackKanbanWidgetConfig, 'farbmodus' | 'maxKartenProLane'>,
): FeedbackKanbanWidgetConfig {
  return {
    art: 'kanban',
    quelle: 'feedback',
    lanes: defaultFeedbackKanbanLanes(),
    farbmodus: basis.farbmodus,
    maxKartenProLane: basis.maxKartenProLane,
  };
}

/**
 * Quellenwechsel (pure): setzt die Lanes STILL auf den Default der neuen Quelle
 * zurück (sonst zeigten StatusCategory-Lanes ins Leere einer Feedback-Quelle und
 * umgekehrt). Farbmodus + Kappung bleiben erhalten; `presetId` fällt beim Wechsel
 * auf Feedback weg. No-op bei gleicher Quelle.
 */
export function wechsleKanbanQuelle(
  cfg: KanbanWidgetConfig,
  quelle: 'antraege' | 'feedback',
): KanbanWidgetConfig {
  if (cfg.quelle === quelle) return cfg;
  const basis = { farbmodus: cfg.farbmodus, maxKartenProLane: cfg.maxKartenProLane };
  if (quelle === 'antraege') {
    return { art: 'kanban', quelle: 'antraege', lanes: defaultAntragKanbanLanes(), ...basis };
  }
  return defaultFeedbackKanbanConfig(basis);
}

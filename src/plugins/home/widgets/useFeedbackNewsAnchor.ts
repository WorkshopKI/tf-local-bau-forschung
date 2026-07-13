/**
 * Gerätelokaler „gelesen bis"-Anker des Feedback-Neuigkeiten-Widgets (v1.1).
 *
 * Muster von useUnreadReplies: per-User-localStorage, kein Datenmodell-Wechsel,
 * kein Share-Write. EIN Datensatz je Nutzer hält Zeitpunkt + gemerkte Stimmen-
 * und Antwort-Stände (schnappschuss). Bewusst UNABHÄNGIG vom Glocken-Seen-Map
 * (`teamflow_feedback_seen_replies_v1`): „Alles gelesen" im Widget soll die
 * Glocke nicht still leeren und umgekehrt.
 */
import { useCallback, useEffect, useState } from 'react';
import type { FeedbackItem } from '@/core/types/feedback';
import { schnappschuss, type FeedbackNewsAnker } from './feedbackNews';

const ANKER_KEY_PREFIX = 'teamflow_feedback_news_anchor_v1';

function keyFor(meId: string): string {
  return `${ANKER_KEY_PREFIX}_${meId}`;
}

/** Toleranter Read: fehlend/kaputt → null (Aufrufer seedet dann aus den Items). */
export function ladeFeedbackNewsAnker(meId: string | undefined): FeedbackNewsAnker | null {
  if (!meId) return null;
  try {
    const raw = localStorage.getItem(keyFor(meId));
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    if (typeof o.anker !== 'string') return null;
    return {
      anker: o.anker,
      stimmenStand: (o.stimmenStand && typeof o.stimmenStand === 'object' ? o.stimmenStand : {}) as Record<string, number>,
      antwortStand: (o.antwortStand && typeof o.antwortStand === 'object' ? o.antwortStand : {}) as Record<string, string>,
    };
  } catch {
    return null;
  }
}

function speichere(meId: string, anker: FeedbackNewsAnker): void {
  try {
    localStorage.setItem(keyFor(meId), JSON.stringify(anker));
  } catch {
    /* ignore */
  }
}

export interface FeedbackNewsAnkerApi {
  /** null bis der Erst-Anker gesetzt ist (Aufrufer seedet nach dem Item-Load). */
  anker: FeedbackNewsAnker | null;
  /** „Alles gelesen": Anker = jetzt + Snapshot der aktuellen Stände. */
  markiereGelesen: (items: FeedbackItem[]) => void;
}

export function useFeedbackNewsAnchor(meId: string | undefined): FeedbackNewsAnkerApi {
  const [anker, setAnker] = useState<FeedbackNewsAnker | null>(() => ladeFeedbackNewsAnker(meId));

  // Nutzer-Wechsel (Login): Anker neu laden.
  useEffect(() => {
    setAnker(ladeFeedbackNewsAnker(meId));
  }, [meId]);

  const markiereGelesen = useCallback((items: FeedbackItem[]): void => {
    if (!meId) return;
    const next = schnappschuss(items, meId, new Date().toISOString());
    speichere(meId, next);
    setAnker(next);
  }, [meId]);

  return { anker, markiereGelesen };
}

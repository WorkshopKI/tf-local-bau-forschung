// Ungelesene Team-Antworten auf EIGENE Feedbacks (Redesign v2.208).
//
// Es gibt kein „Last-Seen" im Datenmodell → gerätelokale localStorage-Map
// (Präzedenz: budgetService). Key pro Nutzer, Wert = Signatur des zuletzt
// gesehenen Antworttexts (djb2). Editiert der Kurator seine Antwort, ändert sich
// die Signatur → der Eintrag gilt wieder als ungelesen. Kein Schema-Wechsel,
// kein Kurator-Schreibpfad, keine Share-Writes (rein lokal, wie das
// „Weitermachen"-Log · arbeitskontext-log-idb-only ist die Analogie).

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeedbackItem } from '@/core/types/feedback';

const SEEN_KEY_PREFIX = 'teamflow_feedback_seen_replies_v1';

type SeenMap = Record<string, string>;

function keyFor(meId: string): string {
  return `${SEEN_KEY_PREFIX}_${meId}`;
}

/** Stabile Kurz-Signatur (djb2 → base36) des Antworttexts. */
function signatureOf(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function loadSeen(meId: string | undefined): SeenMap {
  if (!meId) return {};
  try {
    const raw = localStorage.getItem(keyFor(meId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as SeenMap) : {};
  } catch {
    return {};
  }
}

export interface UnreadReplies {
  /** Anzahl eigener Feedbacks mit ungelesener Team-Antwort (Glocke + „Dein Fortschritt"). */
  count: number;
  /** true, wenn `item` mir gehört und eine noch nicht gesehene Team-Antwort trägt. */
  isUnread: (item: FeedbackItem) => boolean;
  /** Markiert die Antwort eines eigenen Items als gesehen (beim Detail-Öffnen). */
  markSeen: (item: FeedbackItem) => void;
}

/**
 * Ungelesen-Status der Team-Antworten für den aktuellen Nutzer.
 * `meId` = Kürzel/Name (wie Scope/Votes). Ohne `meId` ist alles „gelesen" (count 0).
 */
export function useUnreadReplies(items: FeedbackItem[], meId?: string): UnreadReplies {
  const [seen, setSeen] = useState<SeenMap>(() => loadSeen(meId));

  // Nutzer-Wechsel (Login): Map neu aus localStorage laden.
  useEffect(() => {
    setSeen(loadSeen(meId));
  }, [meId]);

  const isUnread = useCallback(
    (item: FeedbackItem): boolean => {
      if (!meId || item.user_id !== meId) return false;
      const reply = item.kurator_response?.trim();
      if (!reply) return false;
      return seen[item.id] !== signatureOf(reply);
    },
    [meId, seen],
  );

  const markSeen = useCallback(
    (item: FeedbackItem): void => {
      if (!meId || item.user_id !== meId) return;
      const reply = item.kurator_response?.trim();
      if (!reply) return;
      const sig = signatureOf(reply);
      setSeen(prev => {
        if (prev[item.id] === sig) return prev;
        const next = { ...prev, [item.id]: sig };
        try { localStorage.setItem(keyFor(meId), JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    },
    [meId],
  );

  const count = useMemo(() => items.filter(isUnread).length, [items, isUnread]);

  return { count, isUnread, markSeen };
}

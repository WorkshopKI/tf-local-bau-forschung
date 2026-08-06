// Ungelesene KOMMENTARE an Feedback-Tickets (v2.416) — das Gegenstück zu
// useUnreadReplies, nach demselben Muster: per-Nutzer-localStorage, kein
// Datenmodell-Feld, kein Share-Write. Anders als dort gilt es für ALLE Tickets,
// nicht nur die eigenen: die Diskussion an einem fremden Ticket ist genau das,
// was der Marker sichtbar machen soll.
//
// DRITTER, unabhängiger Speicher — bewusst weder an die Glocken-Map noch an den
// Anker des Neuigkeiten-Widgets angehängt. Die Begründung steht schon in
// useFeedbackNewsAnchor: „gelesen" an einer Stelle darf die Marker an einer
// anderen nicht still leeren.
//
// Die Rechnung selbst liegt rein in kommentarStand.ts (node-getestet).

import { useCallback, useEffect, useState } from 'react';
import type { FeedbackItem } from '@/core/types/feedback';
import type { MeineIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import {
  ergaenzeKommentarStand,
  standNach,
  zaehleNeueKommentare,
  type KommentarStand,
} from './kommentarStand';

const STAND_KEY_PREFIX = 'teamflow_feedback_seen_comments_v1';

function keyFor(meId: string): string {
  return `${STAND_KEY_PREFIX}_${meId}`;
}

/** Toleranter Read: fehlend/kaputt → leerer Stand (dann seedet der Nachtrag). */
function ladeStand(meId: string | undefined): KommentarStand {
  if (!meId) return {};
  try {
    const raw = localStorage.getItem(keyFor(meId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as KommentarStand) : {};
  } catch {
    return {};
  }
}

function speichere(meId: string, stand: KommentarStand): void {
  try {
    localStorage.setItem(keyFor(meId), JSON.stringify(stand));
  } catch {
    /* gesperrt → nur für diese Sitzung */
  }
}

export interface UnreadComments {
  /** Neue Kommentare an diesem Ticket seit dem letzten Öffnen (0 = nichts). */
  neuFuer: (item: FeedbackItem) => number;
  /** Markiert die Kommentare eines Tickets als gesehen (beim Öffnen des Details). */
  markSeen: (item: FeedbackItem) => void;
}

/**
 * `ich` statt einer Id: WESSEN Kommentar es ist, entscheidet die tolerante
 * Identität (Bestandsbeiträge tragen ggf. die frühere Schreibweise) — der
 * localStorage-Key hängt weiter an der kanonischen `schreibId`, damit der
 * gemerkte Stand eines Nutzers stabil bleibt.
 */
export function useUnreadComments(items: FeedbackItem[], ich: MeineIdentitaet): UnreadComments {
  const meId = ich.schreibId;
  const [stand, setStand] = useState<KommentarStand>(() => ladeStand(meId));

  // Nutzer-Wechsel (Login): Stand neu aus dem localStorage laden.
  useEffect(() => {
    setStand(ladeStand(meId));
  }, [meId]);

  // Baseline: noch nie beobachtete Tickets bekommen ihren aktuellen Wert. Ohne
  // diesen Schritt wäre beim ersten Start jeder Bestands-Kommentar „neu".
  // `?? prev` gibt bei „nichts Neues" DIESELBE Referenz zurück — React bricht
  // dann ab, obwohl `items` bei jedem Reload eine neue Array-Identität hat.
  useEffect(() => {
    if (!meId) return;
    setStand(prev => {
      const next = ergaenzeKommentarStand(prev, items, ich);
      if (!next) return prev;
      speichere(meId, next);
      return next;
    });
  }, [items, ich, meId]);

  const neuFuer = useCallback(
    (item: FeedbackItem): number => zaehleNeueKommentare(item, stand, ich),
    [stand, ich],
  );

  const markSeen = useCallback(
    (item: FeedbackItem): void => {
      if (!meId) return;
      setStand(prev => {
        const next = standNach(prev, item, ich);
        if (!next) return prev;
        speichere(meId, next);
        return next;
      });
    },
    [ich, meId],
  );

  return { neuFuer, markSeen };
}

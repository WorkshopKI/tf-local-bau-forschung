/**
 * Feedback-Neuigkeiten-Widget (Home, Seitenspalte — Phase 1 v1.1).
 *
 * Read-only + Navigation: zeigt seit dem letzten Besuch Antworten aufs eigene
 * Feedback, Statuswechsel an Tickets, an denen ich beteiligt bin, neue
 * Team-Tickets und Stimmen-Zuwächse (Selektor feedbackNews.ts).
 * Versteckt sich bewusst NICHT bei „nichts Neues" (Startseiten-Stabilität) —
 * dann eine ruhige Zeile. „Alles gelesen" setzt den gerätelokalen Anker.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getFeedbackList } from '@/core/services/feedback';
import { formatShortDate } from '@/components/feedback/feedbackUi';
import { useFeedbackNavStore } from '@/components/feedback/feedbackNavStore';
import type { FeedbackItem } from '@/core/types/feedback';
import { berechneFeedbackNews, type FeedbackNewsEintrag } from './feedbackNews';
import { useFeedbackNewsAnchor } from './useFeedbackNewsAnchor';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const DEFAULT_MAX = 3;

export function FeedbackNewsWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const storage = useStorage();
  const { navigate } = useNavigation();
  const { profile } = useProfile();
  const kuerzel = useMeinKuerzel();
  // Identität wie im Board: Kürzel (Login) → sonst Profilname (nicht „anonymous").
  const meId = kuerzel ?? (profile?.name && profile.name !== 'anonymous' ? profile.name : undefined);

  const maxEintraege = instanz.config.art === 'feedback-news' ? instanz.config.maxEintraege : DEFAULT_MAX;

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getFeedbackList(storage)
      .then(list => { if (!cancelled) { setItems(list); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [storage]);

  const { anker, markiereGelesen, ergaenzeAnker } = useFeedbackNewsAnchor(meId);

  // Erst-Anker nach dem ersten Item-Load setzen (aus den AKTUELLEN Ständen —
  // nichts ist rückwirkend „neu"). Läuft genau einmal (danach anker != null).
  useEffect(() => {
    if (loaded && meId && anker === null) markiereGelesen(items);
  }, [loaded, meId, anker, items, markiereGelesen]);

  // Neu hinzugekommene Beteiligungen mit ihrem aktuellen Status nachtragen —
  // verschiebt „gelesen bis" NICHT, macht aber deren nächsten Statuswechsel
  // sichtbar. No-op, sobald nichts Unbekanntes mehr dabei ist.
  useEffect(() => {
    if (loaded && meId && anker !== null) ergaenzeAnker(items);
  }, [loaded, meId, anker, items, ergaenzeAnker]);

  const news = useMemo(
    () => (anker ? berechneFeedbackNews(items, meId, anker, maxEintraege, Date.now()) : []),
    [items, meId, anker, maxEintraege],
  );

  const gelesen = useAsyncAction(async () => { markiereGelesen(items); });

  // Klick öffnet das betroffene Ticket, nicht nur das Board: Ticket vormerken,
  // dann navigieren — FeedbackBoardPage konsumiert den Slot beim Mount.
  const oeffneTicket = (ticketId: string): void => {
    useFeedbackNavStore.getState().requestOpenTicket(ticketId);
    navigate('feedback-board');
  };

  const seitLabel = anker ? `seit ${formatShortDate(anker.anker)}` : undefined;

  return (
    <WidgetShell
      titel="Feedback-Neuigkeiten"
      meta={seitLabel}
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      aktion={
        news.length > 0 ? (
          <button
            type="button"
            onClick={() => gelesen.run()}
            className="text-[11px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            Alles gelesen
          </button>
        ) : undefined
      }
      zaehler={
        news.length > 0 ? (
          <span className="min-w-5 h-5 px-1.5 rounded-full grid place-items-center text-[11px] font-semibold tabular-nums text-[var(--tf-on-primary)] bg-[var(--tf-primary)]">
            {news.length}
          </span>
        ) : undefined
      }
    >
      {news.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] py-1">
          Keine Neuigkeiten{seitLabel ? ` ${seitLabel}` : ''}.
        </p>
      ) : (
        <div className="flex flex-col">
          {news.map((n, i) => (
            <NewsZeile key={n.key} eintrag={n} onOpen={() => oeffneTicket(n.ticketId)} last={i === news.length - 1} />
          ))}
          <button
            type="button"
            onClick={() => navigate('feedback-board')}
            className="mt-2 self-start text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer"
          >
            Zum Feedback-Board →
          </button>
        </div>
      )}
    </WidgetShell>
  );
}

function NewsZeile({ eintrag, onOpen, last }: { eintrag: FeedbackNewsEintrag; onOpen: () => void; last: boolean }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left py-2 cursor-pointer group"
      style={last ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 mt-px inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold uppercase tracking-[0.04em]"
          style={{ color: eintrag.badgeColor, background: `color-mix(in srgb, ${eintrag.badgeColor} 12%, var(--tf-bg))` }}
        >
          {eintrag.badgeLabel}
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--tf-text)] group-hover:text-[var(--tf-primary)]">
          {eintrag.text}
        </span>
      </div>
      {eintrag.meta ? (
        <p className="mt-0.5 ml-[3px] text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">{eintrag.meta}</p>
      ) : null}
    </button>
  );
}

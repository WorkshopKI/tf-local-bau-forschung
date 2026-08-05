// Die Kommentarzeile des Feedback-Systems — EINE Darstellung für zwei Orte:
// den Thread im Detail-Panel (`variante="thread"`) und die Hover-Vorschau an der
// 💬-Metrik der Karten (`variante="hover"`). Ohne diese geteilte Quelle drifteten
// beide auseinander, sobald einer von beiden angefasst wird.
//
// Die Komponente rendert nur — WELCHE Kommentare sie bekommt und wie stark sie
// gekürzt sind, entscheidet `waehleKommentarVorschau` (feedbackUi.ts, rein +
// getestet).

import type { KommentarVorschauEintrag } from './feedbackUi';
import { formatShortDate } from './feedbackUi';
import { FeedbackAvatar } from './FeedbackAvatar';

interface Props {
  eintraege: KommentarVorschauEintrag[];
  /** 'thread' = Detail-Panel (voller Text) · 'hover' = Vorschau (dichter, kleiner). */
  variante?: 'thread' | 'hover';
  /** Ältere, nicht gezeigte Kommentare → Kopfzeile „+N ältere". Nur im Hover. */
  aeltereAnzahl?: number;
}

export function FeedbackCommentList({ eintraege, variante = 'thread', aeltereAnzahl = 0 }: Props): React.ReactElement {
  const hover = variante === 'hover';

  return (
    <div className={hover ? 'space-y-2' : 'space-y-2.5'}>
      {aeltereAnzahl > 0 && (
        <p className="text-[10.5px] text-[var(--tf-text-tertiary)]">
          +{aeltereAnzahl} ältere{aeltereAnzahl === 1 ? 'r Kommentar' : ' Kommentare'}
        </p>
      )}

      {eintraege.map(({ comment, text, neu }) => {
        const name = comment.user_display_name || comment.user_id;
        return (
          <div
            key={comment.id}
            className={`flex gap-2 ${neu ? '-mx-1.5 px-1.5 py-1 rounded-[6px] bg-[var(--tf-fb-idee-bg)]' : ''}`}
            style={neu ? { borderLeft: '2px solid var(--tf-fb-idee)' } : undefined}
          >
            <FeedbackAvatar name={name} size={hover ? 16 : 20} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5 text-[11px]">
                <span className="font-medium text-[var(--tf-text)]">{name}</span>
                <span className="text-[var(--tf-text-tertiary)]">{formatShortDate(comment.created_at)}</span>
                {neu && (
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[var(--tf-fb-idee)]">
                    neu
                  </span>
                )}
              </p>
              <p
                className={`whitespace-pre-wrap leading-snug text-[var(--tf-text-secondary)] ${hover ? 'text-[12px]' : 'text-[13px]'}`}
              >
                {text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

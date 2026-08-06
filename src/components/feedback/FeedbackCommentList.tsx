// Die Kommentarzeile des Feedback-Systems — EINE Darstellung für zwei Orte:
// den Thread im Detail-Panel (`variante="thread"`) und die Hover-Vorschau an der
// 💬-Metrik der Karten (`variante="hover"`). Ohne diese geteilte Quelle drifteten
// beide auseinander, sobald einer von beiden angefasst wird.
//
// Die Komponente rendert nur — WELCHE Kommentare sie bekommt und wie stark sie
// gekürzt sind, entscheidet `waehleKommentarVorschau` (feedbackUi.ts, rein +
// getestet).

import type { FeedbackComment } from '@/core/types/feedback';
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

interface ArtStil { label: string; bg: string; rand: string }

/** Tönung + Beschriftung je Beitragsart. `kommentar` (und alle Bestandsdaten
 *  ohne `kind`) bleibt bewusst schmucklos — sonst wäre der Normalfall markiert. */
const ART: Record<NonNullable<FeedbackComment['kind']>, ArtStil | undefined> = {
  kommentar: undefined,
  ergaenzung: { label: 'Ergänzung', bg: 'bg-[var(--tf-fb-frage-bg)]', rand: 'var(--tf-fb-frage)' },
  rueckfrage: { label: 'Rückfrage', bg: 'bg-[var(--tf-fb-problem-bg)]', rand: 'var(--tf-fb-problem)' },
};

const NEU_STIL: ArtStil = { label: 'neu', bg: 'bg-[var(--tf-fb-idee-bg)]', rand: 'var(--tf-fb-idee)' };

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
        // Art des Beitrags (v3.18): eine Ergänzung des Erstellers und eine
        // Rückfrage des Teams sind etwas anderes als ein Kommentar — sie tragen
        // eigene Tönung und Beschriftung. „Neu" (ungelesen) sticht vor, weil es
        // der flüchtigere Zustand ist.
        const art = ART[comment.kind ?? 'kommentar'];
        const hervor = neu ? NEU_STIL : art;
        return (
          <div
            key={comment.id}
            className={`flex gap-2 ${hervor ? `-mx-1.5 px-1.5 py-1 rounded-[6px] ${hervor.bg}` : ''}`}
            style={hervor ? { borderLeft: `2px solid ${hervor.rand}` } : undefined}
          >
            <FeedbackAvatar name={name} size={hover ? 16 : 20} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-1.5 text-[11px]">
                <span className="font-medium text-[var(--tf-text)]">{name}</span>
                <span className="text-[var(--tf-text-tertiary)]">{formatShortDate(comment.created_at)}</span>
                {art && (
                  <span
                    className="text-[9.5px] font-medium uppercase tracking-[0.06em]"
                    style={{ color: art.rand }}
                  >
                    {art.label}
                  </span>
                )}
                {neu && (
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--tf-fb-idee)]">
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

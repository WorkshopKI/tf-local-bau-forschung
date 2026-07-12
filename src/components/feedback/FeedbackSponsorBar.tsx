// Read-only Sponsor-Fortschrittsleiste (Redesign v2.208) — das lebendige
// Engagement-Signal auf den Listen-Karten. Anzeige only; die eigentliche
// +/−-Vergabe passiert im Detail (FeedbackSponsorPanel → SponsorButton).
// Rechnet über getSponsoringProgress; ohne Schwelle (nicht sponsorbar / kein
// Aufwand) → null, der Aufrufer zeigt dann die Vote-Pill. Die frühere
// 'board'-Variante entfiel mit v2.225 (Kanban-Karte zeigt eine Punkte-Metrik).

import { ArrowUp } from 'lucide-react';
import { getSponsoringProgress } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  /** Identität des Nutzers — hebt die Karte hervor, wenn er selbst Punkte gesetzt hat. */
  meId?: string;
  /** Kompakte Dichte (v2.225): entkleidet — Label über 40px-Mini-Track, ohne
   *  Rahmen/Fläche und ohne Sponsoren-Zahl (schmale 44px-Spalte). */
  dense?: boolean;
}

export function FeedbackSponsorBar({ ticket, config, meId, dense }: Props): React.ReactElement | null {
  const p = getSponsoringProgress(ticket, config);
  if (p.threshold <= 0) return null;
  const reached = p.thresholdReached;
  const mineActive = !!meId && (ticket.sponsors ?? []).some(s => s.user_id === meId && s.type === 'points');

  if (dense) {
    return (
      <div
        className="flex flex-col items-center gap-1"
        title={`${p.combinedPoints}/${p.threshold} Pkt · ${p.sponsorCount} ${p.sponsorCount === 1 ? 'Sponsor' : 'Sponsoren'}`}
      >
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--tf-text)] tabular-nums whitespace-nowrap">
          <ArrowUp size={11} className="text-[var(--tf-fb-lob)] shrink-0" strokeWidth={1.75} />
          {reached ? 'Ziel' : `${p.combinedPoints}/${p.threshold} Pkt`}
        </span>
        <div className="w-10 h-[5px] rounded-full bg-[var(--tf-fb-sponsor-track)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${p.percentage}%`, background: 'var(--tf-fb-lob)' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[9px] px-2.5 py-2 ${mineActive ? 'bg-[var(--tf-fb-lob-bg)]' : 'bg-[var(--tf-card-surface)]'}`}
      style={{ border: `0.5px solid ${mineActive ? 'var(--tf-fb-lob-border)' : 'var(--tf-border)'}` }}
    >
      <div className="flex items-center justify-between gap-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--tf-text)] tabular-nums">
          <ArrowUp size={12} className="text-[var(--tf-fb-lob)] shrink-0" strokeWidth={1.75} />
          {reached ? 'Ziel erreicht' : `${p.combinedPoints}/${p.threshold} Pkt`}
        </span>
        <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
          {p.sponsorCount} {p.sponsorCount === 1 ? 'Sponsor' : 'Sponsoren'}
        </span>
      </div>
      <div className="mt-[7px] h-[5px] rounded-full bg-[var(--tf-fb-sponsor-track)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${p.percentage}%`, background: 'var(--tf-fb-lob)' }} />
      </div>
    </div>
  );
}

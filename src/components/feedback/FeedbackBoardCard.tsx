// Einzelne Ticket-Karte im öffentlichen Board (kompakte Variante).
// Badges inline in Titelzeile, vereinfachte Sponsor-Buttons, kein Sponsoren-Aufklapper.

import * as Icons from 'lucide-react';
import { getSponsoringProgress, isSponsoringOpen } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  EFFORT_SHORT_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from './constants';
import { SponsorButton } from './SponsorButton';

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;
function getIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  onChanged: () => void;
}

export function FeedbackBoardCard({ ticket, config, onChanged }: Props): React.ReactElement {
  const Icon = getIcon(ticket.category ? CATEGORY_ICONS[ticket.category] : 'MessageCircle');
  const summary = ticket.llm_summary || ticket.text || '–';
  const isFeature = ticket.category === 'idea';
  const hasEffort = !!ticket.effort_estimate;
  const progress = getSponsoringProgress(ticket, config);
  const open = isSponsoringOpen(ticket);

  return (
    <div
      className="rounded-[var(--tf-radius-lg)] p-4 space-y-2 bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {/* Header: Icon + Titel links, Badges rechts */}
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 text-[var(--tf-text-secondary)] shrink-0" />
        <p className="flex-1 min-w-0 text-[13.5px] text-[var(--tf-text)] font-medium leading-snug">
          {summary}
        </p>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${ticket.category ? CATEGORY_COLORS[ticket.category] : 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'}`}>
            {ticket.category ? CATEGORY_LABELS[ticket.category] : 'Unklassifiziert'}
          </span>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.kurator_status]}`}>
            {STATUS_LABELS[ticket.kurator_status]}
          </span>
          {hasEffort && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]">
              {EFFORT_SHORT_LABELS[ticket.effort_estimate!]}
            </span>
          )}
        </div>
      </div>

      {/* Sponsoring-Block (nur bei Features mit Aufwand) */}
      {isFeature && hasEffort && (
        <div className="space-y-2 pt-0.5">
          {/* Progress-Balken */}
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${progress.percentage}%`,
                  background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)',
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {progress.combinedPoints}/{progress.threshold} Pkt · {progress.percentage}%
              {progress.sponsorCount > 0 && ` · ${progress.sponsorCount} Sponsoren`}
            </p>
          </div>

          {/* Kompakte Sponsoring-Buttons */}
          <SponsorButton ticket={ticket} config={config} open={open} onChanged={onChanged} compact />
        </div>
      )}

      {/* Bug: knapper Hinweis */}
      {!isFeature && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Bugs werden ohne Sponsoring bearbeitet.
        </p>
      )}

      {/* Feature ohne Aufwand: Kurator muss noch schätzen */}
      {isFeature && !hasEffort && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Aufwand-Schätzung ausstehend — Sponsoring noch nicht möglich.
        </p>
      )}
    </div>
  );
}

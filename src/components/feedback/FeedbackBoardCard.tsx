// Einzelne Ticket-Karte im öffentlichen Board.
// Zeigt: Titel, Kategorie, Status, Aufwand, Sponsoring-Progress (nur bei Features mit Aufwand).

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { getSponsoringProgress, isSponsoringOpen } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { EFFORT_LABELS } from '@/core/types/feedback';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
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
  const [sponsorsExpanded, setSponsorsExpanded] = useState(false);
  const Icon = getIcon(CATEGORY_ICONS[ticket.category]);
  const summary = ticket.llm_summary || ticket.text || '–';
  const isFeature = ticket.category === 'idea';
  const hasEffort = !!ticket.effort_estimate;
  const progress = getSponsoringProgress(ticket, config);
  const open = isSponsoringOpen(ticket);
  const sponsors = ticket.sponsors ?? [];

  return (
    <div
      className="rounded-[var(--tf-radius-lg)] p-4 space-y-2.5 bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 text-[var(--tf-text-secondary)] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] text-[var(--tf-text)] font-medium leading-snug">{summary}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${CATEGORY_COLORS[ticket.category]}`}>
              {CATEGORY_LABELS[ticket.category]}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${STATUS_COLORS[ticket.admin_status]}`}>
              {STATUS_LABELS[ticket.admin_status]}
            </span>
            {hasEffort && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]">
                Aufwand: {EFFORT_LABELS[ticket.effort_estimate!]}
              </span>
            )}
            {progress.thresholdReached && open && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">
                ✓ Schwelle erreicht
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sponsoring-Block (nur bei Features mit Aufwand) */}
      {isFeature && hasEffort && (
        <div className="space-y-2 pt-1">
          {/* Progress-Balken */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-[var(--tf-bg-secondary)] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${progress.percentage}%`,
                  background: progress.thresholdReached ? 'var(--tf-success-text)' : 'var(--tf-primary)',
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--tf-text-tertiary)]">
              {progress.combinedPoints} / {progress.threshold} Punkte ({progress.percentage}%)
              {' · '}
              {progress.pointsTotal > 0 && `${progress.pointsTotal} Pkt`}
              {progress.pointsTotal > 0 && progress.hoursTotal > 0 && ' + '}
              {progress.hoursTotal > 0 && `${progress.hoursTotal}h`}
              {progress.sponsorCount > 0 && ` von ${progress.sponsorCount} Sponsoren`}
            </p>
          </div>

          {/* Sponsoring-Buttons */}
          <SponsorButton ticket={ticket} config={config} open={open} onChanged={onChanged} />

          {/* Sponsoren-Liste (collapsible) */}
          {sponsors.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setSponsorsExpanded(v => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)] cursor-pointer"
              >
                {sponsorsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Sponsoren ({sponsors.length})
              </button>
              {sponsorsExpanded && (
                <ul className="mt-1 space-y-0.5 text-[11.5px] text-[var(--tf-text-secondary)]">
                  {sponsors.map((s, i) => (
                    <li key={`${s.user_id}-${s.type}-${i}`}>
                      <span className="text-[var(--tf-text)]">{s.user_display_name}</span>
                      {' · '}
                      {s.type === 'points' ? `${s.amount} Pkt` : `${s.amount}h (${s.project_ref})`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bug ohne Sponsoring: knapper Hinweis */}
      {!isFeature && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Bugs werden ohne Sponsoring-Schwelle bearbeitet.
        </p>
      )}

      {/* Feature ohne Aufwand: Admin muss noch schätzen */}
      {isFeature && !hasEffort && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] italic">
          Aufwand-Schätzung ausstehend — Sponsoring noch nicht möglich.
        </p>
      )}
    </div>
  );
}

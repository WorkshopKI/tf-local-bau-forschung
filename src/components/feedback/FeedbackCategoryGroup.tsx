// Collapsible Kategorie-Sektion für das öffentliche Feedback-Board.
// Header (Icon + farbiges Label + Anzahl) bleibt immer sichtbar → Kategorie-
// Überblick „auf einen Blick"; Body listet die FeedbackBoardCards der Gruppe.

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FeedbackCategory, FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from './constants';
import { getLucideIcon } from './feedbackUi';
import { FeedbackBoardCard } from './FeedbackBoardCard';

export type CategoryGroupKey = FeedbackCategory | 'unclassified';

interface Props {
  categoryKey: CategoryGroupKey;
  items: FeedbackItem[];
  config: FeedbackConfig;
  collapsed: boolean;
  onToggle: () => void;
  onChanged: () => void;
  /** Board: user_id des angemeldeten Nutzers → eigene Karten werden markiert. */
  meineUserId?: string;
}

export function FeedbackCategoryGroup({
  categoryKey,
  items,
  config,
  collapsed,
  onToggle,
  onChanged,
  meineUserId,
}: Props): React.ReactElement {
  const isUnclassified = categoryKey === 'unclassified';
  const Icon = getLucideIcon(isUnclassified ? 'MessageCircle' : CATEGORY_ICONS[categoryKey]);
  const label = isUnclassified ? 'Unklassifiziert' : CATEGORY_LABELS[categoryKey];
  const pillColor = isUnclassified
    ? 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]'
    : CATEGORY_COLORS[categoryKey];
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="w-full flex items-center gap-2 px-1 py-1.5 cursor-pointer group"
      >
        <Chevron size={14} className="text-[var(--tf-text-tertiary)] shrink-0" />
        <Icon size={14} className="text-[var(--tf-text-secondary)] shrink-0" />
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${pillColor}`}>
          {label}
        </span>
        <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] tabular-nums">
          {items.length.toLocaleString('de-DE')}
        </span>
        <span className="flex-1 h-px bg-[var(--tf-border)] ml-1" />
      </button>

      {!collapsed && (
        <div className="space-y-3 mt-2">
          {items.map(t => (
            <FeedbackBoardCard
              key={t.id}
              ticket={t}
              config={config}
              onChanged={onChanged}
              mine={!!meineUserId && t.user_id === meineUserId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

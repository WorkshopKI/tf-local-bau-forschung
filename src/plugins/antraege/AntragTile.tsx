import { Badge } from '@/ui';
import type { AntragGroup } from './antragGroups';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { AMPEL_COLOR, AMPEL_TOOLTIP } from './eingangAmpel';
import { daysUntilFrist } from './views';
import { getStatusCategory } from '@/core/utils/status-canonical';
import {
  worstAmpel,
  criticalFrist,
  uniqueStatusCategories,
  getStatusCategoryLabel,
} from './groupAggregates';
import { StatusDotRow } from './StatusDotRow';

interface Props {
  group: AntragGroup;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  onOpenAntrag: (aktenzeichen: string) => void;
  onOpenVerbund: (verbundId: string) => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function formatFrist(d: number | null): string {
  if (d === null) return '';
  if (d === 0) return 'heute';
  return `${d}d`;
}

/**
 * Single-Tile: 1 TV → kompakte Card mit Akronym als Hauptinfo.
 * Verbund-Tile: ≥2 TVs → Sammeltile mit ×N + StatusDotRow oder (bei
 * einheitlichem Status) einem normalen Status-Badge.
 */
export function AntragTile({
  group,
  selectedAktenzeichen,
  selectedVerbundId,
  onOpenAntrag,
  onOpenVerbund,
}: Props): React.ReactElement {
  const isVerbund = group.tvs.length >= 2;
  const headTv = group.tvs[0]!;
  const akronym = strOrNull(headTv.akronym) ?? headTv.aktenzeichen;

  // Auswahl-Highlight
  const isSelected = isVerbund
    ? (group.verbundId !== null && selectedVerbundId === group.verbundId)
      || group.tvs.some(t => t.aktenzeichen === selectedAktenzeichen)
    : selectedAktenzeichen === headTv.aktenzeichen;

  const onClick = (): void => {
    if (isVerbund && group.verbundId !== null) {
      onOpenVerbund(group.verbundId);
    } else {
      onOpenAntrag(headTv.aktenzeichen);
    }
  };

  // Ampel + Frist aggregieren — Single nutzt dieselben Helper wie Verbund.
  const ampel = worstAmpel(group.tvs);
  const frist = isVerbund ? criticalFrist(group.tvs) : daysUntilFrist(headTv);
  const fristTxt = formatFrist(frist);
  const fristCritical = frist !== null && frist < 0;

  // Status: bei einheitlicher Kategorie → Badge mit Label des head TV.
  // Bei gemischten Kategorien (nur im Verbund-Fall möglich) → StatusDotRow.
  const categories = uniqueStatusCategories(group.tvs);
  const showSingleStatus = !isVerbund || categories.size === 1;
  const status = strOrNull(headTv.status);

  // Tooltip: bei Verbund Liste aller TVs → Status
  const titleText = isVerbund
    ? group.tvs
        .map(tv => {
          const az = tv.aktenzeichen;
          const s = strOrNull(tv.status);
          if (s) return `${az} — ${getStatusLabel(s)}`;
          return `${az} — ${getStatusCategoryLabel(getStatusCategory(tv.status))}`;
        })
        .join('\n')
    : status
      ? `${headTv.aktenzeichen} — ${getStatusLabel(status)}`
      : headTv.aktenzeichen;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titleText}
      className={`group flex flex-col items-center justify-between rounded-[var(--tf-radius)] transition-colors text-left ${
        isSelected
          ? 'ring-2 ring-[var(--tf-primary)] bg-[var(--tf-bg-secondary)]'
          : 'hover:bg-[var(--tf-bg-secondary)]'
      }`}
      style={{
        border: '0.5px solid var(--tf-border)',
        minHeight: '72px',
        padding: '6px 8px',
      }}
    >
      {/* Header-Zeile: Ampel + Frist links, ×N rechts (Verbund). */}
      <div className="w-full flex items-center justify-between gap-1 min-w-0">
        <span className="inline-flex items-center gap-1 shrink-0">
          {ampel !== null ? (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: AMPEL_COLOR[ampel] }}
              aria-label={AMPEL_TOOLTIP[ampel]}
            />
          ) : (
            <span className="w-2 h-2 shrink-0" aria-hidden="true" />
          )}
          {fristTxt ? (
            <span
              className={`tabular-nums text-[10px] ${
                fristCritical ? 'text-[var(--tf-danger-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'
              }`}
            >
              {fristTxt}
            </span>
          ) : null}
        </span>
        {isVerbund ? (
          <span className="shrink-0 text-[10px] text-[var(--tf-text-tertiary)] tabular-nums">
            ×{group.tvs.length}
          </span>
        ) : null}
      </div>

      {/* Akronym — dominantes Element. */}
      <div className="w-full flex items-center justify-center min-w-0 py-0.5">
        <span className="font-semibold text-[13px] text-[var(--tf-text)] truncate max-w-full">
          {akronym}
        </span>
      </div>

      {/* Status-Footer: Badge bei einheitlichem Status, sonst Dot-Row. */}
      <div className="w-full flex items-center justify-center min-w-0">
        {showSingleStatus && status ? (
          <Badge
            variant={getStatusVariant(status)}
            className="text-[9px] px-1.5 py-0 leading-tight max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {getStatusLabel(status)}
          </Badge>
        ) : isVerbund ? (
          <StatusDotRow tvs={group.tvs} />
        ) : null}
      </div>
    </button>
  );
}

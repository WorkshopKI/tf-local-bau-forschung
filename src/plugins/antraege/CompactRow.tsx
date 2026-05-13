import { Badge } from '@/ui';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import {
  getEingangAmpel,
  daysSinceEingang,
  AMPEL_COLOR,
  AMPEL_TOOLTIP,
} from './eingangAmpel';
import { daysUntilFrist } from './views';

interface Props {
  tv: AntragListItem;
  selected: boolean;
  onClick: () => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function formatFrist(d: number | null): string {
  if (d === null) return '';
  if (d === 0) return 'heute';
  if (d > 0) return `${d}d`;
  return `${d}d`; // negativ → "-3d"
}

/**
 * Kompakte Single-Line-Zeile (~26px Höhe) für die Kompakt-Liste.
 * Felder von links nach rechts:
 *   Ampel (8px) · FKZ (mono, tertiary) · Akronym (medium) ·
 *   Antragsteller (truncate, flex-grow) · Status-Badge · Frist-Tage
 */
export function CompactRow({ tv, selected, onClick }: Props): React.ReactElement {
  const ampel = getEingangAmpel(tv);
  const ampelDays = ampel !== null ? daysSinceEingang(tv) : null;
  const akronym = strOrNull(tv.akronym);
  const antragsteller = strOrNull(tv.antragsteller);
  const status = strOrNull(tv.status) ?? '';
  const frist = daysUntilFrist(tv);
  const fristTxt = formatFrist(frist);
  const fristCritical = frist !== null && frist < 0;

  const titleText = antragsteller ?? strOrNull(tv.titel) ?? tv.aktenzeichen;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titleText}
      className={`w-full text-left px-2 py-1 rounded-[var(--tf-radius)] transition-colors flex items-center gap-2 min-w-0 ${
        selected
          ? 'bg-[var(--tf-bg-secondary)]'
          : 'hover:bg-[var(--tf-bg-secondary)]'
      }`}
    >
      {/* Ampel-Punkt (8px) — Platzhalter beibehalten wenn keine Ampel, damit
          alle Zeilen horizontal alignieren. */}
      <span className="shrink-0 w-2 h-2 inline-flex items-center justify-center">
        {ampel !== null ? (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: AMPEL_COLOR[ampel] }}
            title={ampelDays !== null ? `${AMPEL_TOOLTIP[ampel]} (${ampelDays} Tage)` : AMPEL_TOOLTIP[ampel]}
            aria-hidden="true"
          />
        ) : null}
      </span>

      {/* FKZ (Aktenzeichen) — monospace, fixed Breite. */}
      <span className="shrink-0 font-mono text-[11px] text-[var(--tf-text-tertiary)] w-[88px] truncate">
        {tv.aktenzeichen}
      </span>

      {/* Akronym — medium font, fixed-ish Breite. */}
      <span className="shrink-0 font-medium text-[12.5px] text-[var(--tf-text)] w-[110px] truncate">
        {akronym ?? ''}
      </span>

      {/* Antragsteller — flex-grow, truncate. */}
      <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
        {antragsteller ?? ''}
      </span>

      {/* Status-Badge — kompakte Padding-Variante. */}
      {status ? (
        <Badge
          variant={getStatusVariant(status)}
          className="shrink-0 min-w-[100px] justify-center whitespace-nowrap text-[10.5px]"
        >
          {getStatusLabel(status)}
        </Badge>
      ) : (
        <span className="shrink-0 w-[100px]" aria-hidden="true" />
      )}

      {/* Frist-Tage — kleine fixed-Breite rechts. */}
      <span
        className={`shrink-0 w-10 text-right tabular-nums text-[11px] ${
          fristCritical
            ? 'text-[var(--tf-danger-text)] font-medium'
            : 'text-[var(--tf-text-tertiary)]'
        }`}
      >
        {fristTxt}
      </span>
    </button>
  );
}

import { Badge } from '@/components/ui/badge';
import type { AntragGroup } from './antragGroups';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { AMPEL_COLOR, AMPEL_TOOLTIP } from './eingangAmpel';
import { daysUntilFristAware } from '@/core/services/csv/frist';
import {
  worstAmpel,
  criticalFristAware,
  dominantStatus,
  verbundFkz,
} from './groupAggregates';
import { StatusBarRow } from './StatusBarRow';
import { MaKuerzelBadge } from './MaKuerzelBadge';
import { useAntraegeStore } from './store';

interface Props {
  group: AntragGroup;
  selectedAktenzeichen: string | null;
  selectedVerbundId: string | null;
  /** „alle"-Modus → MA-Kürzel des Lead-TVs unter dem FKZ anzeigen. */
  showMa: boolean;
  onOpenAntrag: (aktenzeichen: string) => void;
  onOpenVerbund: (verbundId: string) => void;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/** Tage bis zur Frist (Phase-abhaengig). Positiv = Zeit uebrig ("+45d"),
 *  0 = heute, negativ = ueberfaellig ("-12d"). */
function formatFrist(d: number | null): string {
  if (d === null) return '';
  if (d === 0) return 'heute';
  if (d > 0) return `+${d}d`;
  return `${d}d`;
}

/**
 * Karten-Tile für die Förderanträge-Liste. Ein Tile = ein Verbund-Cluster
 * (≥ 1 TV). Layout (matched Design-Handoff):
 *
 *   ┌─────────────────────┐
 *   │ ▬▬▬▬           +N   │  ← StatusBarRow + TV-Total (rechts)
 *   │       AKRONYM       │  ← Hauptelement
 *   │     16VS251043      │  ← FKZ-Subtitle (mono, dezent)
 *   │   [Status-Pill]     │  ← Dominant-Status (Verbund.status oder Lead-TV)
 *   └─────────────────────┘
 *
 * Klick auf Verbund-Tile (≥ 2 TVs) öffnet die Verbund-Detail-Route, Solo-Tile
 * (1 TV) öffnet die Antrag-Detail-Route.
 */
export function AntragTile({
  group,
  selectedAktenzeichen,
  selectedVerbundId,
  showMa,
  onOpenAntrag,
  onOpenVerbund,
}: Props): React.ReactElement {
  const isVerbund = group.tvs.length >= 2;
  const headTv = group.tvs[0]!;
  const isNetzwerkSuper = group.netzwerkId !== null && group.netzwerkLabel !== null;

  // Verbund-Stammsatz: Status-Quelle und FKZ-Display ziehen aus dem Index.
  // Bei Netzwerk-Supergruppe (keine `verbundId`) bleibt `verbund` undefined —
  // Fallback auf Lead-TV-Status und FKZ-Range.
  const verbund = useAntraegeStore(s =>
    group.verbundId !== null ? s.verbundById.get(group.verbundId) : undefined,
  );

  const akronym = isNetzwerkSuper
    ? (group.netzwerkLabel!.split(' · ')[0] ?? group.netzwerkLabel!)
    : (strOrNull(headTv.akronym) ?? headTv.aktenzeichen);

  // FKZ-Subtitle: bei Verbund das Verbund-FKZ (oder Range), bei Solo direkt
  // das Aktenzeichen.
  const fkzSubtitle = isVerbund
    ? verbundFkz(verbund, group.tvs)
    : headTv.aktenzeichen;

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

  // Ampel + Frist (phase-abhaengig via csv/frist.ts):
  // - Antragsphase: antragsdatum + 90 Tage
  // - Begleitphase: vn_eingang_datum + 6 Monate
  // Negativ = ueberfaellig = rot.
  const ampel = worstAmpel(group.tvs);
  const frist = isVerbund ? criticalFristAware(group.tvs) : daysUntilFristAware(headTv);
  const fristTxt = formatFrist(frist);
  const fristCritical = frist !== null && frist < 0;

  // Dominanter Status für die Card-Pill (immer einheitlich, keine Dot-Row mehr —
  // die granularen TV-Stati sind über die StatusBarRow oben kodiert).
  const status = dominantStatus(group.tvs, verbund?.status);

  // Tooltip: bei Verbund Liste aller TVs → Status, sonst nur Head-TV.
  const titleText = isVerbund
    ? group.tvs
        .map(tv => {
          const az = tv.aktenzeichen;
          const s = strOrNull(tv.status);
          return s ? `${az} — ${getStatusLabel(s)}` : az;
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
      className={`group flex flex-col items-stretch justify-between rounded-[var(--tf-radius)] transition-colors text-left ${
        isSelected
          ? 'ring-2 ring-[var(--tf-primary)] bg-[var(--tf-bg-secondary)]'
          : 'hover:bg-[var(--tf-bg-secondary)]'
      }`}
      style={{
        border: '0.5px solid var(--tf-border)',
        minHeight: '88px',
        padding: '6px 8px',
      }}
    >
      {/* Top-Row: StatusBarRow (Balken pro TV) links, "+N"-TV-Total rechts.
          Ampel-Dot vor den Balken; Frist als kleiner Text nach +N. */}
      <div className="w-full flex items-center justify-between gap-1 min-w-0">
        <span className="inline-flex items-center gap-1.5 shrink-0">
          {ampel !== null ? (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: AMPEL_COLOR[ampel] }}
              aria-label={AMPEL_TOOLTIP[ampel]}
            />
          ) : null}
          <StatusBarRow tvs={group.tvs} />
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          {fristTxt ? (
            <span
              className={`tabular-nums text-[10px] ${
                fristCritical ? 'text-[var(--tf-danger-text)] font-medium' : 'text-[var(--tf-text-tertiary)]'
              }`}
            >
              {fristTxt}
            </span>
          ) : null}
          {isVerbund ? (
            <span className="text-[10px] text-[var(--tf-text-tertiary)] tabular-nums">
              +{group.tvs.length}
            </span>
          ) : null}
        </span>
      </div>

      {/* Akronym + FKZ-Subtitle vertikal gestapelt, beide zentriert. */}
      <div className="w-full flex flex-col items-center justify-center min-w-0 py-0.5 gap-0.5">
        <span className="font-semibold text-[13px] text-[var(--tf-text)] truncate max-w-full leading-tight">
          {akronym}
        </span>
        <span className="font-mono text-[9.5px] text-[var(--tf-text-tertiary)] truncate max-w-full leading-tight">
          {fkzSubtitle}
        </span>
        {showMa ? <MaKuerzelBadge kuerzel={headTv.tib_kuerz} /> : null}
      </div>

      {/* Status-Footer: einheitliche Dominant-Status-Pill. */}
      <div className="w-full flex items-center justify-center min-w-0">
        {status ? (
          <Badge
            variant={getStatusVariant(status)}
            className="text-[9px] px-1.5 py-0 leading-tight max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
          >
            {getStatusLabel(status)}
          </Badge>
        ) : null}
      </div>
    </button>
  );
}

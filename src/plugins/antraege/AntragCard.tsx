import { Badge } from '@/ui';
import type { AntragListItem } from '@/core/services/csv/types';
import { getStatusLabel, getStatusVariant } from '@/core/utils/status-mappings';
import { getVbPhaseLabel, getVbPhaseVariant } from '@/core/utils/vb-phase-mappings';
import {
  getEingangAmpel,
  daysSinceEingang,
  AMPEL_COLOR,
  AMPEL_TOOLTIP,
} from './eingangAmpel';

interface Props {
  antrag: AntragListItem;
  onClick: () => void;
  selected?: boolean;
  /** Kompakte Variante fuer den Split-View: weniger Subtext. */
  narrow?: boolean;
  /** Wenn true: Card ist ein Folge-Teilvorhaben eines Verbunds (TV 2..N).
   *  Wird leicht eingerückt mit linker Verbund-Klammer gerendert; Eingangs-
   *  Ampel und Akronym werden dezenter dargestellt — der Verbund-Kopf (TV 1)
   *  trägt die volle visuelle Hervorhebung. */
  verbundTail?: boolean;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function AntragCard({ antrag, onClick, selected = false, narrow = false, verbundTail = false }: Props): React.ReactElement {
  const titel = strOrNull(antrag.titel) ?? antrag.aktenzeichen;
  const akronym = strOrNull(antrag.akronym);
  const antragsteller = strOrNull(antrag.antragsteller);
  const status = strOrNull(antrag.status) ?? '';
  const phaseLabel = getVbPhaseLabel(antrag.vb_phase);

  const baseStyle = selected
    ? { background: 'var(--tf-bg-secondary)', borderColor: 'var(--tf-border-hover)' }
    : { borderColor: 'transparent' };

  // Eingangs-Ampel: Farbpunkt + Tagezahl inline vor dem Aktenzeichen; nur für
  // fachlich offene Anträge ohne `bewilligung_datum`. Bei Folge-TVs eines
  // Verbunds wird die Ampel ausgeblendet — der Verbund-Kopf trägt die Info.
  const ampel = verbundTail ? null : getEingangAmpel(antrag);
  const ampelDays = ampel !== null ? daysSinceEingang(antrag) : null;

  const padding = narrow ? 'px-3 py-1.5' : 'px-4 py-2.5';
  const akronymColor = verbundTail ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]';

  return (
    <div
      className="relative"
      style={verbundTail ? { paddingLeft: '24px' } : undefined}
    >
      {verbundTail ? (
        <span
          aria-hidden="true"
          className="absolute left-3 top-0 bottom-0 w-px"
          style={{ background: 'var(--tf-border-hover)' }}
        />
      ) : null}
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left ${padding} rounded-[var(--tf-radius)] transition-colors ${
          selected ? '' : 'hover:bg-[var(--tf-bg-secondary)]'
        }`}
        style={{ borderWidth: '0.5px', borderStyle: 'solid', ...baseStyle }}
      >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            {ampel !== null && ampelDays !== null ? (
              <span
                className="inline-flex items-center gap-1 shrink-0"
                title={`${AMPEL_TOOLTIP[ampel]} (${ampelDays} Tage)`}
              >
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ background: AMPEL_COLOR[ampel] }}
                  aria-hidden="true"
                />
                <span className={`tabular-nums text-[var(--tf-text-tertiary)] ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>
                  {ampelDays}d
                </span>
              </span>
            ) : null}
            <span className={`font-mono text-[var(--tf-text-tertiary)] ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>{antrag.aktenzeichen}</span>
            {akronym ? (
              <span className={`font-medium ${akronymColor} ${narrow ? 'text-[12.5px]' : 'text-[13px]'}`}>{akronym}</span>
            ) : null}
          </div>
          <div className={`text-[var(--tf-text-secondary)] truncate mt-0.5 ${narrow ? 'text-[12px]' : 'text-[12.5px]'}`}>
            {titel}
          </div>
          {!narrow && antragsteller ? (
            <div className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5 truncate">{antragsteller}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {phaseLabel ? (
            <Badge variant={getVbPhaseVariant(antrag.vb_phase)} className="min-w-[44px] justify-center">
              {phaseLabel}
            </Badge>
          ) : null}
          {status ? (
            <Badge variant={getStatusVariant(status)} className="min-w-[110px] justify-center whitespace-nowrap">
              {getStatusLabel(status)}
            </Badge>
          ) : null}
        </div>
      </div>
      </button>
    </div>
  );
}

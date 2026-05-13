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
import type { AntragGroup } from './antragGroups';
import { isNetzwerkLead } from './netzwerk';

interface Props {
  group: AntragGroup;
  selectedAktenzeichen: string | null;
  onOpenAntrag: (aktenzeichen: string) => void;
  onOpenVerbund: (verbundId: string) => void;
  /** Kompakte Variante für den Split-View: kleinere Schrift. */
  narrow?: boolean;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export function AntragGroupCard({
  group,
  selectedAktenzeichen,
  onOpenAntrag,
  onOpenVerbund,
  narrow = false,
}: Props): React.ReactElement {
  const headTv = group.tvs[0]!;
  const isMultiTv = group.tvs.length >= 2;

  // Eingangs-Ampel: aus dem führenden TV der Gruppe. Wenn der bewilligt /
  // abgeschlossen ist → kein Punkt im Header (auch wenn andere TVs noch
  // offen wären; das wäre semantisch verwirrend für die Gruppen-Ampel).
  const ampel = getEingangAmpel(headTv);
  const ampelDays = ampel !== null ? daysSinceEingang(headTv) : null;

  const phaseLabel = getVbPhaseLabel(headTv.vb_phase);
  const akronym = strOrNull(headTv.akronym);

  const onHeaderClick = (): void => {
    // Header-Klick öffnet Verbund-Detail nur bei echtem Cluster (≥ 2 TVs).
    // Solo-Verbund oder Einzelantrag → direkt zum TV-Detail des Head-TVs.
    if (isMultiTv && group.verbundId !== null) {
      onOpenVerbund(group.verbundId);
    } else {
      onOpenAntrag(headTv.aktenzeichen);
    }
  };

  // Verbund-Cluster (>= 2 TVs) bekommen eine linke 3px-Akzent-Bar in Primary-
  // Color, damit das Auge sie auf einen Blick als zusammengehoerige Gruppe
  // erkennt. Einzelantraege bleiben visuell flach.
  const cardStyle: React.CSSProperties = isMultiTv
    ? {
      borderWidth: '0.5px',
      borderStyle: 'solid',
      borderColor: 'transparent',
      borderLeftWidth: '3px',
      borderLeftColor: 'var(--tf-primary)',
    }
    : { borderWidth: '0.5px', borderStyle: 'solid', borderColor: 'transparent' };

  return (
    <div
      className="rounded-[var(--tf-radius)] py-1 flex items-start gap-2"
      style={cardStyle}
    >
      {/* Foerderart-Badge ganz links — konsistent mit der Home-Page-Liste,
          wo das Badge ebenfalls die linke Bound der Card markiert. Kein
          pl-padding hier, damit das Badge vertikal mit SortDropdown
          ("Sortiert: …") in der Toolbar alignt. */}
      <div className="shrink-0 pt-[6px]">
        {phaseLabel ? (
          <Badge
            variant={getVbPhaseVariant(headTv.vb_phase)}
            className="min-w-[44px] justify-center"
          >
            {phaseLabel}
          </Badge>
        ) : (
          <span className="block min-w-[44px]" aria-hidden="true" />
        )}
      </div>

      {/* Inhalts-Spalte: Header (Ampel + FKZ + Akronym) + TV-Zeilen. */}
      <div className="flex-1 min-w-0 pr-3">
        {/* Header-Zeile. */}
        <button
          type="button"
          onClick={onHeaderClick}
          className="w-full text-left px-2 py-1 rounded-[var(--tf-radius)] transition-colors hover:bg-[var(--tf-bg-secondary)]"
        >
          <div className="flex items-center gap-3 min-w-0">
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
            {group.netzwerkLabel ? (
              <span
                className={`font-medium shrink-0 ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}
                style={{ color: 'var(--tf-primary)' }}
              >
                {group.netzwerkLabel}
              </span>
            ) : null}
            <span className={`font-mono text-[var(--tf-text-tertiary)] shrink-0 ${narrow ? 'text-[10.5px]' : 'text-[11px]'}`}>
              {group.fkzRange}
            </span>
            {akronym ? (
              <span className={`font-medium text-[var(--tf-text)] truncate min-w-0 ${narrow ? 'text-[12.5px]' : 'text-[13px]'}`}>
                {akronym}
              </span>
            ) : null}
          </div>
        </button>

        {/* TV-Zeilen: Antragsteller — Titel + Status-Badge. Alle TVs sind
            einheitlich 20px eingerueckt; die Verbund-Klammer-Linie erscheint
            nur bei Cluster mit >= 2 TVs (mittig bei 10px in der Indent-Spur). */}
        <div className="flex flex-col">
          {group.tvs.map(tv => (
            <TvRow
              key={tv.aktenzeichen}
              tv={tv}
              showLine={isMultiTv}
              selected={selectedAktenzeichen === tv.aktenzeichen}
              onClick={() => onOpenAntrag(tv.aktenzeichen)}
              narrow={narrow}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TvRowProps {
  tv: AntragListItem;
  /** True wenn die Verbund-Klammer-Linie gerendert werden soll (>= 2 TVs).
   *  Die 20px-Einrueckung wird *immer* angewendet, damit Einzelantrag und
   *  Verbund-TV horizontal an derselben Position starten. */
  showLine: boolean;
  selected: boolean;
  onClick: () => void;
  narrow: boolean;
}

function TvRow({ tv, showLine, selected, onClick, narrow }: TvRowProps): React.ReactElement {
  const antragsteller = strOrNull(tv.antragsteller);
  const titel = strOrNull(tv.titel) ?? tv.aktenzeichen;
  const status = strOrNull(tv.status) ?? '';
  const lineText = antragsteller ? `${antragsteller} — ${titel}` : titel;
  const isLead = isNetzwerkLead(tv);

  return (
    <div className="relative" style={{ paddingLeft: '20px' }}>
      {showLine ? (
        <span
          aria-hidden="true"
          className="absolute left-[10px] top-0 bottom-0 w-px"
          style={{ background: 'var(--tf-border-hover)' }}
        />
      ) : null}
      <button
        type="button"
        onClick={onClick}
        title={lineText}
        className={`w-full text-left px-3 py-1 rounded-[var(--tf-radius)] transition-colors ${
          selected
            ? 'bg-[var(--tf-bg-secondary)]'
            : 'hover:bg-[var(--tf-bg-secondary)]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`truncate ${narrow ? 'text-[12px]' : 'text-[12.5px]'} text-[var(--tf-text-secondary)]`}>
            {lineText}
          </span>
          {isLead ? (
            <span
              className="shrink-0 inline-flex items-center rounded-full text-[10px] font-medium uppercase tracking-wider"
              style={{
                padding: '1px 6px',
                color: 'var(--tf-primary)',
                border: '0.5px solid var(--tf-primary)',
              }}
              title="Netzwerk-Lead (FKZ-Suffix 01/02, NW1/NW2)"
            >
              Lead
            </span>
          ) : null}
          <span className="flex-1" />
          {status ? (
            <Badge variant={getStatusVariant(status)} className="min-w-[110px] justify-center whitespace-nowrap shrink-0">
              {getStatusLabel(status)}
            </Badge>
          ) : null}
        </div>
      </button>
    </div>
  );
}

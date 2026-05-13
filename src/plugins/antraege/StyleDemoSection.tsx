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

/**
 * TEMPORÄRE Vergleichs-Section für Card-Style-Varianten. Sichtbar via
 * URL-Hash `#style-demo` (siehe AntraegeMain). Wird nach User-Entscheidung
 * komplett entfernt.
 */

type Variant = 'A' | 'B' | 'C' | 'D';

const SAMPLE_SINGLE: AntragListItem = {
  aktenzeichen: '16EP250140',
  programm_id: 'DEMO',
  _updated_at: '2026-05-12T00:00:00Z',
  akronym: 'CALYPSO',
  titel: 'CALYPSO / KI-gestützte Automatisierte Kalibrierung für Hyperspektrale Anwendungen',
  antragsteller: 'AIRMO GmbH',
  antragsdatum: '2026-02-09',
  status: 'Ablehnung',
  vb_phase: 3,
};

const SAMPLE_TV_1: AntragListItem = {
  aktenzeichen: '16KN110645',
  programm_id: 'DEMO',
  _updated_at: '2026-05-12T00:00:00Z',
  verbund_id: 'V-DEMO',
  akronym: 'LADScessible',
  titel: 'LADScessible / Entwicklung eines orchestrierten KI-Systems für das automatisierte Ableiten eines LADS OPC UA Informationsmodells',
  antragsteller: 'Institut für Umwelt & Energie, Technik & Analytik e.V. (IUTA)',
  antragsdatum: '2026-09-05',
  status: 'techn. geprüft',
  vb_phase: 3,
};

const SAMPLE_TV_2: AntragListItem = {
  aktenzeichen: '16KN110646',
  programm_id: 'DEMO',
  _updated_at: '2026-05-12T00:00:00Z',
  verbund_id: 'V-DEMO',
  akronym: 'LADScessible',
  titel: 'LADScessible / KI gestütztes Deployment von OPC UA LADS Informationsmodellen auf einer modularen Gateway Hardware',
  antragsteller: 'Wiens Synefex GmbH',
  antragsdatum: '2026-09-05',
  status: 'techn. geprüft',
  vb_phase: 3,
};

const SAMPLE_GROUPS: AntragGroup[] = [
  { verbundId: null, tvs: [SAMPLE_SINGLE], fkzRange: SAMPLE_SINGLE.aktenzeichen },
  {
    verbundId: 'V-DEMO',
    tvs: [SAMPLE_TV_1, SAMPLE_TV_2],
    fkzRange: '16KN110645–16KN110646',
  },
];

const VARIANT_LABELS: Record<Variant, { title: string; sub: string }> = {
  A: { title: 'Variante A — Subtiler Background-Tint', sub: 'Jede Card hat einen leichten Hintergrund, größerer Gap. Klassisches Card-Pattern.' },
  B: { title: 'Variante B — Untertrennlinie zwischen Cards', sub: 'Keine Background-Änderung, nur dünne Linie zwischen Cards. Minimal-invasiv.' },
  C: { title: 'Variante C — Linke Akzent-Bar nur bei Verbund', sub: 'Verbunde bekommen eine farbige linke Bar. Einzelanträge bleiben flach.' },
  D: { title: 'Variante D — Kombi A + C', sub: 'Background-Tint überall + Akzent-Bar bei Verbund. Maximaler visueller Halt.' },
};

export function StyleDemoSection(): React.ReactElement {
  return (
    <section
      className="rounded-[var(--tf-radius)] p-4 mb-6"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <h2 className="text-[14px] font-medium mb-1">
        Style-Vergleich (temporär — sichtbar via <span className="font-mono">#style-demo</span>)
      </h2>
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-5">
        Vier Varianten der gleichen Sample-Daten. Hash aus der URL entfernen → normale Liste.
      </p>
      {(['A', 'B', 'C', 'D'] as Variant[]).map(v => (
        <VariantBlock key={v} variant={v} />
      ))}
    </section>
  );
}

interface VariantBlockProps {
  variant: Variant;
}

function VariantBlock({ variant }: VariantBlockProps): React.ReactElement {
  const { title, sub } = VARIANT_LABELS[variant];
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2">
        <div className="text-[13px] font-medium text-[var(--tf-text)]">{title}</div>
        <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">{sub}</div>
      </div>
      <div className={variant === 'A' || variant === 'D' ? 'flex flex-col gap-2' : 'flex flex-col gap-1'}>
        {SAMPLE_GROUPS.map((g, idx) => (
          <DemoCardWrapper
            key={g.tvs[0]!.aktenzeichen}
            group={g}
            variant={variant}
            isLast={idx === SAMPLE_GROUPS.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

interface DemoCardWrapperProps {
  group: AntragGroup;
  variant: Variant;
  isLast: boolean;
}

function DemoCardWrapper({ group, variant, isLast }: DemoCardWrapperProps): React.ReactElement {
  return (
    <>
      <DemoCard group={group} variant={variant} />
      {variant === 'B' && !isLast ? (
        <hr className="my-0" style={{ border: 0, borderTop: '0.5px solid var(--tf-border)' }} />
      ) : null}
    </>
  );
}

interface DemoCardProps {
  group: AntragGroup;
  variant: Variant;
}

function DemoCard({ group, variant }: DemoCardProps): React.ReactElement {
  const headTv = group.tvs[0]!;
  const isMultiTv = group.tvs.length >= 2;
  const ampel = getEingangAmpel(headTv);
  const ampelDays = ampel !== null ? daysSinceEingang(headTv) : null;
  const phaseLabel = getVbPhaseLabel(headTv.vb_phase);
  const akronym = strOrNull(headTv.akronym);

  const useTint = variant === 'A' || variant === 'D';
  const useAccentBar = (variant === 'C' || variant === 'D') && isMultiTv;

  const cardStyle: React.CSSProperties = {
    borderWidth: '0.5px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    ...(useTint ? { background: 'var(--tf-bg-secondary)' } : {}),
    ...(useAccentBar
      ? {
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--tf-primary)',
      }
      : {}),
  };

  return (
    <div
      className="rounded-[var(--tf-radius)] py-1 flex items-start gap-2"
      style={cardStyle}
    >
      <div className="shrink-0 pt-[6px]">
        {phaseLabel ? (
          <Badge variant={getVbPhaseVariant(headTv.vb_phase)} className="min-w-[44px] justify-center">
            {phaseLabel}
          </Badge>
        ) : (
          <span className="block min-w-[44px]" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0 pr-3">
        <div className="w-full text-left px-2 py-1 rounded-[var(--tf-radius)]">
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
                <span className="tabular-nums text-[var(--tf-text-tertiary)] text-[11px]">
                  {ampelDays}d
                </span>
              </span>
            ) : null}
            <span className="font-mono text-[var(--tf-text-tertiary)] shrink-0 text-[11px]">
              {group.fkzRange}
            </span>
            {akronym ? (
              <span className="font-medium text-[var(--tf-text)] truncate min-w-0 text-[13px]">
                {akronym}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col">
          {group.tvs.map(tv => (
            <DemoTvRow key={tv.aktenzeichen} tv={tv} showLine={isMultiTv} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DemoTvRowProps {
  tv: AntragListItem;
  showLine: boolean;
}

function DemoTvRow({ tv, showLine }: DemoTvRowProps): React.ReactElement {
  const antragsteller = strOrNull(tv.antragsteller);
  const titel = strOrNull(tv.titel) ?? tv.aktenzeichen;
  const status = strOrNull(tv.status) ?? '';
  const lineText = antragsteller ? `${antragsteller} — ${titel}` : titel;

  return (
    <div className="relative" style={{ paddingLeft: '20px' }}>
      {showLine ? (
        <span
          aria-hidden="true"
          className="absolute left-[10px] top-0 bottom-0 w-px"
          style={{ background: 'var(--tf-border-hover)' }}
        />
      ) : null}
      <div className="w-full text-left px-3 py-1 rounded-[var(--tf-radius)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-[12.5px] text-[var(--tf-text-secondary)]">
            {lineText}
          </span>
          <span className="flex-1" />
          {status ? (
            <Badge variant={getStatusVariant(status)} className="min-w-[110px] justify-center whitespace-nowrap shrink-0">
              {getStatusLabel(status)}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

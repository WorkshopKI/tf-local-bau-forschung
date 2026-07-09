import { DistributionBar, type DistributionSegment } from '@/components/ui/DistributionBar';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { formatGermanDate } from '@/core/services/csv';
import type { AntragVorgang } from './useDashboardData';
import { bucketMeineAntraege, type QuartalBucket, type QuartalBucketIndex } from './quartalBuckets';

/**
 * Home-Rückstands-Balken: verteilt die eigenen offenen Anträge nach dem Alter
 * ihres Antragsdatums auf vier Quartals-Segmente (Ab Q-3 · Q-2 · Q-1 · akt.
 * Quartal) und zeigt beim Hover die konkreten Anträge je Segment — dieselbe
 * Mini-Tabelle wie der Auslastungs-Altlast-Tooltip (FKZ/Akronym/Status/Datum/TVS).
 *
 * Domänen-Schicht über dem generischen `DistributionBar`: hier leben die
 * Quartals-Buckets, Farb-/Label-Zuordnung und der Antrags-Tooltip.
 */

/** Farb-/Label-Zuordnung je Bucket (0 = aktuell … 3 = Q-3 und älter).
 *  Farben referenzieren die globalen `--tf-altlast-band-*`-Tokens (Token-Vertrag:
 *  mit Fallback), aktuelles Quartal nutzt den hellen 4.-Stufen-Token. */
const BUCKET_META: Record<QuartalBucketIndex, {
  color: string;
  textColor: string;
  legendLabel: string;
  fullLabel: string;
}> = {
  0: {
    color: 'var(--tf-altlast-band-akt, hsl(215, 10%, 90%))',
    textColor: 'var(--tf-altlast-band-akt-text, hsl(215, 20%, 32%))',
    legendLabel: 'akt. Quartal',
    fullLabel: 'aktuelles Quartal',
  },
  1: {
    color: 'var(--tf-altlast-band-1, hsl(215, 12%, 83%))',
    textColor: 'var(--tf-altlast-band-1-text, hsl(215, 20%, 32%))',
    legendLabel: 'Q-1',
    fullLabel: 'letztes Quartal (Q-1)',
  },
  2: {
    color: 'var(--tf-altlast-band-2, hsl(215, 14%, 74%))',
    textColor: 'var(--tf-altlast-band-2-text, hsl(215, 20%, 32%))',
    legendLabel: 'Q-2',
    fullLabel: 'vorletztes Quartal (Q-2)',
  },
  3: {
    color: 'var(--tf-altlast-band-3, hsl(215, 18%, 64%))',
    textColor: 'var(--tf-altlast-band-3-text, #ffffff)',
    legendLabel: 'Ab Q-3',
    fullLabel: 'älter (ab Q-3)',
  },
};

/** Render-Reihenfolge der Segmente: alt → neu (links → rechts). */
const RENDER_ORDER: readonly QuartalBucketIndex[] = [3, 2, 1, 0];

const TT_GRID = 'grid items-baseline gap-x-2 grid-cols-[72px_104px_86px_60px_28px]';
const TT_MAX_ROWS = 10;

/** Segment-Tooltip — spiegelt den Auslastungs-Altlast-Tooltip (`AltlastSegmentTooltip`). */
function QuartalTooltip({ bucket }: { bucket: QuartalBucket }): React.ReactElement {
  const meta = BUCKET_META[bucket.index];
  const shown = bucket.rows.slice(0, TT_MAX_ROWS);
  const rest = bucket.rows.length - shown.length;
  return (
    <div style={{ minWidth: 300 }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          aria-hidden
          style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flex: '0 0 auto' }}
        />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--tf-text-secondary)' }}>
          {meta.fullLabel} · {bucket.count} {bucket.count === 1 ? 'Antrag' : 'Anträge'} · {bucket.tvs} TVs
        </span>
      </div>
      <div className={`${TT_GRID} text-[8.5px] uppercase tracking-wider pb-1`} style={{ color: 'var(--tf-text-tertiary)' }}>
        <span>FKZ</span>
        <span>Akronym</span>
        <span>Status</span>
        <span>Datum</span>
        <span className="text-right">TVs</span>
      </div>
      <ul className="flex flex-col gap-y-0.5">
        {shown.map((v) => {
          const label = v.acronym || v.verbund_titel || v.title || '—';
          const statusLabel = v.status ? getStatusLabel(v.status) : '';
          return (
            <li key={v.id} className={`${TT_GRID} text-[11px]`}>
              <span className="font-mono truncate" style={{ color: 'var(--tf-text-tertiary)' }}>{v.id}</span>
              <span className="truncate" style={{ color: 'var(--tf-text)' }}>{label}</span>
              <span className="truncate" style={{ color: 'var(--tf-text-secondary)' }}>{statusLabel}</span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--tf-text-tertiary)' }}>{formatGermanDate(v.antragsdatum)}</span>
              <span className="tabular-nums text-right" style={{ color: 'var(--tf-text-secondary)' }}>{v.tv_count ?? 1}</span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <div className="mt-1 text-[10px]" style={{ color: 'var(--tf-text-tertiary)' }}>
          +{rest} weitere …
        </div>
      )}
    </div>
  );
}

interface Props {
  /** Alle offenen eigenen Förderanträge (Kürzel-gefiltert, Verbund-geclustert). */
  antraege: AntragVorgang[];
}

export function MeineAntraegeBalken({ antraege }: Props): React.ReactElement | null {
  const { navigate } = useNavigation();
  const { buckets, totalAntraege, totalTvs } = bucketMeineAntraege(antraege, new Date());

  // Kein datierbarer Antrag → kein leerer Balken.
  if (totalAntraege === 0) return null;

  // Gleiche Navigation wie „Alle →" in MeineAntraegeSection: View „Offen" + Frist-Sort.
  const handleZuAntraegen = (): void => {
    const store = useAntraegeStore.getState();
    store.setActiveView('meine_offenen');
    store.setSortForView('meine_offenen', 'frist_asc');
    navigate('antraege');
  };

  const segments: DistributionSegment[] = RENDER_ORDER
    .map((idx) => ({ bucket: buckets[idx], meta: BUCKET_META[idx] }))
    .filter(({ bucket }) => bucket.count > 0)
    .map(({ bucket, meta }) => ({
      key: String(bucket.index),
      count: bucket.count,
      color: meta.color,
      textColor: meta.textColor,
      legendLabel: meta.legendLabel,
      tooltip: <QuartalTooltip bucket={bucket} />,
    }));

  return (
    <div className="mb-6 border border-[var(--tf-border)] rounded-[var(--tf-radius-lg)] bg-[var(--tf-card-surface)] px-[18px] pt-4 pb-[18px]">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
          <span className="font-medium tabular-nums text-[var(--tf-text)]">{totalAntraege}</span> Anträge ·{' '}
          <span className="font-medium tabular-nums text-[var(--tf-text)]">{totalTvs}</span> TVS
        </span>
        <button
          onClick={handleZuAntraegen}
          className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer"
        >
          Zu meinen Anträgen →
        </button>
      </div>
      <DistributionBar segments={segments} />
    </div>
  );
}

/**
 * Gestapelter Kostenbalken über dem geteilten `DistributionBar`.
 *
 * Rein darstellend: Beträge, Anteile und Deckkräfte kommen fertig aus
 * `ansicht/kosten-segmente.ts`. Hier passiert nur die Zuordnung auf die
 * Segment-Props und die Formatierung.
 */
import { DistributionBar, type DistributionSegment } from '@/components/ui/DistributionBar';
import type { KostenSegment } from '../ansicht/kosten-segmente';
import { summenAbweichung } from '../ansicht/kosten-segmente';
import type { MapKosten } from '../types';

const euro = (n: number): string =>
  n.toLocaleString('de-DE', { maximumFractionDigits: 0 });

function SegmentTooltip({ segment }: { segment: KostenSegment }): React.ReactElement {
  return (
    <div className="text-[12.5px]">
      <p className="font-medium text-[var(--tf-text)]">{segment.label}</p>
      <p className="text-[var(--tf-text-secondary)] mt-0.5 tabular-nums">
        {euro(segment.betrag)} € · {(segment.anteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %
      </p>
    </div>
  );
}

export function KostenBalken({
  kosten, segmente,
}: {
  kosten: MapKosten;
  segmente: readonly KostenSegment[];
}): React.ReactElement {
  if (segmente.length === 0) {
    return (
      <p className="text-[13px] text-[var(--tf-text-secondary)]">
        Keine Kostenarten erfasst.
      </p>
    );
  }

  const abweichung = summenAbweichung(kosten, segmente);

  const segments: DistributionSegment[] = segmente.map(s => ({
    key: s.key,
    count: Math.round(s.betrag),
    color: `color-mix(in srgb, var(--tf-primary) ${Math.round(s.deckkraft * 100)}%, var(--tf-bg))`,
    textColor: s.deckkraft > 0.6 ? 'var(--tf-on-primary)' : 'var(--tf-text)',
    legendLabel: s.label,
    tooltip: <SegmentTooltip segment={s} />,
  }));

  return (
    <div className="flex flex-col gap-2">
      <DistributionBar segments={segments} />
      {abweichung !== null && (
        <p className="text-[12px]" style={{ color: 'var(--tf-warning-text)' }}>
          Die Summe der Kostenarten weicht um {euro(abweichung)} € von den
          ausgewiesenen Gesamtkosten ab.
        </p>
      )}
    </div>
  );
}

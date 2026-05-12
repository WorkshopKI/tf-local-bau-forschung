import { useMemo } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useFilteredAntraege } from '@/plugins/antraege/useFilteredAntraege';
import { countByAmpelBucket } from '@/plugins/antraege/eingangAmpel';

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Antragseingang-Ampel als Home-Sidebar-Karte. Zählt offene Anträge
 * (= `bewilligung_datum` leer) in drei Buckets:
 * - Frisch (≤ 30 Tage)        → grün
 * - Warnung (31–90 Tage)      → gelb/orange
 * - Kritisch (> 90 Tage)      → rot
 *
 * Die internen 4 Stufen (gelb 31–60 / orange 61–90) sind auf der
 * AntragCard sichtbar; hier in der Home-Übersicht aggregiert auf
 * 3 visuelle Stufen, weil das für eine Schnellübersicht reicht.
 *
 * Reine Info-Anzeige: nicht klickbar — die Ampel-Information ist über
 * den farbigen Punkt + Tagezahl in jeder Listenzeile direkt verfügbar.
 *
 * Counts berücksichtigen den Profil-Bearbeiter-Filter (`bearbeiterFilter`
 * aus useFilteredAntraege) — sonst zeigt die Home andere Zahlen als die
 * Header-Tabs auf /antraege.
 */
export function EingangAmpelCard(): React.ReactElement | null {
  const antraege = useAntraegeStore(s => s.antraege);
  const { bearbeiterFilter } = useFilteredAntraege();

  const counts = useMemo(() => ({
    frisch: countByAmpelBucket(antraege, 'frisch', bearbeiterFilter),
    warnung: countByAmpelBucket(antraege, 'warnung', bearbeiterFilter),
    kritisch: countByAmpelBucket(antraege, 'kritisch', bearbeiterFilter),
  }), [antraege, bearbeiterFilter]);

  const total = counts.frisch + counts.warnung + counts.kritisch;
  if (total === 0) return null;

  return (
    <div className="bg-[var(--tf-bg-secondary)] rounded-[var(--tf-radius)] p-4">
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3 uppercase tracking-[0.08em]">
        Antragseingang
      </p>
      <div className="flex flex-col gap-0.5">
        <AmpelRow
          color="var(--tf-success-text)"
          label="Frisch"
          sub="≤ 30 Tage"
          count={counts.frisch}
        />
        <AmpelRow
          color="var(--tf-warning-text)"
          label="Warnung"
          sub="31–90 Tage"
          count={counts.warnung}
        />
        <AmpelRow
          color="var(--tf-danger-text)"
          label="Kritisch"
          sub="> 90 Tage"
          count={counts.kritisch}
        />
      </div>
    </div>
  );
}

interface RowProps {
  color: string;
  label: string;
  sub: string;
  count: number;
}

function AmpelRow({ color, label, sub, count }: RowProps): React.ReactElement {
  return (
    <div
      title={`${label} (${sub})`}
      className="flex items-center gap-2 px-1 py-1"
    >
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] text-[var(--tf-text)] leading-tight">{label}</span>
        <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] leading-tight">{sub}</span>
      </span>
      <span className="text-[13px] tabular-nums text-[var(--tf-text)] font-medium">
        {fmt(count)}
      </span>
    </div>
  );
}

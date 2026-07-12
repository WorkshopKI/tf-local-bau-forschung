import { useEingangAmpelCounts, type EingangAmpelCounts } from './useEingangAmpelCounts';
import { WidgetShell } from './widgets/WidgetShell';
import type { WidgetProps } from './widgets/widgetProps';

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Antragseingang-Ampel als Home-Widget (Seitenspalte). Zählt offene Anträge
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
 * (Klickbare Zeilen kommen in Phase 3 über die Widget-Config.)
 *
 * Counts berücksichtigen den Profil-Bearbeiter-Filter (`bearbeiterFilter`
 * aus useFilteredAntraege) — sonst zeigt die Home andere Zahlen als die
 * Header-Tabs auf /antraege. Eingeklappt zeigt der Zähler-Slot die drei
 * Zahlen als farbige Punkte-Pills.
 */
export function AntragseingangWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const counts = useEingangAmpelCounts();

  if (counts.total === 0) return null;

  return (
    <WidgetShell
      titel="Antragseingang"
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      zaehler={<AmpelZaehlerPills counts={counts} />}
    >
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
    </WidgetShell>
  );
}

/** Drei-Zahlen-Zähler für den Shell-Kopf (eingeklappt die einzige Anzeige). */
function AmpelZaehlerPills({ counts }: { counts: EingangAmpelCounts }): React.ReactElement {
  const pill = (color: string, count: number, label: string): React.ReactElement => (
    <span
      title={label}
      className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[var(--tf-text-secondary)]"
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />
      {fmt(count)}
    </span>
  );
  return (
    <>
      {pill('var(--tf-success-text)', counts.frisch, 'Frisch (≤ 30 Tage)')}
      {pill('var(--tf-warning-text)', counts.warnung, 'Warnung (31–90 Tage)')}
      {pill('var(--tf-danger-text)', counts.kritisch, 'Kritisch (> 90 Tage)')}
    </>
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

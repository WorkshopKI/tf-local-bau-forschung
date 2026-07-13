import { useNavigation } from '@/core/hooks/useNavigation';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { bearbeiterScopeLabel, parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
import {
  AMPEL_SCHWELLEN_DEFAULT,
  type AmpelBucket,
  type AmpelSchwellen,
} from '@/plugins/antraege/eingangAmpel';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useEingangAmpelCounts, type EingangAmpelCounts } from './useEingangAmpelCounts';
import { ampelSchwellenAusConfig } from './widgets/homeWidgetsStore';
import { useHomeWidgetsStore } from './widgets/useHomeWidgets';
import { WidgetShell } from './widgets/WidgetShell';
import type { WidgetProps } from './widgets/widgetProps';

const fmt = (n: number): string => n.toLocaleString('de-DE');

/**
 * Antragseingang-Ampel als Home-Widget (Seitenspalte). Zählt offene Anträge
 * (= `bewilligung_datum` leer) in drei Buckets — Grenzen aus der Widget-Config
 * (Default frisch ≤ 30 / warnung ≤ 90 / kritisch > 90 Tage; Phase 3).
 *
 * Die internen 4 Stufen (gelb 31–60 / orange 61–90) sind auf der AntragCard
 * sichtbar und bleiben FIX — konfigurierbare Schwellen wirken nur über den
 * Aggregations-Hook (useEingangAmpelCounts), der auch die Home-Kopfzeile
 * speist (gleiche `ampelSchwellenAusConfig`-Quelle → kein Zahlen-Drift).
 *
 * Zeilen sind seit v2.229 KLICKBAR (Config `zeilenKlickbar`, Default true):
 * Klick öffnet die Antragsliste mit passendem Ampel-Quickfilter — aus einem
 * Widget heraus ist Navigation erwartbar. (Ersetzt die alte Entscheidung
 * „Reine Info-Anzeige: nicht klickbar — die Ampel-Information ist über den
 * farbigen Punkt + Tagezahl in jeder Listenzeile direkt verfügbar.")
 */
export function AntragseingangWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const widgetConfig = useHomeWidgetsStore(s => s.config);
  const schwellen = ampelSchwellenAusConfig(widgetConfig);
  const counts = useEingangAmpelCounts(schwellen);
  const zeilenKlickbar = instanz.config.art === 'ampel' ? instanz.config.zeilenKlickbar : true;

  // Modus sichtbar (v1.1): dieselbe Bearbeiter-Semantik, die useEingangAmpelCounts
  // intern zählt — „Kürzel THU" vs. „Alle Bearbeiter".
  const scopeLabel = bearbeiterScopeLabel(
    parseBearbeiterFilter(meinKuerzel, profile?.bearbeiter_inkl_begleitung),
  );

  if (counts.total === 0) return null;

  const openListe = (bucket: AmpelBucket): void => {
    const store = useAntraegeStore.getState();
    // Reihenfolge: setActiveView resettet den Quickfilter → danach setzen.
    store.setActiveView('meine_offenen');
    store.setAmpelQuickfilter({ bucket, schwellen });
    navigate('antraege');
  };

  const angepasst = schwellen.warnschwelleTage !== AMPEL_SCHWELLEN_DEFAULT.warnschwelleTage
    || schwellen.kritischSchwelleTage !== AMPEL_SCHWELLEN_DEFAULT.kritischSchwelleTage;

  // Zähler-Pills NUR eingeklappt — ausgeklappt stehen dieselben drei Zahlen als
  // Zeilen (Frisch/Warnung/Kritisch) direkt darunter, die Kopf-Pills wären
  // doppelt. Eingeklappt sind sie die einzige sichtbare Anzeige.
  const zaehlerPills = instanz.eingeklappt
    ? <AmpelZaehlerPills counts={counts} schwellen={schwellen} />
    : undefined;

  return (
    <WidgetShell
      titel="Antragseingang"
      meta={scopeLabel}
      variante="seite"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={zaehlerPills}
    >
      <div className="flex flex-col gap-0.5">
        <AmpelRow
          color="var(--tf-success-text)"
          label="Frisch"
          sub={`≤ ${schwellen.warnschwelleTage} Tage`}
          count={counts.frisch}
          onClick={zeilenKlickbar ? () => openListe('frisch') : undefined}
        />
        <AmpelRow
          color="var(--tf-warning-text)"
          label="Warnung"
          sub={`${schwellen.warnschwelleTage + 1}–${schwellen.kritischSchwelleTage} Tage`}
          count={counts.warnung}
          onClick={zeilenKlickbar ? () => openListe('warnung') : undefined}
        />
        <AmpelRow
          color="var(--tf-danger-text)"
          label="Kritisch"
          sub={`> ${schwellen.kritischSchwelleTage} Tage`}
          count={counts.kritisch}
          onClick={zeilenKlickbar ? () => openListe('kritisch') : undefined}
        />
      </div>
      {angepasst || zeilenKlickbar ? (
        <p className="mt-2 text-[10.5px] leading-snug text-[var(--tf-text-tertiary)]">
          {angepasst ? `Schwellen angepasst: ${schwellen.warnschwelleTage}/${schwellen.kritischSchwelleTage} Tage` : null}
          {angepasst && zeilenKlickbar ? ' · ' : null}
          {zeilenKlickbar ? 'Zeile öffnet gefilterte Liste' : null}
        </p>
      ) : null}
    </WidgetShell>
  );
}

/** Drei-Zahlen-Zähler für den Shell-Kopf (eingeklappt die einzige Anzeige). */
function AmpelZaehlerPills({ counts, schwellen }: { counts: EingangAmpelCounts; schwellen: AmpelSchwellen }): React.ReactElement {
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
      {pill('var(--tf-success-text)', counts.frisch, `Frisch (≤ ${schwellen.warnschwelleTage} Tage)`)}
      {pill('var(--tf-warning-text)', counts.warnung, `Warnung (${schwellen.warnschwelleTage + 1}–${schwellen.kritischSchwelleTage} Tage)`)}
      {pill('var(--tf-danger-text)', counts.kritisch, `Kritisch (> ${schwellen.kritischSchwelleTage} Tage)`)}
    </>
  );
}

interface RowProps {
  color: string;
  label: string;
  sub: string;
  count: number;
  onClick?: () => void;
}

function AmpelRow({ color, label, sub, count, onClick }: RowProps): React.ReactElement {
  const inhalt = (
    <>
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[12.5px] text-[var(--tf-text)] leading-tight">{label}</span>
        <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] leading-tight">{sub}</span>
      </span>
      <span className="text-[13px] tabular-nums text-[var(--tf-text)] font-medium">
        {fmt(count)}
      </span>
    </>
  );
  if (!onClick) {
    return (
      <div title={`${label} (${sub})`} className="flex items-center gap-2 px-1 py-1">
        {inhalt}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${sub}) — gefilterte Liste öffnen`}
      className="flex items-center gap-2 px-1 py-1 w-full rounded-[var(--tf-radius-sm)] cursor-pointer hover:bg-[var(--tf-bg-secondary)] transition-colors"
    >
      {inhalt}
    </button>
  );
}

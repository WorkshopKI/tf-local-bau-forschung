/**
 * Schritt „Vorhaben kompakt": Warnbanner, Eckdaten, Arbeitspakete im
 * Zeitverlauf, Kostenverteilung, Antragsteller, unscharfe Angaben.
 *
 * Rein darstellend. Alle Zahlen und Positionen kommen fertig aus den reinen
 * Ableitungen (`ansicht/*`, `import/rechenchecks`); diese Datei rechnet nichts
 * — auch die Anzahl der Warnungen wird gezählt, nicht geschrieben.
 */
import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { baueGanttDaten } from '../ansicht/gantt-daten';
import { baueKostenSegmente } from '../ansicht/kosten-segmente';
import { formatDatum } from '../import/laufzeit';
import { AP_PM_GRENZE } from '../import/rechenchecks';
import type { MapEinreichung, RechenBefund } from '../types';
import { ApGantt } from './ApGantt';
import { BefundAmpel } from './BefundListe';
import { Banner, Karte } from './Karte';
import { KostenBalken } from './KostenBalken';
import { UnschaerfeListe } from './UnschaerfeListe';

function Kpi({ label, wert, hinweis, warnt = false }: {
  label: string; wert: string; hinweis?: string; warnt?: boolean;
}): React.ReactElement {
  return (
    <div
      className="rounded-[10px] bg-[var(--tf-sheet)] px-3.5 py-3 min-w-0"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="block text-[10.5px] uppercase tracking-[0.05em] text-[var(--tf-text-tertiary)]">
        {label}
      </span>
      <span
        className="block text-[20px] font-medium tabular-nums mt-1.5 truncate"
        style={{ color: warnt ? 'var(--tf-warning-text)' : 'var(--tf-text)' }}
      >
        {wert}
      </span>
      {hinweis != null && (
        <span className="block text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">{hinweis}</span>
      )}
    </div>
  );
}

const euro = (n: number | null): string =>
  n === null ? '—' : `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

export function VorhabenKompakt({ einreichung, befunde, substanz, gliederung }: {
  einreichung: MapEinreichung;
  befunde: readonly RechenBefund[];
  substanz: {
    unschaerfe: React.ComponentProps<typeof UnschaerfeListe>['begriffe'];
    erledigteAusloeser: React.ComponentProps<typeof UnschaerfeListe>['erledigteAusloeser'];
    nachfordernUnschaerfe: React.ComponentProps<typeof UnschaerfeListe>['onNachfordern'];
  };
  gliederung: React.ComponentProps<typeof UnschaerfeListe>['gliederung'];
}): React.ReactElement {
  const gantt = useMemo(() => baueGanttDaten(einreichung, AP_PM_GRENZE), [einreichung]);
  const segmente = useMemo(() => baueKostenSegmente(einreichung.kosten), [einreichung]);

  const auffaellig = befunde.filter(b => b.schwere === 'fehler' || b.schwere === 'warnung');
  const nnAnteil = einreichung.summen.nnAnteil;

  return (
    <div className="flex flex-col gap-4">
      {auffaellig.length > 0 && (
        <Banner
          ton="warn"
          symbol={<TriangleAlert size={17} />}
          titel={`${auffaellig.length} ${auffaellig.length === 1 ? 'Warnung' : 'Warnungen'} aus den Rechenchecks`}
        >
          <ul className="list-disc pl-4 leading-[1.5]">
            {auffaellig.map(b => <li key={b.id}>{b.titel}</li>)}
          </ul>
        </Banner>
      )}

      <Karte titel="Eckdaten" kopfRechts={<BefundAmpel befunde={befunde} />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Kpi
            label="Laufzeit"
            wert={einreichung.laufzeit.monate === null ? '—' : `${einreichung.laufzeit.monate} Monate`}
            hinweis={`${formatDatum(einreichung.laufzeit.start)} – ${formatDatum(einreichung.laufzeit.ende)}`}
          />
          <Kpi
            label="Gesamtkosten"
            wert={euro(einreichung.kosten.gesamt)}
            hinweis={einreichung.kosten.foerdersatz === null
              ? 'Fördersatz unbekannt'
              : `${(einreichung.kosten.foerdersatz * 100).toLocaleString('de-DE')} % Fördersatz`}
          />
          <Kpi label="Zuwendung" wert={euro(einreichung.kosten.beantragteZuwendung)} hinweis="beantragt" />
          <Kpi
            label="Personenmonate"
            wert={einreichung.summen.personenmonateEinsatz === null
              ? '—'
              : einreichung.summen.personenmonateEinsatz.toLocaleString('de-DE')}
            hinweis={nnAnteil === null
              ? undefined
              : `${(nnAnteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % nicht benannt`}
            warnt={nnAnteil !== null && nnAnteil > 0}
          />
        </div>
      </Karte>

      <Karte
        titel="Arbeitspakete im Zeitverlauf"
        kopfRechts={`Grenze ${AP_PM_GRENZE} PM je Arbeitspaket`}
      >
        <ApGantt daten={gantt} />
      </Karte>

      <Karte titel="Kostenverteilung">
        <KostenBalken kosten={einreichung.kosten} segmente={segmente} />
      </Karte>

      {einreichung.antragsteller.kurzprofil != null && (
        <Karte titel="Antragsteller">
          <p className="text-[13px] leading-[1.5] text-[var(--tf-text-secondary)] whitespace-pre-line">
            {einreichung.antragsteller.kurzprofil}
          </p>
        </Karte>
      )}

      <Karte titel="Unscharfe Angaben">
        <UnschaerfeListe
          begriffe={substanz.unschaerfe}
          gliederung={gliederung}
          erledigteAusloeser={substanz.erledigteAusloeser}
          onNachfordern={substanz.nachfordernUnschaerfe}
        />
      </Karte>
    </div>
  );
}

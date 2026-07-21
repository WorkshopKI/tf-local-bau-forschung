/**
 * „Vorhaben kompakt" — KPI-Zeile, Arbeitspakete im Zeitverlauf, Kostenverteilung,
 * Rechenbefunde und der Import-Report.
 *
 * Rein darstellend. Alle Zahlen und Positionen kommen fertig aus den reinen
 * Ableitungen (`ansicht/*`, `import/rechenchecks`); diese Datei rechnet nichts.
 */
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { useMemo, useState } from 'react';
import { baueGanttDaten } from '../ansicht/gantt-daten';
import { baueKostenSegmente } from '../ansicht/kosten-segmente';
import { formatDatum } from '../import/laufzeit';
import { AP_PM_GRENZE } from '../import/rechenchecks';
import { useMapPruefung } from '../useMapPruefung';
import { useMapVb } from '../useMapVb';
import type { MapEinreichung, MapImportReport } from '../types';
import { AbschlussPanel } from './AbschlussPanel';
import { ApGantt } from './ApGantt';
import { BefundAmpel, BefundListe } from './BefundListe';
import { ChecklistePanel } from './ChecklistePanel';
import { ChecklistenEditor } from './ChecklistenEditor';
import { ImportReportPanel } from './ImportReportPanel';
import { KostenBalken } from './KostenBalken';
import { ProjektCanvas } from './ProjektCanvas';
import { ReaderLite } from './ReaderLite';
import { SdtDeltaKarte } from './SdtDeltaKarte';
import { VbPanel } from './VbPanel';
import { WirkungsketteAnsicht } from './WirkungsketteAnsicht';
import { pruefeRichtwerte } from '../infografik/richtwerte';

function Kpi({ label, wert, hinweis }: {
  label: string; wert: string; hinweis?: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)] uppercase tracking-wide">{label}</span>
      <span className="text-[16px] font-medium text-[var(--tf-text)] tabular-nums">{wert}</span>
      {hinweis != null && (
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{hinweis}</span>
      )}
    </div>
  );
}

function Karte({ titel, kopfRechts, children }: {
  titel: string; kopfRechts?: React.ReactNode; children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      className="rounded-[var(--tf-radius-lg,10px)] bg-[var(--tf-card-surface,var(--tf-bg))] px-[18px] py-4"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[14px] font-medium text-[var(--tf-text)]">{titel}</h2>
        {kopfRechts}
      </div>
      {children}
    </section>
  );
}

const euro = (n: number | null): string =>
  n === null ? '—' : `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;

export function KompaktAnsicht({
  einreichung, report,
}: {
  einreichung: MapEinreichung;
  report: MapImportReport | null;
}): React.ReactElement {
  const [sicht, setSicht] = useState('kompakt');

  const gantt = useMemo(() => baueGanttDaten(einreichung, AP_PM_GRENZE), [einreichung]);
  const segmente = useMemo(() => baueKostenSegmente(einreichung.kosten), [einreichung]);
  const befunde = useMemo(() => report?.befunde ?? [], [report]);

  const pruefung = useMapPruefung(einreichung, befunde);
  const vb = useMapVb(einreichung);
  const nnAnteil = einreichung.summen.nnAnteil;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[19px] font-medium text-[var(--tf-text)] leading-snug">
          {einreichung.stamm.titel ?? 'Ohne Titel'}
        </h1>
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] mt-1">
          {einreichung.stamm.akronym ?? '—'} · importiert am{' '}
          {formatDatum(einreichung.importiertAm.slice(0, 10))}
          {einreichung.importiertVon != null && ` von ${einreichung.importiertVon}`}
        </p>
      </div>

      <ScopeTabs
        items={[
          { key: 'kompakt', label: 'Vorhaben kompakt' },
          { key: 'befunde', label: 'Rechenchecks', count: befunde.length },
          { key: 'vb', label: 'Vorhabensbeschreibung' },
          { key: 'canvas', label: 'Canvas' },
          { key: 'delta', label: 'Delta zum Stand der Technik' },
          { key: 'wirkung', label: 'Wirkungskette' },
          { key: 'reader', label: 'Lesen nach Aspekt' },
          {
            key: 'pruefung', label: 'Förderfähig',
            count: pruefung.ergebnis?.fortschritt.gesamt,
          },
          { key: 'abschluss', label: 'Abschluss' },
          { key: 'checkliste', label: 'Checkliste bearbeiten' },
          { key: 'report', label: 'Import-Report' },
        ]}
        activeKey={sicht}
        onChange={setSicht}
        aria-label="Ansicht der Einreichung"
      />

      {sicht === 'kompakt' && (
        <div className="flex flex-col gap-4">
          <Karte titel="Eckdaten" kopfRechts={<BefundAmpel befunde={befunde} />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Kpi
                label="Zuwendung"
                wert={euro(einreichung.kosten.beantragteZuwendung)}
                hinweis="beantragt"
              />
              <Kpi
                label="Personenmonate"
                wert={einreichung.summen.personenmonateEinsatz === null
                  ? '—'
                  : einreichung.summen.personenmonateEinsatz.toLocaleString('de-DE')}
                hinweis={nnAnteil === null
                  ? undefined
                  : `${(nnAnteil * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % nicht benannt`}
              />
            </div>
          </Karte>

          <Karte
            titel="Arbeitspakete im Zeitverlauf"
            kopfRechts={
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                Grenze {AP_PM_GRENZE} PM je Arbeitspaket
              </span>
            }
          >
            <ApGantt daten={gantt} />
          </Karte>

          <Karte titel="Kostenverteilung">
            <KostenBalken kosten={einreichung.kosten} segmente={segmente} />
          </Karte>

          {einreichung.antragsteller.kurzprofil != null && (
            <Karte titel="Antragsteller">
              <p className="text-[13px] text-[var(--tf-text-secondary)] whitespace-pre-line">
                {einreichung.antragsteller.kurzprofil}
              </p>
            </Karte>
          )}
        </div>
      )}

      {sicht === 'befunde' && (
        <Karte titel="Rechenchecks" kopfRechts={<BefundAmpel befunde={befunde} />}>
          <BefundListe befunde={befunde} />
        </Karte>
      )}

      {sicht === 'vb' && (
        <Karte titel="Vorhabensbeschreibung">
          <VbPanel vb={vb} einreichungId={einreichung.id} />
        </Karte>
      )}

      {sicht === 'canvas' && (
        <Karte
          titel="Projekt-Canvas"
          kopfRechts={
            vb.infografik === null
              ? <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Textfelder noch nicht extrahiert</span>
              : <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Textfelder KI-generiert</span>
          }
        >
          <ProjektCanvas einreichung={einreichung} texte={vb.infografik?.canvas ?? null} />
        </Karte>
      )}

      {sicht === 'delta' && (
        <Karte titel="Delta zum Stand der Technik">
          {vb.infografik === null
            ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)]">
                Die Zielparameter entstehen im internen Analyse-Lauf über die
                Vorhabensbeschreibung — starten Sie ihn im Reiter „Vorhabensbeschreibung".
              </p>
            )
            : <SdtDeltaKarte zeilen={vb.infografik.sdtDelta} />}
        </Karte>
      )}

      {sicht === 'wirkung' && (
        <Karte titel="Wirkungskette">
          {vb.infografik === null
            ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)]">
                Die Wirkungskette entsteht im internen Analyse-Lauf über die
                Vorhabensbeschreibung — starten Sie ihn im Reiter „Vorhabensbeschreibung".
              </p>
            )
            : (
              <WirkungsketteAnsicht
                kette={vb.infografik.wirkungskette}
                richtwerte={pruefeRichtwerte(vb.infografik.wirkungskette, einreichung)}
              />
            )}
        </Karte>
      )}

      {sicht === 'reader' && (
        <Karte titel="Lesen nach Prüfaspekt">
          {vb.dokument === null
            ? (
              <p className="text-[13px] text-[var(--tf-text-secondary)]">
                Ordnen Sie zuerst im Reiter „Vorhabensbeschreibung" ein Dokument zu.
              </p>
            )
            : (
              <ReaderLite
                gliederung={vb.gliederung}
                markdown={vb.korpus?.markdown ?? vb.dokument.markdown}
                mapping={vb.aspektMapping}
              />
            )}
        </Karte>
      )}

      {sicht === 'pruefung' && (
        <Karte titel="Förderfähigkeit">
          {pruefung.definition === null || pruefung.ergebnis === null
            ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Checkliste wird geladen …</p>
            : (
              <ChecklistePanel
                definition={pruefung.definition}
                ergebnis={pruefung.ergebnis}
                versionVeraltet={pruefung.versionVeraltet}
                aspektMapping={vb.aspektMapping}
                gliederung={vb.gliederung}
                vbMarkdown={vb.korpus?.markdown ?? ''}
                onBewerte={(itemId, status, bemerkung) =>
                  void pruefung.bewerteItem({ itemId, status, bemerkung })}
                onStufe={(itemId, stufe, bemerkung) =>
                  void pruefung.bewerteItem({ itemId, status: 'erfuellt', stufe, bemerkung })}
                onBedingung={(itemId, wert) => void pruefung.beantworteBedingung(itemId, wert)}
                onNachziehen={() => void pruefung.ziehePruefungNach()}
              />
            )}
        </Karte>
      )}

      {sicht === 'abschluss' && (
        <Karte titel="Abschluss">
          {pruefung.definition === null || pruefung.ergebnis === null
            ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Wird geladen …</p>
            : (
              <AbschlussPanel
                einreichung={einreichung}
                definition={pruefung.definition}
                ergebnis={pruefung.ergebnis}
              />
            )}
        </Karte>
      )}

      {sicht === 'checkliste' && (
        <Karte titel="Checkliste bearbeiten">
          {pruefung.definition === null
            ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Wird geladen …</p>
            : (
              <ChecklistenEditor
                definition={pruefung.definition}
                onBearbeite={pruefung.bearbeiteItem}
                onErgaenze={pruefung.ergaenzeKriterium}
                onAktiviere={pruefung.aktiviereItem}
                onZuruecksetzen={pruefung.setzeChecklisteZurueck}
              />
            )}
        </Karte>
      )}

      {sicht === 'report' && (
        <Karte titel="Import-Report">
          {report === null
            ? <p className="text-[13px] text-[var(--tf-text-secondary)]">Report wird geladen …</p>
            : <ImportReportPanel report={report} />}
        </Karte>
      )}
    </div>
  );
}

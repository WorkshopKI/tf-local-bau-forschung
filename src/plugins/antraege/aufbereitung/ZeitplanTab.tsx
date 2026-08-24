/**
 * Inhalt des Zeitplan-Tabs: Gantt + Kennzahlen-Karte + Plausibilitäts-Sektion,
 * mit Lade-/Fehler-/Empty-States (async-error-pattern). Reine Präsentation über
 * den geladenen Run — keine eigene IO (die liegt in `useAufbereitung`).
 */
import { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Button } from '@/components/ui/button';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { GanttZeitplan } from './GanttZeitplan';
import { PersonenZeitplan } from './PersonenZeitplan';
import { KennzahlenKarte, BefundZeile } from './zeitplanBausteine';
import { VerbundZeitplan } from './VerbundZeitplan';
import { Rohtabellen } from './Rohtabellen';
import { zeitplanUnsicher } from './zeitplan-qualitaet';
import { befundKey } from './store';
import { EinreichungsPlan } from './EinreichungsPlan';
import type { EinreichungsBezug } from './map-verknuepfung';
import type { AufbereitungRun } from './types';

interface Props {
  run: AufbereitungRun | null;
  loading: boolean;
  neu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
  /** Für die Nachreich-Drop-Zone der fehlenden TV-Anlagen (Verbund). */
  ctx: { key: string; knownIds: string[] };
  onIngested: () => void;
  /**
   * Zum Vorgang gefundene Einreichungs-JSON. Trägt sie einen Plan, ist sie die
   * EINZIGE angezeigte Quelle — genau sie hebt die Zeitplan-Pause auf; die
   * PDF-geernteten Zeilen bleiben gesperrt und werden nicht danebengestellt.
   */
  einreichung?: EinreichungsBezug | null;
}

const HERKUNFT_LABEL: Record<'anlage5' | 'vb' | 'beide', string> = {
  anlage5: 'ANLAGE 5',
  beide: 'ANLAGE 5',
  vb: 'TEXT-PROJEKTPLAN (VB)',
};

export function ZeitplanTab({ run, loading, neu, toggle, ctx, onIngested, einreichung }: Props): React.ReactElement {
  if (loading) {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">Aufbereitung wird geladen …</div>;
  }

  // Einreichungs-JSON schlägt alles: deklarierte Felder sind die stärkere Quelle als
  // eine aus dem Dokument geerntete Tabelle. Die geernteten Zeilen daneben zu zeigen
  // stellte zwei Wahrheiten nebeneinander, ohne dass eine davon die andere prüft.
  if (einreichung?.zeitplan) {
    return <div><EinreichungsPlan bezug={einreichung} /></div>;
  }

  // Verbund (≥2 TV): pro-TV-Sektionen statt eines Single-Zeitplans.
  if (run?.teilplaene) {
    return (
      <div>
        {neu.error ? (
          <div className="mb-4 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]"
            style={{ border: '0.5px solid var(--tf-border)' }}>
            Fehler bei der Aufbereitung: {neu.error}
          </div>
        ) : null}
        <VerbundZeitplan run={run} teilplaene={run.teilplaene} toggle={toggle} ctx={ctx} onIngested={onIngested} />
      </div>
    );
  }

  return (
    <div>
      {neu.error ? (
        <div className="mb-4 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          Fehler bei der Aufbereitung: {neu.error}
        </div>
      ) : null}

      {!run ? (
        <EmptyState
          titel="Noch nicht aufbereitet"
          text="Die Vorhabensbeschreibung wurde noch nicht analysiert."
          busy={neu.busy} onCompute={() => neu.run()}
        />
      ) : !run.zeitplan ? (
        <EmptyState
          titel="Kein Zeitplan gefunden"
          text={run.hinweis ?? 'Im Antrag wurde weder eine Anlage 5 noch eine Projektplan-Tabelle in der VB gefunden.'}
          busy={neu.busy} onCompute={() => neu.run()}
        />
      ) : (
        <ZeitplanInhalt run={run} zeitplan={run.zeitplan} toggle={toggle} />
      )}
    </div>
  );
}

function EmptyState({ titel, text, busy, onCompute }: { titel: string; text: string; busy: boolean; onCompute: () => void }): React.ReactElement {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <div className="text-[15px] font-medium text-[var(--tf-text)]">{titel}</div>
      <div className="text-[13px] text-[var(--tf-text-tertiary)] max-w-[420px]">{text}</div>
      <Button variant="primary" size="sm" loading={busy} onClick={() => onCompute()} className="mt-1">
        {busy ? 'Wird aufbereitet …' : 'Jetzt aufbereiten'}
      </Button>
    </div>
  );
}

function ZeitplanInhalt({
  run, zeitplan, toggle,
}: {
  run: AufbereitungRun;
  zeitplan: NonNullable<AufbereitungRun['zeitplan']>;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  const { zeilen, herkunft, achseMax } = zeitplan;
  const [ansicht, setAnsicht] = useState<'ap' | 'person'>('ap');
  const [rohManuell, setRohManuell] = useState(false);

  // AP-Nummern mit Zeitraum-Abweichung (Warning-Dot im Gantt).
  const abweichungsNummern = new Set<string>();
  for (const b of run.befunde) {
    if (b.typ !== 'zeitraum-abweichung') continue;
    for (const z of zeilen) {
      if (!z.istUnterAp && z.bezeichnung && b.text.includes(z.bezeichnung)) abweichungsNummern.add(z.nummer.trim());
    }
  }

  const quelleName = herkunft === 'vb' ? 'Text-Projektplan (VB)' : 'Anlage 5';
  const hatMaNr = zeilen.some(z => !!z.maNr?.trim());
  const aktiveAnsicht = hatMaNr ? ansicht : 'ap';
  const unsicher = zeitplanUnsicher(zeilen);

  // Extraktion unsicher (PDF-Tabelle zerfallen) → KEIN Gantt (täuscht Vollständigkeit vor),
  // stattdessen ehrlicher Hinweis + die geernteten Roh-Tabellen zum Selbstlesen.
  if (unsicher) {
    return (
      <>
        <SectionHeader label={`PROJEKTPLAN — ${HERKUNFT_LABEL[herkunft]}`} />
        <div className="mt-2 rounded-[10px] px-4 py-3 text-[13px] text-[var(--tf-warning-text)]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          ⚠ Arbeitsplan hinterlegt, aber nicht zuverlässig auslesbar — die Tabelle zerfiel bei der Extraktion
          (häufig bei PDF-Tabellen). Kein Gantt-Diagramm, da es sonst Vollständigkeit vortäuscht. Bitte die
          geernteten Roh-Tabellen unten selbst prüfen (oder die Anlage 5 als <strong>DOCX</strong> neu hochladen).
        </div>
        <Rohtabellen tabellen={run.tabellen} className="mt-4" />
        {run.befunde.length > 0 ? (
          <div className="mt-8">
            <SectionHeader label="PLAUSIBILITÄT — TEXT VS. ANLAGE 5" />
            {run.befunde.map((b, i) => (
              <BefundZeile key={i} befund={b} offen={run.offenePunkte.includes(befundKey(b))} toggle={toggle} />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionHeader label={`PROJEKTPLAN — ${HERKUNFT_LABEL[herkunft]}`} />
        <ScopeTabs
          variant="pills"
          items={[
            { key: 'ap', label: 'Nach AP' },
            { key: 'person', label: 'Nach Person', disabled: !hatMaNr, title: hatMaNr ? undefined : 'nur mit Anlage 5 / MA-Zuordnung verfügbar' },
          ]}
          activeKey={aktiveAnsicht}
          onChange={(k) => setAnsicht(k === 'person' ? 'person' : 'ap')}
          aria-label="Zeitplan-Ansicht: Nach AP oder Nach Person"
        />
      </div>
      <div className="flex gap-6 items-start flex-wrap">
        <div className="flex-1 min-w-[420px]">
          {aktiveAnsicht === 'person' ? (
            <PersonenZeitplan zeilen={zeilen} achseMax={achseMax} quelleLabel={quelleName} />
          ) : (
            <GanttZeitplan zeilen={zeilen} achseMax={achseMax} abweichungsNummern={abweichungsNummern} quelleLabel={quelleName} />
          )}
        </div>
        <KennzahlenKarte
          zeilen={zeilen}
          quelleName={herkunft === 'vb' ? 'Text-Projektplan' : 'Anlage 5'}
          // Die Anlage 5 kann ein eigenes Dokument sein oder ein Abschnitt der VB —
          // gestempelt wird die Datei, aus der die Zeilen tatsächlich stammen.
          quelleHash={run.quellen.find(q => q.rolle === (herkunft === 'vb' ? 'vb' : 'anlage5'))?.hash
            ?? run.quellen.find(q => q.rolle === 'vb')?.hash ?? null}
        />
      </div>

      {/* Manuelle Übersteuerung: Roh-Tabellen auch bei gelungener Extraktion (Vergleich). */}
      {run.tabellen.length > 0 ? (
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => setRohManuell(v => !v)}>
            {rohManuell ? 'Rohtabellen ausblenden' : 'Rohtabellen anzeigen'}
          </Button>
          {rohManuell ? <Rohtabellen tabellen={run.tabellen} className="mt-2" /> : null}
        </div>
      ) : null}

      {run.befunde.length > 0 ? (
        <div className="mt-8">
          <SectionHeader label="PLAUSIBILITÄT — TEXT VS. ANLAGE 5" />
          {run.befunde.map((b, i) => (
            <BefundZeile key={i} befund={b} offen={run.offenePunkte.includes(befundKey(b))} toggle={toggle} />
          ))}
        </div>
      ) : null}
    </>
  );
}


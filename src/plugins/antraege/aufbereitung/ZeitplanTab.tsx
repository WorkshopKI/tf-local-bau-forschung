/**
 * Inhalt des Zeitplan-Tabs: Gantt + Kennzahlen-Karte + Plausibilitäts-Sektion,
 * mit Lade-/Fehler-/Empty-States (async-error-pattern). Reine Präsentation über
 * den geladenen Run — keine eigene IO (die liegt in `useAufbereitung`).
 */
import { useState } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusDot } from '@/components/ui/StatusBadge';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Button } from '@/components/ui/button';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { GanttZeitplan } from './GanttZeitplan';
import { PersonenZeitplan } from './PersonenZeitplan';
import { befundKey } from './store';
import type { AufbereitungRun } from './types';
import { summePm } from './tabellen';
import type { ApZeile, Befund } from './tabellen';

const WARN = '#f59e0b';
const INFO = 'var(--tf-text-secondary)';

interface Props {
  run: AufbereitungRun | null;
  loading: boolean;
  neu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}

const HERKUNFT_LABEL: Record<'anlage5' | 'vb' | 'beide', string> = {
  anlage5: 'ANLAGE 5',
  beide: 'ANLAGE 5',
  vb: 'TEXT-PROJEKTPLAN (VB)',
};

export function ZeitplanTab({ run, loading, neu, toggle }: Props): React.ReactElement {
  if (loading) {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">Aufbereitung wird geladen …</div>;
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
        <KennzahlenKarte zeilen={zeilen} run={run} herkunft={herkunft} />
      </div>

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

function KennzahlenKarte({
  zeilen, run, herkunft,
}: {
  zeilen: ApZeile[];
  run: AufbereitungRun;
  herkunft: 'anlage5' | 'vb' | 'beide';
}): React.ReactElement {
  // Gesamt-PM ohne Doppelzählung (geteilte reine Funktion, auch im Zahlen-Quervergleich).
  const gesamtPm = summePm(zeilen);
  const oberCount = zeilen.filter(z => !z.istUnterAp).length;
  const unterCount = zeilen.filter(z => z.istUnterAp).length;
  const maCount = new Set(zeilen.map(z => z.maNr).filter((m): m is string => !!m && m.trim() !== '')).size;

  const quelle = run.quellen.find(q => q.rolle === (herkunft === 'vb' ? 'vb' : 'anlage5'));
  const hashKurz = quelle ? (quelle.hash.length > 6 ? `${quelle.hash.slice(0, 4)}…${quelle.hash.slice(-2)}` : quelle.hash) : '–';
  const quelleName = herkunft === 'vb' ? 'Text-Projektplan' : 'Anlage 5';

  return (
    <div className="shrink-0 w-[210px] rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="text-[13px] font-medium text-[var(--tf-text)] mb-3">Kennzahlen</div>
      <Stat label="Gesamt-PM" value={gesamtPm > 0 ? String(gesamtPm) : '–'} />
      <Stat label="APs" value={`${oberCount}${unterCount > 0 ? ` (+${unterCount} Unter-APs)` : ''}`} />
      <Stat label="Quelle" value={`${quelleName} (Hash ${hashKurz})`} />
      <Stat label="Eingesetzte MA" value={maCount > 0 ? String(maCount) : '–'} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] text-[var(--tf-text-tertiary)]">{label}</div>
      <div className="text-[13px] text-[var(--tf-text)]">{value}</div>
    </div>
  );
}

function BefundZeile({
  befund, offen, toggle,
}: {
  befund: Befund;
  offen: boolean;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <StatusDot color={befund.schwere === 'warnung' ? WARN : INFO} size={7} className="mt-1.5"
        title={befund.schwere === 'warnung' ? 'Warnung' : 'Hinweis'} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--tf-text)] leading-snug">{befund.text}</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {befund.quellen.map((q, i) => (
            <span key={i} className="text-[10.5px] px-1.5 py-0.5 rounded text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}>
              {q.rolle === 'anlage5' ? 'Anl. 5' : q.sektionId ? `§ ${q.sektionId}` : 'Text-Projektplan'}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggle.run(befundKey(befund))}
        disabled={toggle.busy}
        title="wird später an Nachforderungen angebunden"
        className="shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
      >
        {offen ? '✓ Offener Punkt' : 'Als offenen Punkt übernehmen'}
      </button>
    </div>
  );
}

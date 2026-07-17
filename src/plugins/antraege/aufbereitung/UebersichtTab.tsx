/**
 * Übersicht-Tab (Cockpit, Paket 5 Phase 0). Erster Tab der Aufbereitung: zeigt
 * während der minutenlangen KI-Läufe, was läuft und was fertig ist. Drei Blöcke:
 *  1. Externe Recherche (Deep-Research-Auftrag) — Platzhalter bis Phase 1.
 *  2. Interne Aufbereitung — vertikaler Stepper über die KI-Bausteine.
 *  3. Deterministische Aufbereitung — Tabellen-/Quellen-Status (der Zeitplan-Einstieg
 *     entfällt, solange `ZEITPLAN_PAUSIERT` gilt).
 * Monochrom; Farbe nur über den Status-Punkt. Keine eigene Logik/State — nutzt
 * dieselben Actions (`bausteine`/`neu`) wie die Seite.
 */
import { useMemo } from 'react';
import { Check, Loader2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusDot } from '@/components/ui/StatusBadge';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import type { AufbereitungTabId } from './AufbereitungTabs';
import { ZEITPLAN_PAUSIERT, ZEITPLAN_PAUSE_HINWEIS } from './pausierte-module';
import type { AufbereitungRun } from './types';
import type { BausteinUiStatus } from './useAufbereitung';
import { baueStepper, type StepperEingang, type StepperSchritt } from './uebersicht';

interface Props {
  run: AufbereitungRun | null;
  loading: boolean;
  veraltet: boolean;
  stepper: StepperEingang;
  onTab: (id: AufbereitungTabId) => void;
  bausteine: UseAsyncActionResult<[]>;
  neu: UseAsyncActionResult<[]>;
}

export function UebersichtTab({ run, loading, veraltet, stepper, onTab, bausteine, neu }: Props): React.ReactElement {
  const schritte = useMemo(() => baueStepper(stepper), [stepper]);
  const fertig = schritte.filter(s => s.status === 'ok' || s.status === 'degradiert' || s.status === 'fehler').length;

  return (
    <div className="flex flex-col gap-5 max-w-[860px]">
      {/* Block 1 — Externe Recherche (Platzhalter bis Phase 1) */}
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Externe Recherche</h3>
        <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
          Deep-Research-Auftrag für ChatGPT / Claude / Mistral — folgt im Recherche-Tab.
        </p>
      </section>

      {/* Block 2 — Interne Aufbereitung (Stepper) */}
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Interne Aufbereitung</h3>
            {schritte.length ? (
              <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                {bausteine.busy ? `läuft … (${fertig}/${schritte.length})` : `${fertig}/${schritte.length}`}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" loading={neu.busy} onClick={() => neu.run()}>
              {neu.busy ? 'Aufbereiten …' : 'Neu aufbereiten'}
            </Button>
            <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()}>
              {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'Mit KI aufbereiten'}
            </Button>
          </div>
        </div>
        {bausteine.error ? (
          <div className="mb-3 rounded-lg px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            {bausteine.error}
          </div>
        ) : null}
        <ol className="flex flex-col">
          {schritte.map((s, i) => (
            <StepperZeile key={s.key} schritt={s} letzte={i === schritte.length - 1} onTab={onTab} />
          ))}
        </ol>
      </section>

      {/* Block 3 — Deterministische Aufbereitung */}
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Deterministische Aufbereitung</h3>
        <div className="mt-2 flex flex-col gap-1 text-[12.5px] text-[var(--tf-text-secondary)]">
          {loading ? (
            <span className="text-[var(--tf-text-tertiary)]">Wird geladen …</span>
          ) : run ? (
            <>
              <span>
                {ZEITPLAN_PAUSIERT ? 'Tabellen' : 'Zeitplan, Tabellen'} &amp; Plausibilität aufbereitet ({run.gliederung.length} Sektionen,{' '}
                {run.tabellen.length} Tabellen).
              </span>
              {veraltet ? (
                <span className="text-[var(--tf-text-tertiary)]">
                  ● Quellen haben sich seit der Aufbereitung geändert — „Neu aufbereiten" für den aktuellen Stand.
                </span>
              ) : null}
              {ZEITPLAN_PAUSIERT ? (
                <span className="mt-1 text-[var(--tf-text-tertiary)]">{ZEITPLAN_PAUSE_HINWEIS}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onTab('zeitplan')}
                  className="mt-1 inline-flex w-fit items-center gap-1 text-[12px] text-[var(--tf-primary)] hover:underline"
                >
                  Zeitplan öffnen <ArrowRight size={12} />
                </button>
              )}
            </>
          ) : (
            <span className="text-[var(--tf-text-tertiary)]">Noch nicht aufbereitet — „Neu aufbereiten" oder „Mit KI aufbereiten".</span>
          )}
        </div>
      </section>
    </div>
  );
}

function StepperZeile({ schritt, letzte, onTab }: { schritt: StepperSchritt; letzte: boolean; onTab: (id: AufbereitungTabId) => void }): React.ReactElement {
  const v = visual(schritt.status);
  const fertig = schritt.status === 'ok' || schritt.status === 'degradiert' || schritt.status === 'fehler';
  return (
    <li className="flex gap-3">
      {/* Marker-Spalte + Verbindungslinie */}
      <div className="flex flex-col items-center">
        <span className="mt-0.5 flex h-5 w-5 items-center justify-center shrink-0">{v.marker}</span>
        {!letzte ? <span className="w-px flex-1" style={{ background: 'var(--tf-border)' }} /> : null}
      </div>
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--tf-text)]">{schritt.label}</span>
          <span className="text-[11.5px] shrink-0" style={{ color: v.farbe }}>{v.text}</span>
        </div>
        {schritt.status === 'degradiert' && schritt.begruendung ? (
          <div className="mt-0.5 text-[11.5px] text-[var(--tf-text-tertiary)]">{schritt.begruendung}</div>
        ) : null}
        {fertig && schritt.tabId ? (
          <button
            type="button"
            onClick={() => onTab(schritt.tabId as AufbereitungTabId)}
            className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline"
          >
            Tab öffnen <ArrowRight size={11} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

function visual(status: BausteinUiStatus): { marker: React.ReactNode; text: string; farbe: string } {
  switch (status) {
    case 'ok':
      return { marker: <Check size={14} className="text-[var(--tf-success-text)]" />, text: 'fertig', farbe: 'var(--tf-success-text)' };
    case 'laeuft':
      return { marker: <Loader2 size={13} className="animate-spin text-[var(--tf-text-secondary)]" />, text: 'läuft …', farbe: 'var(--tf-text-secondary)' };
    case 'degradiert':
      return { marker: <AlertTriangle size={13} className="text-[var(--tf-warning-text)]" />, text: 'eingeschränkt', farbe: 'var(--tf-warning-text)' };
    case 'fehler':
      return { marker: <XCircle size={13} className="text-[var(--tf-danger-text)]" />, text: 'Fehler', farbe: 'var(--tf-danger-text)' };
    default:
      return { marker: <StatusDot color="var(--tf-text-tertiary)" size={7} />, text: 'ausstehend', farbe: 'var(--tf-text-tertiary)' };
  }
}

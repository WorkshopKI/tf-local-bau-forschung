/**
 * Glossar-Tab (v2.219). Listet die vom LLM ausgewählten Fachbegriffe alphabetisch —
 * je Begriff eine kurze Definition (wortnah) + Fundstellen-Chip. Rein anzeigend; keine
 * offenen Punkte / Quervergleiche (anders als der Zahlen-Tab). Zustände + Degradations-
 * Banner wie ZahlenTab. Monochrom.
 */
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { FundstelleChip } from './FundstelleChip';
import type { GlossarBegriff, GlossarDaten } from './glossar';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { VbSektion } from './gliederung';

interface Props {
  run: AufbereitungRun | null;
  glossar: BausteinUiState<GlossarDaten>;
  vbMarkdown: string | null;
  bausteine: UseAsyncActionResult<[]>;
  bausteineNeu: UseAsyncActionResult<[]>;
}

const LEER: GlossarDaten = { schemaVersion: 1, begriffe: [] };

export function GlossarTab({ run, glossar, vbMarkdown, bausteine, bausteineNeu }: Props): React.ReactElement {
  if (glossar.status === 'fehlt' || (!run && glossar.status !== 'laeuft')) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        {bausteine.error ? (
          <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Glossar noch nicht erstellt</div>
        <div className="max-w-[460px] text-[13px] text-[var(--tf-text-tertiary)]">
          Ein interner KI-Lauf sammelt die Fachbegriffe der Vorhabensbeschreibung — jeder mit kurzer
          Definition (wortnah aus dem Text) und Fundstelle.
        </div>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-1">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </div>
    );
  }
  if (glossar.status === 'laeuft') {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">KI-Aufbereitung läuft — Glossar wird erstellt …</div>;
  }
  if (glossar.status === 'fehler') {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <div className="text-[14px] text-[var(--tf-text)]">KI-Aufbereitung nicht möglich</div>
        <div className="max-w-[420px] text-[12.5px] text-[var(--tf-text-tertiary)]">Der interne KI-Dienst ist derzeit nicht erreichbar.</div>
        <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()}>Erneut versuchen</Button>
      </div>
    );
  }
  return (
    <GlossarInhalt
      run={run!}
      daten={glossar.daten ?? LEER}
      degradiert={glossar.status === 'degradiert'}
      rohtext={glossar.status === 'degradiert' ? glossar.rohtext : undefined}
      begruendung={glossar.begruendung}
      vbMarkdown={vbMarkdown}
      bausteineNeu={bausteineNeu}
    />
  );
}

function GlossarInhalt({
  run, daten, degradiert, rohtext, begruendung, vbMarkdown, bausteineNeu,
}: {
  run: AufbereitungRun;
  daten: GlossarDaten;
  degradiert: boolean;
  rohtext?: string;
  begruendung?: string;
  vbMarkdown: string | null;
  bausteineNeu: UseAsyncActionResult<[]>;
}): React.ReactElement {
  const byId = useMemo(() => new Map(run.gliederung.map(s => [s.id, s])), [run.gliederung]);
  const chips = (ids: string[]): React.ReactElement[] =>
    ids.map(id => byId.get(id)).filter((s): s is VbSektion => !!s).map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />);

  return (
    <div>
      {degradiert ? (
        <details className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          <summary className="cursor-pointer text-[var(--tf-warning-text)]">
            {begruendung ?? 'Unstrukturiertes KI-Ergebnis'} — Glossar nur teilweise verwertbar.{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); bausteineNeu.run(); }} disabled={bausteineNeu.busy} className="underline disabled:opacity-50">neu berechnen</button>
          </summary>
          {rohtext ? <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-[var(--tf-text-secondary)]">{rohtext}</pre> : null}
        </details>
      ) : null}

      {daten.begriffe.length === 0 ? (
        <div className="py-14 text-center text-[13px] text-[var(--tf-text-tertiary)]">Keine Fachbegriffe gefunden.</div>
      ) : (
        <div className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-[var(--tf-text)]">Fachbegriffe</span>
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{daten.begriffe.length}</span>
          </div>
          {daten.begriffe.map((b, i) => (
            <BegriffZeile key={`${b.begriff}:${i}`} begriff={b} chips={chips} letzte={i === daten.begriffe.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function BegriffZeile({
  begriff, chips, letzte,
}: {
  begriff: GlossarBegriff;
  chips: (ids: string[]) => React.ReactElement[];
  letzte: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2" style={{ borderBottom: letzte ? undefined : '0.5px solid var(--tf-border)' }}>
      <div className="w-[170px] shrink-0 text-[13px] font-medium text-[var(--tf-text)] break-words">{begriff.begriff}</div>
      <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--tf-text-secondary)]">{begriff.definition}</div>
      {begriff.sektionIds.length > 0 ? <div className="shrink-0 flex items-center gap-1.5">{chips(begriff.sektionIds)}</div> : null}
    </div>
  );
}

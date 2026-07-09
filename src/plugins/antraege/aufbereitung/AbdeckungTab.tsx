/**
 * Abdeckungs-Tab (Paket 2): zeigt je Prüfaspekt A–J die zugeordneten VB-Sektionen
 * (Fundstellen-Chips), einen monochromen Substanz-Balken und Warning/Info-Badges
 * (dünn, fehlende Pflichtangaben, Zeitplan-Widersprüche bei H). Darunter „NICHT IM
 * PRÜFRASTER" (Ebene-1-Sektionen ohne Aspekt) und „OFFENE PUNKTE" (fehlt-Kandidaten
 * + übernommene Zeitplan-Befunde) mit der bestehenden Offene-Punkte-Mechanik.
 *
 * Substanz-Werte, „dünn"-Flag, ohne-Aspekt-Liste und die stabilen Fehlt-Keys sind
 * DETERMINISTISCH (aus `aspekte.ts`); das LLM liefert nur Zuordnung + Fehlt-Texte.
 */
import { useMemo } from 'react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusDot } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { FundstelleChip } from './FundstelleChip';
import { StrukturKarte } from './StrukturKarte';
import {
  PRUEF_ASPEKTE, berechneSubstanz, ermittleOhneAspekt, fehlendeAlsKandidaten,
  type AspektMapping, type AspektSubstanz,
} from './aspekte';
import { befundKey } from './store';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { VbSektion } from './gliederung';

const WARN = '#f59e0b';

interface Props {
  run: AufbereitungRun | null;
  aspekte: BausteinUiState<AspektMapping>;
  vbMarkdown: string | null;
  wurzel: string;
  ansicht: 'liste' | 'karte';
  onAnsicht: (a: 'liste' | 'karte') => void;
  bausteine: UseAsyncActionResult<[]>;
  bausteineNeu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}

export function AbdeckungTab({
  run, aspekte, vbMarkdown, wurzel, ansicht, onAnsicht, bausteine, bausteineNeu, toggle,
}: Props): React.ReactElement {
  if (aspekte.status === 'fehlt' || (!run && aspekte.status !== 'laeuft')) {
    return (
      <StartState
        busy={bausteine.busy}
        onStart={() => bausteine.run()}
        error={bausteine.error}
      />
    );
  }
  if (aspekte.status === 'laeuft') {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">KI-Aufbereitung läuft — Prüfaspekte werden zugeordnet …</div>;
  }
  if (aspekte.status === 'fehler') {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <div className="text-[14px] text-[var(--tf-text)]">KI-Aufbereitung nicht möglich</div>
        <div className="max-w-[420px] text-[12.5px] text-[var(--tf-text-tertiary)]">
          Der interne KI-Dienst ist derzeit nicht erreichbar. Der Zeitplan-Tab bleibt unabhängig davon nutzbar.
        </div>
        <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()}>Erneut versuchen</Button>
      </div>
    );
  }
  // degradiert oder ok:
  return (
    <AbdeckungInhalt
      run={run!}
      aspekte={aspekte}
      vbMarkdown={vbMarkdown}
      wurzel={wurzel}
      ansicht={ansicht}
      onAnsicht={onAnsicht}
      bausteineNeu={bausteineNeu}
      toggle={toggle}
    />
  );
}

function StartState({ busy, onStart, error }: { busy: boolean; onStart: () => void; error: string | null }): React.ReactElement {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      {error ? (
        <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>
          {error}
        </div>
      ) : null}
      <div className="text-[15px] font-medium text-[var(--tf-text)]">Prüfraster noch nicht erstellt</div>
      <div className="max-w-[440px] text-[13px] text-[var(--tf-text-tertiary)]">
        Ein interner KI-Lauf ordnet die Sektionen der Vorhabensbeschreibung den Prüfaspekten A–J zu und benennt fehlende Pflichtangaben.
      </div>
      <Button variant="primary" size="sm" loading={busy} onClick={onStart} className="mt-1">
        {busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
      </Button>
    </div>
  );
}

function AbdeckungInhalt({
  run, aspekte, vbMarkdown, wurzel, ansicht, onAnsicht, bausteineNeu, toggle,
}: {
  run: AufbereitungRun;
  aspekte: BausteinUiState<AspektMapping>;
  vbMarkdown: string | null;
  wurzel: string;
  ansicht: 'liste' | 'karte';
  onAnsicht: (a: 'liste' | 'karte') => void;
  bausteineNeu: UseAsyncActionResult<[]>;
  toggle: UseAsyncActionResult<[string]>;
}): React.ReactElement {
  const mapping = aspekte.daten ?? { zuordnung: {}, fehlend: {} };
  const byId = useMemo(() => new Map(run.gliederung.map(s => [s.id, s])), [run.gliederung]);
  const substanz = useMemo(() => berechneSubstanz(mapping, run.gliederung), [mapping, run.gliederung]);
  const maxAnteil = useMemo(() => substanz.reduce((m, s) => Math.max(m, s.anteil), 0), [substanz]);
  const ohneAspekt = useMemo(() => ermittleOhneAspekt(mapping, run.gliederung), [mapping, run.gliederung]);
  const kandidaten = useMemo(() => fehlendeAlsKandidaten(mapping), [mapping]);
  // Zeitplan-Widersprüche (Warnungs-Befunde) — Zusatz-Badge bei Aspekt H (Projektplan).
  const widersprueche = useMemo(() => run.befunde.filter(b => b.schwere === 'warnung').length, [run.befunde]);
  // Bereits als offen markierte Zeitplan-Befunde (im OFFENE-PUNKTE-Abschnitt konsolidiert).
  const uebernommeneBefunde = useMemo(
    () => run.befunde.filter(b => run.offenePunkte.includes(befundKey(b))),
    [run.befunde, run.offenePunkte],
  );

  return (
    <div>
      {aspekte.status === 'degradiert' ? (
        <DegradiertBanner rohtext={aspekte.rohtext} onRetry={() => bausteineNeu.run()} busy={bausteineNeu.busy} />
      ) : null}

      <div className="flex items-center justify-between">
        <SectionHeader label="PRÜFASPEKTE A–J" />
        <ScopeTabs
          variant="pills"
          items={[{ key: 'liste', label: 'Liste' }, { key: 'karte', label: 'Karte' }]}
          activeKey={ansicht}
          onChange={(k) => onAnsicht(k === 'karte' ? 'karte' : 'liste')}
          aria-label="Ansicht: Liste oder Karte"
        />
      </div>

      {ansicht === 'karte' ? (
        <StrukturKarte
          gliederung={run.gliederung}
          mapping={mapping}
          substanz={substanz}
          vbMarkdown={vbMarkdown}
          wurzel={wurzel}
        />
      ) : (
        <div>
          {PRUEF_ASPEKTE.map((a, i) => (
            <AspektZeile
              key={a.id}
              aspektId={a.id}
              name={a.name}
              substanz={substanz[i]!}
              maxAnteil={maxAnteil}
              sektionen={substanz[i]!.sektionIds.map(id => byId.get(id)).filter((s): s is VbSektion => !!s)}
              fehlend={mapping.fehlend[a.id] ?? []}
              widersprueche={a.id === 'H' ? widersprueche : 0}
              vbMarkdown={vbMarkdown}
            />
          ))}
        </div>
      )}

      {ohneAspekt.length > 0 ? (
        <div className="mt-8">
          <SectionHeader label="NICHT IM PRÜFRASTER" />
          {ohneAspekt.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
              <div className="text-[13.5px] text-[var(--tf-text)]">
                {s.nummer ? `Kap. ${s.nummer} ` : ''}<span className="text-[var(--tf-text-secondary)]">„{s.titel}"</span>
              </div>
              <div className="shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)]">keinem Aspekt zugeordnet</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        <SectionHeader label="OFFENE PUNKTE (KANDIDATEN FÜR NACHFORDERUNG)" />
        {kandidaten.length === 0 && uebernommeneBefunde.length === 0 ? (
          <div className="py-3 text-[12.5px] text-[var(--tf-text-tertiary)]">Keine fehlenden Pflichtangaben erkannt.</div>
        ) : (
          <>
            {kandidaten.map(k => (
              <OffenerPunkt
                key={k.key}
                text={k.text}
                referenz={`Aspekt ${k.aspektId}`}
                offen={run.offenePunkte.includes(k.key)}
                busy={toggle.busy}
                onToggle={() => toggle.run(k.key)}
              />
            ))}
            {uebernommeneBefunde.map((b, i) => (
              <OffenerPunkt
                key={`befund-${i}`}
                text={b.text}
                referenz="Zeitplan"
                offen
                busy={toggle.busy}
                onToggle={() => toggle.run(befundKey(b))}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AspektZeile({
  aspektId, name, substanz, maxAnteil, sektionen, fehlend, widersprueche, vbMarkdown,
}: {
  aspektId: string;
  name: string;
  substanz: AspektSubstanz;
  maxAnteil: number;
  sektionen: VbSektion[];
  fehlend: string[];
  widersprueche: number;
  vbMarkdown: string | null;
}): React.ReactElement {
  const pct = maxAnteil > 0 ? (substanz.anteil / maxAnteil) * 100 : 0;
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <div className="w-[220px] shrink-0 text-[14px] font-medium text-[var(--tf-text)]">
        <span className="text-[var(--tf-text-tertiary)]">{aspektId}</span> · {name}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {sektionen.length > 0
          ? sektionen.map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />)
          : <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">keine Fundstelle</span>}
      </div>
      <div className="h-[4px] w-[80px] shrink-0 overflow-hidden rounded-full bg-[var(--tf-border)]" title={`${(substanz.anteil * 100).toFixed(0)} % der VB`}>
        <div className="h-full bg-[var(--tf-text-secondary)]" style={{ width: `${pct}%`, opacity: 0.7 }} />
      </div>
      <div className="flex w-[260px] shrink-0 flex-wrap justify-end gap-1.5">
        {substanz.duenn ? <WarnBadge>dünn — {sektionen.length} {sektionen.length === 1 ? 'Sektion' : 'Sektionen'}</WarnBadge> : null}
        {widersprueche > 0 ? <WarnBadge>{widersprueche} {widersprueche === 1 ? 'Widerspruch' : 'Widersprüche'}</WarnBadge> : null}
        {fehlend.map((t, i) => <InfoBadge key={i} title={t}>fehlt: {kurz(t, 34)}</InfoBadge>)}
        {sektionen.length === 0 && !substanz.duenn && fehlend.length === 0 && widersprueche === 0
          ? <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">—</span> : null}
      </div>
    </div>
  );
}

function OffenerPunkt({
  text, referenz, offen, busy, onToggle,
}: {
  text: string;
  referenz: string;
  offen: boolean;
  busy: boolean;
  onToggle: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <StatusDot color={WARN} size={7} className="mt-1.5" title="offener Punkt" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--tf-text)]">{text}</div>
      <div className="shrink-0 text-[11.5px] text-[var(--tf-text-tertiary)]">{referenz}</div>
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        title="wird später an Nachforderungen angebunden"
        className="shrink-0 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] disabled:opacity-50"
      >
        {offen ? '✓ Offener Punkt' : 'Als offenen Punkt übernehmen'}
      </button>
    </div>
  );
}

function DegradiertBanner({ rohtext, onRetry, busy }: { rohtext?: string; onRetry: () => void; busy: boolean }): React.ReactElement {
  return (
    <details className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
      <summary className="cursor-pointer text-[var(--tf-warning-text)]">
        Unstrukturiertes KI-Ergebnis — Zuordnung nur teilweise verwertbar.{' '}
        <button type="button" onClick={(e) => { e.preventDefault(); onRetry(); }} disabled={busy} className="underline disabled:opacity-50">neu berechnen</button>
      </summary>
      {rohtext ? <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-[var(--tf-text-secondary)]">{rohtext}</pre> : null}
    </details>
  );
}

function WarnBadge({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-[var(--tf-warning-text)]"
      style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
      {children}
    </span>
  );
}

function InfoBadge({ children, title }: { children: React.ReactNode; title?: string }): React.ReactElement {
  return (
    <span title={title} className="rounded px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-[var(--tf-info-text)]"
      style={{ border: '0.5px solid var(--tf-info-border)', background: 'var(--tf-info-soft)' }}>
      {children}
    </span>
  );
}

function kurz(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

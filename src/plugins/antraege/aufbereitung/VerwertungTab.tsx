/**
 * Verwertung/Markt-Tab (Stufe 2). Zeigt die vom LLM aus dem KORPUS extrahierten
 * Verwertungs-/Markt-Aussagen, gruppiert nach Kategorie — je Aussage der wortnahe Text
 * + Fundstellen-Chip. Rein anzeigend. Zustände + Degradations-Banner wie GlossarTab.
 *
 * DOKUMENTGRENZEN-UNABHÄNGIG: läuft über den Korpus, daher gleicher Inhalt, ob das
 * Verwertungskonzept in der VB oder in einem Extra-Dokument steht. Der Leer-Zustand ist
 * INHALTSBASIERT (kein Verwertungs-Inhalt im Material) — nicht dokumentbasiert. Die
 * Fundstellen zeigen in dieselbe Korpus-Gliederung wie alle anderen Tabs (Lesemodus-
 * Sprung landet korrekt, auch bei Marketing-Sektionen).
 */
import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { BausteinFehler } from './BausteinFehler';
import { FundstelleChip } from './FundstelleChip';
import {
  VERWERTUNG_KATEGORIE_LABEL,
  type VerwertungDaten,
} from './verwertung';
import { gruppiereVergleich, hatExterneVerwertung, type ExterneAussageMitHerkunft } from './verwertung-vergleich';
import type { BausteinUiState } from './useAufbereitung';
import type { AufbereitungRun } from './types';
import type { VbSektion } from './gliederung';

interface Props {
  run: AufbereitungRun | null;
  verwertung: BausteinUiState<VerwertungDaten>;
  vbMarkdown: string | null;
  bausteine: UseAsyncActionResult<[]>;
  bausteineNeu: UseAsyncActionResult<[]>;
  onGotoRecherche?: () => void;
}

const LEER: VerwertungDaten = { schemaVersion: 1, aussagen: [] };

export function VerwertungTab({ run, verwertung, vbMarkdown, bausteine, bausteineNeu, onGotoRecherche }: Props): React.ReactElement {
  if (verwertung.status === 'fehlt' || (!run && verwertung.status !== 'laeuft')) {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center">
        {bausteine.error ? (
          <div className="mb-1 rounded-lg px-3 py-2 text-[13px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <div className="text-[15px] font-medium text-[var(--tf-text)]">Verwertung/Markt noch nicht aufbereitet</div>
        <div className="max-w-[460px] text-[13px] text-[var(--tf-text-tertiary)]">
          Ein interner KI-Lauf sammelt die Verwertungs- und Markt-Aussagen aus dem Antragsmaterial
          (Vorhabensbeschreibung und ggf. Zusatzdokumente) — je Aussage mit Fundstelle.
        </div>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-1">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </div>
    );
  }
  if (verwertung.status === 'laeuft') {
    return <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">KI-Aufbereitung läuft — Verwertung/Markt wird aufbereitet …</div>;
  }
  if (verwertung.status === 'fehler') {
    return <BausteinFehler begruendung={verwertung.begruendung} bausteine={bausteine} />;
  }
  return (
    <VerwertungInhalt
      run={run!}
      daten={verwertung.daten ?? LEER}
      degradiert={verwertung.status === 'degradiert'}
      rohtext={verwertung.status === 'degradiert' ? verwertung.rohtext : undefined}
      begruendung={verwertung.begruendung}
      vbMarkdown={vbMarkdown}
      bausteineNeu={bausteineNeu}
      onGotoRecherche={onGotoRecherche}
    />
  );
}

function VerwertungInhalt({
  run, daten, degradiert, rohtext, begruendung, vbMarkdown, bausteineNeu, onGotoRecherche,
}: {
  run: AufbereitungRun;
  daten: VerwertungDaten;
  degradiert: boolean;
  rohtext?: string;
  begruendung?: string;
  vbMarkdown: string | null;
  bausteineNeu: UseAsyncActionResult<[]>;
  onGotoRecherche?: () => void;
}): React.ReactElement {
  const byId = useMemo(() => new Map(run.gliederung.map(s => [s.id, s])), [run.gliederung]);
  const chips = (ids: string[]): React.ReactElement[] =>
    ids.map(id => byId.get(id)).filter((s): s is VbSektion => !!s).map(s => <FundstelleChip key={s.id} sektion={s} vbMarkdown={vbMarkdown} />);

  // Gegenüberstellung „Laut Antrag" ↔ „Extern" je Kategorie (rein, geteilte Funktion).
  const gruppen = useMemo(() => gruppiereVergleich(daten.aussagen, run.extern), [daten.aussagen, run.extern]);
  const hatExtern = hatExterneVerwertung(run.extern);

  return (
    <div>
      {degradiert ? (
        <details className="mb-4 rounded-lg px-3 py-2 text-[12.5px]" style={{ border: '0.5px solid var(--tf-warning-border)', background: 'var(--tf-warning-soft)' }}>
          <summary className="cursor-pointer text-[var(--tf-warning-text)]">
            {begruendung ?? 'Unstrukturiertes KI-Ergebnis'} — Verwertung/Markt nur teilweise verwertbar.{' '}
            <button type="button" onClick={(e) => { e.preventDefault(); bausteineNeu.run(); }} disabled={bausteineNeu.busy} className="underline disabled:opacity-50">neu berechnen</button>
          </summary>
          {rohtext ? <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap text-[11px] text-[var(--tf-text-secondary)]">{rohtext}</pre> : null}
        </details>
      ) : null}

      {!hatExtern ? (
        <div className="mb-4 text-[12px] text-[var(--tf-text-tertiary)]">
          Externe Recherche importieren, um die Antrags-Aussagen zu spiegeln
          {onGotoRecherche ? (
            <>
              {' '}—{' '}
              <button type="button" onClick={onGotoRecherche} className="inline-flex items-center gap-1 text-[var(--tf-primary)] hover:underline">
                zum Recherche-Tab
              </button>
            </>
          ) : null}
          .
        </div>
      ) : null}

      {gruppen.length === 0 ? (
        <div className="py-14 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          Im Antragsmaterial wurde kein Verwertungs-/Markt-Inhalt gefunden.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {gruppen.map(g => (
            <div key={g.kat} className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
              <div className="mb-2.5 text-[13px] font-medium text-[var(--tf-text)]">{VERWERTUNG_KATEGORIE_LABEL[g.kat]}</div>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Laut Antrag */}
                <div>
                  <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">Laut Antrag ({g.antrag.length})</div>
                  {g.antrag.length === 0 ? (
                    <div className="text-[12px] text-[var(--tf-text-tertiary)]">—</div>
                  ) : (
                    g.antrag.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 py-1.5">
                        <div className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--tf-text-secondary)]">{a.text}</div>
                        {a.sektionIds.length > 0 ? <div className="shrink-0 flex items-center gap-1.5">{chips(a.sektionIds)}</div> : null}
                      </div>
                    ))
                  )}
                </div>
                {/* Extern (nicht verifiziert) */}
                <div>
                  <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">Extern · nicht verifiziert ({g.extern.length})</div>
                  {g.extern.length === 0 ? (
                    <div className="text-[12px] text-[var(--tf-text-tertiary)]">—</div>
                  ) : (
                    g.extern.map((a, i) => <ExternZeile key={i} aussage={a} />)
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExternZeile({ aussage }: { aussage: ExterneAussageMitHerkunft }): React.ReactElement {
  return (
    <div className="py-1.5">
      <div className="text-[12.5px] leading-snug text-[var(--tf-text-secondary)]">{aussage.text}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--tf-text-tertiary)]">
        {aussage.modellLabel ? <span>{aussage.modellLabel}</span> : null}
        {(aussage.quellenUrls ?? []).map((u, k) => (
          <a key={k} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[var(--tf-primary)] hover:underline">
            <ExternalLink size={10} /> Quelle
          </a>
        ))}
      </div>
    </div>
  );
}

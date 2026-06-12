/**
 * Review-Body EINES Abschnitts (generalisiert aus der Kurzfassung-`ReviewCard`,
 * kein Duplikat der Logik). Kopf/Badge/Transport + Export sitzen im Sektions-
 * Container; diese Karte zeigt Quellenanalyse, finalen Text + Meta, Verlauf,
 * Prüf-Ergebnis und die Aktionsleiste (Freigeben/Neu/Kürzer/Länger/Prüfen).
 * Im freigegebenen Zustand: nur „Erneut öffnen" (Export liegt im Sektionskopf).
 */
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { CollapsibleSection, MarkdownRenderer } from '@/ui';
import { splitSentences, VB_KUERZEN_HINWEIS, type SkillModifierKey } from '@/core/services/skills';
import { CheckList } from '../kurzfassung/CheckList';
import { VersionVerlauf } from '../kurzfassung/VersionVerlauf';
import { formatDate } from '../kurzfassung/kurzfassung-verlauf';
import type { StepRun } from './types';

interface Props {
  run: StepRun;
  busy: boolean;
  llmAvailable: boolean | null;
  onModify: (modifier: SkillModifierKey) => void;
  onPruefen: () => void;
  onFreigeben: () => void;
  onVerwerfen: () => void;
  onStop: () => void;
  onUebernehmen: (index: number) => void;
  onErneutOeffnen: () => void;
  onOpenTweak: () => void;
}

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'px-4 py-2 rounded-[8px] text-[13px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed';
const TWEAK_LINK = 'inline-flex items-center gap-1 text-[12.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]';

export function SectionReviewCard({
  run, busy, llmAvailable, onModify, onPruefen, onFreigeben, onVerwerfen, onStop, onUebernehmen, onErneutOeffnen, onOpenTweak,
}: Props): React.ReactElement {
  const freigegeben = run.status === 'freigegeben';
  const satzanzahl = splitSentences(run.finalerText).length;
  const genDisabled = busy || llmAvailable === false;

  return (
    <div className="mt-3">
      {run.warnung && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          {run.warnung}
        </div>
      )}

      {run.vbGekuerzt && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Die Vorhabensbeschreibung war zu lang fürs LLM-Kontextfenster und wurde für die Analyse gekürzt — der Schluss floss nicht in diesen Abschnitt ein. {VB_KUERZEN_HINWEIS}
        </div>
      )}

      {run.quellenanalyse && (
        <CollapsibleSection label="Quellenanalyse" defaultOpen={!freigegeben}>
          <div className="pb-3">
            <MarkdownRenderer content={run.quellenanalyse} />
          </div>
        </CollapsibleSection>
      )}

      <div className="mt-4">
        {run.finalerText.split(/\n{2,}/).map((p, i) => (
          <p key={i} className="text-[13.5px] leading-[1.7] text-[var(--tf-text)] mb-2">{p}</p>
        ))}
        <div className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
          {satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'} · {freigegeben ? `freigegeben am ${formatDate(run.freigegeben_am ?? run.erstellt_am)}` : `generiert am ${formatDate(run.erstellt_am)}`}
          {run.mitTweak ? ' · mit persönlichem Stil' : ''}
        </div>
      </div>

      <VersionVerlauf
        versions={run.verlauf ?? []}
        aktuellerText={run.finalerText}
        aktuellErstelltAm={run.erstellt_am}
        busy={busy}
        onUebernehmen={onUebernehmen}
      />

      {run.checks.length > 0 && (
        <div className="mt-5">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2.5">Prüf-Ergebnis</div>
          <CheckList checks={run.checks} />
        </div>
      )}

      <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)]">
        {freigegeben ? (
          <div className="flex items-center gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={onErneutOeffnen}>Erneut öffnen</button>
            <span className="flex-1" />
            <button type="button" className={TWEAK_LINK} onClick={onOpenTweak}>
              <SlidersHorizontal size={13} />
              Persönlicher Stil
            </button>
          </div>
        ) : busy ? (
          <div className="flex items-center gap-3 text-[13px] text-[var(--tf-text-secondary)]">
            <Loader2 size={14} className="animate-spin" />
            Generiere…
            <button type="button" className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]" onClick={onStop}>
              Stopp
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className={BTN_PRIMARY} onClick={onFreigeben}>Freigeben</button>
              <button type="button" className={BTN_SECONDARY} disabled={genDisabled} onClick={() => onModify('neu')}>Neu</button>
              <button type="button" className={BTN_SECONDARY} disabled={genDisabled} onClick={() => onModify('kuerzer')}>Kürzer</button>
              <button type="button" className={BTN_SECONDARY} disabled={genDisabled} onClick={() => onModify('laenger')}>Länger</button>
              <button type="button" className={BTN_SECONDARY} onClick={onPruefen}>Prüfen</button>
              <span className="flex-1" />
              <button type="button" className={TWEAK_LINK} onClick={onOpenTweak}>
                <SlidersHorizontal size={13} />
                Persönlicher Stil
              </button>
              <button type="button" className="text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]" onClick={onVerwerfen}>
                Verwerfen
              </button>
            </div>
            {llmAvailable === false && (
              <div className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">
                KI nicht erreichbar — Neu/Kürzer/Länger derzeit nicht möglich.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Review-Body der Kurzfassung (ohne eigenen Kopf — Titel/Badge/Transport sitzen
 * in der `KurzfassungSection`). Layout nach `mockup-kurzfassung-review.html`:
 * aufklappbare Quellenanalyse, finaler Fließtext + Meta, Prüf-Checkliste,
 * Aktionsleiste. Im freigegebenen Zustand: nur „Gutachten-Vorlage erstellen".
 */
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { splitSentences, VB_KUERZEN_HINWEIS, type SkillModifierKey } from '@/core/services/skills';
import type { ThinkingBudget } from '@/core/services/ai/llm-thinking';
import { CheckList } from './CheckList';
import { VersionVerlauf } from './VersionVerlauf';
import { ThinkingControl } from './ThinkingControl';
import { StreamingVorschau } from './StreamingVorschau';
import { formatDate } from './kurzfassung-verlauf';
import type { KurzfassungRecord } from './types';

interface Props {
  record: KurzfassungRecord;
  busy: boolean;
  llmAvailable: boolean | null;
  onModify: (modifier: SkillModifierKey) => void;
  onPruefen: () => void;
  onFreigeben: () => void;
  onVerwerfen: () => void;
  onStop: () => void;
  onCreateVorlage: () => void;
  onUebernehmen: (index: number) => void;
  /** Öffnet den Tweak-Editor (User-Tweaks v2) — Einstieg in der Aktionsleiste. */
  onOpenTweak: () => void;
  /** Thinking-/Reasoning-Budget für die nächste Generierung (Default aus der Einstellung, hier übersteuerbar). */
  thinkingBudget: ThinkingBudget;
  onSetThinkingBudget: (budget: ThinkingBudget) => void;
  /** Live-Streaming-Vorschau während `busy`. */
  streamContent: string;
  streamThinking: string;
}

const TWEAK_LINK = 'inline-flex items-center gap-1 text-[12.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]';

export function ReviewCard({
  record, busy, llmAvailable, onModify, onPruefen, onFreigeben, onVerwerfen, onStop, onCreateVorlage, onUebernehmen, onOpenTweak, thinkingBudget, onSetThinkingBudget, streamContent, streamThinking,
}: Props): React.ReactElement {
  const freigegeben = record.status === 'freigegeben';
  const satzanzahl = splitSentences(record.finalerText).length;
  const genDisabled = busy || llmAvailable === false;

  return (
    <div className="mt-3">
      {record.warnung && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          {record.warnung}
        </div>
      )}

      {record.vbGekuerzt && (
        <div className="mb-3 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          ⚠ Die Vorhabensbeschreibung war zu lang fürs LLM-Kontextfenster und wurde für die Analyse gekürzt — der Schluss floss nicht in diese Kurzfassung ein. {VB_KUERZEN_HINWEIS}
        </div>
      )}

      {/* Quellenanalyse (aufklappbar, im Entwurf offen) */}
      {record.quellenanalyse && (
        <CollapsibleSection label="Quellenanalyse" defaultOpen={!freigegeben}>
          <div className="pb-3">
            <MarkdownRenderer content={record.quellenanalyse} />
          </div>
        </CollapsibleSection>
      )}

      {/* Finaler Text — bewusst Markdown (Skill-Format, z.B. „**Kurztitel:** …") wie die Quellenanalyse rendern. */}
      <div className="mt-4">
        <div className="text-[13.5px] leading-[1.7] text-[var(--tf-text)]">
          <MarkdownRenderer content={record.finalerText} />
        </div>
        <div className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
          {satzanzahl} {satzanzahl === 1 ? 'Satz' : 'Sätze'} · {freigegeben ? `freigegeben am ${formatDate(record.freigegeben_am ?? record.erstellt_am)}` : `generiert am ${formatDate(record.erstellt_am)}`}
          {record.mitTweak ? ' · mit persönlichem Stil' : ''}
        </div>
      </div>

      {/* Denkprozess (Reasoning/Thinking) — aufklappbar, wenn das Modell welchen lieferte */}
      {record.denkprozess ? (
        <div className="mt-4">
          <CollapsibleSection label="Denkprozess" defaultOpen={false}>
            <div className="pb-2 text-[12.5px] leading-[1.6] text-[var(--tf-text-secondary)] whitespace-pre-wrap max-h-[360px] overflow-auto">
              {record.denkprozess}
            </div>
          </CollapsibleSection>
        </div>
      ) : record.denkprozessAngefordert ? (
        <div className="mt-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Thinking war aktiv, aber das Modell hat keinen separaten Denkprozess geliefert — möglicherweise unterstützt das genutzte Modell / der Server kein Reasoning.
        </div>
      ) : null}

      {/* Versionsverlauf (Vorfassungen vergleichen & zurückholen) */}
      <VersionVerlauf
        versions={record.verlauf ?? []}
        aktuellerText={record.finalerText}
        aktuellErstelltAm={record.erstellt_am}
        busy={busy}
        onUebernehmen={onUebernehmen}
      />

      {/* Prüf-Ergebnis */}
      {record.checks.length > 0 && (
        <div className="mt-5">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] mb-2.5">Prüf-Ergebnis</div>
          <CheckList checks={record.checks} />
        </div>
      )}

      {/* Aktionsleiste */}
      <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--tf-border)]">
        {freigegeben ? (
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={onCreateVorlage}>
              Gutachten-Vorlage erstellen
            </Button>
            <span className="flex-1" />
            <button type="button" className={TWEAK_LINK} onClick={onOpenTweak}>
              <SlidersHorizontal size={13} />
              Persönlicher Stil
            </button>
          </div>
        ) : busy ? (
          <StreamingVorschau thinking={streamThinking} content={streamContent} onStop={onStop} />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="primary" onClick={onFreigeben}>Freigeben</Button>
              <Button variant="secondary" disabled={genDisabled} onClick={() => onModify('neu')}>Neu</Button>
              <Button variant="secondary" disabled={genDisabled} onClick={() => onModify('kuerzer')}>Kürzer</Button>
              <Button variant="secondary" disabled={genDisabled} onClick={() => onModify('laenger')}>Länger</Button>
              <ThinkingControl budget={thinkingBudget} onChange={onSetThinkingBudget} disabled={busy} />
              <Button variant="secondary" onClick={onPruefen}>Prüfen</Button>
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

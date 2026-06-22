/**
 * „Quelle & Prüfung"-Panel des Werkstatt-Layouts (Design-Handoff
 * `workflow-mit-bearbeiten`): zeigt den Antragsbezug (Quellenanalyse), das
 * deterministische Prüf-Ergebnis, beratende KI-QS-Hinweise und den Denkprozess
 * des AKTIVEN Abschnitts — gegengelesen neben dem Entwurf.
 *
 * Zwei Ausprägungen:
 *  - `variant="side"`: rechte Spalte (sticky), per Chevron einklappbar; der
 *    eingeklappte 42px-Reopen-Streifen rendert der Container (GutachtenSection).
 *  - `variant="block"`: voll-breiter Block unter der Karte (schmaler Container,
 *    einspaltiger Fallback) — nicht einklappbar.
 *
 * Reines Anzeige-Substrat aus `StepRun` — keine Prototyp-Fiktion: der
 * „Antragsbezug" ist die echte `quellenanalyse`, die Prüfung sind die echten
 * `checks`, der Denkprozess das echte Reasoning.
 */
import { Quote, ChevronRight } from 'lucide-react';
import { CollapsibleSection, MarkdownRenderer } from '@/ui';
import { CheckList } from '../kurzfassung/CheckList';
import { QsHinweisList } from './QsHinweisList';
import { AmpelGruppe } from './AmpelGruppe';
import { groupChecksByKategorie } from './checkGruppen';
import type { StepRun } from './types';

interface Props {
  step: StepRun;
  /** Provenance für die Fußzeile („generiert von …"). */
  provenance?: { skillName: string; version?: number };
  variant: 'side' | 'block';
  /** Nur `variant="side"`: Panel einklappen (Container rendert dann den Reopen-Streifen). */
  onCollapse?: () => void;
  /** Nur `variant="side"`: Pointer-Down auf der linken Ziehleiste (Breite anpassen). */
  onResizeStart?: (e: React.PointerEvent) => void;
}

export function KontextPanel({ step, provenance, variant, onCollapse, onResizeStart }: Props): React.ReactElement {
  const offen = step.checks.filter(c => c.level !== 'ok').length;
  const qs = step.qsHinweise ?? [];

  return (
    <aside className={`g-context${variant === 'block' ? ' block' : ''}`}>
      {variant === 'side' && onResizeStart && (
        <div
          className="g-ctx-resize"
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Panel-Breite anpassen"
          title="Breite ziehen"
        />
      )}
      <div className="g-ctx-head">
        <span>Quelle &amp; Prüfung</span>
        {variant === 'side' && onCollapse && (
          <button type="button" className="g-ctx-collapse" title="Einklappen — nur den Entwurf lesen" onClick={onCollapse}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {step.quellenanalyse && (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">Antragsbezug</div>
          <div className="g-quotecard">
            <Quote className="g-qci" />
            <div className="g-quote-md"><MarkdownRenderer content={step.quellenanalyse} /></div>
          </div>
        </div>
      )}

      {step.checks.length > 0 && (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">
            Prüfung · {step.checks.length} {step.checks.length === 1 ? 'Regel' : 'Regeln'}
            {offen > 0 && <span className="g-ctx-fail">{offen} offen</span>}
          </div>
          <div className="flex flex-col">
            {groupChecksByKategorie(step.checks).map(g => (
              <AmpelGruppe
                key={g.kategorie}
                label={g.label}
                level={g.worst}
                summary={g.summary}
                count={g.checks.length}
                defaultOpen={g.worst !== 'ok'}
              >
                <CheckList checks={g.checks} />
              </AmpelGruppe>
            ))}
          </div>
        </div>
      )}

      {qs.length > 0 && (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">KI-Qualitätshinweis · beratend</div>
          <QsHinweisList befunde={qs} />
        </div>
      )}

      {step.denkprozess ? (
        <div className="g-ctx-block">
          <CollapsibleSection label="Denkprozess" defaultOpen={false}>
            <p className="g-ctx-text">{step.denkprozess}</p>
          </CollapsibleSection>
        </div>
      ) : step.denkprozessAngefordert ? (
        <div className="g-ctx-block">
          <p className="g-ctx-text">
            Thinking war aktiv, aber das Modell hat keinen separaten Denkprozess geliefert.
          </p>
        </div>
      ) : null}

      {provenance && (
        <div className="g-ctx-foot">
          <span className="g-model">
            generiert von: {provenance.skillName}{provenance.version != null ? ` v${provenance.version}` : ''}
          </span>
        </div>
      )}
    </aside>
  );
}

/**
 * „Quelle & KI-Hinweise"-Panel des Werkstatt-Layouts (Design-Handoff
 * `workflow-mit-bearbeiten`): zeigt den Antragsbezug (Quellenanalyse), beratende
 * KI-QS-Hinweise und den Denkprozess des AKTIVEN Abschnitts — gegengelesen neben
 * dem Entwurf. Die deterministische Regelprüfung sitzt bewusst NICHT hier, sondern
 * links am Text (`PruefBlock` in `SectionReviewCard`).
 *
 * Zwei Ausprägungen:
 *  - `variant="side"`: rechte Spalte (sticky), per Chevron einklappbar; der
 *    eingeklappte 42px-Reopen-Streifen rendert der Container (GutachtenSection).
 *  - `variant="block"`: voll-breiter Block unter der Karte (schmaler Container,
 *    einspaltiger Fallback) — nicht einklappbar.
 *
 * Reines Anzeige-Substrat aus `StepRun` — keine Prototyp-Fiktion: der
 * „Antragsbezug" ist die echte `quellenanalyse`, der Denkprozess das echte Reasoning.
 */
import { useMemo } from 'react';
import { Quote, ChevronRight } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { splitSentences } from '@/core/services/skills';
import type { QuellenBeleg } from '@/core/services/skills';
import { BelegKarten } from './BelegKarten';
import { extrahiereZitate, ordneSaetzeZu } from './belegAbleitung';
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
  /**
   * Beleg↔Satz-Verknüpfung (Journey-Paket 4, Phase 6): flüchtiges Hover-Highlight +
   * Klick-Pin. Sind alle drei gesetzt UND trägt der Schritt `belege`, rendert der
   * Antragsbezug als Beleg-Karten; sonst exakt das heutige flache Rendering.
   */
  hoverSaetze?: number[] | null;
  onHoverSaetze?: (saetze: number[] | null) => void;
  onPinSatz?: (satzIndex: number) => void;
}

export function KontextPanel({
  step, provenance, variant, onCollapse, onResizeStart, hoverSaetze, onHoverSaetze, onPinSatz,
}: Props): React.ReactElement {
  const satzAnzahl = useMemo(() => splitSentences(step.finalerText).length, [step.finalerText]);
  // Marker bevorzugt; fehlen sie, die Satz↔Zitat-Zuordnung deterministisch ableiten
  // (reine Anzeige, nicht persistiert — wirkt auch rückwirkend für Alt-Läufe).
  const anzeigeBelege = useMemo<QuellenBeleg[]>(() => {
    if (step.belege?.length) return step.belege;
    if (!step.quellenanalyse?.trim()) return [];
    return ordneSaetzeZu(extrahiereZitate(step.quellenanalyse), step.finalerText);
  }, [step.belege, step.quellenanalyse, step.finalerText]);
  const belegeAbgeleitet = anzeigeBelege.length > 0 && !step.belege?.length;
  const zeigeBelege = !!(anzeigeBelege.length && onHoverSaetze && onPinSatz);

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
        <span>Quelle &amp; KI-Hinweise</span>
        {variant === 'side' && onCollapse && (
          <button type="button" className="g-ctx-collapse" title="Einklappen — nur den Entwurf lesen" onClick={onCollapse}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {zeigeBelege ? (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">
            Antragsbezug
            {belegeAbgeleitet && (
              <span
                className="g-ctx-auto"
                title="Automatisch aus Wortüberlappung zugeordnet — kein Modell-Beleg."
              >
                · automatisch zugeordnet
              </span>
            )}
          </div>
          <BelegKarten
            belege={anzeigeBelege}
            satzAnzahl={satzAnzahl}
            hoverSaetze={hoverSaetze ?? null}
            onHover={onHoverSaetze!}
            onPin={onPinSatz!}
          />
        </div>
      ) : step.quellenanalyse ? (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">Antragsbezug</div>
          <div className="g-quotecard">
            <Quote className="g-qci" />
            <div className="g-quote-md"><MarkdownRenderer content={step.quellenanalyse} /></div>
          </div>
        </div>
      ) : null}

      {/* Die QS-Befunde standen hier bis v2.337 ein zweites Mal. Sie leben jetzt
          ausschließlich im QS-Strip der Karte — direkt an den Sätzen, die sie
          betreffen, und dort auch anklickbar. Zwei Darstellungen derselben Daten
          hätten synchron gehalten werden müssen. */}

      {step.entwurf ? (
        <div className="g-ctx-block">
          {/* Neutral beschriftet: das Panel rendert für JEDEN Abschnitt. Nur der
              C-Skill beschreibt seinen `### Entwurf` als vollständige
              Risiko-Liste; der A-Skill fordert unter derselben Überschrift „ein
              erster, noch ungeschliffener Entwurf der Kurzfassung". Die Zusage
              „alle genannten Risiken" war mit dem Panel mitgewandert (v4.124). */}
          <CollapsibleSection label="Entwurf (vor dem Feinschliff)" defaultOpen={false}>
            <div className="g-ctx-text"><MarkdownRenderer content={step.entwurf} /></div>
          </CollapsibleSection>
        </div>
      ) : null}

      {/* Der Denkprozess stand hier bis v6.5. Er lebt jetzt in der Fußzeile der
          Abschnitts-Karte (`AbschnittFuss`) — dieses Panel ist einklappbar und im
          Alltag zu, während der Denkprozess zu der Fassung gehört, die er
          erklärt. Nur EINE Darstellung, aus demselben Grund wie bei den
          QS-Befunden (v2.337): zwei müsste jemand synchron halten. */}

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

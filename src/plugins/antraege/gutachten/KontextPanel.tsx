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
import { useMemo } from 'react';
import { Quote, ChevronRight } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { splitSentences } from '@/core/services/skills';
import type { QuellenBeleg } from '@/core/services/skills';
import { CheckList, type CheckListAktion } from '../kurzfassung/CheckList';
import { QsHinweisList } from './QsHinweisList';
import { AmpelGruppe } from './AmpelGruppe';
import { BelegKarten } from './BelegKarten';
import { extrahiereZitate, ordneSaetzeZu } from './belegAbleitung';
import { groupChecksByKategorie } from './checkGruppen';
import { pruefSummary } from './pruefSummary';
import { qsRollup } from './qs';
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
   * Prüfpanel-Aktionen (Journey-Paket 3, opt-in): regel-gebundene KI-Korrektur je
   * Fehler-Check + (Phase 4) Fundstellen-Sprung. Fehlt → nur-Anzeige wie bisher.
   */
  aktion?: CheckListAktion;
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
  step, provenance, variant, onCollapse, onResizeStart, aktion, hoverSaetze, onHoverSaetze, onPinSatz,
}: Props): React.ReactElement {
  const { fehler, hinweis } = pruefSummary(step.checks);
  const qs = step.qsHinweise ?? [];
  const qsR = qs.length > 0 ? qsRollup(qs) : null;
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
        <span>Quelle &amp; Prüfung</span>
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

      {step.checks.length > 0 && (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">
            Prüfung · {step.checks.length} {step.checks.length === 1 ? 'Regel' : 'Regeln'}
            {fehler > 0 && (
              <span className="ml-auto font-medium normal-case tracking-normal text-[var(--tf-danger-text)]">{fehler} Fehler</span>
            )}
            {hinweis > 0 && (
              <span className={`font-medium normal-case tracking-normal text-[var(--tf-warning-text)]${fehler === 0 ? ' ml-auto' : ''}`}>
                {hinweis} {hinweis === 1 ? 'Hinweis' : 'Hinweise'}
              </span>
            )}
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
                <CheckList checks={g.checks} aktion={aktion} />
              </AmpelGruppe>
            ))}
          </div>
        </div>
      )}

      {qs.length > 0 && qsR && (
        <div className="g-ctx-block">
          <div className="g-ctx-cap">KI-Qualitätshinweis · beratend</div>
          <AmpelGruppe
            label="Befunde"
            level={qsR.level}
            summary={qsR.summary}
            count={qs.length}
            defaultOpen={qsR.level !== 'ok'}
          >
            <QsHinweisList befunde={qs} />
          </AmpelGruppe>
        </div>
      )}

      {step.entwurf ? (
        <div className="g-ctx-block">
          <CollapsibleSection label="Entwurf — alle genannten Risiken" defaultOpen={false}>
            <div className="g-ctx-text"><MarkdownRenderer content={step.entwurf} /></div>
          </CollapsibleSection>
        </div>
      ) : null}

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

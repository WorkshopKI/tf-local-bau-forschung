/**
 * Gutachten-Sektion auf der Verbund-Detailseite (Feature-Flag `gutachtenWorkflow`):
 * der vollständige Workflow A–G im „Werkstatt"-Layout (Design-Handoff
 * `workflow-mit-bearbeiten`) — Antrag-Kontextkarte + Fortschrittsleiste oben, dann
 * 3-spaltiges Grid: Stepper-Rail · aktive Entwurf-Karte · einklappbares
 * „Quelle & Prüfung"-Panel. Schmaler Container → einspaltiger Fallback
 * (horizontaler Stepper, Panel als Block). Funktioniert ohne LLM (freigegebene
 * Stände + Export bleiben nutzbar; nur Generieren/Modifier degradieren).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { FileText, Check, Pencil, ChevronLeft } from 'lucide-react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import { KonvertierungReviewDialog } from '@/core/components/KonvertierungReviewDialog';
import { maxConversionLevel } from '@/core/services/converter';
import { vbUeberschreitetCap, VB_KUERZEN_HINWEIS } from '@/core/services/skills';
import { getVbCharCap, getLlmContextTokens } from '@/core/services/ai/llm-context';
import type { Antrag } from '@/core/services/csv/types';
import {
  ankerFuer, ankerKeyGueltig, type AbschnittEinfuegung, type AbschnittAnzeige,
} from '@/core/services/gutachten-vorlagen';
import { VorlageDialog } from '../kurzfassung/VorlageDialog';
import { TweakEditor } from '../kurzfassung/TweakEditor';
import { ThinkingControl } from '../kurzfassung/ThinkingControl';
import { StreamingVorschau } from '../kurzfassung/StreamingVorschau';
import type { KurzfassungContext } from '../kurzfassung/types';
import { useGutachtenWorkflow } from './useGutachtenWorkflow';
import { AbschnittNav } from './AbschnittNav';
import { AbschnittStepper } from './AbschnittStepper';
import { SectionReviewCard } from './SectionReviewCard';
import { KontextPanel } from './KontextPanel';
import { ResumeLine } from './ResumeLine';
import { leereSchritte } from './runner';
import type { WorkflowStep } from '@/core/services/skills';
import type { WorkflowRun } from './types';
import './gutachten.css';

/** Container-Mindestbreite für das 3-spaltige Werkstatt-Grid; darunter einspaltig. */
const WERK_MIN_WIDTH = 1040;

export function GutachtenSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const ctrl = useGutachtenWorkflow(ctx);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  // Kontext-Panel ein-/ausgeklappt (Werkstatt; persistiert nur im Session-State).
  const [ctxOpen, setCtxOpen] = useState(true);

  // Container-Breite messen → 3-spaltiges Grid (breit) vs. einspaltig (schmal).
  // Default groß: bis zur ersten Messung breit rendern (kein Flackern).
  const [bodyWidth, setBodyWidth] = useState(9999);
  const roRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((el: HTMLDivElement | null): void => {
    roRef.current?.disconnect();
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setBodyWidth(w);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  const { run, vbDokument: vbDok, steps } = ctrl;
  const order = steps.map(s => s.id);
  const vbLvl = maxConversionLevel(vbDok?.conversion);
  const vbWarnung = vbDok?.conversion?.warnings.find(w => w.level === 'warnung')?.message ?? '';
  const tweakEffektiv = !!(ctrl.tweak?.aktiv && (ctrl.tweak.stilHinweise.trim() || ctrl.tweak.beispielFormulierungen.trim()));

  const freigegebenCount = run ? steps.filter(d => run.schritte[d.id]?.status === 'freigegeben').length : 0;
  const alleFreigegeben = run ? steps.length > 0 && freigegebenCount === steps.length : false;
  // Gibt es noch fehlende (leere) Abschnitte? → „Alle Abschnitte erstellen" anbieten.
  const hatLeere = run ? leereSchritte(run, order).length > 0 : false;
  // Der rechts dargestellte aktive Abschnitt (Controller garantiert eine
  // gültige aktiverSchritt-ID; Fallback auf den ersten Step defensiv).
  const activeDef = run ? (steps.find(d => d.id === run.aktiverSchritt) ?? steps[0]) : undefined;
  const activeStep = run && activeDef ? run.schritte[activeDef.id] : undefined;

  // Layout-Entscheidung: einspaltig unterhalb der Schwelle.
  const solo = bodyWidth < WERK_MIN_WIDTH;
  // Panel nur zeigen, wenn der aktive Abschnitt einen Stand hat (sonst nichts zum Gegenlesen).
  const showPanel = !!activeStep;
  const gridClass = solo
    ? 'g-werk solo'
    : !showPanel
      ? 'g-werk no-ctx'
      : ctxOpen ? 'g-werk' : 'g-werk ctx-closed';
  const panelProvenance = activeStep
    ? { skillName: ctrl.activeSkill?.name ?? activeStep.skillId ?? '—', ...(activeStep.skillVersion != null ? { version: activeStep.skillVersion } : {}) }
    : undefined;

  // Synthetischer „Antrag" als Feld-Quelle für den DOCX-Füller (Verbund-Ebene).
  const mappingAntrag = useMemo<Antrag>(() => ({
    aktenzeichen: ctx.foerderkennzeichen,
    programm_id: '',
    ...(ctx.titel ? { titel: ctx.titel } : {}),
    ...(ctx.antragsteller ? { antragsteller: ctx.antragsteller } : {}),
    _field_sources: {},
    _updated_at: '',
  }), [ctx.foerderkennzeichen, ctx.titel, ctx.antragsteller]);

  // Export: freigegebene Abschnitte (mit gültigem Anker + Text) + Anzeige-Liste.
  // Schritte ohne gültigen DOCX-Anker (z.B. Unterschritte) werden sauber übersprungen.
  const exportSections: AbschnittEinfuegung[] = run
    ? steps.flatMap(d => {
        const s = run.schritte[d.id];
        return s?.status === 'freigegeben' && ankerKeyGueltig(d.ankerKey)
          ? [{ id: d.ankerKey, anker: ankerFuer('EP', d.ankerKey), finalerText: s.finalerText }]
          : [];
      })
    : [];
  const abschnitteAnzeige: AbschnittAnzeige[] = steps.flatMap(d =>
    ankerKeyGueltig(d.ankerKey)
      ? [{
          id: d.ankerKey,
          label: d.label,
          anker: ankerFuer('EP', d.ankerKey),
          freigegeben: run?.schritte[d.id]?.status === 'freigegeben',
        }]
      : [],
  );

  return (
    <div className="gutachten-werkstatt">
      {/* Fortschritt + Aktionen */}
      <div className="g-progress">
        <div className="g-progress-l">
          <span className="g-gtitle">Gutachten</span>
          {run && <span className="g-pcount">{freigegebenCount} von {steps.length} Abschnitten freigegeben</span>}
        </div>
        {ctrl.vbVorhanden && run && (hatLeere || ctrl.bulkRunning) && (
          ctrl.bulkRunning ? (
            <button type="button" className="g-btn" onClick={ctrl.stop}>Stopp</button>
          ) : (
            <button
              type="button"
              className="g-btn"
              disabled={ctrl.busy || ctrl.llmAvailable === false}
              onClick={ctrl.alleGenerieren}
              title="Erzeugt alle noch fehlenden Abschnitte nacheinander als Entwurf — ohne Zwischen-Freigabe."
            >
              Alle Abschnitte erstellen
            </button>
          )
        )}
        <button
          type="button"
          className={`g-btn export${alleFreigegeben ? ' ready' : ''}`}
          disabled={freigegebenCount === 0}
          onClick={() => setDialogOpen(true)}
        >
          <FileText size={15} />
          In Vorlage exportieren
          {freigegebenCount > 0 && <span className="g-exbadge">{freigegebenCount} Abschnitte</span>}
        </button>
      </div>

      {ctrl.bulkRunning && (
        <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
          <span className="w-3 h-3 rounded-full border-[1.5px] border-[var(--tf-text-tertiary)] border-t-transparent animate-spin" />
          Erstelle Entwürfe — Abschnitt {ctrl.aktiverSchritt}…
        </div>
      )}

      {ctrl.error && (
        <div className="my-2 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">{ctrl.error}</div>
      )}

      {ctrl.loading || !run ? (
        <div className="py-3 text-[13px] text-[var(--tf-text-tertiary)]">Laden…</div>
      ) : !ctrl.vbVorhanden ? (
        <div className="py-2">
          <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
            Für das Gutachten wird die Vorhabensbeschreibung (VB) des Verbundes benötigt. Legen Sie sie hier ab —
            das Förderkennzeichen wird aus dem Dateinamen erkannt.
          </p>
          <DokumentAufnahme relationTag={ctx.key} knownIds={ctx.knownIds} onIngested={ctrl.refreshVb} />
        </div>
      ) : (
        <>
          {/* VB-Info / Ersetzen */}
          {ersetzen ? (
            <div className="mb-4">
              <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">
                Neue Vorhabensbeschreibung hochladen — die neueste ersetzt die bisherige für das Gutachten.
              </p>
              <DokumentAufnahme relationTag={ctx.key} knownIds={ctx.knownIds} onIngested={() => { ctrl.refreshVb(); setErsetzen(false); }} />
              <button type="button" onClick={() => setErsetzen(false)} className="mt-2 text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text-secondary)]">Abbrechen</button>
            </div>
          ) : vbDok && (
            <div className="mb-4 flex items-center gap-2 flex-wrap text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span className="font-mono truncate max-w-[260px]" title={vbDok.filename}>{vbDok.filename}</span>
              <span>·</span>
              <button type="button" onClick={() => setReviewOpen(true)} className="text-[var(--tf-primary)] hover:underline">Konvertierung prüfen</button>
              <span>·</span>
              <button type="button" onClick={() => setErsetzen(true)} className="hover:text-[var(--tf-text-secondary)]">VB ersetzen</button>
              {vbLvl === 'warnung' && <span className="text-[var(--tf-warning-text)]">⚠ mögliche Konvertierungsprobleme{vbWarnung ? `: ${vbWarnung}` : ''}</span>}
            </div>
          )}

          {vbDok && vbUeberschreitetCap(vbDok.markdown, getVbCharCap()) && (
            <div className="mb-4 rounded-[8px] px-3 py-2 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)]">
              ⚠ Die VB ist sehr lang ({vbDok.markdown.length.toLocaleString('de-DE')} Zeichen, Limit ~{getVbCharCap().toLocaleString('de-DE')} aus {getLlmContextTokens().toLocaleString('de-DE')} Tokens Kontext) und würde für die Analyse gekürzt. {VB_KUERZEN_HINWEIS}
            </div>
          )}

          {/* Wiederaufnahme-Zeile (wenn aktiver Schritt in Arbeit) */}
          {run.schritte[run.aktiverSchritt]?.status === 'entwurf' && (
            <ResumeLine run={run} steps={steps} onWeiter={ctrl.weiterschaltenStep} />
          )}

          <div ref={measureRef}>
            <div className={gridClass}>
              {solo
                ? <AbschnittStepper run={run} steps={steps} onJump={ctrl.weiterschaltenStep} />
                : <AbschnittNav run={run} steps={steps} onJump={ctrl.weiterschaltenStep} />}

              {activeDef && (
                <ActiveAbschnitt def={activeDef} run={run} ctrl={ctrl} tweakEffektiv={tweakEffektiv} onOpenTweak={() => setTweakOpen(true)} />
              )}

              {/* Kontext-Panel rechts (breit) bzw. als Block (schmal) */}
              {!solo && showPanel && activeStep && (
                ctxOpen ? (
                  <KontextPanel step={activeStep} provenance={panelProvenance} variant="side" onCollapse={() => setCtxOpen(false)} />
                ) : (
                  <button type="button" className="g-ctx-reopen" onClick={() => setCtxOpen(true)} title="Quelle & Prüfung einblenden">
                    <ChevronLeft size={16} />
                    <span className="g-ctx-reopen-lbl">Quelle &amp; Prüfung</span>
                  </button>
                )
              )}

              {solo && showPanel && activeStep && (
                <KontextPanel step={activeStep} provenance={panelProvenance} variant="block" />
              )}
            </div>
          </div>
        </>
      )}

      {run && (
        <VorlageDialog
          open={dialogOpen}
          antrag={mappingAntrag}
          sections={exportSections}
          abschnitte={abschnitteAnzeige}
          onErstellt={(info) => ctrl.stampVorlage(info)}
          onClose={() => setDialogOpen(false)}
        />
      )}

      {vbDok && (
        <KonvertierungReviewDialog
          open={reviewOpen}
          filename={vbDok.filename}
          format={vbDok.format}
          pages={vbDok.pages}
          markdown={vbDok.markdown}
          report={vbDok.conversion}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {tweakOpen && ctrl.activeSkill && activeDef && (
        <TweakEditor
          skillVersion={ctrl.activeSkill.version}
          sektionLabel={`${activeDef.id} — ${activeDef.label}`}
          regeln={ctrl.regeln}
          tweak={ctrl.tweak}
          onClose={() => setTweakOpen(false)}
          onSave={ctrl.saveTweak}
          onRemove={ctrl.removeTweak}
        />
      )}
    </div>
  );
}

/** Der aktive Abschnitt als Werkstatt-Karte (Kopf + Generieren-Prompt ODER Review). */
function ActiveAbschnitt({
  def, run, ctrl, tweakEffektiv, onOpenTweak,
}: {
  def: WorkflowStep;
  run: WorkflowRun;
  ctrl: ReturnType<typeof useGutachtenWorkflow>;
  tweakEffektiv: boolean;
  onOpenTweak: () => void;
}): React.ReactElement {
  const id = def.id;
  const step = run.schritte[id];
  const status = step?.status ?? 'leer';
  const { navigate } = useNavigation();
  const skillId = step?.skillId;
  const openSkill = skillId
    ? () => navigate('skill-verwaltung-kuration', { selectedId: skillId })
    : undefined;
  const reset = useAsyncAction(async () => { await ctrl.zuruecksetzenStep(id); });

  return (
    // key = Abschnitts-ID: bei Abschnittswechsel remountet die Karte → Fade-in spielt
    // erneut und der lokale Bearbeiten-Zustand (Editor) wird sauber zurückgesetzt.
    <section className="g-card werk" key={id}>
      <div className="g-card-head">
        <h2 className="g-card-title">{def.id} — {def.label}</h2>
        {status === 'freigegeben' ? (
          <span className="g-pill ok"><Check className="g-pi" /> Freigegeben</span>
        ) : status === 'entwurf' ? (
          <span className="g-pill draft">Entwurf</span>
        ) : null}
        {step?.originalText != null && (
          <span className="g-edited-badge">
            <Pencil /> bearbeitet
            <button
              type="button"
              className="g-edited-restore"
              disabled={reset.busy}
              onClick={() => reset.run()}
              title="Ursprünglich generierten Text wiederherstellen"
            >
              Zurücksetzen
            </button>
          </span>
        )}
        {tweakEffektiv && <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">persönlicher Stil aktiv</span>}
        <span className="g-ab-spacer" />
        {step && (
          <span className="g-model"><span className="g-mdot" />{step.modell} · lokal</span>
        )}
      </div>

      {ctrl.retryNote && (
        <div className="mt-2 mb-1 text-[12px] text-[var(--tf-warning-text)] bg-[var(--tf-warning-bg)] rounded-[8px] px-3 py-2">
          {ctrl.retryNote}
        </div>
      )}

      {!step ? (
        ctrl.busy ? (
          <StreamingVorschau thinking={ctrl.streamThinking} content={ctrl.streamContent} onStop={ctrl.stop} />
        ) : (
          <div className="mt-3">
            <p className="text-[13px] text-[var(--tf-text-secondary)] mb-3">Dieser Abschnitt wird KI-gestützt aus der Vorhabensbeschreibung erstellt.</p>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="g-btn primary" disabled={ctrl.llmAvailable === false} onClick={() => ctrl.generate(id)}>
                {def.label} generieren
              </button>
              <ThinkingControl budget={ctrl.thinkingBudget} onChange={ctrl.setThinkingBudget} disabled={ctrl.busy} />
              {ctrl.kontextRelevant && (
                <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)] cursor-pointer select-none" title="Ignoriert die Relevanz-Map und übergibt die vollständige Vorhabensbeschreibung.">
                  <input
                    type="checkbox"
                    className="accent-[var(--tf-primary)]"
                    checked={ctrl.forceFullContext}
                    disabled={ctrl.busy}
                    onChange={(e) => ctrl.setForceFullContext(e.target.checked)}
                  />
                  Vollständigen Kontext erzwingen
                </label>
              )}
            </div>
            {ctrl.llmAvailable === false && (
              <div className="mt-2 text-[11.5px] text-[var(--tf-warning-text)]">KI nicht erreichbar — Generierung derzeit nicht möglich.</div>
            )}
          </div>
        )
      ) : (
        <SectionReviewCard
          run={step}
          busy={ctrl.busy}
          llmAvailable={ctrl.llmAvailable}
          onModify={(m) => ctrl.modify(id, m)}
          onBearbeiten={(text) => ctrl.bearbeitenStep(id, text)}
          onPruefen={() => ctrl.pruefen(id)}
          onFreigeben={() => ctrl.freigebenStep(id)}
          onVerwerfen={() => ctrl.verwerfenStep(id)}
          onStop={ctrl.stop}
          onUebernehmen={(i) => ctrl.uebernehmenStep(id, i)}
          onErneutOeffnen={() => ctrl.erneutOeffnenStep(id)}
          onOpenTweak={onOpenTweak}
          onQs={ctrl.qsFor(id) ? () => ctrl.runQs(id) : undefined}
          provenance={{ skillName: ctrl.activeSkill?.name ?? step.skillId ?? '—', regelCount: ctrl.regeln.length }}
          onOpenSkill={openSkill}
          onFeedback={(rating, notiz) => ctrl.sendFeedback(id, rating, notiz)}
          thinkingBudget={ctrl.thinkingBudget}
          onSetThinkingBudget={ctrl.setThinkingBudget}
          streamContent={ctrl.streamContent}
          streamThinking={ctrl.streamThinking}
        />
      )}
    </section>
  );
}

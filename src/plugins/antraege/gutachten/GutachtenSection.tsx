/**
 * Gutachten-Sektion auf der Verbund-Detailseite (Feature-Flag `gutachtenWorkflow`):
 * der vollständige Workflow A–G. Kopf mit Fortschritt + Export, Abschnitts-Stepper,
 * freigegebene Abschnitte als zugeklappte Zeilen, der aktive Abschnitt als geöffnete
 * Review-Karte, wartende Abschnitte inert. Funktioniert ohne LLM (freigegebene
 * Stände + Export bleiben nutzbar; nur Generieren/Modifier degradieren).
 */
import { useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
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
import { AbschnittStepper } from './AbschnittStepper';
import { SectionReviewCard } from './SectionReviewCard';
import { AbschnittRow } from './AbschnittRow';
import { ResumeLine } from './ResumeLine';
import { fruehereInArbeit } from './runner';
import type { WorkflowStep } from '@/core/services/skills';
import type { WorkflowRun } from './types';

const BTN_PRIMARY = 'px-4 py-2 rounded-[8px] text-[13px] bg-[var(--tf-text)] text-[var(--tf-bg)] hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2';

export function GutachtenSection({ ctx }: { ctx: KurzfassungContext }): React.ReactElement {
  const ctrl = useGutachtenWorkflow(ctx);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);

  const { run, vbDokument: vbDok, steps } = ctrl;
  const order = steps.map(s => s.id);
  const vbLvl = maxConversionLevel(vbDok?.conversion);
  const vbWarnung = vbDok?.conversion?.warnings.find(w => w.level === 'warnung')?.message ?? '';
  const tweakEffektiv = !!(ctrl.tweak?.aktiv && (ctrl.tweak.stilHinweise.trim() || ctrl.tweak.beispielFormulierungen.trim()));

  const freigegebenCount = run ? steps.filter(d => run.schritte[d.id]?.status === 'freigegeben').length : 0;

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
    <div>
      {/* Sektionskopf */}
      <div className="flex items-center gap-3.5 mb-4">
        <span className="text-[16px] font-medium text-[var(--tf-text)]">Gutachten</span>
        {run && <span className="text-[12px] text-[var(--tf-text-tertiary)]">{freigegebenCount} von {steps.length} Abschnitten freigegeben</span>}
        <span className="flex-1" />
        <button type="button" className={BTN_PRIMARY} disabled={freigegebenCount === 0} onClick={() => setDialogOpen(true)}>
          In Vorlage exportieren
          {freigegebenCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/15">{freigegebenCount} Abschnitte</span>}
        </button>
      </div>

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

          <AbschnittStepper run={run} steps={steps} onJump={ctrl.weiterschaltenStep} />

          {steps.map(def => {
            const step = run.schritte[def.id];
            const isActive = def.id === run.aktiverSchritt;
            if (isActive) return <ActiveAbschnitt key={def.id} def={def} run={run} ctrl={ctrl} tweakEffektiv={tweakEffektiv} onOpenTweak={() => setTweakOpen(true)} />;
            if (step) {
              const freigegeben = step.status === 'freigegeben';
              return (
                <AbschnittRow
                  key={def.id}
                  def={def}
                  step={step}
                  konsistenzHinweis={freigegeben && fruehereInArbeit(run, def.id, order)}
                  oeffnenLabel={freigegeben ? 'Erneut öffnen' : 'Öffnen'}
                  onOeffnen={() => (freigegeben ? ctrl.erneutOeffnenStep(def.id) : ctrl.weiterschaltenStep(def.id))}
                />
              );
            }
            return <AbschnittRow key={def.id} def={def} wartetAufLabel={run.aktiverSchritt} />;
          })}
        </>
      )}

      {run && (
        <VorlageDialog
          open={dialogOpen}
          antrag={mappingAntrag}
          sections={exportSections}
          abschnitte={abschnitteAnzeige}
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

      {tweakOpen && ctrl.activeSkill && (
        <TweakEditor
          skillVersion={ctrl.activeSkill.version}
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

/** Der aktive Abschnitt als geöffnete Karte (Kopf + Generieren-Prompt ODER Review). */
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

  return (
    <div className="my-2 rounded-[12px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg)] px-6 py-5">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[14px] font-medium text-[var(--tf-text)]">{def.id} — {def.label}</span>
        {status === 'freigegeben' ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">✓ Freigegeben</span>
        ) : status === 'entwurf' ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">Entwurf — nicht freigegeben</span>
        ) : null}
        <span className="flex-1" />
        {step && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(145,60%,42%)' }} />
            {step.modell} · lokal
          </span>
        )}
      </div>
      {tweakEffektiv && (
        <div className="mb-1 text-[10.5px] text-[var(--tf-text-tertiary)]">persönlicher Stil aktiv</div>
      )}

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
              <button type="button" className={BTN_PRIMARY} disabled={ctrl.llmAvailable === false} onClick={() => ctrl.generate(id)}>
                {def.label} generieren
              </button>
              <ThinkingControl budget={ctrl.thinkingBudget} onChange={ctrl.setThinkingBudget} disabled={ctrl.busy} />
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
    </div>
  );
}

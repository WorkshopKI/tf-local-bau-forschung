/**
 * Gutachten-Sektion auf der Verbund-Detailseite (Feature-Flag `gutachtenWorkflow`):
 * der vollständige Workflow A–G im „Werkstatt"-Layout (Design-Handoff
 * `workflow-mit-bearbeiten`) — Antrag-Kontextkarte + Fortschrittsleiste oben, dann
 * 3-spaltiges Grid: Stepper-Rail · aktive Entwurf-Karte · einklappbares
 * „Quelle & Prüfung"-Panel. Schmaler Container → einspaltiger Fallback
 * (horizontaler Stepper, Panel als Block). Funktioniert ohne LLM (freigegebene
 * Stände + Export bleiben nutzbar; nur Generieren/Modifier degradieren).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Check, Pencil, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { DokumentAufnahme } from '@/core/components/DokumentAufnahme';
import { KonvertierungReviewDialog } from '@/core/components/KonvertierungReviewDialog';
import { maxConversionLevel } from '@/core/services/converter';
import { vbUeberschreitetCap, VB_KUERZEN_HINWEIS } from '@/core/services/skills';
import { erlaubeWorkflowEntwuerfe } from '@/config/feature-flags';
import { ARTEFAKT_TYP_LABEL } from '@/plugins/skill-verwaltung-kuration/workflowShared';
import { getVbCharCap, getLlmContextTokens } from '@/core/services/ai/llm-context';
import type { Antrag } from '@/core/services/csv/types';
import {
  ankerFuer, ankerKeyGueltig, type AbschnittEinfuegung, type AbschnittAnzeige,
} from '@/core/services/gutachten-vorlagen';
import { VorlageDialog } from '../kurzfassung/VorlageDialog';
import { TweakEditor } from '../kurzfassung/TweakEditor';
import { StreamingVorschau } from '../kurzfassung/StreamingVorschau';
import type { KurzfassungContext } from '../kurzfassung/types';
import { useGutachtenWorkflow } from './useGutachtenWorkflow';
import { AbschnittNav } from './AbschnittNav';
import { AbschnittStepper } from './AbschnittStepper';
import { SectionReviewCard } from './SectionReviewCard';
import { KontextPanel } from './KontextPanel';
import type { CheckListAktion } from '../kurzfassung/CheckList';
import { ResumeLine } from './ResumeLine';
import { leereSchritte } from './runner';
import type { WorkflowStep } from '@/core/services/skills';
import type { StepId, WorkflowRun } from './types';
import './gutachten.css';

/** Container-Mindestbreite für das 3-spaltige Werkstatt-Grid; darunter einspaltig. */
const WERK_MIN_WIDTH = 1040;

// Resize-Breiten der Rail/des Kontext-Panels als UI-Pref persistieren (localStorage —
// file://-tauglich, laut CLAUDE.md für einfache UI-Prefs erlaubt; vgl. useCollapsedSection).
const RAIL_W_KEY = 'teamflow_gutachten_rail_w';
const CTX_W_KEY = 'teamflow_gutachten_ctx_w';
const RAIL_COLLAPSED_KEY = 'teamflow_gutachten_rail_collapsed';
/** Breite der eingeklappten Rail (nur Kreise, kein Label) — analog Handoff-Icons-Modus. */
const RAIL_COLLAPSED_W = 56;
/**
 * Kleinstmögliche Breite der mittleren Entwurf-Karte beim Verbreitern des Panels.
 * Bewusst niedrig — der Nutzer darf die Quelle-Karte dominant ziehen; nur diese
 * lesbare Restbreite bleibt der Entwurf-Spalte reserviert (kein 620px-Hardcap mehr).
 */
const CARD_MIN_WIDTH = 260;
/** Panel-Mindestbreite (Kontext-Panel rechts). */
const CTX_MIN_W = 280;
/** Obergrenze fürs Persistieren — nur ein Sanity-Cap; die echte Grenze rechnet der Container. */
const CTX_PERSIST_MAX = 2400;
function readPersistedWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  } catch {
    return fallback;
  }
}
function readPersistedFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

export function GutachtenSection({
  ctx, initialAbschnittId,
}: { ctx: KurzfassungContext; initialAbschnittId?: string }): React.ReactElement {
  const ctrl = useGutachtenWorkflow(ctx);
  // Einklappbar (persistiert, Default offen): beim Texten anderer Artefakte
  // (NF/Kurzfassung) wegklappbar. Body via CSS verstecken statt unmounten —
  // der aktive Markdown-Editor (SectionReviewCard) behält so seinen Buffer.
  const [open, toggleOpen] = useCollapsedSection('verbund_gutachten_collapsed');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ersetzen, setErsetzen] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  // Kontext-Panel ein-/ausgeklappt (Werkstatt; persistiert nur im Session-State).
  const [ctxOpen, setCtxOpen] = useState(true);
  // „Anzeigen"-Sprung (Journey-Paket 3): Ziel-Satz + monotone nonce (erneut auslösbar).
  const [fundstelle, setFundstelle] = useState<{ satzIndex: number; nonce: number } | null>(null);
  // Flüchtiges Beleg↔Satz-Hover-Highlight (Journey-Paket 4): gehoverte Satz-Nummern,
  // geteilt zwischen Beleg-Karten (Panel) und Satz-Spans (Review-Karte).
  const [hoverSaetze, setHoverSaetze] = useState<number[] | null>(null);
  // Pin: einen Satz scrollen + highlighten — EIN Pfad (bestehender fundstelle-Mechanismus),
  // von Prüf-Checks (Paket 3) UND Beleg-Karten (Paket 4) genutzt.
  const pinSatz = useCallback(
    (satzIndex: number) => setFundstelle(prev => ({ satzIndex, nonce: (prev?.nonce ?? 0) + 1 })),
    [],
  );
  // Breiten von Rail (links) + Kontext-Panel (rechts), je per Ziehleiste anpassbar.
  // Initial aus localStorage (persistiert über Reload), Default 190/340 (Handoff
  // `workflow-stepper-neu`: angedockte Rail ~190px). Bestehende Werte werden geklemmt.
  const [railWidth, setRailWidth] = useState(() => readPersistedWidth(RAIL_W_KEY, 190, 150, 320));
  const [ctxWidth, setCtxWidth] = useState(() => readPersistedWidth(CTX_W_KEY, 340, CTX_MIN_W, CTX_PERSIST_MAX));
  // Rail eingeklappt = nur Kreis-Badges (horizontal platzsparend), per Toggle, persistiert.
  const [railCollapsed, setRailCollapsed] = useState(() => readPersistedFlag(RAIL_COLLAPSED_KEY, false));
  useEffect(() => {
    try { window.localStorage.setItem(RAIL_COLLAPSED_KEY, railCollapsed ? '1' : '0'); } catch { /* ignorieren */ }
  }, [railCollapsed]);
  const [resizing, setResizing] = useState(false);
  // Persistieren erst, wenn das Ziehen beendet ist (kein localStorage-Write pro Frame).
  useEffect(() => {
    if (resizing) return;
    try {
      window.localStorage.setItem(RAIL_W_KEY, String(railWidth));
      window.localStorage.setItem(CTX_W_KEY, String(ctxWidth));
    } catch { /* localStorage nicht verfügbar — ignorieren */ }
  }, [resizing, railWidth, ctxWidth]);

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

  // Deep-Link (Home-„Weitermachen"): einmal auf den übergebenen Abschnitt springen,
  // sobald Run + Steps geladen sind und der Abschnitt existiert. `weiterschaltenStep`
  // ist derselbe (persistierende) Sprung wie ein Klick in der Rail; nur wenn sich
  // der Abschnitt vom aktiven unterscheidet, und pro (Run, Abschnitt) genau einmal.
  const jumpedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialAbschnittId || !run || steps.length === 0) return;
    const marker = `${run.aktenzeichen}:${initialAbschnittId}`;
    if (jumpedRef.current === marker) return;
    if (!steps.some(s => s.id === initialAbschnittId)) return;
    jumpedRef.current = marker;
    if (run.aktiverSchritt !== initialAbschnittId) {
      ctrl.weiterschaltenStep(initialAbschnittId as StepId);
    }
  }, [initialAbschnittId, run, steps, ctrl]);

  // Beim Abschnittswechsel ein etwaiges „Anzeigen"-Highlight + Hover verwerfen (die neue
  // Karte remountet — sonst würde ihr Effekt einen stale satzIndex highlighten).
  useEffect(() => { setFundstelle(null); setHoverSaetze(null); }, [run?.aktiverSchritt]);

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
  // Eine aus localStorage geladene (auf größerem Monitor gesetzte) Panel-Breite auf den
  // aktuell verfügbaren Raum klemmen — sonst schrumpft die mittlere Karte per `minmax(0,1fr)`
  // bis auf 0. Nur außerhalb des aktiven Ziehens und im Mehrspalten-Layout.
  useEffect(() => {
    if (resizing || solo) return;
    const railW = railCollapsed ? RAIL_COLLAPSED_W : railWidth;
    const maxW = Math.max(CTX_MIN_W, bodyWidth - railW - CARD_MIN_WIDTH - 48);
    setCtxWidth(w => (w > maxW ? maxW : w));
  }, [bodyWidth, solo, railCollapsed, railWidth, resizing]);
  // Panel nur zeigen, wenn der aktive Abschnitt einen Stand hat (sonst nichts zum Gegenlesen).
  const showPanel = !!activeStep;
  // Prüfpanel-Aktionen (Journey-Paket 3): je Fehler-Check ein regel-gebundener
  // KI-Korrektur-Lauf über die BESTEHENDE `ctrl.modify`-Leitung (keine Parallel-
  // Leitung). `regelFor` löst die auslösende Regel per `regelId` gegen die aktiven
  // Regeln auf; nur bei offenem Abschnitt vorhanden.
  const pruefAktion: CheckListAktion | undefined = activeDef ? {
    regelFor: (c) => ctrl.regeln.find(r => r.id === c.regelId) ?? null,
    onKorrektur: (c, k) => ctrl.modify(
      activeDef.id, k.modifier,
      { anweisung: k.anweisung, ...(c.regelId ? { regelId: c.regelId } : {}) },
    ),
    genDisabled: ctrl.busy || ctrl.llmAvailable === false,
    busy: ctrl.busy,
    onFundstelle: pinSatz,
  } : undefined;
  // `resizing` (eine Flag für beide Ziehleisten) schaltet die Grid-Transition ab → 1:1-Tracking.
  const gridClass = solo ? 'g-werk solo' : `g-werk${resizing ? ' resizing' : ''}`;
  // Zweispaltig: [Docked-Einheit Rail+Karte] · [Panel]. Die Rail-Breite steckt in der
  // Docked-Einheit (inline an der Rail), das Grid steuert nur die Panel-Spalte.
  const gridStyle: React.CSSProperties | undefined = solo
    ? undefined
    : {
        gridTemplateColumns: showPanel
          ? `minmax(0,1fr) ${ctxOpen ? `${ctxWidth}px` : '42px'}`
          : 'minmax(0,1fr)',
      };
  // Gemeinsamer Drag-Helfer; `compute(dx)` setzt die jeweilige Breite (window-Listener bis pointerup).
  const beginResize = (e: React.PointerEvent, compute: (dx: number) => void): void => {
    e.preventDefault();
    const startX = e.clientX;
    setResizing(true);
    const onMove = (ev: PointerEvent): void => compute(ev.clientX - startX);
    const onUp = (): void => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  // Rechtes Panel: nach links ziehen = breiter. Kein fester Hardcap mehr — der
  // Nutzer darf die Quelle-Karte beliebig breit ziehen; einzige Obergrenze ist der
  // Container (Rail + reservierte Rest-Kartenbreite CARD_MIN_WIDTH + Gaps).
  const startCtxResize = (e: React.PointerEvent): void => {
    const startW = ctxWidth;
    const railW = railCollapsed ? RAIL_COLLAPSED_W : railWidth;
    const maxW = Math.max(CTX_MIN_W, bodyWidth - railW - CARD_MIN_WIDTH - 48);
    beginResize(e, dx => setCtxWidth(Math.min(maxW, Math.max(CTX_MIN_W, startW - dx))));
  };
  // Linke Rail: nach rechts ziehen = breiter (angedockt, Labels brauchen ≳150px).
  const startRailResize = (e: React.PointerEvent): void => {
    const startW = railWidth;
    beginResize(e, dx => setRailWidth(Math.min(320, Math.max(150, startW + dx))));
  };
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
        <button
          type="button"
          className="g-progress-l"
          onClick={toggleOpen}
          aria-expanded={open}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
        >
          <ChevronRight
            size={15}
            className="transition-transform duration-200 shrink-0"
            style={{ color: 'var(--tf-text-tertiary)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="g-gtitle">Gutachten</span>
          {run && <span className="g-pcount">{freigegebenCount} von {steps.length} Abschnitten freigegeben</span>}
        </button>
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

      {/* Fortschrittsbalken (aus der früheren Übersichts-Karte übernommen) — bleibt
          auch bei eingeklappter Sektion als Summen-Anzeige sichtbar. */}
      {run && steps.length > 0 && (
        <div className="h-[3px] rounded-full bg-[var(--tf-border)] overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-[var(--tf-text-secondary)]"
            style={{ width: `${Math.round((freigegebenCount / steps.length) * 100)}%` }}
          />
        </div>
      )}

      {/* Body via CSS verstecken (nicht unmounten) — erhält Editor-Buffer. */}
      <div className={open ? undefined : 'hidden'}>
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

          {/* dev-Test: welchen GA-Workflow der Stepper fährt. Nur wenn Entwürfe erlaubt
              sind UND es >1 wählbaren Workflow gibt — sonst kein Dropdown, GA unverändert. */}
          {erlaubeWorkflowEntwuerfe() && ctrl.verfuegbareWorkflows.length > 1 && (
            <div className="mb-4 flex items-center gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
              <span>Workflow (dev-Test):</span>
              <select
                value={ctrl.testWorkflowId ?? ''}
                onChange={e => ctrl.setTestWorkflowId(e.target.value || null)}
                className="text-[12px] px-2 py-1 rounded-[6px] border-[0.5px] border-[var(--tf-border-hover)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-primary)]"
              >
                <option value="">Standard (automatisch)</option>
                {ctrl.verfuegbareWorkflows.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {ARTEFAKT_TYP_LABEL[w.artefaktTyp ?? 'ga']}{w.freigabe === 'entwurf' ? ' · Entwurf' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {vbDok && vbUeberschreitetCap(vbDok.markdown, getVbCharCap()) && (
            <div
              className="mb-4 text-[11.5px] text-[var(--tf-warning-text)]"
              title={`${vbDok.markdown.length.toLocaleString('de-DE')} Zeichen, Limit ~${getVbCharCap().toLocaleString('de-DE')} aus ${getLlmContextTokens().toLocaleString('de-DE')} Tokens Kontext. ${VB_KUERZEN_HINWEIS}`}
            >
              ⚠ VB länger als das Kontextfenster — würde für die Analyse gekürzt. Extern kürzen und über „VB ersetzen" neu hochladen oder in Einstellungen → KI-Assistent das Kontextfenster erhöhen.
            </div>
          )}

          {/* Wiederaufnahme-Zeile (wenn aktiver Schritt in Arbeit) */}
          {run.schritte[run.aktiverSchritt]?.status === 'entwurf' && (
            <ResumeLine run={run} steps={steps} onWeiter={ctrl.weiterschaltenStep} />
          )}

          <div ref={measureRef}>
            <div className={gridClass} style={gridStyle}>
              {solo ? (
                <>
                  <AbschnittStepper run={run} steps={steps} onJump={ctrl.weiterschaltenStep} />
                  {activeDef && (
                    <ActiveAbschnitt def={activeDef} run={run} ctrl={ctrl} tweakEffektiv={tweakEffektiv} onOpenTweak={() => setTweakOpen(true)} fundstelle={fundstelle ?? undefined} hoverSaetze={hoverSaetze} onHoverSaetze={setHoverSaetze} />
                  )}
                </>
              ) : (
                /* Docked-Einheit: Rail + Ziehleiste + Karte teilen einen Rahmen (Grid-Spalte 1). */
                <div className="g-docked">
                  <AbschnittNav
                    run={run}
                    steps={steps}
                    onJump={ctrl.weiterschaltenStep}
                    railWidth={railCollapsed ? RAIL_COLLAPSED_W : railWidth}
                    collapsed={railCollapsed}
                    onToggleCollapse={() => setRailCollapsed(c => !c)}
                  />
                  {/* Ziehleiste nur sinnvoll, wenn ausgeklappt (eingeklappt = feste Kreis-Breite). */}
                  {!railCollapsed && (
                    <div
                      className="g-resize-handle"
                      onPointerDown={startRailResize}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Abschnittsliste-Breite anpassen"
                      title="Breite ziehen"
                    />
                  )}
                  {activeDef && (
                    <ActiveAbschnitt def={activeDef} run={run} ctrl={ctrl} tweakEffektiv={tweakEffektiv} onOpenTweak={() => setTweakOpen(true)} fundstelle={fundstelle ?? undefined} hoverSaetze={hoverSaetze} onHoverSaetze={setHoverSaetze} docked />
                  )}
                </div>
              )}

              {/* Kontext-Panel rechts (breit) bzw. als Block (schmal) */}
              {!solo && showPanel && activeStep && (
                ctxOpen ? (
                  <KontextPanel step={activeStep} provenance={panelProvenance} variant="side" onCollapse={() => setCtxOpen(false)} onResizeStart={startCtxResize} aktion={pruefAktion} hoverSaetze={hoverSaetze} onHoverSaetze={setHoverSaetze} onPinSatz={pinSatz} />
                ) : (
                  <button type="button" className="g-ctx-reopen" onClick={() => setCtxOpen(true)} title="Quelle & Prüfung einblenden">
                    <ChevronLeft size={16} />
                    <span className="g-ctx-reopen-lbl">Quelle &amp; Prüfung</span>
                  </button>
                )
              )}

              {solo && showPanel && activeStep && (
                <KontextPanel step={activeStep} provenance={panelProvenance} variant="block" aktion={pruefAktion} hoverSaetze={hoverSaetze} onHoverSaetze={setHoverSaetze} onPinSatz={pinSatz} />
              )}
            </div>
          </div>
        </>
      )}
      </div>

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
  def, run, ctrl, tweakEffektiv, onOpenTweak, fundstelle, hoverSaetze, onHoverSaetze, docked = false,
}: {
  def: WorkflowStep;
  run: WorkflowRun;
  ctrl: ReturnType<typeof useGutachtenWorkflow>;
  tweakEffektiv: boolean;
  onOpenTweak: () => void;
  /** „Anzeigen"-Sprung (Journey-Paket 3) an die Review-Karte durchreichen. */
  fundstelle?: { satzIndex: number; nonce: number };
  /** Beleg↔Satz-Hover (Journey-Paket 4): gehoverte Sätze + Setter für die Satz-Spans. */
  hoverSaetze?: number[] | null;
  onHoverSaetze?: (saetze: number[] | null) => void;
  /** Mehrspaltig: Karte ohne eigenen Rahmen, Teil der Docked-Einheit (`.g-card.docked`). */
  docked?: boolean;
}): React.ReactElement {
  const id = def.id;
  const step = run.schritte[id];
  const status = step?.status ?? 'leer';
  const { navigate } = useNavigation();
  // Transport-Anzeige nur bei EXTERNER KI (DSGVO-Klasse, nicht der mehrdeutige modell-Name) —
  // intern (Default) = kein Hinweis. Defensiv, falls noch kein Transport aktiv ist.
  const bridge = useAIBridge();
  let externActive = false;
  let providerName = '';
  try {
    externActive = bridge.getActiveKlasse() === 'extern';
    if (externActive) providerName = bridge.getActiveProviderName();
  } catch { /* kein aktiver Transport → kein Hinweis */ }
  const skillId = step?.skillId;
  const openSkill = skillId
    ? () => navigate('skill-verwaltung-kuration', { selectedId: skillId })
    : undefined;
  const reset = useAsyncAction(async () => { await ctrl.zuruecksetzenStep(id); });

  return (
    // key = Abschnitts-ID: bei Abschnittswechsel remountet die Karte → Fade-in spielt
    // erneut und der lokale Bearbeiten-Zustand (Editor) wird sauber zurückgesetzt.
    <section className={`g-card werk${docked ? ' docked' : ''}`} key={id}>
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
        {/* Nur bei externer KI ein fett sichtbarer Warnhinweis; interne KI (Default) zeigt nichts. */}
        {externActive && (
          <span className="g-extern-warn"><AlertTriangle size={13} /> Externe KI: {providerName}</span>
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
          {...(fundstelle ? { fundstelle } : {})}
          hoverSaetze={hoverSaetze ?? null}
          {...(onHoverSaetze ? { onHoverSaetze } : {})}
          onQs={ctrl.qsFor(id) ? () => ctrl.runQs(id) : undefined}
          provenance={{ skillName: ctrl.activeSkill?.name ?? step.skillId ?? '—', regelCount: ctrl.regeln.length }}
          onOpenSkill={openSkill}
          onFeedback={(rating, notiz) => ctrl.sendFeedback(id, rating, notiz)}
          streamContent={ctrl.streamContent}
          streamThinking={ctrl.streamThinking}
        />
      )}
    </section>
  );
}

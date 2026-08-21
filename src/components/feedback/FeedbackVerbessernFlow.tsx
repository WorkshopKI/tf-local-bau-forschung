// Geführter „Feedback verbessern"-Ablauf (v2.206): verschmilzt die früheren zwei
// KI-Funktionen (Einschuss-Verbesserer + Chatbot) zu EINEM Ablauf über die interne
// KI:
//   1. Rückfragen  — interne KI stellt 0–3 gezielte Rückfragen
//   2. Generieren   — interne KI liefert klaren Text + Anforderung (Ist/Soll + Kriterien)
//   3. Bearbeiten   — Nutzer passt beides an und speichert
// Alle KI-Calls sind intern-only (DSGVO, siehe feedbackImprove.ts); die interne
// Bridge ist single-turn → jeder Schritt ist ein eigenständiger, kontext-vollständiger
// submitMessage-Call (kein Multi-Turn-Chat).

import { modellLabel } from '@/core/services/ai/bridge-modelle';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useKiZiel } from '@/core/services/ai/ki-ziel';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  askClarifyingQuestions,
  improveFeedbackGuided,
  updateFeedback,
  type FeedbackImprovePayload,
  type FeedbackQA,
  type GuidedImproveResult,
} from '@/core/services/feedback';
import { updateOutboxFeedback } from '@/core/services/personal-storage';
import type { FeedbackContext, LLMClassification } from '@/core/types/feedback';
import { FeedbackImproveEditor, type FeedbackImproveEdits } from './FeedbackImproveEditor';

interface Props {
  feedbackId: string;
  /** Roh-Feedback (text + typ-abhängige Felder + Kategorie) — Eingabe für die KI. */
  payload: FeedbackImprovePayload;
  context: FeedbackContext;
  /** Aktives Plugin (für das Bildschirmseiten-Kontext-Doc im Prompt). */
  pluginId: string;
  /**
   * Read-only prod-Client (v2.207.1): der pers. Handle, in dessen Outbox das
   * Roh-Feedback landete. Nicht-null nur ohne Daten-Share-Schreibrecht → die
   * verbesserte Fassung überschreibt die Outbox-Datei, sonst sammelt der Kurator
   * den Roh-Text ein. Bei Schreibrecht (Kurator/PL/dev) `null` (Shared-Write greift).
   */
  outboxHandle: FileSystemDirectoryHandle | null;
  onClose: () => void;
}

type Step =
  | { k: 'fragen-laeuft' }
  | { k: 'fragen'; fragen: string[] }
  | { k: 'verbessern-laeuft' }
  | { k: 'bearbeiten'; result: GuidedImproveResult }
  | { k: 'fehler' };

export function FeedbackVerbessernFlow({ feedbackId, payload, context, pluginId, outboxHandle, onClose }: Props): React.ReactElement {
  const bridge = useAIBridge();
  const storage = useStorage();
  const [step, setStep] = useState<Step>({ k: 'fragen-laeuft' });
  const [antworten, setAntworten] = useState<string[]>([]);
  const aliveRef = useRef(true);
  const initRef = useRef(false);
  const lastQa = useRef<FeedbackQA[]>([]);

  useEffect(() => () => { aliveRef.current = false; }, []);

  // Phase 2: Verbesserung (aus Rückfragen-Antworten oder direkt).
  const generieren = useCallback(async (qa: FeedbackQA[]): Promise<void> => {
    lastQa.current = qa;
    setStep({ k: 'verbessern-laeuft' });
    const transport = bridge.getActiveTransport();
    const result = await improveFeedbackGuided(transport, payload, qa, context, pluginId);
    if (!aliveRef.current) return;
    setStep(result ? { k: 'bearbeiten', result } : { k: 'fehler' });
  }, [bridge, payload, context, pluginId]);

  // Phase 1: Rückfragen (einmalig beim Mount). Leere Liste → direkt verbessern.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      const transport = bridge.getActiveTransport();
      const fragen = await askClarifyingQuestions(transport, payload, context, pluginId);
      if (!aliveRef.current) return;
      if (fragen.length === 0) { await generieren([]); return; }
      setAntworten(new Array<string>(fragen.length).fill(''));
      setStep({ k: 'fragen', fragen });
    })();
  }, [bridge, payload, context, pluginId, generieren]);

  const weiter = useAsyncAction(async () => {
    if (step.k !== 'fragen') return;
    await generieren(step.fragen.map((frage, i) => ({ frage, antwort: antworten[i] ?? '' })));
  });
  const ueberspringen = useAsyncAction(async () => { await generieren([]); });
  const erneut = useAsyncAction(async () => { await generieren(lastQa.current); });

  const speichern = useAsyncAction(async (edits: FeedbackImproveEdits) => {
    if (step.k !== 'bearbeiten') return;
    const classification: LLMClassification = {
      ...step.result.classification,
      anforderung: edits.anforderung.trim() || undefined,
      akzeptanzkriterien: edits.akzeptanzkriterien.length > 0 ? edits.akzeptanzkriterien : undefined,
      verbessert: true,
    };
    const verbesserterText = edits.verbesserterText.trim() || payload.text;
    await updateFeedback(storage, feedbackId, {
      text: verbesserterText,
      original_text: payload.text,
      llm_summary: classification.summary,
      llm_classification: classification,
    });
    // Read-only prod-Client: das Roh-Feedback liegt in der pers. Outbox — die polierte
    // Fassung dort überschreiben, sonst sammelt der Kurator den Roh-Text ein
    // (updateFeedback schreibt bei fehlendem Schreibrecht nur lokal + no-op ins Shared).
    // Best-effort: `updateOutboxFeedback` wirft nie; ein fehlgeschlagener Rewrite
    // verliert die lokal gespeicherte Verbesserung nicht.
    if (outboxHandle) {
      await updateOutboxFeedback(outboxHandle, feedbackId, {
        text: verbesserterText,
        original_text: payload.text,
        llm_summary: classification.summary,
        llm_classification: classification,
      });
    }
    onClose();
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step.k === 'fragen-laeuft') {
    return <LadeZeile text="KI überlegt Rückfragen …" />;
  }

  if (step.k === 'verbessern-laeuft') {
    return <LadeZeile text="KI verbessert dein Feedback …" />;
  }

  if (step.k === 'fehler') {
    return (
      <div className="p-4 text-center space-y-3">
        <p className="text-[13px] text-[var(--tf-text)]">Die Verbesserung ist diesmal nicht gelungen.</p>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Dein Feedback ist gespeichert. Läuft die interne KI (KI-Tab offen)?
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <Button type="button" onClick={() => erneut.run()} loading={erneut.busy} variant="primary" icon={RotateCcw}>
            Erneut versuchen
          </Button>
          <Button type="button" onClick={onClose} variant="secondary">Fertig</Button>
        </div>
      </div>
    );
  }

  if (step.k === 'bearbeiten') {
    return (
      <FeedbackImproveEditor
        result={step.result}
        saving={speichern.busy}
        error={speichern.error}
        onSave={speichern.run}
        onDiscard={onClose}
      />
    );
  }

  // step.k === 'fragen'
  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--tf-text)]">
        <Sparkles size={14} className="text-[var(--tf-primary)]" />
        Kurze Rückfragen der KI
      </div>
      <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
        Optional — deine Antworten schärfen die verbesserte Fassung. Du kannst auch überspringen.
      </p>
      {step.fragen.map((frage, i) => (
        <div key={i} className="flex flex-col gap-1">
          <label className="text-[12px] text-[var(--tf-text)]">{frage}</label>
          <textarea
            value={antworten[i] ?? ''}
            onChange={e => setAntworten(prev => {
              const next = [...prev];
              next[i] = e.target.value;
              return next;
            })}
            rows={2}
            placeholder="Antwort (optional)"
            className="w-full px-2.5 py-1.5 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none resize-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          />
        </div>
      ))}
      <div className="flex gap-2 pt-0.5">
        <Button type="button" onClick={() => weiter.run()} loading={weiter.busy} disabled={ueberspringen.busy} variant="primary" className="flex-1">
          Weiter
        </Button>
        <Button type="button" onClick={() => ueberspringen.run()} loading={ueberspringen.busy} disabled={weiter.busy} variant="secondary">
          Überspringen
        </Button>
      </div>
    </div>
  );
}

/**
 * Ladezustand mit Transparenz über die genutzte KI: die Feedback-Verbesserung läuft
 * IMMER über gpt-oss-120b (`FEEDBACK_ZIEL` in feedbackImprove.ts) — steht die
 * globale Modellwahl auf Qwen3.6-35B, wird das ausdrücklich erklärt, sonst wirkt
 * die Einstellung stillschweigend ignoriert.
 */
function LadeZeile({ text }: { text: string }): React.ReactElement {
  const starkGewaehlt = useKiZiel(s => s.ziel) === 'stark';
  return (
    <div className="p-6 flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 size={22} className="animate-spin text-[var(--tf-primary)]" />
      <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{text}</p>
      <p className="text-[11px] text-[var(--tf-text-tertiary)]">
        Läuft über {modellLabel('standard')} · kann bis zu einer Minute dauern.
      </p>
      {starkGewaehlt && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)] leading-snug max-w-[280px]">
          Ihre Modellwahl steht auf {modellLabel('stark')} — Feedback läuft bewusst über
          {' '}{modellLabel('standard')}, weil das hier deutlich schneller ist.
        </p>
      )}
    </div>
  );
}

/**
 * LLMKlassifizierungButtons — Toolbar mit drei Buttons fuer den
 * Klassifizierungs-Workflow (Workflow-Revision 1.17):
 *
 *  1. "LLM-Klassifizierung starten" — ruft `klassifiziereBatch` ueber den
 *     aktiv konfigurierten AIBridge-Transport. Schreibt Ergebnisse als
 *     Bulk-Pass (EIN persist am Ende, siehe CLAUDE.md Lesson 16).
 *  2. "Prompt kopieren" — schreibt Prompt-Text via navigator.clipboard.writeText
 *     (funktioniert unter file://, secure context).
 *  3. "LLM-Ergebnis einfuegen" — oeffnet Modal mit Textarea, parst JSON,
 *     wendet an.
 */
import { useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAuslastungData } from '../hooks/useAuslastungData';
import {
  buildPromptForClipboard,
  klassifiziereBatch,
  parseClipboardResponse,
  type LLMVerbund,
  type LLMKlassifizierungEintrag,
} from '../services/llm-klassifizierung';
import {
  type Klassifizierung,
  type UeberKategorie,
} from '../types';
import type { VerbundKlassifizierungsView } from '../services/verbund-aggregation';

interface Props {
  /** Verbund-Views aus `buildVerbundClassificationViews` — der Hook liefert
   *  Title + Akronym aus dem Verbund-Store. Der Klassifizierungs-Prompt nutzt
   *  einen Eintrag pro Verbund (alle TVs teilen die Klassifizierung). */
  verbundViews: VerbundKlassifizierungsView[];
  kategorien: UeberKategorie[];
  /** v2.7: Master-Daten noch nicht geladen → Buttons disabled, Counts „…". */
  isLoading?: boolean;
}

function readString(a: { [key: string]: unknown }, key: string): string {
  const v = a[key];
  return typeof v === 'string' ? v : '';
}

export function LLMKlassifizierungButtons({ verbundViews, kategorien, isLoading = false }: Props): React.ReactElement {
  const storage = useStorage();
  const aiBridge = useAIBridge();
  const persist = useAuslastungData(s => s.persist);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);

  function showToast(msg: string, tone: 'success' | 'error' = 'success'): void {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2400);
  }

  // Filter: nur Verbuende, die noch nicht klassifiziert sind. Ein Verbund gilt
  // als klassifiziert, wenn seine Klassifizierung freigegeben ist ODER bereits
  // einen LLM-/Regel-Vorschlag mit Primaer hat. (Bei nur Stage-2-Embedding-
  // Match ist `methode === 'embedding'` — den koennen wir mit LLM ueberschreiben.)
  const offeneVerbuende = verbundViews.filter(v => {
    const kl = v.klassifizierung;
    if (kl.status === 'freigegeben') return false;
    if (kl.vorgeschlagenePrimaer && kl.vorgeschlagenePrimaer.methode === 'llm') return false;
    return true;
  });

  // Builder fuer LLMVerbund aus VerbundKlassifizierungsView.
  function toLLMVerbund(v: VerbundKlassifizierungsView): LLMVerbund {
    const lead = v.tvs[0];
    const antragsteller = (lead && typeof lead.antragsteller === 'string')
      ? lead.antragsteller
      : undefined;
    return {
      id: v.verbundId,
      verbundTitel: v.verbundTitel,
      tvTitels: v.tvs.map(tv => readString(tv as { [key: string]: unknown }, 'titel')).filter(t => t.length > 0),
      ...(antragsteller ? { antragsteller } : {}),
    };
  }

  // Applikator: pro LLM-Verbund-Eintrag alle TVs des Verbundes mit derselben
  // Klassifizierung versorgen. EIN persist am Ende (siehe CLAUDE.md Lesson 16).
  async function applyResults(resultsByVerbundId: Map<string, LLMKlassifizierungEintrag>): Promise<number> {
    if (resultsByVerbundId.size === 0) return 0;

    // verbundId → Liste der aktenzeichen aller TVs dieses Verbundes.
    const tvsByVerbundId = new Map<string, string[]>();
    for (const view of verbundViews) {
      tvsByVerbundId.set(view.verbundId, view.tvs.map(tv => tv.aktenzeichen));
    }

    // Pro aktenzeichen das Klassifizierungs-Ergebnis (alle TVs eines Verbundes
    // bekommen dasselbe Result-Objekt).
    const resultsByAktz = new Map<string, LLMKlassifizierungEintrag>();
    for (const [verbundId, r] of resultsByVerbundId) {
      const aktzs = tvsByVerbundId.get(verbundId);
      if (!aktzs) continue;
      for (const aktz of aktzs) resultsByAktz.set(aktz, r);
    }

    let updated = 0;
    const next = useAuslastungData.getState().data.klassifizierungen.map((k): Klassifizierung => {
      const r = resultsByAktz.get(k.antragId);
      if (!r) return k;
      updated++;
      return {
        ...k,
        vorgeschlagenePrimaer: {
          kategorieId: r.primaer,
          confidence: r.confidence === 'high' ? 0.9 : r.confidence === 'medium' ? 0.6 : 0.3,
          methode: 'llm',
          begruendung: r.begruendung,
        },
        vorgeschlageneAspekte: r.aspekte.map(a => ({ kategorieId: a, confidence: 0.6 })),
        vorgeschlageneKategorien: [
          { kategorieId: r.primaer, confidence: 0.9, methode: 'llm' },
          ...r.aspekte.map(a => ({ kategorieId: a, confidence: 0.6, methode: 'llm' as const })),
        ],
      };
    });
    // TVs ohne bestehende Klassifizierung → anhaengen.
    const existingIds = new Set(next.map(k => k.antragId));
    for (const [antragId, r] of resultsByAktz) {
      if (existingIds.has(antragId)) continue;
      next.push({
        antragId,
        vorgeschlagenePrimaer: {
          kategorieId: r.primaer,
          confidence: r.confidence === 'high' ? 0.9 : r.confidence === 'medium' ? 0.6 : 0.3,
          methode: 'llm',
          begruendung: r.begruendung,
        },
        vorgeschlageneAspekte: r.aspekte.map(a => ({ kategorieId: a, confidence: 0.6 })),
        freigegebenePrimaer: '',
        freigegebeneAspekte: [],
        vorgeschlageneKategorien: [
          { kategorieId: r.primaer, confidence: 0.9, methode: 'llm' },
          ...r.aspekte.map(a => ({ kategorieId: a, confidence: 0.6, methode: 'llm' as const })),
        ],
        freigegebeneKategorien: [],
        status: 'vorgeschlagen',
      });
      updated++;
    }
    useAuslastungData.setState(s => ({ data: { ...s.data, klassifizierungen: next } }));
    await persist(storage);
    return updated;
  }

  const startLLM = useAsyncAction(async () => {
    if (offeneVerbuende.length === 0) {
      showToast('Keine unklassifizierten Verbuende gefunden.', 'error');
      return;
    }
    setProgress({ done: 0, total: offeneVerbuende.length });
    try {
      const result = await klassifiziereBatch({
        verbuende: offeneVerbuende.map(toLLMVerbund),
        kategorien,
        bridge: aiBridge,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const updated = await applyResults(result.byVerbundId);
      const errorCount = result.errors.length;
      showToast(
        `${updated} Anträge (über ${result.byVerbundId.size} Verbünde) klassifiziert${errorCount > 0 ? ` (${errorCount} Fehler)` : ''}.`,
        errorCount > 0 ? 'error' : 'success',
      );
    } finally {
      setProgress(null);
    }
  });

  const copyPrompt = useAsyncAction(async () => {
    if (offeneVerbuende.length === 0) {
      showToast('Keine unklassifizierten Verbuende gefunden.', 'error');
      return;
    }
    const prompt = buildPromptForClipboard(offeneVerbuende.map(toLLMVerbund), kategorien);
    await navigator.clipboard.writeText(prompt);
    showToast(`Prompt fuer ${offeneVerbuende.length} Verbünde in Zwischenablage.`);
  });

  const unklassifiziertCount = offeneVerbuende.length;
  const totalCount = verbundViews.length;

  const busy = startLLM.busy || copyPrompt.busy;
  // v2.7: Master-Loading blockt alle Klassifizierungs-Aktionen. Count als „…" statt 0.
  const countLabel = isLoading ? '…' : String(unklassifiziertCount);
  const noOpen = unklassifiziertCount === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => startLLM.run()}
        disabled={busy || isLoading || noOpen}
        className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'var(--tf-primary)', color: 'var(--tf-bg)' }}
        title="Klassifiziert alle offenen Verbuende via aktivem AI-Bridge-Transport"
      >
        {startLLM.busy && progress
          ? `${progress.done} / ${progress.total} Verbünde klassifiziert…`
          : `LLM-Klassifizierung starten (${countLabel})`}
      </button>
      <button
        type="button"
        onClick={() => copyPrompt.run()}
        disabled={busy || isLoading || noOpen}
        className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
        style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
      >
        Prompt kopieren
      </button>
      <button
        type="button"
        onClick={() => setShowPasteModal(true)}
        disabled={busy || isLoading}
        className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
        style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
      >
        LLM-Ergebnis einfügen
      </button>
      {!isLoading && unklassifiziertCount !== totalCount && (
        <span className="text-[11px] text-[var(--tf-text-tertiary)] ml-2">
          {unklassifiziertCount} noch unklassifiziert (von {totalCount} Verbünden)
        </span>
      )}
      {startLLM.error && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">
          LLM-Fehler: {startLLM.error}
        </span>
      )}
      {copyPrompt.error && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">
          Clipboard-Fehler: {copyPrompt.error}
        </span>
      )}
      {toast && (
        <span
          className="text-[11.5px] px-2 py-0.5 rounded"
          style={{
            background: toast.tone === 'success' ? 'var(--tf-success-soft, #d1fae5)' : 'var(--tf-danger-soft, #fee2e2)',
            color: 'var(--tf-text)',
          }}
        >
          {toast.msg}
        </span>
      )}
      {showPasteModal && (
        <PasteModal
          kategorien={kategorien}
          onClose={() => setShowPasteModal(false)}
          onApply={async (results) => {
            const updated = await applyResults(results);
            showToast(`${updated} Antraege klassifiziert.`);
            setShowPasteModal(false);
          }}
        />
      )}
    </div>
  );
}

interface PasteModalProps {
  kategorien: UeberKategorie[];
  onClose: () => void;
  onApply: (results: Map<string, LLMKlassifizierungEintrag>) => Promise<void>;
}

function PasteModal({ kategorien, onClose, onApply }: PasteModalProps): React.ReactElement {
  const [text, setText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const validIds = new Set(kategorien.map(k => k.id));
  const apply = useAsyncAction(async () => {
    setParseError(null);
    try {
      const parsed = parseClipboardResponse(text);
      const map = new Map<string, LLMKlassifizierungEintrag>();
      const unbekannt: string[] = [];
      for (const item of parsed) {
        if (!validIds.has(item.primaer)) {
          unbekannt.push(`${item.id}: ${item.primaer}`);
          continue;
        }
        const aspekte = item.aspekte.filter(a => validIds.has(a));
        map.set(item.id, {
          primaer: item.primaer,
          aspekte,
          begruendung: item.begruendung,
          confidence: 'high',
        });
      }
      if (unbekannt.length > 0) {
        console.warn('[LLMKlassifizierungButtons] unbekannte Kategorien:', unbekannt);
      }
      await onApply(map);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[12px] p-5 flex flex-col gap-3"
        style={{ background: 'var(--tf-bg)', border: '0.5px solid var(--tf-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium">LLM-Ergebnis einfügen</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]"
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          JSON-Array vom LLM hier einfügen (Markdown-Wrapper und Erläuterungs-Text werden toleriert).
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={12}
          className="w-full p-2 rounded text-[12px] font-mono"
          style={{ background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border)' }}
          placeholder='[{"id":"16DS261161","primaer":"IT","aspekte":["DT"],"begruendung":"…"}]'
        />
        {parseError && (
          <div className="text-[12px] text-[var(--tf-danger-text)]">{parseError}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)', color: 'var(--tf-text-secondary)' }}
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => apply.run()}
            disabled={!text.trim() || apply.busy}
            className="px-3 py-1.5 rounded-md text-[12.5px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            {apply.busy ? 'Anwenden…' : 'Anwenden'}
          </button>
        </div>
      </div>
    </div>
  );
}

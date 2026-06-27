/**
 * Dialog vor „Mit KI analysieren": zeigt den editierbaren Anweisungstext und
 * eine read-only Voll-Vorschau des Prompts, der tatsächlich ans LLM geht.
 *
 * Der User bearbeitet NUR die Anweisung — Frage-Einbettung, JSON-Vertrag und
 * Treffer-Block werden fest umrahmt (`assembleBegruendungPrompt`), damit der
 * Edit das Parsing nie bricht. Die Vorschau nutzt exakt dieselbe Assemblierung
 * wie der echte Lauf (`buildPreviewPrompt`).
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { DEFAULT_BEGRUENDUNG_INSTRUCTION, buildPreviewPrompt } from './analyse/stages/begruendung';

interface AnalysePromptDialogProps {
  open: boolean;
  query: string;
  /** Treffer, die annotiert werden (bereits auf Top-N begrenzt). */
  results: ReadonlyArray<UnifiedSearchResult>;
  /** Gesamtzahl der angezeigten Treffer (für den „nur Top-N"-Hinweis). */
  totalCount: number;
  instruction: string;
  onInstructionChange: (next: string) => void;
  providerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AnalysePromptDialog({
  open,
  query,
  results,
  totalCount,
  instruction,
  onInstructionChange,
  providerName,
  onConfirm,
  onCancel,
}: AnalysePromptDialogProps): React.ReactElement | null {
  const [showPreview, setShowPreview] = useState(false);

  if (!open) return null;

  const previewPrompt = buildPreviewPrompt(query, instruction, results);
  const isDefault = instruction.trim() === DEFAULT_BEGRUENDUNG_INSTRUCTION;
  const truncated = totalCount > results.length;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      size="xl"
      align="top"
      dismissOnOverlayClick={false}
      title="Mit KI analysieren"
      description={`Die KI ergänzt die Tabelle um eine Spalte „Begründung" — warum jeder Treffer für deine Anfrage relevant ist. Die übrigen Spalten und Treffer bleiben unverändert.`}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onCancel}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            icon={Sparkles}
            onClick={onConfirm}
            disabled={results.length === 0}
          >
            Analyse starten
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pb-1">
        <div className="flex items-center gap-2 text-[12px] text-[var(--tf-text-secondary)]">
          <span>
            Anfrage: <span className="text-[var(--tf-text)]">«{query}»</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {results.length} Treffer werden analysiert{truncated ? ` (Top ${results.length} von ${totalCount} nach Score)` : ''}
          </span>
          <span aria-hidden="true">·</span>
          <span>Provider: {providerName}</span>
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="analyse-instruction" className="text-[12px] font-medium text-[var(--tf-text)]">
            Anweisung an die KI
          </label>
          <button
            type="button"
            onClick={() => onInstructionChange(DEFAULT_BEGRUENDUNG_INSTRUCTION)}
            disabled={isDefault}
            className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-secondary)] rounded px-1.5 py-0.5 hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            title="Anweisung auf den Standardtext zurücksetzen"
          >
            <RotateCcw size={12} />
            Auf Standard zurücksetzen
          </button>
        </div>
        <textarea
          id="analyse-instruction"
          value={instruction}
          onChange={e => onInstructionChange(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full resize-y rounded p-2.5 text-[12.5px] leading-relaxed text-[var(--tf-text)] bg-transparent outline-none focus:border-[var(--tf-primary)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Frage, Ausgabeformat (JSON) und die Trefferliste werden automatisch angehängt — du bearbeitest nur die Anweisung.
        </p>

        <button
          type="button"
          onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-1 self-start text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
        >
          {showPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Vollständige Vorschau des Prompts
        </button>
        {showPreview && (
          <pre
            className="max-h-[40vh] overflow-auto rounded p-2.5 text-[11px] leading-relaxed text-[var(--tf-text-secondary)] whitespace-pre-wrap bg-[var(--tf-bg-secondary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {previewPrompt}
          </pre>
        )}
      </div>
    </Dialog>
  );
}

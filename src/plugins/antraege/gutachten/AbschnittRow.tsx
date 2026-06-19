/**
 * Zugeklappte Abschnitts-Zeile (freigegeben/entwurf) bzw. inerte „wartet auf …"-
 * Zeile (leer). Der AKTIVE Schritt wird NICHT hier, sondern als geöffnete Karte
 * im Sektions-Container gerendert.
 */
import type { WorkflowStep } from '@/core/services/skills';
import type { StepRun } from './types';

function wordCount(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

interface Props {
  def: WorkflowStep;
  step?: StepRun;
  /** Dezenter Konsistenz-Hinweis (ein früherer Abschnitt ist wieder in Arbeit). */
  konsistenzHinweis?: boolean;
  /** Label des Schritts, auf den gewartet wird (nur für leere Zeilen). */
  wartetAufLabel?: string;
  onOeffnen?: () => void;
  oeffnenLabel?: string;
}

export function AbschnittRow({ def, step, konsistenzHinweis, wartetAufLabel, onOeffnen, oeffnenLabel }: Props): React.ReactElement {
  // Leer / wartend
  if (!step) {
    return (
      <div className="flex items-center gap-3.5 py-3 border-t-[0.5px] border-[var(--tf-border)]">
        <span className="text-[13.5px] text-[var(--tf-text-tertiary)] w-[232px] shrink-0">{def.id} — {def.label}</span>
        <span className="text-[13px] text-[var(--tf-text-tertiary)]">{wartetAufLabel ? `wartet auf ${wartetAufLabel}` : 'noch nicht begonnen'}</span>
      </div>
    );
  }

  const freigegeben = step.status === 'freigegeben';
  return (
    <div className="border-t-[0.5px] border-[var(--tf-border)]">
      <div className="flex items-center gap-3.5 py-3">
        <span className="text-[13.5px] font-medium text-[var(--tf-text)] w-[232px] shrink-0">{def.id} — {def.label}</span>
        <span className="flex-1 min-w-0 text-[13px] text-[var(--tf-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
          {step.finalerText}
        </span>
        {freigegeben ? (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-success-bg)] text-[var(--tf-success-text)] whitespace-nowrap">Freigegeben ✓</span>
        ) : (
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] whitespace-nowrap">Entwurf</span>
        )}
        <span className="text-[11px] text-[var(--tf-text-tertiary)] whitespace-nowrap">{wordCount(step.finalerText)} Wörter</span>
        {onOeffnen && (
          <button type="button" onClick={onOeffnen} className="text-[12px] text-[var(--tf-primary)] hover:underline whitespace-nowrap">
            {oeffnenLabel ?? 'Öffnen'}
          </button>
        )}
      </div>
      {konsistenzHinweis && (
        <div className="pb-3 -mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
          Ein früherer Abschnitt wurde wieder geöffnet — diesen Abschnitt ggf. auf Konsistenz prüfen.
        </div>
      )}
    </div>
  );
}

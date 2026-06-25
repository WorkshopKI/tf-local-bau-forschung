/**
 * Dev-only Recall-Eval-Panel (Phase 9): fährt den Anonymisierungs-Skill über die
 * FIKTIVEN Fixtures (interner Transport) und zeigt den Recall-Report. Gegated über
 * `isDevFixturesEnabled()` (fiktive Fixtures) im Parent.
 *
 * Misst NUR — die Skill-Aktivierung (`aktiv: true`) bleibt ein manueller Schritt
 * nach bestandenem Gate.
 */
import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { loadSkillRegistry, getSkillById, type SkillRecord } from '@/core/services/skills';
import {
  ANFRAGE_ANONYMISIEREN_SKILL,
  ANFRAGE_ANONYMISIEREN_SKILL_ID,
} from '@/core/services/skills/registry/anfrage-anonymisieren.seed';
import { runRecallEval } from './eval/run-recall';

export function AnfrageRecallEval(): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSkillRegistry(storage);
      if (cancelled) return;
      setSkill(getSkillById(loaded.file, ANFRAGE_ANONYMISIEREN_SKILL_ID) ?? ANFRAGE_ANONYMISIEREN_SKILL);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const run = useAsyncAction(async () => {
    if (!skill) return;
    const { text } = await runRecallEval(bridge, skill);
    setReport(text);
  });

  return (
    <details className="mb-4 rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg-secondary)]">
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] text-[var(--tf-text-secondary)] flex items-center gap-1.5">
        <FlaskConical size={13} /> Recall-Eval (dev · fiktive Fixtures · interner Transport)
      </summary>
      <div className="px-3 pb-3">
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2">
          Misst, ob der Anonymisierer jede Ground-Truth-PII entfernt (Recall = 1 − Leak-Rate). Aktivierung
          des Skills bleibt manuell nach bestandenem Gate.
        </p>
        <button
          type="button"
          onClick={() => run.run()}
          disabled={!skill || run.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-90"
        >
          {run.busy ? 'Eval läuft…' : 'Recall-Eval starten'}
        </button>
        {run.error && <p className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler: {run.error}</p>}
        {report && (
          <pre className="mt-2 text-[11px] leading-[1.5] font-mono whitespace-pre-wrap text-[var(--tf-text)] max-h-[40vh] overflow-y-auto">
            {report}
          </pre>
        )}
      </div>
    </details>
  );
}

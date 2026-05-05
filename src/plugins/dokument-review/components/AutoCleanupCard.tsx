/**
 * Eine-Click-Bulk-Cleanup ueber sechs Heuristiken (siehe cleanup.ts).
 * Workflow:
 *   1. Vorschau berechnet pro Regel die Trefferanzahl auf den aktuell offenen
 *      Review-Eintraegen.
 *   2. Kurator deaktiviert ggf. einzelne Regeln per Checkbox.
 *   3. "Anwenden" schreibt ManifestEntry + (bei irrelevant-Regeln) SkipListEntry,
 *      reloadet das Manifest und zeigt Toast mit Summary.
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import type { ManifestEntry } from '@/phase2';
import { useDokumentReviewStore } from '../store';
import {
  executeCleanup,
  previewCleanup,
  type CleanupRuleId,
  type CleanupRuleResult,
} from '../cleanup';

interface Props {
  entries: ManifestEntry[];
  onAfter: () => Promise<void>;
}

export function AutoCleanupCard({ entries, onAfter }: Props): React.ReactElement | null {
  const storage = useStorage();
  const showToast = useDokumentReviewStore(s => s.showToast);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<CleanupRuleId, boolean>>({
    zero_byte: true,
    parse_error: true,
    bescheid: true,
    bewilligung: true,
    zuwendungsbescheid: true,
    format_outside_whitelist: true,
    matched_with_fkz: true,
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const rules = useMemo<CleanupRuleResult[]>(() => previewCleanup(entries), [entries]);
  const totalCandidates = rules.reduce((sum, r) => sum + r.matches.length, 0);
  const totalSelected = rules.reduce((sum, r) => sum + (enabled[r.ruleId] ? r.matches.length : 0), 0);

  // Wenn keine Eintraege da sind, Card ausblenden.
  useEffect(() => {
    if (totalCandidates === 0 && open && !running) setOpen(false);
  }, [totalCandidates, open, running]);

  if (entries.length === 0) return null;

  const handleApply = async (): Promise<void> => {
    const selected = rules.filter(r => enabled[r.ruleId] && r.matches.length > 0);
    if (selected.length === 0) {
      showToast('Keine Regel ausgewaehlt.', 'info');
      return;
    }
    setRunning(true);
    setProgress({ done: 0, total: selected.reduce((s, r) => s + r.matches.length, 0) });
    try {
      const result = await executeCleanup(storage.idb, selected, (done, total) => {
        setProgress({ done, total });
      });
      await onAfter();
      const breakdown = selected
        .map(r => `${r.matches.length} ${r.label}`)
        .join(', ');
      showToast(`Cleanup angewendet: ${result.totalChanged} Eintraege (${breakdown}).`);
      setOpen(false);
    } catch (e) {
      showToast(`Cleanup-Fehler: ${(e as Error).message}`, 'error');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div
      className="border-[0.5px] rounded-[12px] bg-[var(--tf-bg)] p-[14px] flex flex-col gap-3"
      style={{ borderColor: 'var(--tf-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--tf-text-secondary)]" />
          <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Auto-Cleanup</h3>
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            {totalCandidates.toLocaleString('de-DE')} Treffer in der Review-Queue
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          disabled={running}
          className="text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer disabled:opacity-40"
        >
          {open ? 'Einklappen' : (totalCandidates > 0 ? 'Vorschau anzeigen' : 'Keine Treffer')}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            {rules.map(r => (
              <RuleRow
                key={r.ruleId}
                rule={r}
                checked={enabled[r.ruleId]}
                onToggle={() => setEnabled(prev => ({ ...prev, [r.ruleId]: !prev[r.ruleId] }))}
                disabled={running}
              />
            ))}
          </div>

          {progress && (
            <div className="text-[11.5px] text-[var(--tf-text-secondary)]">
              Verarbeite {progress.done.toLocaleString('de-DE')} / {progress.total.toLocaleString('de-DE')}…
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
              {totalSelected.toLocaleString('de-DE')} Eintraege werden geaendert.
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={running}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={running ? Loader2 : Sparkles}
                onClick={handleApply}
                disabled={running || totalSelected === 0}
              >
                {running ? 'Laeuft…' : 'Anwenden'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RuleRowProps {
  rule: CleanupRuleResult;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}

function RuleRow({ rule, checked, onToggle, disabled }: RuleRowProps): React.ReactElement {
  const empty = rule.matches.length === 0;
  return (
    <label
      className={`flex items-start gap-2.5 px-2 py-1.5 rounded-[6px] text-[12px] ${
        empty ? 'opacity-40' : 'hover:bg-[var(--tf-hover)]'
      } ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
    >
      <input
        type="checkbox"
        checked={checked && !empty}
        disabled={empty || disabled}
        onChange={onToggle}
        className="mt-0.5 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[var(--tf-text)] font-medium">{rule.label}</span>
          <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
            {rule.matches.length.toLocaleString('de-DE')}
          </span>
        </div>
        <div className="text-[11px] text-[var(--tf-text-tertiary)]">{rule.description}</div>
      </div>
    </label>
  );
}

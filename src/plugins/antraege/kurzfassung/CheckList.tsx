/** Prüf-Ergebnis-Checkliste (rein typografisch, keine Karten) — Mockup-konform. */
import type { CheckResult } from '@/core/services/skills';

function glyph(level: CheckResult['level']): { char: string; cls: string } {
  if (level === 'ok') return { char: '✓', cls: 'text-[var(--tf-success-text)]' };
  if (level === 'hinweis') return { char: '!', cls: 'text-[var(--tf-warning-text)]' };
  return { char: '!', cls: 'text-[var(--tf-danger-text)]' };
}

export function CheckList({ checks }: { checks: CheckResult[] }): React.ReactElement | null {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {checks.map(c => {
        const g = glyph(c.level);
        return (
          <div key={c.id}>
            <div className="flex items-baseline gap-2.5 text-[13px] text-[var(--tf-text)]">
              <span className={`w-3.5 shrink-0 text-center ${g.cls}`}>{g.char}</span>
              <span>{c.label}</span>
            </div>
            {c.detail && (
              <div className="ml-[23px] mt-0.5 text-[12px] text-[var(--tf-text-secondary)]">{c.detail}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

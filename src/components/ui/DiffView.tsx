import { useMemo } from 'react';
import DiffMatchPatch from 'diff-match-patch';

interface DiffViewProps {
  textA: string;
  textB: string;
  labelA?: string;
  labelB?: string;
}

const dmp = new DiffMatchPatch();

export function DiffView({ textA, textB, labelA = 'Alt', labelB = 'Neu' }: DiffViewProps): React.ReactElement {
  const { diffs, stats } = useMemo(() => {
    const d = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(d);
    let added = 0, removed = 0;
    for (const [op, text] of d) {
      if (op === 1) added += text.split('\n').length - 1;
      if (op === -1) removed += text.split('\n').length - 1;
    }
    return { diffs: d, stats: { added, removed } };
  }, [textA, textB]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[12px] text-[var(--tf-text-secondary)]">
        <span className="text-[var(--tf-success-text)]">+{stats.added}</span>
        <span className="text-[var(--tf-danger-text)]">-{stats.removed}</span>
        <span>{labelA} → {labelB}</span>
      </div>
      <div className="rounded-[var(--tf-radius)] p-4 text-[13px] font-mono whitespace-pre-wrap overflow-auto max-h-[400px]"
        style={{ border: '0.5px solid var(--tf-border)' }}>
        {diffs.map(([op, text], i) => (
          <span key={i} className={
            op === 1 ? 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]' :
            op === -1 ? 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)] line-through' : ''
          }>{text}</span>
        ))}
      </div>
    </div>
  );
}

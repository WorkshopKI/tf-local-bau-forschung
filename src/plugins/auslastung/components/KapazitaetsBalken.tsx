/**
 * Horizontaler Balken: zugewiesen / selbst-eingetragen / vorgeschlagen vs.
 * Quartalskapazitaet.
 *
 * Farbtier:
 *  - <70% emerald, 70-90% amber, >90% rose
 */
interface Props {
  freigegeben: number;
  selbst: number;
  vorgeschlagen: number;
  quartalsKapazitaet: number;
  showLabels?: boolean;
}

export function KapazitaetsBalken({
  freigegeben, selbst, vorgeschlagen, quartalsKapazitaet, showLabels = true,
}: Props): React.ReactElement {
  const total = freigegeben + selbst + vorgeschlagen;
  const pct = quartalsKapazitaet > 0 ? (total / quartalsKapazitaet) * 100 : 0;
  const tier =
    pct >= 90 ? 'rose'
    : pct >= 70 ? 'amber'
    : 'emerald';
  const TIER: Record<typeof tier, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  const fPct = quartalsKapazitaet > 0 ? Math.min(100, (freigegeben / quartalsKapazitaet) * 100) : 0;
  const sPct = quartalsKapazitaet > 0 ? Math.min(100, (selbst / quartalsKapazitaet) * 100) : 0;
  const vPct = quartalsKapazitaet > 0 ? Math.min(100, (vorgeschlagen / quartalsKapazitaet) * 100) : 0;

  return (
    <div className="w-full">
      <div
        className="h-2 rounded-full overflow-hidden flex"
        style={{ background: 'var(--tf-bg-secondary)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={TIER[tier]} style={{ width: `${fPct}%` }} title={`${freigegeben}h freigegeben`} />
        <div className="bg-blue-400" style={{ width: `${sPct}%` }} title={`${selbst}h selbst`} />
        <div className="bg-slate-300" style={{ width: `${vPct}%`, opacity: 0.7 }} title={`${vorgeschlagen}h vorgeschlagen`} />
      </div>
      {showLabels && (
        <div className="flex items-center justify-between mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
          <span>{Math.round(total)}h / {Math.round(quartalsKapazitaet)}h</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
    </div>
  );
}

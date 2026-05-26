/**
 * Horizontaler Balken: zugewiesen / selbst-eingetragen / vorgeschlagen vs.
 * Quartalskapazitaet.
 *
 * Farbtier:
 *  - <70% emerald, 70-90% amber, >90% rose
 *
 * Optionaler informativer Sub-Track unterhalb (`altlast.stunden > 0`): zeigt
 * die Stunden offener Antraege aus den letzten 2 Quartalen, skaliert wie der
 * Hauptbalken. Bewusst getrennt, weil Altlasten KEINE aktuelle Q0-Kapazitaet
 * verbrauchen und nicht ins Ranking einfliessen.
 */
interface Props {
  freigegeben: number;
  selbst: number;
  vorgeschlagen: number;
  quartalsKapazitaet: number;
  showLabels?: boolean;
  /** Optional: heller Sub-Track unter dem Hauptbalken. Nur wenn `stunden > 0`
   *  gerendert. Skala = `quartalsKapazitaet` (gleiche Bezugsgroesse wie oben),
   *  bei >100% gecapped. */
  altlast?: { stunden: number };
  /** Optional: Tooltip-Text fuer den Hauptbalken (`title`-Attribut). */
  mainTitle?: string;
  /** Optional: Tooltip-Text fuer den Altanträge-Sub-Track. Wenn nicht
   *  gesetzt, wird ein generischer Fallback genutzt. */
  altlastTitle?: string;
}

export function KapazitaetsBalken({
  freigegeben, selbst, vorgeschlagen, quartalsKapazitaet, showLabels = true, altlast,
  mainTitle, altlastTitle,
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

  const showAltlast = altlast != null && altlast.stunden > 0;
  const altlastPct = showAltlast && quartalsKapazitaet > 0
    ? Math.min(100, (altlast.stunden / quartalsKapazitaet) * 100)
    : 0;

  return (
    <div className="w-full">
      <div
        className="h-2 rounded-full overflow-hidden flex"
        style={{ background: 'var(--tf-bg-secondary)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        title={mainTitle}
      >
        <div
          className={TIER[tier]}
          style={{ width: `${fPct}%` }}
          title={mainTitle ?? `${freigegeben}h freigegeben`}
        />
        <div
          className="bg-blue-400"
          style={{ width: `${sPct}%` }}
          title={mainTitle ?? `${selbst}h selbst`}
        />
        <div
          className="bg-slate-300"
          style={{ width: `${vPct}%`, opacity: 0.7 }}
          title={mainTitle ?? `${vorgeschlagen}h vorgeschlagen`}
        />
      </div>
      {showAltlast && (
        <div
          className="h-1 mt-0.5 rounded-full overflow-hidden"
          style={{ background: 'var(--tf-bg-secondary)' }}
          title={altlastTitle ?? `Altanträge (informativ, kein Ranking-Bezug): ${Math.round(altlast.stunden)}h aus den letzten 2 Quartalen`}
        >
          <div className="h-full bg-slate-400" style={{ width: `${altlastPct}%`, opacity: 0.55 }} />
        </div>
      )}
      {showLabels && (
        <div className="flex items-center justify-between mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
          <span>{Math.round(total)}h / {Math.round(quartalsKapazitaet)}h</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
    </div>
  );
}

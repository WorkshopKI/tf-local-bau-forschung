/**
 * AltlastInlineList (v2.x) — kompakte, zweispaltige Auflistung der Altanträge
 * einer MA im Inline-Detail (rechte Karte, unter "Eigene Eintragungen").
 *
 * Altanträge = noch offene Anträge aus den letzten 2 Quartalen (siehe
 * services/altlast.ts). Rein informativ für die PL — fliessen NICHT in die
 * Kapazität ein. Daher kein Empty-State: ohne Altanträge rendert die
 * Komponente `null` und die Karte bleibt unverändert.
 *
 * Bewusst eigene Datei (nicht in MaInlineDetail.tsx), damit jene Datei nicht
 * weiter über den 300-Zeilen-Richtwert wächst (CLAUDE.md).
 */
import { Info } from 'lucide-react';
import type { MaAltlastBucket } from '../services/altlast';

const HINT =
  'Noch offene Anträge aus den letzten 2 Quartalen — rein informativ, fließen nicht in die Kapazität ein.';

export function AltlastInlineList({ altlast }: { altlast?: MaAltlastBucket }): React.ReactElement | null {
  if (!altlast || altlast.verbuende.length === 0) return null;
  const quartale = altlast.quartale.join(' · ');
  return (
    <div className="mt-2 pt-2" style={{ borderTop: '0.5px dashed var(--tf-border)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
          Altanträge (offen){quartale ? ` · ${quartale}` : ''} ({altlast.verbuende.length})
        </span>
        <span
          className="text-[var(--tf-text-tertiary)] cursor-help opacity-70 hover:opacity-100 inline-flex"
          title={HINT}
          aria-label={HINT}
        >
          <Info size={11} aria-hidden />
        </span>
      </div>
      {/* Zweispaltig: bei dem kurzen Format passt doppelt so viel in die Karte,
       *  fällt auf 1 Spalte zurück, wenn die rechte Karte sehr schmal wird. */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {altlast.verbuende.map((v, i) => {
          const extra = v.aktenzeichen.length - 1;
          const allAz = v.aktenzeichen.join(', ');
          const label = v.akronym || v.titel || '';
          return (
            <li
              key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`}
              className="flex items-baseline gap-2 text-[11.5px]"
            >
              {/* Fix-Breite-Box für Aktenzeichen + optional +N → alle Akronyme
               *  starten bündig bei derselben x-Position (analog VerbundSection). */}
              <span
                className="shrink-0 flex items-baseline gap-1 font-mono text-[var(--tf-text-tertiary)] overflow-hidden w-[96px]"
                title={extra > 0 ? allAz : (v.aktenzeichen[0] ?? '')}
              >
                <span>{v.aktenzeichen[0]}</span>
                {extra > 0 && <span>+{extra}</span>}
              </span>
              {/* Fixe Akronym-Breite (kein flex-1) → TVs steht bündig untereinander
               *  und nicht am Karten-Rand. */}
              <span className="shrink-0 truncate text-[var(--tf-text-secondary)] w-[104px]" title={label}>
                {label}
              </span>
              <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0 tabular-nums">
                {v.tvCount} TVs
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

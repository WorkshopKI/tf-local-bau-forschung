/**
 * AltlastInlineList (v2.x) — einspaltige Auflistung der Altanträge einer MA im
 * Inline-Detail (rechte Karte, unter "Eigene Eintragungen").
 *
 * Altanträge = noch offene Anträge aus den letzten 2 Quartalen (siehe
 * services/altlast.ts). Rein informativ für die PL — fliessen NICHT in die
 * Kapazität ein. Daher kein Empty-State: ohne Altanträge rendert die
 * Komponente `null` und die Karte bleibt unverändert.
 *
 * Spalten pro Zeile: FKZ(+N) · Akronym · Status · Antragsdatum · TVs, bündig
 * über ein gemeinsames Grid-Raster. Bei vielen Altanträgen wächst die Karte
 * nach unten (kein Scroll-Cap — bewusst, als PL-Übersicht).
 *
 * Bewusst eigene Datei (nicht in MaInlineDetail.tsx), damit jene Datei nicht
 * weiter über den 300-Zeilen-Richtwert wächst (CLAUDE.md).
 */
import { Info } from 'lucide-react';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { formatGermanDate } from '@/core/services/csv';
import type { MaAltlastBucket } from '../services/altlast';

const HINT =
  'Noch offene Anträge aus den letzten 2 Quartalen — rein informativ, fließen nicht in die Kapazität ein.';

/** Gemeinsames Spalten-Raster für Kopfzeile + Datenzeilen → alle Spalten
 *  stehen bündig untereinander.
 *  FKZ · Akronym · Status · Datum · TVs · Spacer.
 *  ALLE realen Spalten sind feste px (sonst säßen Kopf und Zeilen — je eigenes
 *  Grid — wegen unterschiedlich breitem `auto`-Inhalt nicht bündig). Der
 *  flexible Rest landet im leeren Spacer GANZ RECHTS: dadurch packen die Spalten
 *  links zusammen (Status rückt nach links, TVs klebt nicht am Rand). */
const GRID =
  'grid items-baseline gap-x-3 grid-cols-[92px_132px_116px_78px_28px_minmax(0,1fr)]';

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

      {/* Spaltenkopf */}
      <div className={`${GRID} text-[9.5px] uppercase tracking-wider text-[var(--tf-text-tertiary)] pb-1`}>
        <span aria-hidden />
        <span>Akronym</span>
        <span>Status</span>
        <span>Datum</span>
        <span className="text-right">TVs</span>
        <span aria-hidden />
      </div>

      <ul className="flex flex-col gap-y-1">
        {altlast.verbuende.map((v, i) => {
          const extra = v.aktenzeichen.length - 1;
          const allAz = v.aktenzeichen.join(', ');
          const label = v.akronym || v.titel || '';
          const statusLabel = v.status ? getStatusLabel(v.status) : '';
          return (
            <li key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`} className={`${GRID} text-[11.5px]`}>
              <span
                className="font-mono text-[var(--tf-text-tertiary)] truncate"
                title={extra > 0 ? allAz : (v.aktenzeichen[0] ?? '')}
              >
                {v.aktenzeichen[0]}{extra > 0 ? ` +${extra}` : ''}
              </span>
              <span className="truncate text-[var(--tf-text-secondary)]" title={label}>
                {label}
              </span>
              <span className="truncate text-[var(--tf-text-secondary)]" title={statusLabel}>
                {statusLabel}
              </span>
              <span className="font-mono text-[var(--tf-text-tertiary)] tabular-nums">
                {formatGermanDate(v.antragsdatum)}
              </span>
              <span className="text-[var(--tf-text-tertiary)] tabular-nums text-right">
                {v.tvCount}
              </span>
              <span aria-hidden />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

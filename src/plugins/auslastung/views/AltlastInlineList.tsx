/**
 * AltlastInlineList (v2.x) — einspaltige Auflistung der Altanträge einer MA im
 * Inline-Detail (rechte Karte, unter "Eigene Eintragungen").
 *
 * Altanträge = noch offene Anträge aus bis zu 7 Vorquartalen (siehe
 * services/altlast.ts). Rein informativ für die PL — fliessen NICHT in die
 * Kapazität ein. Daher kein Empty-State: ohne Altanträge rendert die
 * Komponente `null` und die Karte bleibt unverändert.
 *
 * Spalten pro Zeile: [Alters-Punkt] FKZ(+N) · Akronym · Status ·
 * Antragsdatum · TVs, bündig über ein gemeinsames Grid-Raster. Der farbige Punkt
 * (gedämpfte Blau-Rampe, dunkel Q-3..Q-7 → hell Q-1) spiegelt das Balken-Segment. Bei vielen
 * Altanträgen wächst die Karte nach unten (kein Scroll-Cap — bewusst, als PL-Übersicht).
 *
 * Bewusst eigene Datei (nicht in MaInlineDetail.tsx), damit jene Datei nicht
 * weiter über den Größen-Richtwert (~400–500) wächst (CLAUDE.md → File Size Limit).
 */
import { Info } from 'lucide-react';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { formatGermanDate } from '@/core/services/csv';
import type { MaAltlastBucket } from '../services/kapazitaet';
import { altlastBandColor, ALTLAST_BAND_LABELS } from './uebersicht/altlast-colors';

const HINT =
  'Noch offene Anträge aus den letzten Quartalen (bis Q-7) — rein informativ, fließen nicht in die Kapazität ein. Farbe = Alter (dunkel → hell = alt → neu).';

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
          const kurz = v.status ? statusKurzLabel(v.status) : '';
          return (
            <li key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`} className={`${GRID} text-[11.5px]`}>
              <span className="flex items-center gap-1.5 min-w-0">
                {v.altlastBand && (
                  <span
                    aria-hidden
                    title={ALTLAST_BAND_LABELS[v.altlastBand - 1]}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: altlastBandColor(v.altlastBand),
                      flex: '0 0 auto',
                    }}
                  />
                )}
                <span
                  className="font-mono text-[var(--tf-text-tertiary)] truncate"
                  title={extra > 0 ? allAz : (v.aktenzeichen[0] ?? '')}
                >
                  {v.aktenzeichen[0]}{extra > 0 ? ` +${extra}` : ''}
                </span>
              </span>
              <span className="truncate text-[var(--tf-text-secondary)]" title={label}>
                {label}
              </span>
              <span
                className="truncate text-[var(--tf-text-secondary)]"
                title={v.status ? statusLabel(v.status) : undefined}
              >
                {kurz}
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

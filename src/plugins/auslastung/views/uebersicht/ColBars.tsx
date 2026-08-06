/**
 * ColBars — die beiden nebeneinanderliegenden Balken-Spalten der MA-Tabelle
 * (Tab „Auslastung MA", Design-Handoff `auslastung-balken`, Layout C).
 *
 * Anders als `GesamtauslastungBar` (Karten-Sicht: zwei gestapelte Balken pro
 * Karte, jeweils % der eigenen Quartalskapazität) rendert jede dieser
 * Komponenten EINE Balken-Spalte mit EIGENER linker Grundlinie:
 *
 *  - `AltlastColBar`  — Rückstand: Segmente Q-3–7 · Q-2 · Q-1 (alt→neu, links→
 *    rechts = chronologisch), gedämpfte Blau-Rampe (`altlast-colors`, Farbe folgt
 *    dem Alter: dunkel = alt/links, hell = neu/rechts), Track-Breite RELATIV zum größten Rückstand
 *    aller sichtbaren MAs (`maxBl`) → Zeilenvergleich „wer hat am meisten
 *    liegen". Zahl im Segment nur bei Anteil ≥ 10 %. Hover über ein Segment
 *    zeigt eine kompakte Mini-Tabelle der konkreten Anträge dieses Bands
 *    (`AltlastSegmentTooltip`, spiegelt die Detail-Liste `AltlastInlineList`).
 *  - `AktuellColBar`  — aktuelles Quartal: Kapazitäts-Auslastung in % (eigene
 *    0–100-Grundlinie, KEIN Kohorten-Max), `--tf-akt-bar`, rot bei Überbuchung
 *    (`--tf-danger-text`, > 100 %). belegt% steht im Balken.
 *
 * Höhe 13px, radius 3px (Handoff-Maße). Alle Farben tokenbasiert (Light+Dark).
 */
import { memo } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { statusKurzLabel, statusLabel } from '@/core/utils/status-wert-labels';
import { formatGermanDate } from '@/core/services/csv';
import type { AuslastungVerbund } from '../../services/kapazitaet';
import {
  altlastBandColor,
  altlastBandTextColor,
  ALTLAST_BAND_LABELS,
} from './altlast-colors';

const BAR_HEIGHT = 13;
const BAR_RADIUS = 3;

interface AltlastProps {
  /** Offene Altanträge in TVs je Band [Q-1, Q-2, Q-3..Q-7]. */
  bandTvs: readonly [number, number, number];
  /** Größte Altlast-Summe über die sichtbaren MAs (gemeinsame Skala). */
  maxBl: number;
  /** Die einzelnen offenen Altanträge — je Band gefiltert für den Segment-Tooltip
   *  (kompakte Antrags-Mini-Tabelle, spiegelt die Detail-Liste `AltlastInlineList`). */
  verbuende: readonly AuslastungVerbund[];
}

export const AltlastColBar = memo(function AltlastColBar({ bandTvs, maxBl, verbuende }: AltlastProps): React.ReactElement {
  const sum = bandTvs[0] + bandTvs[1] + bandTvs[2];
  const fillWidth = maxBl > 0 ? (sum / maxBl) * 100 : 0;

  return (
    <div className="flex items-center w-full" style={{ height: BAR_HEIGHT }}>
      {sum > 0 && (
        <div
          className="flex h-full"
          style={{ width: `${fillWidth}%`, gap: 1.5, borderRadius: BAR_RADIUS, overflow: 'hidden' }}
        >
          {([2, 1, 0] as const).map((i) => {
            const tvs = bandTvs[i];
            if (tvs <= 0) return null;
            const band = (i + 1) as 1 | 2 | 3;
            const show = sum > 0 && tvs / sum >= 0.10;
            const rows = verbuende.filter((v) => v.altlastBand === band);
            // Der Tooltip-Wrapper IST das Flex-Item (flexGrow proportional zu TVs);
            // das Segment-div füllt ihn (w-full h-full). So bleibt das Flex-Layout
            // erhalten und der Hover zeigt die konkreten Anträge dieses Bands.
            return (
              <Tooltip
                key={i}
                maxWidth={440}
                wrapperClassName="flex"
                wrapperStyle={{ flexGrow: tvs, flexBasis: 0, minWidth: 2, height: '100%' }}
                content={<AltlastSegmentTooltip band={band} rows={rows} />}
              >
                <div
                  className="flex items-center justify-center h-full w-full"
                  style={{ background: altlastBandColor(band) }}
                >
                  {show && (
                    <span
                      className="font-mono"
                      style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: altlastBandTextColor(band) }}
                    >
                      {tvs}
                    </span>
                  )}
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── Segment-Tooltip: kompakte Antrags-Mini-Tabelle je Band ─────────────────
// Spiegelt die Detail-Liste `AltlastInlineList`, aber gefiltert auf EIN Band und
// für den Tooltip komprimiert (feste Spalten, gekappt bei TT_MAX_ROWS). So sieht
// die PL beim Hover sofort, WELCHE Anträge zu diesem Rückstands-Segment gehören.
const TT_GRID = 'grid items-baseline gap-x-2 grid-cols-[72px_104px_86px_60px_22px]';
const TT_MAX_ROWS = 10;

function AltlastSegmentTooltip({ band, rows }: {
  band: 1 | 2 | 3;
  rows: readonly AuslastungVerbund[];
}): React.ReactElement {
  const shown = rows.slice(0, TT_MAX_ROWS);
  const rest = rows.length - shown.length;
  const totalTvs = rows.reduce((s, v) => s + v.tvCount, 0);
  return (
    <div style={{ minWidth: 280 }}>
      {/* Kopf: Band-Punkt (Balken-Farbe) + Alters-Label + Zähler */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          aria-hidden
          style={{ width: 7, height: 7, borderRadius: '50%', background: altlastBandColor(band), flex: '0 0 auto' }}
        />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--tf-text-secondary)' }}>
          {ALTLAST_BAND_LABELS[band - 1]} · {rows.length} {rows.length === 1 ? 'Antrag' : 'Anträge'} · {totalTvs} TVs
        </span>
      </div>
      {/* Spaltenkopf */}
      <div className={`${TT_GRID} text-[8.5px] uppercase tracking-wider pb-1`} style={{ color: 'var(--tf-text-tertiary)' }}>
        <span>FKZ</span>
        <span>Akronym</span>
        <span>Status</span>
        <span>Datum</span>
        <span className="text-right">TVs</span>
      </div>
      <ul className="flex flex-col gap-y-0.5">
        {shown.map((v, i) => {
          const extra = v.aktenzeichen.length - 1;
          const label = v.akronym || v.titel || '—';
          const kurz = v.status ? statusKurzLabel(v.status) : '';
          return (
            <li key={`${v.verbundId ?? v.aktenzeichen[0] ?? i}`} className={`${TT_GRID} text-[11px]`}>
              <span className="font-mono truncate" style={{ color: 'var(--tf-text-tertiary)' }}>
                {v.aktenzeichen[0]}{extra > 0 ? ` +${extra}` : ''}
              </span>
              <span className="truncate" style={{ color: 'var(--tf-text)' }}>{label}</span>
              <span
                className="truncate"
                style={{ color: 'var(--tf-text-secondary)' }}
                title={v.status ? statusLabel(v.status) : undefined}
              >
                {kurz}
              </span>
              <span className="font-mono tabular-nums" style={{ color: 'var(--tf-text-tertiary)' }}>{formatGermanDate(v.antragsdatum)}</span>
              <span className="tabular-nums text-right" style={{ color: 'var(--tf-text-secondary)' }}>{v.tvCount}</span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <div className="mt-1 text-[10px]" style={{ color: 'var(--tf-text-tertiary)' }}>
          +{rest} weitere …
        </div>
      )}
    </div>
  );
}

interface AktuellProps {
  /** Belegt-% im aktuellen Quartal. Kann > 100 sein (überbucht). */
  belegtPct: number;
  /** Freie TVs im Quartal (für Tooltip). */
  freiTVs: number;
  /** Quartals-Label für den Tooltip, z.B. „2026-Q3". */
  quartal: string;
}

export const AktuellColBar = memo(function AktuellColBar({ belegtPct, freiTVs, quartal }: AktuellProps): React.ReactElement {
  const ueberbucht = belegtPct > 100;
  const fillW = Math.min(100, Math.max(0, belegtPct));
  const fillColor = ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-akt-bar)';
  const ring = ueberbucht
    ? '0 0 0 1.5px hsl(0, 55%, 45%, 0.28)'
    : '0 0 0 1.5px hsl(var(--tf-primary-h), 48%, 42%, 0.28)';
  // Zahl im Fill, wenn der Fill breit genug ist; sonst knapp rechts daneben.
  const inside = fillW >= 20;
  const title =
    `Auslastung ${quartal}: ${belegtPct} % belegt · ${freiTVs} ${freiTVs === 1 ? 'TV' : 'TVs'} frei`
    + (ueberbucht ? ' · überbucht' : '');

  return (
    <div className="relative w-full" style={{ height: BAR_HEIGHT }} title={title}>
      {/* Track (freie Kapazität als Referenz) */}
      <div className="absolute inset-0" style={{ background: 'var(--tf-bg-secondary)', borderRadius: BAR_RADIUS }} />
      {fillW > 0 && (
        <div
          className="absolute top-0 bottom-0 left-0 flex items-center justify-center"
          style={{ width: `${fillW}%`, background: fillColor, borderRadius: BAR_RADIUS, boxShadow: ring }}
        >
          {inside && belegtPct > 0 && (
            <span
              className="font-mono"
              style={{ fontSize: 9.5, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: '#ffffff' }}
            >
              {belegtPct}%
            </span>
          )}
        </div>
      )}
      {!inside && belegtPct > 0 && (
        <span
          className="absolute font-mono"
          style={{
            left: `calc(${fillW}% + 4px)`,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9.5,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: fillColor,
          }}
        >
          {belegtPct}%
        </span>
      )}
    </div>
  );
});

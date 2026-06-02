/**
 * TypKapazitaetBars (v2.16) — per-Antragstyp-Auslastung (FuE/DS/DL/NW) als
 * primäre Kapazitäts-Visualisierung im „Kapazitäten MAs"-Tab.
 *
 * Drei Varianten (gleiche Datenquelle `computeKapazitaetProTyp`):
 *  - `row`    : kompakte horizontale Mini-Bars je Typ (Tabellen-Zeile).
 *  - `tile`   : 4 schmale vertikale Bars (Karte) + Tooltip mit Zahlen.
 *  - `detail` : volle Breite, je Typ eine Zeile „verbraucht/Kontingent · frei".
 *
 * Tokenbasiert (Track `--tf-bg-secondary`, Fill `--tf-primary`, Überbuchung
 * `--tf-danger-text`-Akzent). Feste Slot-Breiten → kein Layout-Shift.
 * Unlimited-Slots (kein Kontingent) zeigen nur den Count, keine Bar.
 */
import { memo } from 'react';
import type { KapazitaetProTypView, TypSlot } from '../../services/kapazitaet-pro-typ';

interface Props {
  view: KapazitaetProTypView;
  variant: 'row' | 'tile' | 'detail';
}

function fmt(n: number): string {
  return String(Math.round(n));
}
function freiCount(rest: number): number {
  return Math.max(0, Math.floor(rest));
}
function slotTitle(s: TypSlot): string {
  if (s.unlimited) return `${s.bucket}: ${s.verbraucht} Anträge (kein Kontingent)`;
  const base = `${s.bucket}: ${s.verbraucht} von ${fmt(s.kontingentQ!)} Anträgen/Quartal`;
  return s.ueberbucht ? `${base} · überbucht` : `${base} · frei ${freiCount(s.rest!)}`;
}
function fillColor(s: TypSlot): string {
  return s.ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-primary)';
}

export const TypKapazitaetBars = memo(function TypKapazitaetBars({ view, variant }: Props): React.ReactElement {
  if (variant === 'tile') return <TileBars view={view} />;
  if (variant === 'detail') return <DetailBars view={view} />;
  return <RowBars view={view} />;
});

function RowBars({ view }: { view: KapazitaetProTypView }): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      {view.slots.map(s => (
        <div key={s.bucket} className="flex items-center gap-1 font-mono" title={slotTitle(s)}>
          <span style={{ fontSize: 9 }} className="text-[var(--tf-text-tertiary)]">{s.bucket}</span>
          {s.unlimited ? (
            <span style={{ fontSize: 10 }} className="text-[var(--tf-text-secondary)]">{s.verbraucht || '–'}</span>
          ) : (
            <>
              <span className="relative inline-block" style={{ width: 26, height: 4, background: 'var(--tf-bg-secondary)', borderRadius: 'var(--tf-radius-pill)' }}>
                <span className="absolute left-0 top-0 bottom-0" style={{ width: `${s.pct}%`, background: fillColor(s), borderRadius: 'var(--tf-radius-pill)' }} />
              </span>
              <span style={{ fontSize: 10, color: s.ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-text)' }}>
                {s.verbraucht}/{fmt(s.kontingentQ!)}{s.ueberbucht ? '!' : ''}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function TileBars({ view }: { view: KapazitaetProTypView }): React.ReactElement {
  return (
    <div aria-hidden style={{ position: 'absolute', top: 8, bottom: 6, right: 8, display: 'flex', gap: 2 }}>
      {view.slots.map(s => (
        <div
          key={s.bucket}
          title={slotTitle(s)}
          style={{ width: 6, background: 'var(--tf-bg-secondary)', borderRadius: 3, position: 'relative', overflow: 'hidden' }}
        >
          {!s.unlimited && s.pct! > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${s.pct}%`, background: fillColor(s), borderRadius: 3 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function DetailBars({ view }: { view: KapazitaetProTypView }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      {view.slots.map(s => (
        <div key={s.bucket} className="flex items-center gap-2 font-mono" style={{ fontSize: 11 }}>
          <span className="text-[var(--tf-text-tertiary)]" style={{ width: 28 }}>{s.bucket}</span>
          <span className="relative inline-block" style={{ flex: 1, maxWidth: 160, height: 6, background: 'var(--tf-bg-secondary)', borderRadius: 'var(--tf-radius-pill)' }}>
            {!s.unlimited && (
              <span className="absolute left-0 top-0 bottom-0" style={{ width: `${s.pct}%`, background: fillColor(s), borderRadius: 'var(--tf-radius-pill)' }} />
            )}
          </span>
          {s.unlimited ? (
            <span className="text-[var(--tf-text-tertiary)]">{s.verbraucht} · kein Kontingent</span>
          ) : (
            <span style={{ color: s.ueberbucht ? 'var(--tf-danger-text)' : 'var(--tf-text-secondary)' }}>
              {s.verbraucht}/{fmt(s.kontingentQ!)} · {s.ueberbucht ? `überbucht ${fmt(-s.rest!)}` : `frei ${freiCount(s.rest!)}`}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

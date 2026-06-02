/**
 * MaTile — einzelne MA-Karte für die Heatmap-View.
 *
 * Layout (siehe `_design/handoff/auslastung/README.md`):
 *  - `aspect-ratio: 1.15`, 0.5px border, 6px radius, padding 8px 40px 6px 8px
 *    (rechts mehr, weil die Twin-Bars dort sitzen).
 *  - **Header** oben links: MA-Kürzel, 11px monospace.
 *  - **Kategorie-Punkt** (optional) top-left bei 6/6 px, 6×6.
 *  - **Twin-Bars** rechts (zwei schmale vertikale Bars, 12 px breit, 4 px gap):
 *     - links Fest-Bar (Primary, Fill = Belegt%-aktuelles-Quartal)
 *     - rechts Altlast-Bar (desaturated Primary, Fill = Altlast%)
 *     - Tick-Marke bei 50 % über beiden.
 *  - **Footer** unten links: Gesamt-Auslastungs-% (12 px / weight 500).
 *     Bei „ohne Buchung mit Altlast": stattdessen `— · +X` in tertiary.
 *
 * Drei States (auf dem Container):
 *  - `normal`   : MA hat Festbuchung oder Pending.
 *  - `empty`    : keine Festbuchung, aber Altlast-Antraege vorhanden.
 *    Hintergrund mit diagonalem 4 px-Hatching; Fest-Bar leer.
 *  - `inactive` : Container `opacity: 0.55`. Label "inakt." statt %.
 */
import { memo } from 'react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaAltlastBucket } from '../../services/altlast';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet-pro-typ';
import { dotColor } from './kategorie-colors';
import { TypKapazitaetBars } from './TypKapazitaetBars';

type TileState = 'normal' | 'empty' | 'inactive';

interface Props {
  ma: AnonymerMitarbeiter;
  kapView: KapazitaetsView;
  /** v2.16: per-Antragstyp-Auslastung (primäres Modell, wenn Kontingent gepflegt). */
  kapTyp?: KapazitaetProTypView;
  altlast?: MaAltlastBucket;
  kategorien: UeberKategorie[];
  stundenProTV: number;
  /** Echtes Kürzel bei aktiver De-Anon-Session, sonst null. */
  realName: string | null;
  onClick: (anonId: string) => void;
}

function MaTileImpl({ ma, kapView, kapTyp, altlast, kategorien, stundenProTV, realName, onClick }: Props): React.ReactElement {
  const altlastTvs = altlast?.tvs ?? 0;
  const hasFest = kapView.verbrauchteStunden > 0;
  const hasAltlast = altlastTvs > 0;
  const state: TileState = !ma.aktiv
    ? 'inactive'
    : (!hasFest && hasAltlast)
      ? 'empty'
      : 'normal';

  const belegtPct = kapView.effektivStunden > 0
    ? Math.min(100, Math.round((kapView.verbrauchteStunden / kapView.effektivStunden) * 100))
    : 0;
  const altlastPct = kapView.effektivStunden > 0
    ? Math.min(100, Math.round((altlastTvs * stundenProTV / kapView.effektivStunden) * 100))
    : 0;

  const hauptKat = kategorien.find(k => k.id === ma.hauptKategorie);

  const hatchedBg =
    'repeating-linear-gradient(135deg, var(--tf-bg-secondary), var(--tf-bg-secondary) 4px, var(--tf-bg) 4px, var(--tf-bg) 8px)';

  const containerStyle: React.CSSProperties = {
    aspectRatio: '1.15',
    border: '0.5px solid var(--tf-border)',
    borderRadius: 6,
    padding: '8px 40px 6px 8px',
    background: state === 'empty' || state === 'inactive' ? hatchedBg : 'var(--tf-bg)',
    opacity: state === 'inactive' ? 0.55 : 1,
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform var(--tf-duration-fast) var(--tf-ease), border-color var(--tf-duration-fast) var(--tf-ease)',
  };

  const footerColor =
    state === 'inactive' || state === 'empty' ? 'var(--tf-text-tertiary)' : 'var(--tf-text)';

  return (
    <button
      type="button"
      onClick={() => onClick(ma.anonId)}
      style={containerStyle}
      className="hover:-translate-y-px hover:border-[var(--tf-border-hover)] text-left"
      title={realName ? `${ma.anonId} (${realName})` : ma.anonId}
    >
      {/* Kategorie-Punkt */}
      {hauptKat && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColor(hauptKat.farbe),
          }}
        />
      )}

      {/* MA-Kürzel oben (rechts vom Punkt) */}
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: state === 'empty' ? 'var(--tf-text-tertiary)' : 'var(--tf-text)',
          marginLeft: hauptKat ? 10 : 0,
          lineHeight: 1.1,
        }}
      >
        {ma.anonId}
        {realName && (
          <span style={{ color: 'var(--tf-text-tertiary)' }}> · {realName}</span>
        )}
      </div>

      {/* Rechts: v2.16 per-Antragstyp-Bars (primär), Fallback: Stunden-Twin-Bars */}
      {kapTyp?.hatKontingent ? (
        <TypKapazitaetBars view={kapTyp} variant="tile" />
      ) : (
        <TwinBars
          festPct={belegtPct}
          altlastPct={altlastPct}
          emptyFest={state === 'empty'}
        />
      )}

      {/* Footer unten links */}
      <div
        style={{
          position: 'absolute',
          left: 8,
          bottom: 6,
          fontSize: 12,
          fontWeight: 500,
          color: footerColor,
          lineHeight: 1,
        }}
      >
        {state === 'inactive' && <span>inakt.</span>}
        {state === 'empty' && <span>— · +{altlastTvs}</span>}
        {state === 'normal' && <span>{belegtPct} %</span>}
      </div>
    </button>
  );
}

function TwinBars({
  festPct, altlastPct, emptyFest,
}: { festPct: number; altlastPct: number; emptyFest: boolean }): React.ReactElement {
  const trackStyle: React.CSSProperties = {
    width: 12,
    background: 'var(--tf-bg-secondary)',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  };
  const tickStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '50%',
    height: 0.5,
    background: 'var(--tf-bg)',
    zIndex: 2,
  };
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 8,
        bottom: 6,
        right: 8,
        display: 'flex',
        gap: 4,
      }}
    >
      <div style={trackStyle}>
        {!emptyFest && festPct > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              height: `${festPct}%`,
              background: 'var(--tf-primary)',
              borderRadius: 3,
            }}
          />
        )}
        <span style={tickStyle} />
      </div>
      <div style={trackStyle}>
        {altlastPct > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0, bottom: 0,
              height: `${altlastPct}%`,
              background: 'hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)',
              borderRadius: 3,
            }}
          />
        )}
        <span style={tickStyle} />
      </div>
    </div>
  );
}

export const MaTile = memo(MaTileImpl);

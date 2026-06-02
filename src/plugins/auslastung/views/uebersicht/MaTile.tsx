/**
 * MaTile — einzelne MA-Karte für die Heatmap-View.
 *
 * Layout (siehe `_design/handoff/auslastung/README.md`):
 *  - `aspect-ratio: 1.15`, 0.5px border, 6px radius, padding 8px 40px 6px 8px
 *    (rechts mehr, weil die per-Typ-Bars dort sitzen).
 *  - **Header** oben links: MA-Kürzel, 11px monospace.
 *  - **Kategorie-Punkt** (optional) top-left bei 6/6 px, 6×6.
 *  - **Per-Antragstyp-Bars** rechts (`TypKapazitaetBars` variant `tile`, nur wenn
 *     ein Kontingent gepflegt ist) — 4 schmale vertikale Bars je Typ.
 *  - **Footer** unten links: Gesamt-Auslastungs-% (12 px / weight 500).
 *     Bei „ohne Buchung mit Altlast": stattdessen `— · +X` in tertiary.
 *  - **Gesamt-Balken** am unteren Rand (`GesamtauslastungBar`, horizontal):
 *     belegt (Primary) + offene Altanträge der 2 Vorquartale (desaturated Primary).
 *
 * Drei States (auf dem Container):
 *  - `normal`   : MA hat Festbuchung oder Pending.
 *  - `empty`    : keine Festbuchung, aber Altlast-Antraege vorhanden.
 *    Hintergrund mit diagonalem 4 px-Hatching; Gesamt-Balken zeigt nur Altlast.
 *  - `inactive` : Container `opacity: 0.55`. Label "inakt." statt %.
 */
import { memo } from 'react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaAltlastBucket } from '../../services/altlast';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet-pro-typ';
import { dotColor } from './kategorie-colors';
import { TypKapazitaetBars } from './TypKapazitaetBars';
import { GesamtauslastungBar } from './GesamtauslastungBar';

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
  const altlastFillPct = Math.min(100 - belegtPct, altlastPct);

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

      {/* Rechts: v2.16 per-Antragstyp-Bars (nur bei gepflegtem Kontingent) */}
      {kapTyp?.hatKontingent && <TypKapazitaetBars view={kapTyp} variant="tile" />}

      {/* Footer unten links: Gesamt-% */}
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

      {/* Gesamtauslastungs-Balken am unteren Kartenrand (belegt + Altlast) */}
      <div aria-hidden style={{ position: 'absolute', left: 8, right: 8, bottom: 2 }}>
        <GesamtauslastungBar belegtPct={belegtPct} altlastFillPct={altlastFillPct} height={3} />
      </div>
    </button>
  );
}

export const MaTile = memo(MaTileImpl);

/**
 * MaTile — einzelne MA-Karte für die Heatmap-View.
 *
 * Layout (siehe `_design/handoff/auslastung/README.md`):
 *  - `aspect-ratio: 1.15`, 0.5px border, 6px radius, padding 10px 44px 8px 10px
 *    (rechts mehr, weil die per-Typ-Bars dort sitzen).
 *  - **Header** oben links: MA-Kürzel, 13px monospace.
 *  - **Kategorie-Punkt** (optional) top-left bei 6/6 px, 6×6.
 *  - **Per-Antragstyp-Bars** rechts (`TypKapazitaetBars` variant `tile`, nur wenn
 *     ein Kontingent gepflegt ist) — 4 schmale vertikale Bars je Typ.
 *  - **Unten-links-Block**: Zeile `% · +X` (15 px / weight 600; `· +X` =
 *     offene Altanträge der Vorquartale gesamt, gedämpft, für ALLE States sofern > 0),
 *     darunter zwei Balken (`GesamtauslastungBar`): „Auslastung Quartal" +
 *     „Altanträge" (alters-gestaffelt segmentiert), je mit Tooltip. `right`-Abstand
 *     hält die per-Typ-Bars frei.
 *
 * Drei States (auf dem Container):
 *  - `normal`   : MA hat Festbuchung oder Pending.
 *  - `empty`    : keine Festbuchung, aber Altlast-Antraege vorhanden.
 *    Hintergrund mit diagonalem 4 px-Hatching; Gesamt-Balken zeigt nur Altlast.
 *  - `inactive` : Container `opacity: 0.55`. Label "inakt." statt %.
 */
import { memo } from 'react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaAltlastBucket } from '../../services/kapazitaet';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet';
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
  quartal: string;
  stundenProTV: number;
  /** Echtes Kürzel bei aktiver De-Anon-Session, sonst null. */
  realName: string | null;
  onClick: (anonId: string) => void;
}

function MaTileImpl({ ma, kapView, kapTyp, altlast, kategorien, quartal, stundenProTV, realName, onClick }: Props): React.ReactElement {
  const altlastTvs = altlast?.tvs ?? 0;
  const bandTvs = altlast?.tvsProBand ?? ([0, 0, 0] as const);
  const hasFest = kapView.verbrauchteStunden > 0;
  const hasAltlast = altlastTvs > 0;
  const state: TileState = !ma.aktiv
    ? 'inactive'
    : (!hasFest && hasAltlast)
      ? 'empty'
      : 'normal';

  const eff = kapView.effektivStunden;
  const belegtPct = eff > 0
    ? Math.min(100, Math.round((kapView.verbrauchteStunden / eff) * 100))
    : 0;
  const altlastBandPct: [number, number, number] = eff > 0
    ? [
        (bandTvs[0] * stundenProTV / eff) * 100,
        (bandTvs[1] * stundenProTV / eff) * 100,
        (bandTvs[2] * stundenProTV / eff) * 100,
      ]
    : [0, 0, 0];
  const hatTypBars = !!kapTyp?.hatKontingent;

  const hauptKat = kategorien.find(k => k.id === ma.hauptKategorie);

  const hatchedBg =
    'repeating-linear-gradient(135deg, var(--tf-bg-secondary), var(--tf-bg-secondary) 4px, var(--tf-bg) 4px, var(--tf-bg) 8px)';

  const containerStyle: React.CSSProperties = {
    aspectRatio: '1.15',
    border: '0.5px solid var(--tf-border)',
    borderRadius: 6,
    padding: '10px 44px 8px 10px',
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
          fontSize: 13,
          fontWeight: 500,
          color: state === 'empty' ? 'var(--tf-text-tertiary)' : 'var(--tf-text)',
          marginLeft: hauptKat ? 10 : 0,
          lineHeight: 1.1,
        }}
      >
        {ma.anonId}
        {realName && (
          <>
            <span style={{ color: 'var(--tf-text-tertiary)' }}> · </span>
            <span style={{ color: 'var(--tf-text)', fontWeight: 700 }}>{realName}</span>
          </>
        )}
      </div>

      {/* Rechts: v2.16 per-Antragstyp-Bars (nur bei gepflegtem Kontingent) */}
      {hatTypBars && <TypKapazitaetBars view={kapTyp!} variant="tile" />}

      {/* Unten links: % · +X + zwei Balken (Auslastung Quartal / Altanträge).
          right hält Abstand zu den per-Typ-Vertikal-Bars, falls vorhanden. */}
      <div style={{ position: 'absolute', left: 10, right: hatTypBars ? 44 : 10, bottom: 8 }}>
        <div className="flex items-baseline gap-1" style={{ color: footerColor, lineHeight: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {state === 'inactive' ? 'inakt.' : state === 'empty' ? '—' : `${belegtPct} %`}
          </span>
          {altlastTvs > 0 && (
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--tf-text-tertiary)' }}>
              · +{altlastTvs}
            </span>
          )}
        </div>
        <div style={{ marginTop: 5 }}>
          <GesamtauslastungBar
            belegtPct={belegtPct}
            altlastBandPct={altlastBandPct}
            freiTVs={kapView.restTVs}
            altlastTvs={altlastTvs}
            altlastBandTvs={bandTvs}
            quartal={quartal}
            height={4}
          />
        </div>
      </div>
    </button>
  );
}

export const MaTile = memo(MaTileImpl);

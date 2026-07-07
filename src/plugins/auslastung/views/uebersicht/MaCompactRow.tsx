/**
 * MaCompactRow — kompakte einzeilige MA-Zeile in der Übersichts-Tabelle.
 *
 * Layout-Spalten (Design-Handoff `auslastung-balken`, Layout C):
 *  MA · Altlasten (Rückstand)[Balken] · Aktuelles Quartal[Balken] · Aktuell ·
 *  Altlast. · Frei · Kategorie · Status · ⋯
 *
 * Zwei getrennte Balken-Spalten mit je eigener linker Grundlinie (`AltlastColBar`
 * relativ zum Kohorten-Max `maxBl`, `AktuellColBar` als Kapazitäts-Auslastung %,
 * rot bei Überbuchung). Die frühere Spalte „Belegt %" entfällt — der %-Wert steht
 * jetzt im Aktuell-Balken.
 *
 * Click auf die Zeile (außer Buttons/Inputs) toggelt den Inline-Expand —
 * der Caller rendert dann eine zweite Zeile mit `MaInlineDetail`.
 *
 * Memoized: bei stabilen Handlern (`useCallback` im Parent) und unveraendertem
 * MA-Datensatz wird die Zeile nicht neu gerendert.
 */
import { memo } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaQuartalsAuslastung } from '../../services/kapazitaet';
import type { MaAltlastBucket } from '../../services/kapazitaet';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet';
import { dotColor } from './kategorie-colors';
import { TypKapazitaetBars } from './TypKapazitaetBars';
import { AltlastColBar, AktuellColBar } from './ColBars';

const CELL_PAD = '7px 8px';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  kapView: KapazitaetsView;
  /** v2.16: per-Antragstyp-Auslastung (primäres Modell, wenn Kontingent gepflegt). */
  kapTyp?: KapazitaetProTypView;
  altlast?: MaAltlastBucket;
  /** Größte Altlast-Summe über die sichtbaren MAs (gemeinsame Balken-Skala). */
  maxBl: number;
  kategorien: UeberKategorie[];
  realName: string | null;
  quartal: string;
  expanded: boolean;
  onToggleExpand: (anonId: string) => void;
}

function MaCompactRowImpl({
  ma, kapView, kapTyp, altlast, maxBl, kategorien, realName, quartal, expanded, onToggleExpand,
}: Props): React.ReactElement {
  const hauptKat = kategorien.find(k => k.id === ma.hauptKategorie);
  const abgemeldet = ma.abgemeldet.includes(quartal);
  const altlastTvs = altlast?.tvs ?? 0;
  const bandTvs = altlast?.tvsProBand ?? ([0, 0, 0] as const);
  const ohneBuchung = kapView.verbrauchteStunden === 0 && altlastTvs === 0;

  const belegtPct = kapView.effektivStunden > 0
    ? Math.round((kapView.verbrauchteStunden / kapView.effektivStunden) * 100)
    : 0;

  const festTvs = kapView.fest.tvs;
  const dimmed = ohneBuchung || abgemeldet;

  const statusInfo: { dotColor: string; label: string } = abgemeldet
    ? { dotColor: 'var(--tf-text-tertiary)', label: 'Abgemeldet' }
    : !ma.aktiv
      ? { dotColor: 'var(--tf-text-tertiary)', label: 'Inaktiv' }
      : ohneBuchung
        ? { dotColor: 'var(--tf-warning-text)', label: 'Ohne Buchung' }
        : { dotColor: 'hsl(145, 50%, 45%)', label: 'Aktiv' };

  function handleRowClick(e: React.MouseEvent): void {
    const t = e.target as HTMLElement;
    if (t.closest('button, input, textarea, select, [data-no-expand]')) return;
    onToggleExpand(ma.anonId);
  }

  return (
    <tr
      onClick={handleRowClick}
      className="cursor-pointer transition-colors hover:bg-[var(--tf-bg-secondary)]"
      style={{ borderTop: '0.5px solid var(--tf-border)' }}
    >
      {/* MA */}
      <td className="font-mono align-middle whitespace-nowrap" style={{ padding: CELL_PAD, fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', color: dimmed ? 'var(--tf-text-tertiary)' : 'var(--tf-text)' }}>
        <span title={realName ? `${ma.anonId} (${realName})` : ma.anonId}>
          {ma.anonId}
          {realName && (
            <>
              <span style={{ color: 'var(--tf-text-tertiary)' }}> · </span>
              <span style={{ color: 'var(--tf-text)', fontWeight: 700 }}>{realName}</span>
            </>
          )}
        </span>
      </td>

      {/* Altlasten (Rückstand) — eigener Balken, relativ zum Kohorten-Max.
          Spaltenbreite kommt aus dem <colgroup> (resizable, --altlast-w). */}
      <td className="align-middle" style={{ padding: CELL_PAD, overflow: 'hidden' }}>
        <AltlastColBar bandTvs={bandTvs} maxBl={maxBl} />
      </td>

      {/* Aktuelles Quartal — Kapazitäts-Auslastung %, per-Typ darunter, Zonentrenner links */}
      <td className="align-middle" style={{ padding: CELL_PAD, borderLeft: '0.5px solid var(--tf-border)' }}>
        <div className="flex flex-col gap-1.5">
          <AktuellColBar belegtPct={belegtPct} freiTVs={kapView.restTVs} quartal={quartal} />
          {kapTyp?.hatKontingent && <TypKapazitaetBars view={kapTyp} variant="row" />}
        </div>
      </td>

      {/* Aktuell (Festbuchung im laufenden Quartal, TVs) */}
      <td
        className="text-right font-mono align-middle whitespace-nowrap"
        style={{ padding: CELL_PAD, fontSize: 12, fontWeight: 500, width: 80, color: festTvs > 0 ? 'var(--tf-akt-bar)' : 'var(--tf-text-tertiary)' }}
        title={`${kapView.fest.antraege} ${kapView.fest.antraege === 1 ? 'Antrag' : 'Anträge'} · ${festTvs} TVs im Quartal`}
      >
        {festTvs}
      </td>

      {/* Altlast. — Summe der offenen Altanträge (TVs) */}
      <td
        className="text-right font-mono align-middle"
        style={{ padding: CELL_PAD, fontSize: 12, width: 80, color: altlastTvs > 0 ? 'var(--tf-text-secondary)' : 'var(--tf-text-tertiary)' }}
        title={`${altlastTvs} offene ${altlastTvs === 1 ? 'TV' : 'TVs'} aus Vorquartalen`}
      >
        {altlastTvs > 0 ? altlastTvs : '—'}
      </td>

      {/* Frei (TVs) */}
      <td className="text-right font-mono align-middle" style={{ padding: CELL_PAD, fontSize: 12, fontWeight: 500, width: 70, color: kapView.restTVs > 0 ? 'var(--tf-primary)' : 'var(--tf-text-tertiary)' }}>
        {kapView.restTVs}
      </td>

      {/* Kategorie */}
      <td className="align-middle" style={{ padding: CELL_PAD, width: 90 }}>
        {hauptKat ? (
          <span
            className="inline-flex items-center gap-1 font-mono"
            style={{
              fontSize: 10.5,
              padding: '1px 5px',
              borderRadius: 4,
              background: 'var(--tf-bg-secondary)',
              color: 'var(--tf-text-secondary)',
            }}
          >
            <span
              aria-hidden
              style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(hauptKat.farbe), display: 'inline-block' }}
            />
            {hauptKat.id}
          </span>
        ) : (
          <span className="italic text-[var(--tf-text-tertiary)]" style={{ fontSize: 11 }}>—</span>
        )}
      </td>

      {/* Status */}
      <td className="align-middle" style={{ padding: CELL_PAD, width: 90 }}>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'var(--tf-text-secondary)' }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: statusInfo.dotColor, display: 'inline-block' }} />
          {statusInfo.label}
        </span>
      </td>

      {/* Aktionen */}
      <td className="align-middle text-right" style={{ padding: CELL_PAD, width: 30 }}>
        <button
          type="button"
          aria-label={expanded ? 'Zeile einklappen' : 'Zeile ausklappen'}
          className="inline-flex items-center justify-center cursor-pointer rounded hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)]"
          style={{ width: 22, height: 22 }}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(ma.anonId); }}
        >
          {expanded ? <ChevronRight size={14} style={{ transform: 'rotate(90deg)' }} /> : <MoreHorizontal size={14} />}
        </button>
      </td>
    </tr>
  );
}

export const MaCompactRow = memo(MaCompactRowImpl);

/**
 * MaCompactRow — kompakte einzeilige MA-Zeile in der Übersichts-Tabelle.
 *
 * Layout-Spalten:
 *  MA · Auslastung (2 Balken + per-Typ) · Belegt% · Frei(TVs) · Aktuell · Altanträge · Kategorie · Status · ⋯
 *
 * Click auf die Zeile (außer Buttons/Inputs) toggelt den Inline-Expand —
 * der Caller rendert dann eine zweite Zeile mit `MaInlineDetail`.
 *
 * Memoized: bei stabilen Handlern (`useCallback` im Parent) und unveraendertem
 * MA-Datensatz wird die Zeile nicht neu gerendert (~250ms Einsparung bei 79
 * MAs pro Filter-Klick).
 */
import { memo } from 'react';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import type { AnonymerMitarbeiter, UeberKategorie } from '../../types';
import type { MaQuartalsAuslastung } from '../../services/quartals-auslastung';
import type { MaAltlastBucket } from '../../services/altlast';
import type { KapazitaetsView } from '../../services/kapazitaet';
import type { KapazitaetProTypView } from '../../services/kapazitaet-pro-typ';
import { dotColor } from './kategorie-colors';
import { TypKapazitaetBars } from './TypKapazitaetBars';
import { GesamtauslastungBar } from './GesamtauslastungBar';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  kapView: KapazitaetsView;
  /** v2.16: per-Antragstyp-Auslastung (primäres Modell, wenn Kontingent gepflegt). */
  kapTyp?: KapazitaetProTypView;
  altlast?: MaAltlastBucket;
  kategorien: UeberKategorie[];
  realName: string | null;
  quartal: string;
  stundenProTV: number;
  expanded: boolean;
  onToggleExpand: (anonId: string) => void;
}

function MaCompactRowImpl({
  ma, kapView, kapTyp, altlast, kategorien, realName, quartal, stundenProTV, expanded, onToggleExpand,
}: Props): React.ReactElement {
  const hauptKat = kategorien.find(k => k.id === ma.hauptKategorie);
  const abgemeldet = ma.abgemeldet.includes(quartal);
  const ohneBuchung = kapView.verbrauchteStunden === 0 && (altlast?.tvs ?? 0) === 0;
  const altlastTvs = altlast?.tvs ?? 0;

  const belegtPct = kapView.effektivStunden > 0
    ? Math.round((kapView.verbrauchteStunden / kapView.effektivStunden) * 100)
    : 0;
  const altlastPct = kapView.effektivStunden > 0
    ? Math.min(100, Math.round((altlastTvs * stundenProTV / kapView.effektivStunden) * 100))
    : 0;

  const isMaxFrei = kapView.verbrauchteStunden === 0;
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
      <td className="font-mono align-middle whitespace-nowrap" style={{ padding: '6px 8px', fontSize: 11.5, fontWeight: 500, width: 110, color: dimmed ? 'var(--tf-text-tertiary)' : 'var(--tf-text)' }}>
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

      {/* Auslastung — zwei Balken (Auslastung Q / Altanträge), per-Typ darunter */}
      <td className="align-middle" style={{ padding: '6px 8px', minWidth: 200 }}>
        <div className="flex flex-col gap-1.5">
          <GesamtauslastungBar
            belegtPct={belegtPct}
            altlastPct={altlastPct}
            freiTVs={kapView.restTVs}
            altlastTvs={altlastTvs}
            quartal={quartal}
          />
          {kapTyp?.hatKontingent && <TypKapazitaetBars view={kapTyp} variant="row" />}
        </div>
      </td>

      {/* Belegt % */}
      <td className="text-right font-mono align-middle" style={{ padding: '6px 8px', fontSize: 12, fontWeight: 500, width: 70, color: dimmed ? 'var(--tf-text-tertiary)' : 'var(--tf-text)' }}>
        {belegtPct} %
      </td>

      {/* Frei (TVs) */}
      <td className="text-right font-mono align-middle" style={{ padding: '6px 8px', fontSize: 12, fontWeight: 500, width: 80, color: isMaxFrei ? 'hsl(145, 50%, 35%)' : 'var(--tf-text)' }}>
        {kapView.restTVs}
      </td>

      {/* Aktuell (Festbuchung im laufenden Quartal) */}
      <td
        className="font-mono align-middle whitespace-nowrap"
        style={{ padding: '6px 8px', fontSize: 12, width: 95, color: 'var(--tf-text-secondary)' }}
        title={`${kapView.fest.antraege} ${kapView.fest.antraege === 1 ? 'Antrag' : 'Anträge'} mit insgesamt ${kapView.fest.tvs} TVs`}
      >
        {kapView.fest.tvs} TVs <span className="text-[var(--tf-text-tertiary)]">({kapView.fest.antraege})</span>
      </td>

      {/* Altanträge (offene Anträge aus den letzten 2 Quartalen) */}
      <td className="font-mono align-middle" style={{ padding: '6px 8px', fontSize: 12, width: 85, color: altlastTvs > 0 ? 'var(--tf-text-secondary)' : 'var(--tf-text-tertiary)' }}>
        {altlastTvs > 0 ? `${altlastTvs} TVs` : '—'}
      </td>

      {/* Kategorie */}
      <td className="align-middle" style={{ padding: '6px 8px', width: 90 }}>
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
      <td className="align-middle" style={{ padding: '6px 8px', width: 90 }}>
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11.5, color: 'var(--tf-text-secondary)' }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: '50%', background: statusInfo.dotColor, display: 'inline-block' }} />
          {statusInfo.label}
        </span>
      </td>

      {/* Aktionen */}
      <td className="align-middle text-right" style={{ padding: '6px 8px', width: 30 }}>
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

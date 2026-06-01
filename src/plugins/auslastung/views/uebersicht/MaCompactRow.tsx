/**
 * MaCompactRow — kompakte einzeilige MA-Zeile in der Übersichts-Tabelle.
 *
 * Layout-Spalten (s. Handoff-Design):
 *  MA · Kategorie · Auslastung (Mini-Bar) · Belegt% · Frei(TVs) · Fest · Altlast · Verlauf · Status · ⋯
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
import { dotColor } from './kategorie-colors';

interface Props {
  ma: AnonymerMitarbeiter;
  auslastung: MaQuartalsAuslastung;
  kapView: KapazitaetsView;
  altlast?: MaAltlastBucket;
  kategorien: UeberKategorie[];
  realName: string | null;
  quartal: string;
  stundenProTV: number;
  expanded: boolean;
  onToggleExpand: (anonId: string) => void;
}

function MaCompactRowImpl({
  ma, kapView, altlast, kategorien, realName, quartal, stundenProTV, expanded, onToggleExpand,
}: Props): React.ReactElement {
  const hauptId = ma.hauptKategorie;
  const hauptKat = kategorien.find(k => k.id === hauptId);

  const abgemeldet = ma.abgemeldet.includes(quartal);
  const ohneBuchung = kapView.verbrauchteStunden === 0 && (altlast?.tvs ?? 0) === 0;
  const altlastTvs = altlast?.tvs ?? 0;

  const belegtPct = kapView.effektivStunden > 0
    ? Math.round((kapView.verbrauchteStunden / kapView.effektivStunden) * 100)
    : 0;
  const altlastPct = kapView.effektivStunden > 0
    ? Math.min(100, Math.round((altlastTvs * stundenProTV / kapView.effektivStunden) * 100))
    : 0;
  const altlastFillPct = Math.min(100 - belegtPct, altlastPct);

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
          {realName && <span style={{ color: 'var(--tf-text-tertiary)' }}> · {realName}</span>}
        </span>
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

      {/* Auslastung Mini-Bar */}
      <td className="align-middle" style={{ padding: '6px 8px', minWidth: 200 }}>
        <div className="relative" style={{ height: 4, background: 'var(--tf-bg-secondary)', borderRadius: 'var(--tf-radius-pill)' }}>
          {belegtPct > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0"
              style={{ width: `${Math.min(100, belegtPct)}%`, background: 'var(--tf-primary)', borderRadius: 'var(--tf-radius-pill)' }}
            />
          )}
          {altlastFillPct > 0 && (
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: `${Math.min(100, belegtPct)}%`,
                width: `${altlastFillPct}%`,
                background: 'hsl(var(--tf-primary-h), calc(var(--tf-primary-s) * 0.4), 70%)',
                borderRadius: 'var(--tf-radius-pill)',
              }}
            />
          )}
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

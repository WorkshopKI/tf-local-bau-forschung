/**
 * MatrixRow (v2.16) — eine MA-Zeile der Kompetenz-Matrix.
 *
 * Rendert ALLE `<td>` geometrie-getrieben (Sticky-`left`/`right` aus `ColMeta`,
 * Plan-Risiko #1) und delegiert den Zell-Inhalt an `LevelCell`/`CapCell`/
 * `HauptkatChip`. `React.memo` greift, weil der Parent bei Hover identische
 * Props liefert (ma/draft/cols/colMax stabil) → die 79 Zeilen re-rendern beim
 * Hover NICHT, nur beim Edit der jeweiligen Zeile bzw. bei Max-Änderung.
 */
import { memo, useMemo } from 'react';
import type { AnonymerMitarbeiter, AntragstypBucket, KategorieFarbe } from '../../types';
import type { UeberkategorieId } from '../../services/default-labels';
import type { ColMeta } from '../../services/kompetenz-geometry';
import { capCellBg } from '../../services/kompetenz-matrix-colors';
import { maToDraft, type Draft, type SortCol } from '../../hooks/useKompetenzMatrixModel';
import { LevelCell } from './LevelCell';
import { CapCell } from './CapCell';
import { HauptkatChip } from './HauptkatChip';

export type ColMaxMap = Record<SortCol, number>;

interface Props {
  ma: AnonymerMitarbeiter;
  /** `undefined` = Zeile unbearbeitet (spiegelt Store) → memo-stabil. */
  draft: Draft | undefined;
  cols: ColMeta[];
  colMax: ColMaxMap;
  farbeByUeber: Record<string, KategorieFarbe>;
  /** Klartext-Kürzel (nur unter aktiver De-Anon-Session) oder null. */
  kuerzel: string | null;
  onCycle: (anonId: string, ueber: UeberkategorieId, label: string) => void;
  onKontingent: (anonId: string, bucket: AntragstypBucket, raw: string) => void;
  onAbschlag: (anonId: string, raw: string) => void;
}

function MatrixRowImpl({
  ma, draft, cols, colMax, farbeByUeber, kuerzel, onCycle, onKontingent, onAbschlag,
}: Props): React.ReactElement {
  const eff = useMemo(() => draft ?? maToDraft(ma), [draft, ma]);

  return (
    <tr data-row style={ma.aktiv ? undefined : { opacity: 0.55 }}>
      {cols.map(col => {
        switch (col.kind) {
          case 'ma':
            return (
              <td key={col.key} className="km-ma km-sl" style={{ left: col.stickyLeft }}>
                <span className="font-mono text-[11px] font-medium">{ma.anonId}</span>
                {kuerzel && <span className="ml-1.5 text-[10px] text-[var(--tf-text-tertiary)]">{kuerzel}</span>}
              </td>
            );
          case 'cap': {
            const bucket = col.bucket!;
            const v = eff.kontingent[bucket];
            return (
              <td key={col.key} className="km-cap km-sl" style={{ left: col.stickyLeft, background: capCellBg(v, colMax[bucket]) }}>
                <CapCell value={v} onChange={raw => onKontingent(ma.anonId, bucket, raw)} ariaLabel={`${ma.anonId} ${bucket} Kontingent`} />
              </td>
            );
          }
          case 'absch': {
            const v = eff.abschlag || undefined;
            return (
              <td key={col.key} className="km-absch km-sl" style={{ left: col.stickyLeft, background: capCellBg(v, colMax.Ab) }}>
                <CapCell value={v} onChange={raw => onAbschlag(ma.anonId, raw)} ariaLabel={`${ma.anonId} Abschlag Prozent`} />
              </td>
            );
          }
          case 'comp': {
            const ueber = col.ueberId!;
            const label = col.label!;
            const lvl = eff.matrix[ueber]?.[label];
            return (
              <td
                key={col.key}
                className={`km-cc${col.gsFirst ? ' gs-first' : ''}`}
                data-v={lvl ?? 0}
                data-ci={col.subIdx}
                data-gi={ueber}
              >
                <LevelCell level={lvl} label={label} onCycle={() => onCycle(ma.anonId, ueber, label)} />
              </td>
            );
          }
          case 'haupt':
            return (
              <td key={col.key} className="km-haupt km-sr">
                <HauptkatChip matrix={eff.matrix} farbeByUeber={farbeByUeber} />
              </td>
            );
          default:
            return null;
        }
      })}
    </tr>
  );
}

export const MatrixRow = memo(MatrixRowImpl);

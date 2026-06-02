/**
 * KompetenzMatrix (v2.16) — Orchestrator der dichten Skill-Matrix.
 *
 * Baut die Geometrie (einzige Breiten-/Sticky-Quelle), löst Kategorie-Farben
 * aus `config.ueberKategorien` (konsistent mit den übrigen Tabs), berechnet die
 * Spaltenmaxima für die Graustufen-Heatmap und rendert Reveal-Bar + Controls +
 * Tabelle + Footer. Das Hover-Highlight wird als `<style>` aus dem aktuellen
 * Hover generiert (`buildHoverCss`) — die 79 Zeilen re-rendern dabei NICHT.
 */
import { useMemo } from 'react';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useDeAnonResolver } from '../AnonymIdBadge';
import type { KompetenzSchemaEntry } from '../../types';
import { buildGeometry } from '../../services/kompetenz-geometry';
import { buildFarbeByUeber, buildHoverCss, type HoverHighlight } from '../../services/kompetenz-matrix-colors';
import type { KompetenzMatrixModel } from '../../hooks/useKompetenzMatrixModel';
import { MatrixHeader } from './MatrixHeader';
import { MatrixRow, type ColMaxMap } from './MatrixRow';
import { RevealBar } from './RevealBar';
import { MatrixControls } from './MatrixControls';
import './kompetenz-matrix.css';

interface Props {
  model: KompetenzMatrixModel;
  schema: KompetenzSchemaEntry[];
}

export function KompetenzMatrix({ model, schema }: Props): React.ReactElement {
  const ueberKategorien = useAuslastungData(s => s.data.config.ueberKategorien);
  const resolver = useDeAnonResolver();

  const geometry = useMemo(() => buildGeometry(schema, model.kapHidden), [schema, model.kapHidden]);
  const farbeByUeber = useMemo(() => buildFarbeByUeber(ueberKategorien), [ueberKategorien]);

  // Spaltenmaxima für die Graustufen-Rampe (live über die effektiven Werte).
  let mFuE = 0, mDS = 0, mDL = 0, mNW = 0, mAb = 0;
  for (const ma of model.rows) {
    const d = model.effective(ma);
    mFuE = Math.max(mFuE, d.kontingent.FuE ?? 0);
    mDS = Math.max(mDS, d.kontingent.DS ?? 0);
    mDL = Math.max(mDL, d.kontingent.DL ?? 0);
    mNW = Math.max(mNW, d.kontingent.NW ?? 0);
    mAb = Math.max(mAb, d.abschlag);
  }
  const colMax = useMemo<ColMaxMap>(
    () => ({ FuE: mFuE, DS: mDS, DL: mDL, NW: mNW, Ab: mAb }),
    [mFuE, mDS, mDL, mNW, mAb],
  );

  const highlight: HoverHighlight = model.hover
    ? model.hover.kind === 'col'
      ? { kind: 'col', subIdx: model.hover.subIdx, farbe: farbeByUeber[model.hover.ueberId] ?? 'slate' }
      : { kind: 'group', ueberId: model.hover.ueberId, farbe: farbeByUeber[model.hover.ueberId] ?? 'slate' }
    : null;

  return (
    <div className="flex flex-col">
      <MatrixControls model={model} />

      <div className="mt-3">
        <RevealBar hover={model.hover} farbeByUeber={farbeByUeber} />
        {highlight && <style dangerouslySetInnerHTML={{ __html: buildHoverCss(highlight) }} />}
        <div className="km-wrap" onMouseLeave={model.clearHover}>
          <table className="km-table">
            <colgroup>
              {geometry.cols.map(c => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>
            <MatrixHeader
              geometry={geometry}
              farbeByUeber={farbeByUeber}
              sort={model.sort}
              onSort={model.cycleSort}
              onHover={model.setHover}
            />
            <tbody>
              {model.rows.map(ma => (
                <MatrixRow
                  key={ma.anonId}
                  ma={ma}
                  draft={model.drafts[ma.anonId]}
                  cols={geometry.cols}
                  colMax={colMax}
                  farbeByUeber={farbeByUeber}
                  kuerzel={resolver(ma.anonId)}
                  onCycle={model.cycleCell}
                  onKontingent={model.setKontingent}
                  onAbschlag={model.setAbschlag}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-[var(--tf-text-tertiary)]">
        {model.rows.length} {model.showInactive ? 'MA' : 'aktive MA'} sichtbar · {model.total} gesamt · {geometry.totalSubCols} Unterkategorien
      </p>
    </div>
  );
}

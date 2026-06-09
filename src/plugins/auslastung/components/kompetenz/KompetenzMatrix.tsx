/**
 * KompetenzMatrix (v2.16) — Orchestrator der dichten Skill-Matrix.
 *
 * Baut die Geometrie (einzige Breiten-/Sticky-Quelle), löst Kategorie-Farben
 * aus `config.ueberKategorien` (konsistent mit den übrigen Tabs), berechnet die
 * Spaltenmaxima für die Graustufen-Heatmap und rendert Reveal-Bar + Controls +
 * Tabelle + Footer. Das Hover-Highlight wird als `<style>` aus dem aktuellen
 * Hover generiert (`buildHoverCss`) — die 79 Zeilen re-rendern dabei NICHT.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { useDeAnonResolver } from '../AnonymIdBadge';
import type { KompetenzSchemaEntry } from '../../types';
import type { UeberkategorieId } from '../../services/default-labels';
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

  // Hover-Highlight per Event-Delegation: ein Handler an der `.km-wrap` liest die
  // data-Attribute des überfahrenen Elements (Body-Zelle, Code- oder Band-Header)
  // → so highlightet auch das Überfahren der ZELLEN, nicht nur der Header. Ein
  // Ref dedupliziert (kein setHover bei gleichbleibender Spalte/Gruppe).
  const colInfo = useMemo(() => {
    const m = new Map<number, { ueberId: UeberkategorieId; label: string; ueberLabel: string }>();
    const gl = new Map(geometry.groups.map(g => [g.ueberId, g.label]));
    for (const c of geometry.cols) {
      if (c.kind === 'comp') {
        m.set(c.subIdx!, { ueberId: c.ueberId!, label: c.label!, ueberLabel: gl.get(c.ueberId!) ?? '' });
      }
    }
    return m;
  }, [geometry]);
  const groupLabel = useMemo(() => new Map(geometry.groups.map(g => [g.ueberId, g.label])), [geometry]);
  const hoverKeyRef = useRef<string | null>(null);

  // Füll-Höhe: die Matrix soll den vertikalen Platz bis knapp über den
  // Viewport-Rand nutzen statt bei festen 70vh zu stoppen (CSS-Fallback). Reine
  // Layout-Messung (kein Data-Fetch) → useEffect hier legitim. Gemessen wird
  // `max-height` (nicht `height`): kurze Tabellen bleiben kurz, lange füllen den
  // Platz und scrollen erst dann intern. Adaptiert an Header/Tabs/Toolbar/Banner.
  // Hidden-Guard (top<=0) wegen Eager-Mount: inaktive Tabs sind `display:none`
  // (→ getBoundingClientRect().top = 0), dann CSS-70vh-Fallback behalten.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const recompute = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top;
        if (top <= 0) return; // versteckt / display:none → Fallback behalten
        const avail = window.innerHeight - top - 40; // 40px ≈ Footer-Zeile + Luft
        el.style.maxHeight = `${Math.max(240, Math.round(avail))}px`;
      });
    };
    recompute();
    const io = new IntersectionObserver(recompute);
    io.observe(el);
    window.addEventListener('resize', recompute);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, []);

  const handleOver = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    const t = e.target as HTMLElement;
    const colEl = t.closest('.km-cc, .km-h-code') as HTMLElement | null;
    if (colEl?.dataset.ci !== undefined) {
      const key = `c${colEl.dataset.ci}`;
      if (hoverKeyRef.current === key) return;
      hoverKeyRef.current = key;
      const info = colInfo.get(Number(colEl.dataset.ci));
      if (info) model.setHover({ kind: 'col', subIdx: Number(colEl.dataset.ci), ...info });
      return;
    }
    const bandEl = t.closest('.km-h-band') as HTMLElement | null;
    if (bandEl?.dataset.gi) {
      const key = `g${bandEl.dataset.gi}`;
      if (hoverKeyRef.current === key) return;
      hoverKeyRef.current = key;
      const gi = bandEl.dataset.gi as UeberkategorieId;
      model.setHover({ kind: 'group', ueberId: gi, ueberLabel: groupLabel.get(gi) ?? '' });
      return;
    }
    if (hoverKeyRef.current !== null) { hoverKeyRef.current = null; model.clearHover(); }
  }, [colInfo, groupLabel, model]);

  const handleLeave = useCallback((): void => {
    hoverKeyRef.current = null;
    model.clearHover();
  }, [model]);

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
        <div ref={wrapRef} className="km-wrap" onMouseOver={handleOver} onMouseLeave={handleLeave}>
          <table className="km-table" style={{ width: geometry.totalWidth }}>
            <colgroup>
              {geometry.cols.map(c => <col key={c.key} style={{ width: c.width }} />)}
            </colgroup>
            <MatrixHeader
              geometry={geometry}
              farbeByUeber={farbeByUeber}
              sort={model.sort}
              onSort={model.cycleSort}
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
                  editable={model.editMode}
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

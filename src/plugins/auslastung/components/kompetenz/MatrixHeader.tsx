/**
 * MatrixHeader (v2.16) — die zwei sticky Header-Zeilen der Kompetenz-Matrix.
 *
 * Zeile 1 (Band): MA · KAP-Kontingent-Band · Absch.% · 5 Kategorie-Bänder (mit
 * gtag) · Hauptkat. Zeile 2 (Code): FuE/DS/DL/NW (sortierbar) · 28 Kurzcode-
 * Header. Frozen-Left/-Right + Hover-/Sort-Handler. Breiten/Offsets stammen aus
 * der Geometrie (einzige Quelle). Kategorie-Farbe via `--kat-h`/`--kat-s`
 * (`katVars`) + theme-skopierte Lightness → Dark automatisch.
 */
import type { KategorieFarbe } from '../../types';
import type { Geometry } from '../../services/klassifizierung';
import { COL_W } from '../../services/klassifizierung';
import { katVars } from '../../services/klassifizierung';
import { deriveCode } from '../../services/klassifizierung';
import type { SortCol, SortState } from '../../hooks/useKompetenzMatrixModel';

/** Display-Kürzung einzelner Band-Labels für die dichte Matrix — rein
 *  visuell, ändert NICHT den Überkategorie-Namen aus der Config (der wird in
 *  Matching/Klassifizierung/anderen Tabs voll gebraucht). Ein-Unterkategorie-
 *  Gruppen (z.B. NM) zeigen unten gar kein Label-Text, nur den `gtag`-Chip —
 *  das volle Label bläht die schmale Spalte sonst auf und würde ohnehin
 *  abgeschnitten (voller Name bleibt in Reveal-Leiste + `title`). Der Override
 *  bleibt für etwaige lange Mehr-Spalten-Labels nutzbar. */
const BAND_LABEL_OVERRIDE: Partial<Record<string, string>> = {};

interface Props {
  geometry: Geometry;
  farbeByUeber: Record<string, KategorieFarbe>;
  sort: SortState;
  onSort: (col: SortCol) => void;
}

export function MatrixHeader({ geometry, farbeByUeber, sort, onSort }: Props): React.ReactElement {
  const { cols, groups } = geometry;
  const capCols = cols.filter(c => c.kind === 'cap');
  const abschCol = cols.find(c => c.kind === 'absch');

  return (
    <thead>
      {/* ── Zeile 1: Bänder ── */}
      <tr>
        <th
          className="km-h-ma km-sl km-sortable"
          style={{ left: 0 }}
          rowSpan={2}
          data-sortdir={sort.col === 'MA' ? sort.dir : undefined}
          onClick={() => onSort('MA')}
          title="MA — Klick sortiert"
        >
          MA<span className="km-sarr" />
        </th>

        {capCols.length > 0 && (
          <th className="km-h-kapband km-sl" style={{ left: COL_W.ma }} colSpan={capCols.length}>
            <span className="km-gtag">KAP</span>Kontingent (Stunden/Jahr)
          </th>
        )}
        {abschCol && (
          <th
            className="km-h-absch km-sl km-sortable"
            style={{ left: abschCol.stickyLeft }}
            rowSpan={2}
            data-sortdir={sort.col === 'Ab' ? sort.dir : undefined}
            onClick={() => onSort('Ab')}
            title="Abschlag % — Klick sortiert"
          >
            Absch.&nbsp;%<span className="km-sarr" />
          </th>
        )}

        {groups.map(g => (
          <th
            key={g.ueberId}
            className="km-h-band"
            style={katVars(farbeByUeber[g.ueberId])}
            colSpan={g.span}
            data-gi={g.ueberId}
            title={g.label}
          >
            <span className="km-gtag">{g.ueberId}</span>{g.span === 1 ? null : (BAND_LABEL_OVERRIDE[g.ueberId] ?? g.label)}
          </th>
        ))}

        <th className="km-h-haupt km-sr" rowSpan={2}>Hauptkat.</th>
      </tr>

      {/* ── Zeile 2: Code-Header ── */}
      <tr>
        {capCols.map(c => (
          <th
            key={c.key}
            className="km-h-cap km-sl km-sortable"
            style={{ left: c.stickyLeft }}
            data-sortdir={sort.col === c.bucket ? sort.dir : undefined}
            onClick={() => onSort(c.bucket as SortCol)}
            title={`${c.bucket} — Klick sortiert`}
          >
            {c.bucket}<span className="km-sarr" />
          </th>
        ))}

        {cols.filter(c => c.kind === 'comp').map(c => (
          <th
            key={c.key}
            className={`km-h-code${c.gsFirst ? ' gs-first' : ''}`}
            style={katVars(farbeByUeber[c.ueberId!])}
            data-ci={c.subIdx}
            data-gi={c.ueberId}
            title={c.label}
          >
            {deriveCode(c.label!)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

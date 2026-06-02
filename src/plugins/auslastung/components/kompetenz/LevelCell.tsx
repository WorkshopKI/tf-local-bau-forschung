/**
 * LevelCell (v2.16) — Klick-Button einer grünen Kompetenz-Heatmap-Zelle.
 *
 * Nur der innere Button; das umgebende `<td>` (mit `data-v`/`data-ci`/`data-gi`
 * + Farbe via `.km-cc[data-v]`-Selektor) rendert `MatrixRow`. Klick zykelt
 * `·→1→2→3→·` (Logik im Modell). Farbe kommt aus den `--tf-level-*`-Tokens →
 * Dark-Parität automatisch.
 */
import type { KompetenzLevel } from '../../types';

const LEVEL_TITLE: Record<KompetenzLevel, string> = {
  1: 'Grundkenntnisse',
  2: 'vertiefte Kenntnisse',
  3: 'Expertenwissen',
};

interface Props {
  level: KompetenzLevel | undefined;
  /** Volles Unterkategorie-Label (für Tooltip/Aria). */
  label: string;
  onCycle: () => void;
}

export function LevelCell({ level, label, onCycle }: Props): React.ReactElement {
  const desc = level ? `${level} — ${LEVEL_TITLE[level]}` : 'leer (klicken für Level)';
  return (
    <button type="button" onClick={onCycle} title={`${label}: ${desc}`} aria-label={`${label}: ${desc}`}>
      {level ?? '·'}
    </button>
  );
}

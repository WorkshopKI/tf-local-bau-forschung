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
  /** Nur im Bearbeiten-Modus klickbar (Schutz vor versehentlichem Ändern). */
  editable: boolean;
  onCycle: () => void;
}

export function LevelCell({ level, label, editable, onCycle }: Props): React.ReactElement {
  const lvlDesc = level ? `${level} — ${LEVEL_TITLE[level]}` : 'kein Level';
  const desc = editable ? `${lvlDesc} (klicken zum Ändern)` : lvlDesc;
  // Kein `disabled`: ein disabled-Button verschluckt Mouse-Events → das
  // Spalten-Hover-Highlight (Delegation auf der Zelle) würde brechen. Stattdessen
  // im Read-Modus onClick weglassen + cursor/Tabindex anpassen.
  return (
    <button
      type="button"
      onClick={editable ? onCycle : undefined}
      tabIndex={editable ? undefined : -1}
      className={editable ? undefined : 'km-ro'}
      title={`${label}: ${desc}`}
      aria-label={`${label}: ${desc}`}
    >
      {level ?? '·'}
    </button>
  );
}

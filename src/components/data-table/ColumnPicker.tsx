/**
 * Generischer "Spalten ▼"-Dropdown.
 *
 * Props-basiert: nimmt `columns`, `visibleKeys`, `onToggleColumn` entgegen
 * — kein Plugin-spezifischer Store-Import. Plugin-Wrapper (z.B. Suche)
 * binden den eigenen Persistierungs-Store darum.
 *
 * Locked-Spalten sind checked + disabled (Spec: nicht entfernbar).
 * Drag-and-Drop fuer Reihenfolge bewusst nicht — Reihenfolge folgt der
 * uebergebenen `columns`-Liste.
 *
 * Rubriken (`SortableColumn.gruppe`) sind opt-in: wer keine setzt, bekommt
 * dieselbe flache Liste wie zuvor. Sie ordnen nur den Picker — die Spalten-
 * Reihenfolge der Tabelle bleibt die der `columns`-Liste.
 *
 * Die Rechen-Anteile (Falten, Suche, Zaehler, Rubrik-Schalter) liegen in
 * `columnPickerLogik.ts` — node-testbar, weil Vitest keine `.tsx` einsammelt.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Columns3, Info, Search } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { Tooltip } from '@/components/ui/Tooltip';
import { SpaltenHilfeInhalt } from './SpaltenHilfeInhalt';
import {
  filtereRubriken,
  gruppiereSpalten,
  rubrikZielZustand,
  wendeRubrikSchalterAn,
  zaehleSichtbar,
  type SpaltenRubrik,
} from './columnPickerLogik';
import type { SortableColumn } from './types';

export type { SpaltenRubrik };
export { gruppiereSpalten };

/** Ab so vielen Spalten lohnt das Suchfeld. Darunter ist es Ballast — die
 *  Skill-Tabelle hat acht, da findet man schneller mit dem Auge. */
const SUCHFELD_AB_SPALTEN = 12;

export interface ColumnPickerProps<T> {
  columns: SortableColumn<T>[];
  visibleKeys: string[];
  onToggleColumn: (key: string) => void;
  /** Optional: Funktion, die pro Spalte zusaetzliches Label-Rendering liefert
   *  (z.B. visuelles Greying bei Typ-Filtern in der Suche). Default: kein Extra. */
  renderColumnExtra?: (column: SortableColumn<T>) => ReactNode;
  /** Optional: pro Spalte ein "grayed"-Flag, das Text-Tertiary einfaerbt
   *  (ohne den Checkbox-Toggle zu deaktivieren). */
  isGrayed?: (column: SortableColumn<T>) => boolean;
  /** Optional: ganze Auswahl auf einmal setzen (Rubrik an/aus). Fehlt der
   *  Callback, faellt der Schalter auf N Einzel-Toggles zurueck — das
   *  funktioniert, weil `onToggleColumn` seinen Zustand jedes Mal frisch liest. */
  onSetColumns?: (keys: string[]) => void;
  /** Spalten, die die Seite selbst erzwingt (z.B. die MA-Spalte im
   *  Uebersichtsmodus). Sie erscheinen angehakt + deaktiviert mit der Marke
   *  „auto". Sie ganz herauszufiltern waere falsch: der Zaehler zaehlte sie dann
   *  nicht mit und behauptete „11 von 23", waehrend die Tabelle 12 Spalten zeigt. */
  erzwungeneKeys?: readonly string[];
}

export function ColumnPicker<T>({
  columns,
  visibleKeys,
  onToggleColumn,
  renderColumnExtra,
  isGrayed,
  onSetColumns,
  erzwungeneKeys,
}: ColumnPickerProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [suche, setSuche] = useState('');
  // Höhe des Kopfstreifens: die Rubrik-Überschriften kleben DARUNTER. Mit
  // `top: 0` schöben sie sich hinter den Streifen und wären genau dann
  // unsichtbar, wenn man sie braucht. Die Höhe hängt davon ab, ob das Suchfeld
  // gerendert wird — deshalb gemessen statt geraten.
  const [kopfHoehe, setKopfHoehe] = useState(0);
  const rubriken = useMemo(() => gruppiereSpalten(columns), [columns]);
  const gefiltert = useMemo(() => filtereRubriken(rubriken, suche), [rubriken, suche]);
  const erzwungen = useMemo(() => new Set(erzwungeneKeys ?? []), [erzwungeneKeys]);
  // Erzwungene Spalten zählen MIT: sie stehen in der Tabelle, also gehören sie
  // in den Zähler. Ohne sie meldete der Picker „8 von 38", während die Tabelle
  // 9 Spalten zeigt.
  const sichtbarZahl = zaehleSichtbar(columns, [...visibleKeys, ...(erzwungeneKeys ?? [])]);
  const mitSuche = columns.length >= SUCHFELD_AB_SPALTEN;

  useClickOutside(containerRef, () => setOpen(false), open);

  function schalteRubrik(spalten: SortableColumn<T>[]): void {
    const ziel = rubrikZielZustand(spalten, visibleKeys);
    if (onSetColumns) {
      onSetColumns(wendeRubrikSchalterAn(spalten, visibleKeys, ziel));
      return;
    }
    // Rueckfall ohne `onSetColumns`: einzeln umschalten. Nur die Spalten
    // anfassen, die noch nicht im Zielzustand sind — sonst kippten die bereits
    // richtigen wieder heraus.
    const sichtbar = new Set(visibleKeys);
    for (const c of spalten) {
      if (c.locked === true) continue;
      const istAn = sichtbar.has(c.key);
      if (ziel === 'alleAn' ? !istAn : istAn) onToggleColumn(c.key);
    }
  }

  function renderZeile(c: SortableColumn<T>): React.ReactElement {
    const auto = erzwungen.has(c.key);
    const checked = auto || visibleKeys.includes(c.key);
    const disabled = c.locked === true || auto;
    const grayed = isGrayed ? isGrayed(c) : false;
    return (
      <label
        key={c.key}
        className={`flex items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
          grayed ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'
        } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={() => onToggleColumn(c.key)}
        />
        <span>{c.label}</span>
        {/* Die Herkunft schon VOR dem Einblenden lesbar: wer hier steht,
            entscheidet gerade, ob er die Spalte braucht. Das ⓘ ist reine
            Hover-Andeutung — ein Klick darauf schaltet weiterhin die Zeile, weil
            die ganze Zeile das `<label>` ist. */}
        {c.hilfe && (
          <Tooltip
            content={<SpaltenHilfeInhalt hilfe={c.hilfe} />}
            maxWidth={340}
            wrapperClassName="inline-flex shrink-0 items-center"
          >
            <Info size={11} className="text-[var(--tf-text-tertiary)]" />
          </Tooltip>
        )}
        {c.locked ? (
          <span className="ml-auto text-[10px] text-[var(--tf-text-tertiary)]">fix</span>
        ) : auto ? (
          <span
            className="ml-auto text-[10px] text-[var(--tf-text-tertiary)]"
            title="Diese Spalte blendet die Seite in dieser Ansicht selbst ein."
          >
            auto
          </span>
        ) : null}
        {renderColumnExtra?.(c)}
      </label>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <Columns3 size={14} />
        <span>Spalten</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          /* Hoehen-Deckel relativ statt fix (vorher 360px): mit Rubriken und den
             kuratierten Ordner-Spalten sind es schnell 40+ Zeilen, und ein fester
             Wert passt entweder nicht auf ein Notebook oder verschenkt auf einem
             grossen Monitor Platz. */
          className="absolute top-full right-0 mt-1 z-[100] w-[260px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md max-h-[70vh] overflow-y-auto"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {/* Kopfstreifen: bleibt beim Scrollen stehen, sonst verliert man bei
              40 Zeilen Suchfeld und Zaehler aus dem Blick. */}
          <div
            ref={el => { if (el) setKopfHoehe(el.offsetHeight); }}
            className="sticky top-0 z-[2] bg-[var(--tf-bg)] px-3 pt-2 pb-1.5"
            style={{ borderBottom: '0.5px solid var(--tf-border)' }}
          >
            <div className="text-[10.5px] text-[var(--tf-text-tertiary)] tabular-nums">
              {sichtbarZahl} von {columns.length} Spalten
            </div>
            {mitSuche && (
              <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-[6px]"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <Search size={12} className="shrink-0 text-[var(--tf-text-tertiary)]" />
                <input
                  type="text"
                  value={suche}
                  onChange={e => setSuche(e.target.value)}
                  placeholder="Spalte suchen"
                  className="w-full bg-transparent text-[12px] text-[var(--tf-text)] outline-none"
                />
              </div>
            )}
          </div>
          {gefiltert.map(rubrik => (
            <div key={rubrik.name ?? ''}>
              {rubrik.name !== null ? (
                // `sticky`: bei vielen Spalten scrollt die Liste — die Rubrik
                // bleibt dann sichtbar, sonst weiss man in der Mitte nicht mehr,
                // wozu die Haekchen gehoeren.
                <div
                  className="sticky z-[1] flex items-center gap-2 px-3 pt-2 pb-1 bg-[var(--tf-bg)] text-[10.5px] tracking-[0.06em] font-medium text-[var(--tf-text-tertiary)]"
                  style={{ top: kopfHoehe }}
                >
                  <span className="min-w-0 truncate">{rubrik.name}</span>
                  <button
                    type="button"
                    onClick={() => schalteRubrik(rubrik.columns)}
                    className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
                  >
                    {rubrikZielZustand(rubrik.columns, visibleKeys) === 'alleAn' ? 'alle' : 'keine'}
                  </button>
                </div>
              ) : null}
              {rubrik.columns.map(renderZeile)}
            </div>
          ))}
          {gefiltert.length === 0 && (
            <div className="px-3 py-4 text-[12px] text-[var(--tf-text-tertiary)]">
              Keine Spalte passt zu „{suche.trim()}".
            </div>
          )}
        </div>
      )}
    </div>
  );
}

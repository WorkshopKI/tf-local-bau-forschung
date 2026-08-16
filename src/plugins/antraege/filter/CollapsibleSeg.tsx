import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { segAnzeige, sichtbareSegmente } from './segAnzeige';

/**
 * Kollabierbare Filter-Pille. Default-Zustand: nur "{label}: {value} ▸" sichtbar.
 * Klick → klappt nach rechts in einen Seg auf. Auswahl ≠ defaultValue → bleibt
 * sticky offen. Auswahl = defaultValue → kollabiert wieder. Klick außerhalb
 * (nur transient, also wenn aktuell auf defaultValue) → schließt zurück.
 *
 * Manuelles Schliessen: Klick auf das Label im expanded State setzt
 * `manualClosed=true` und überschreibt den sticky-open-Modus. So kann der
 * User die Pille auch bei aktivem Filter zusammenklappen und sieht weiter
 * "{label}: {value} ▸". Nächster Klick auf die kollabierte Pille setzt
 * `manualClosed=false` zurück.
 *
 * Visuelle und Verhaltens-Spec aus dem Design-Handoff
 * `_design/handoff/card-grid/design_handoff_filter_quickfilter/`
 * (siehe README.md "Components / CollapsibleSeg").
 */
export interface CollapsibleSegItem {
  label: string;
  count?: number;
  /** Optionaler Hover-Tooltip auf dem Item-Button (z.B. Richtungs-Erklärung bei
   *  Pfeil-Sortier-Chips). Weggelassen → kein `title`-Attribut. */
  title?: string;
  /** Optionale Unterstufen — das Segment bekommt dann ein Menü (Pfeil rechts).
   *  Der Knopf selbst wählt weiterhin `label`; die Unterstufen wählen ihres.
   *  Ohne dieses Feld rendert das Segment wie zuvor (opt-in, damit die anderen
   *  fünf Nutzer von `SegGroup` unverändert bleiben). */
  unterpunkte?: CollapsibleSegItem[];
  /** Abweichende Beschriftung INNERHALB des Menüs. `label` bleibt die Identität
   *  (der Aufrufer bildet daraus seinen Schlüssel) — im Menü liest sich der
   *  Oberpunkt aber anders als der Knopf, unter dem er hängt. */
  menuLabel?: string;
}

interface Props {
  label: string;
  /** Langfassung der Beschriftung als `title` am Label — für Pillen, deren
   *  vollständiger Name in der Zeile zu viel Breite kostet. Weggelassen → kein
   *  `title`-Attribut, wie bisher. */
  titel?: string;
  /** Aktueller Wert als Label-String (muss exakt einem `items[].label` entsprechen). */
  value: string;
  items: CollapsibleSegItem[];
  onChange: (label: string) => void;
  /** Wert der die Pille kollabiert. Default `"Alle"`. */
  defaultValue?: string;
  /**
   * Wenn true, bleibt die Pille auch bei `value !== defaultValue` initial
   * kollabiert (keine Sticky-Open-Auto-Expansion). Nur der explizite Klick
   * auf die Pille expandiert. Für Pillen wie "Gruppiert", bei denen der
   * gewählte Nicht-Default-Wert dauerhaft persistiert ist und die Pille
   * trotzdem ruhig im Layout sitzen soll. Nur im **uncontrolled** Modus wirksam.
   */
  startCollapsed?: boolean;
  /**
   * Controlled-Modus (Akkordeon): wenn gesetzt, bestimmt der Aufrufer die
   * Expansion vollständig — die interne Sticky-Open-/manual-close-Heuristik ist
   * dann inaktiv, und Auswahl (auch `defaultValue`) klappt NICHT automatisch zu.
   * Der Aufrufer koordiniert damit ein „nur eine Pille offen"-Akkordeon.
   * Weggelassen (`undefined`) → uncontrolled, bestehendes Verhalten unverändert.
   */
  expanded?: boolean;
  /** Nur im Controlled-Modus: Klick auf die (kollabierte) Pille → `true`, Klick
   *  auf das Label der offenen Pille → `false`. */
  onExpandToggle?: (open: boolean) => void;
}

export function CollapsibleSeg({
  label,
  titel,
  value,
  items,
  onChange,
  defaultValue = 'Alle',
  startCollapsed = false,
  expanded,
  onExpandToggle,
}: Props): React.ReactElement {
  const isControlled = expanded !== undefined;
  const [forceOpen, setForceOpen] = useState(false);
  const [manualClosed, setManualClosed] = useState(startCollapsed);
  const isFiltered = value !== defaultValue;
  const uncontrolledExpanded = !manualClosed && (isFiltered || forceOpen);
  const isOpen = isControlled ? expanded : uncontrolledExpanded;

  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Außen-Klick-Zuklappen nur im uncontrolled Modus — im Akkordeon steuert der
    // Aufrufer die (persistierte) Expansion, ein Außen-Klick würde dagegen kämpfen.
    if (isControlled) return;
    if (!forceOpen || isFiltered) return;
    const onMouseDown = (e: MouseEvent): void => {
      const node = ref.current;
      if (!node || !(e.target instanceof Element)) return;
      // Echter Außen-Klick (Liste/Tabelle) → transient offene Pille zuklappen.
      // ABER nicht, wenn auf eine ANDERE Pille geklickt wird — sonst schließt
      // das Öffnen einer zweiten Pille die erste. Mehrere Pillen dürfen
      // gleichzeitig offen sein.
      if (!node.contains(e.target) && !e.target.closest('[data-collapsible-seg]')) {
        setForceOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isControlled, forceOpen, isFiltered]);

  const openPill = (): void => {
    if (isControlled) { onExpandToggle?.(true); return; }
    setForceOpen(true);
    setManualClosed(false);
  };
  const closePill = (): void => {
    if (isControlled) { onExpandToggle?.(false); return; }
    setManualClosed(true);
    setForceOpen(false);
  };

  if (!isOpen) {
    return (
      <div ref={ref} data-collapsible-seg className="inline-flex">
        <button
          type="button"
          onClick={openPill}
          aria-label={`${label} filtern`}
          title={titel}
          aria-expanded={false}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] cursor-pointer whitespace-nowrap transition-[border-color,background] duration-150 ease-out hover:bg-[var(--tf-hover)] ${
            isFiltered ? 'bg-[var(--tf-primary-light)]' : 'bg-[var(--tf-bg)]'
          }`}
          // Eine zugeklappte Pille sieht sonst gleich aus, ob sie filtert oder
          // nicht — bei mehreren gleichzeitig offenen Pillen ist das die einzige
          // Stelle, an der man den aktiven Filter noch erkennt.
          style={{ border: `0.5px solid ${isFiltered ? 'var(--tf-primary)' : 'var(--tf-border)'}` }}
        >
          <span className="text-[var(--tf-text-tertiary)]">{label}:</span>
          <span className={`font-medium ${isFiltered ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text)]'}`}>
            {value}
          </span>
          <ChevronRight size={10} className="text-[var(--tf-text-tertiary)] ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-collapsible-seg
      className="inline-flex items-center gap-2"
      style={{
        animation: 'seg-expand 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        transformOrigin: 'left center',
      }}
    >
      <button
        type="button"
        onClick={closePill}
        aria-label={`${label} ausblenden`}
        title={titel}
        aria-expanded={true}
        className={`inline-flex items-center gap-1 text-[12px] cursor-pointer bg-transparent border-0 p-0 hover:text-[var(--tf-text)] ${
          isFiltered ? 'text-[var(--tf-primary)] font-medium' : 'text-[var(--tf-text-tertiary)]'
        }`}
      >
        <span>{label}:</span>
        <ChevronLeft size={10} />
      </button>
      <SegGroup
        items={items}
        value={value}
        onChange={(lbl) => {
          onChange(lbl);
          // Uncontrolled: Auswahl des Default-Werts klappt zu. Controlled:
          // Expansion bleibt beim Aufrufer (Akkordeon), Auswahl ändert sie nie.
          if (!isControlled && lbl === defaultValue) setForceOpen(false);
        }}
        ariaLabel={label}
      />
    </div>
  );
}

/**
 * Reguläre Seg-Buttons-Gruppe (ohne Collapse-Wrapping). Wird sowohl vom
 * `CollapsibleSeg` im expanded-State genutzt als auch direkt vom Gruppieren-
 * Toggle in der Quickfilter-Toolbar.
 */
export function SegGroup({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: CollapsibleSegItem[];
  value: string;
  onChange: (label: string) => void;
  ariaLabel: string;
}): React.ReactElement {
  // Was in dieser Sicht nichts liefert, steht auch nicht da (siehe
  // `sichtbareSegmente`). Eine Stelle für alle Pillen — Status, Antragstyp,
  // Projektart, PreCheck und die Facetten-Umschalter der Schnellzugriff-Leiste.
  const gezeigte = sichtbareSegmente(items, value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // `overflow-hidden` darf bleiben, auch wenn ein Segment ein Menü hat: das
      // Menü hängt am `document.body` (siehe `SegItem`) und wird hier nicht
      // geclippt.
      className="inline-flex rounded-[8px] bg-[var(--tf-bg)] overflow-hidden"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {gezeigte.map((it, i) => (
        <SegItem
          key={it.label}
          item={it}
          value={value}
          onChange={onChange}
          erstes={i === 0}
          letztes={i === gezeigte.length - 1}
        />
      ))}
    </div>
  );
}

/** Mindestbreite des Untermenüs — auch die Grundlage der Rand-Klemmung. */
const MENUE_BREITE = 190;

/** Ein Segment-Knopf, optional mit Untermenü. Eigene Komponente, weil das Menü
 *  Zustand braucht — Hooks gehen nicht in einem `map`-Rückruf. */
function SegItem({
  item,
  value,
  onChange,
  erstes,
  letztes,
}: {
  item: CollapsibleSegItem;
  value: string;
  onChange: (label: string) => void;
  erstes: boolean;
  letztes: boolean;
}): React.ReactElement {
  const unterpunkte = item.unterpunkte ?? [];
  const hatMenue = unterpunkte.length > 0;
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useClickOutside(ref, () => setOffen(false), offen);

  // Das Menü hängt am `document.body`, nicht im Segment: die aufgeklappte Pille
  // trägt eine CSS-Animation mit `transform` und ist damit ein eigener
  // Stacking-Context — ein `z-index` DARIN gilt nur innerhalb der Pille, und die
  // Tabelle darunter malte über das offene Menü. Gleiches Muster wie im
  // `ColumnFilterDropdown`.
  useLayoutEffect(() => {
    if (!offen) { setPos(null); return; }
    const messe = (): void => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const RAND = 8;
      setPos({
        left: Math.max(RAND, Math.min(r.left, window.innerWidth - MENUE_BREITE - RAND)),
        top: r.bottom + 4,
      });
    };
    messe();
    // Mitwandern statt einfrieren — die Toolbar scrollt mit der Seite, ein
    // fixiertes Menü stünde sonst irgendwo im Nichts.
    window.addEventListener('scroll', messe, true);
    window.addEventListener('resize', messe);
    return () => {
      window.removeEventListener('scroll', messe, true);
      window.removeEventListener('resize', messe);
    };
  }, [offen]);

  // Was der Knopf anzeigt (aktiv? welche Zahl? welcher Zusatz?) entscheidet das
  // reine `segAnzeige` — inklusive der Falle, dass der Oberpunkt im Menü noch
  // einmal steht und sich sonst selbst als „aktiven Unterpunkt" findet.
  const { aktiverUnterpunkt, gezeigt, active } = segAnzeige(item, value);

  const ecken = `${erstes ? 'rounded-l-[8px] ' : ''}${letztes ? 'rounded-r-[8px] ' : ''}`;

  return (
    <div
      ref={ref}
      className={`relative inline-flex ${ecken}${active ? 'bg-[var(--tf-primary-light)]' : ''}`}
      style={erstes ? undefined : { borderLeft: '0.5px solid var(--tf-border)' }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        title={gezeigt.title}
        onClick={() => onChange(item.label)}
        className={`${ecken}${hatMenue ? 'pl-2.5 pr-1' : 'px-2.5'} py-1.5 text-[12px] font-inherit cursor-pointer transition-colors bg-transparent ${
          active
            ? 'text-[var(--tf-primary)] font-medium'
            : 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
        }`}
      >
        {item.label}
        {aktiverUnterpunkt ? (
          <span className="ml-1 opacity-70">· {aktiverUnterpunkt.label}</span>
        ) : null}
        {gezeigt.count != null ? (
          <span
            className={`ml-1.5 font-mono text-[10.5px] ${
              active ? 'opacity-70' : 'text-[var(--tf-text-tertiary)]'
            }`}
          >
            {gezeigt.count.toLocaleString('de-DE')}
          </span>
        ) : null}
      </button>
      {hatMenue ? (
        <>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={offen}
            aria-label={`${item.label} eingrenzen`}
            onClick={() => setOffen(o => !o)}
            className={`${letztes ? 'rounded-r-[8px] ' : ''}pl-0.5 pr-1.5 py-1.5 cursor-pointer bg-transparent transition-colors ${
              active ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'
            }`}
          >
            <ChevronDown size={11} />
          </button>
          {offen && pos ? createPortal(
            <div
              role="menu"
              className="fixed z-[1000] rounded-[8px] bg-[var(--tf-bg)] shadow-md overflow-hidden"
              style={{
                border: '0.5px solid var(--tf-border)',
                left: pos.left,
                top: pos.top,
                minWidth: MENUE_BREITE,
              }}
              // Der Außen-Klick-Wächter hört am `document`; ohne das käme sein
              // `pointerdown` VOR dem `click` und das Menü wäre weg, bevor die
              // Auswahl ankommt.
              onPointerDown={(e) => e.stopPropagation()}
            >
              {unterpunkte.map(u => {
                const gewaehlt = value === u.label;
                return (
                  <button
                    key={u.label}
                    type="button"
                    role="menuitemradio"
                    aria-checked={gewaehlt}
                    title={u.title}
                    onClick={() => { onChange(u.label); setOffen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer text-left hover:bg-[var(--tf-hover)] ${
                      gewaehlt ? 'text-[var(--tf-primary)] font-medium' : 'text-[var(--tf-text)]'
                    }`}
                  >
                    <Check
                      size={11}
                      className={`shrink-0 ${gewaehlt ? '' : 'invisible'}`}
                    />
                    <span className="flex-1">{u.menuLabel ?? u.label}</span>
                    {u.count != null ? (
                      <span className="font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
                        {u.count.toLocaleString('de-DE')}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          ) : null}
        </>
      ) : null}
    </div>
  );
}

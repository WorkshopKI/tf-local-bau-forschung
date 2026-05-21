import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
}

interface Props {
  label: string;
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
   * trotzdem ruhig im Layout sitzen soll.
   */
  startCollapsed?: boolean;
}

export function CollapsibleSeg({
  label,
  value,
  items,
  onChange,
  defaultValue = 'Alle',
  startCollapsed = false,
}: Props): React.ReactElement {
  const [forceOpen, setForceOpen] = useState(false);
  const [manualClosed, setManualClosed] = useState(startCollapsed);
  const isFiltered = value !== defaultValue;
  const expanded = !manualClosed && (isFiltered || forceOpen);

  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!forceOpen || isFiltered) return;
    const onMouseDown = (e: MouseEvent): void => {
      const node = ref.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        setForceOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [forceOpen, isFiltered]);

  if (!expanded) {
    return (
      <div ref={ref} className="inline-flex">
        <button
          type="button"
          onClick={() => { setForceOpen(true); setManualClosed(false); }}
          aria-label={`${label} filtern`}
          aria-expanded={false}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-[var(--tf-bg)] text-[12px] cursor-pointer whitespace-nowrap transition-[border-color,background] duration-150 ease-out hover:bg-[var(--tf-hover)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <span className="text-[var(--tf-text-tertiary)]">{label}:</span>
          <span className="text-[var(--tf-text)] font-medium">{value}</span>
          <ChevronRight size={10} className="text-[var(--tf-text-tertiary)] ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="inline-flex items-center gap-2"
      style={{
        animation: 'seg-expand 200ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        transformOrigin: 'left center',
      }}
    >
      <button
        type="button"
        onClick={() => { setManualClosed(true); setForceOpen(false); }}
        aria-label={`${label} ausblenden`}
        aria-expanded={true}
        className="inline-flex items-center gap-1 text-[12px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer bg-transparent border-0 p-0"
      >
        <span>{label}:</span>
        <ChevronLeft size={10} />
      </button>
      <SegGroup
        items={items}
        value={value}
        onChange={(lbl) => {
          onChange(lbl);
          if (lbl === defaultValue) setForceOpen(false);
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
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-[8px] overflow-hidden bg-[var(--tf-bg)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {items.map((it, i) => {
        const active = value === it.label;
        return (
          <button
            key={it.label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.label)}
            className={`px-2.5 py-1.5 text-[12px] font-inherit cursor-pointer transition-colors ${
              active
                ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)] font-medium'
                : 'bg-transparent text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]'
            }`}
            style={i === 0 ? undefined : { borderLeft: '0.5px solid var(--tf-border)' }}
          >
            {it.label}
            {it.count != null ? (
              <span
                className={`ml-1.5 font-mono text-[10.5px] ${
                  active ? 'opacity-70' : 'text-[var(--tf-text-tertiary)]'
                }`}
              >
                {it.count.toLocaleString('de-DE')}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Leichtgewichtiger Hover-Tooltip mit Card-Look.
 *
 * Warum nicht das native `title`-Attribut? → Card-Look (Border, Schatten,
 * mehrzeiliger Text). Warum kein Radix/Portal? → Für zwei Sätze Text Overkill.
 *
 * Trick gegen `overflow: hidden` der Tabellenzellen: der Tooltip ist
 * `position: fixed` und wird beim Hover per `getBoundingClientRect` des
 * Wrappers positioniert. Fixed-Elemente werden von `overflow`-Ancestors NICHT
 * geclippt (es gibt hier keinen transform-Containing-Block), daher erscheint
 * die Card außerhalb der Zelle. `pointer-events-none` verhindert Flackern.
 */
import { useRef, useState, type ReactNode } from 'react';

interface TooltipPos {
  x: number;
  y: number;
  placement: 'top' | 'bottom';
}

interface Props {
  content: ReactNode;
  children: ReactNode;
}

export function HoverTooltip({ content, children }: Props): React.ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<TooltipPos | null>(null);

  function show(): void {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Nahe am oberen Rand → unterhalb anzeigen, sonst oberhalb.
    const placement: 'top' | 'bottom' = r.top < 140 ? 'bottom' : 'top';
    // Horizontal an den Viewport klammern, damit die Card nicht abgeschnitten wird.
    const x = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150);
    setPos({
      x,
      y: placement === 'top' ? r.top - 6 : r.bottom + 6,
      placement,
    });
  }

  return (
    <span
      ref={ref}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && (
        <span
          role="tooltip"
          className="fixed left-0 top-0 max-w-[280px] px-3 py-2 rounded-[8px] text-[11.5px] leading-snug text-left whitespace-normal pointer-events-none"
          style={{
            zIndex: 80,
            transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, ${pos.placement === 'top' ? '-100%' : '0%'})`,
            background: 'var(--tf-bg)',
            border: '0.5px solid var(--tf-border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            color: 'var(--tf-text)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

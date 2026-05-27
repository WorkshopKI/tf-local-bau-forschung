/**
 * StatistikSection — Collapsible Section-Header fuer den oberen Statistik-Block
 * im Uebersicht-Tab. Nach Handoff-Design (`_design/handoff/auslastung/README.md`).
 *
 * Header-Layout:
 *  [chevron]  [STATISTIK-ÜBERSICHT (caps)]  [Q-Stichtag (14px)]  [hairline ────]
 *
 * Chevron rotiert um 90° im offenen Zustand. Klappzustand persistiert in
 * `localStorage.auslastung_stat_collapsed` (`'0'` = offen, `'1'` = collapsed),
 * Default offen — das Design legt die Story-Sicht in den Vordergrund.
 *
 * Klick auf den Header (oder Enter/Space mit Tastatur) toggelt. Animation
 * via `grid-template-rows: 0fr/1fr` (CSS-Variante ohne max-height-Sprung).
 */
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

const LS_KEY = 'auslastung_stat_collapsed';

interface Props {
  /** Caps-Section-Label, z.B. "STATISTIK-ÜBERSICHT". */
  label: string;
  /** Optionaler Count rechts vom Label, z.B. "2026-Q2". */
  count?: string;
  children: React.ReactNode;
}

function readInitialOpen(): boolean {
  try {
    return window.localStorage.getItem(LS_KEY) !== '1';
  } catch {
    return true;
  }
}

export function StatistikSection({ label, count, children }: Props): React.ReactElement {
  const [open, setOpen] = useState<boolean>(readInitialOpen);

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, open ? '0' : '1');
    } catch {
      // localStorage nicht verfuegbar (privater Tab o.Ä.) — silently ignorieren.
    }
  }, [open]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full cursor-pointer text-left select-none hover:bg-[var(--tf-hover)] transition-colors"
        style={{ padding: '6px 4px', margin: '0 -4px 16px', borderRadius: 6 }}
      >
        <ChevronRight
          size={14}
          className="text-[var(--tf-text-tertiary)] shrink-0"
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--tf-duration-med) var(--tf-ease)',
          }}
        />
        <span
          className="uppercase text-[var(--tf-text-tertiary)]"
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: 'var(--tf-tracking-caps)',
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        {count && (
          <span
            className="text-[var(--tf-text)]"
            style={{ fontSize: 14, fontWeight: 500, lineHeight: 1 }}
          >
            {count}
          </span>
        )}
        <span
          aria-hidden
          className="flex-1"
          style={{ height: '0.5px', background: 'var(--tf-border)' }}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] ease-out"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          transitionDuration: 'var(--tf-duration-med)',
        }}
      >
        <div className="overflow-hidden">
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

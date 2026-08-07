/**
 * EIN Menü für mehrere Darstellungs-Achsen einer Liste (Gruppierung, Dichte,
 * Sichtbarkeit …) — statt je Achse ein eigenes „…: …"-Dropdown in der Toolbar.
 *
 * Der Knopf trägt im Normalfall nur „Darstellung" und ist damit schmaler als
 * jeder einzelne Vorgänger. Weicht eine Achse vom Standard ab, steht ihr Wert
 * dahinter („Darstellung: Antrag mit TV · Status") — was gerade anders ist,
 * bleibt also sichtbar, ohne dass der Dauerzustand Platz kostet.
 *
 * **Das Menü bleibt nach einer Wahl offen.** Es ist kein Einzel-Schalter,
 * sondern mehrere nebeneinander; nach jedem Klick zu schließen zwänge zum
 * Wiederöffnen, sobald jemand zwei Achsen stellt. Geschlossen wird per Klick
 * daneben (`useClickOutside`).
 *
 * Welche Achsen gelten und was als Standard zählt, rechnet der Aufrufer in
 * einem reinen Modul (`darstellungsAchsen.ts` je Seite) — hier steht nur die
 * Darstellung.
 *
 * Visuelle Familie = `ColumnPicker`/`MultiSelectDropdown` (gerahmter Knopf +
 * Menü, `--tf-*`-Theming), damit die Toolbar-Steuerungen einer Seite fluchten.
 * Geteilt seit v3.24 (vorher `plugins/antraege/`), Aufrufer: Förderanträge und
 * Feedback-Board.
 */
import { useRef, useState } from 'react';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { darstellungsZusammenfassung, type DarstellungAchse } from './darstellungsAchsen';

interface Props<Id extends string> {
  achsen: readonly DarstellungAchse<Id>[];
  onChange: (id: Id, key: string) => void;
  /** Tooltip des Knopfes — er nennt die Achsen dieser Seite beim Namen. */
  titel?: string;
  /** Auf den Trigger gemergt (z.B. `h-8`, wo die Toolbar 32px fährt). */
  className?: string;
}

export function DarstellungDropdown<Id extends string>({
  achsen, onChange, titel, className,
}: Props<Id>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useClickOutside(containerRef, () => setOpen(false), open);

  const zusammenfassung = darstellungsZusammenfassung(achsen);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={titel ?? 'Darstellung der Liste'}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--tf-text)] rounded hover:bg-[var(--tf-hover)] whitespace-nowrap${className ? ` ${className}` : ''}`}
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <SlidersHorizontal size={14} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[var(--tf-text-tertiary)]">
          Darstellung{zusammenfassung ? ':' : ''}
        </span>
        {zusammenfassung ? <span className="font-medium">{zusammenfassung}</span> : null}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 z-[100] min-w-[230px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md overflow-hidden"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {achsen.map((a, i) => (
            <div
              key={a.id}
              style={i > 0 ? { borderTop: '0.5px solid var(--tf-border)' } : undefined}
            >
              <div className="px-3 pt-2 pb-1">
                <div className="text-[10.5px] tracking-[0.06em] font-medium text-[var(--tf-text-tertiary)]">
                  {a.label}
                </div>
                <div className="text-[10.5px] text-[var(--tf-text-tertiary)] opacity-80">
                  {a.hinweis}
                </div>
              </div>
              {a.options.map(o => {
                const aktiv = o.key === a.value;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={aktiv}
                    onClick={() => onChange(a.id, o.key)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-[12px] cursor-pointer hover:bg-[var(--tf-hover)] ${
                      aktiv ? 'text-[var(--tf-primary)] font-medium' : 'text-[var(--tf-text)]'
                    }`}
                  >
                    {/* Haken belegt seinen Platz auch unsichtbar — sonst rückte
                        die Beschriftung bei jedem Wechsel (Pitfall #14). */}
                    <Check size={12} className={aktiv ? '' : 'invisible'} aria-hidden="true" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

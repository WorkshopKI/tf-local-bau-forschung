/**
 * Inline-Autocomplete fuer Antrags-Zuordnung. Filtert die in-memory-Liste
 * der Antraege auf FKZ-/Akronym-/Titel-Substring. Tastatur:
 *   - Tippen filtert Vorschlaege
 *   - ArrowDown / ArrowUp navigiert die Vorschlagsliste
 *   - Enter waehlt aus, Escape leert das Feld
 */
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Antrag } from '@/core/services/csv/types';

interface Props {
  antraege: Antrag[];
  onSelect: (aktenzeichen: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export interface AntragAutocompleteHandle {
  focus: () => void;
}

export const AntragAutocomplete = forwardRef<AntragAutocompleteHandle, Props>(
  function AntragAutocomplete({ antraege, onSelect, placeholder, initialValue }, ref): React.ReactElement {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [query, setQuery] = useState(initialValue ?? '');
    const [highlight, setHighlight] = useState(0);
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
        inputRef.current?.select();
      },
    }), []);

    const matches = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const out: Antrag[] = [];
      for (const a of antraege) {
        const az = a.aktenzeichen.toLowerCase();
        const ak = a.akronym?.toLowerCase() ?? '';
        const t = a.titel?.toLowerCase() ?? '';
        if (az.includes(q) || ak.includes(q) || t.includes(q)) {
          out.push(a);
          if (out.length >= 8) break;
        }
      }
      return out;
    }, [antraege, query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(prev => Math.min(matches.length - 1, prev + 1));
        setOpen(true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pick = matches[highlight];
        if (pick) {
          onSelect(pick.aktenzeichen);
          setQuery('');
          setOpen(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        setOpen(false);
        inputRef.current?.blur();
      }
    };

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          data-tf-autocomplete-input="true"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'FKZ, Akronym oder Titel suchen…'}
          className="w-full bg-[var(--tf-bg)] text-[var(--tf-text)] text-[12.5px] rounded-[var(--tf-radius)] px-3 py-2 outline-none focus:border-[var(--tf-text)] transition-colors"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
        {open && matches.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-30 max-h-[260px] overflow-y-auto rounded-[var(--tf-radius)] bg-[var(--tf-bg)] shadow-lg"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {matches.map((m, i) => (
              <button
                key={m.aktenzeichen}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(m.aktenzeichen);
                  setQuery('');
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-3 py-2 text-[12px] transition-colors cursor-pointer ${
                  i === highlight ? 'bg-[var(--tf-hover)]' : ''
                }`}
              >
                <div className="font-mono text-[12px] text-[var(--tf-text)]">{m.aktenzeichen}</div>
                <div className="text-[11px] text-[var(--tf-text-tertiary)] truncate">
                  {m.akronym ? `${m.akronym} · ` : ''}{m.titel ?? '—'}
                </div>
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && matches.length === 0 && (
          <div
            className="absolute left-0 right-0 top-full mt-1 z-30 px-3 py-2 text-[11.5px] rounded-[var(--tf-radius)] bg-[var(--tf-bg)] text-[var(--tf-text-tertiary)]"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            Keine Treffer.
          </div>
        )}
      </div>
    );
  },
);

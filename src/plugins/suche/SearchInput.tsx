/**
 * Such-Eingabefeld inkl. Recent-Vorschläge (Konsolidierung 2026-07 aus SuchSeite.tsx
 * extrahiert — die erste der drei TODO-Verantwortungs-Grenzen). Kapselt das
 * Input-Feld, den Lade-Spinner und das komplette Recent-Search-Dropdown mit
 * Tastatur-Navigation, Blur-Commit und Klick-außerhalb-Logik.
 *
 * Die `query` selbst bleibt beim Aufrufer (sie treibt via `useDeferredValue` die
 * Such-Pipeline); dieses Feld ist ein kontrollierter Input, der Änderungen über
 * `onValueChange` meldet. Verhaltens-invariant zur bisherigen SuchSeite-Logik.
 */
import { useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useSucheStore } from './store';
import { SearchSuggestions } from './SearchSuggestions';
import { filterRecentSearches } from './suchseite-utils';
import { useClickOutside } from '@/core/hooks/useClickOutside';

export interface SearchInputProps {
  value: string;
  /** Wird bei jedem Tippen UND bei Vorschlags-Auswahl aufgerufen. */
  onValueChange: (next: string) => void;
  disabled: boolean;
  showSpinner: boolean;
}

export function SearchInput({ value, onValueChange, disabled, showSpinner }: SearchInputProps): React.ReactElement {
  const recentSearches = useSucheStore(s => s.recentSearches);
  const addRecentSearch = useSucheStore(s => s.addRecentSearch);
  const removeRecentSearch = useSucheStore(s => s.removeRecentSearch);
  const clearRecentSearches = useSucheStore(s => s.clearRecentSearches);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const suggestions = filterRecentSearches(recentSearches, value);
  useClickOutside(searchBoxRef, () => { setSuggestOpen(false); setActiveIndex(-1); }, suggestOpen);

  const handleInput = (next: string): void => {
    onValueChange(next);
    setSuggestOpen(true);
    setActiveIndex(-1);
  };

  const selectSuggestion = (s: string): void => {
    onValueChange(s);
    setSuggestOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      if (!suggestOpen) { setSuggestOpen(true); return; }
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!suggestOpen || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const picked = suggestOpen && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked !== undefined) {
        e.preventDefault();
        selectSuggestion(picked);
      } else {
        const q = value.trim();
        if (q) addRecentSearch(q);
        setSuggestOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === 'Escape') {
      if (suggestOpen) { e.preventDefault(); setSuggestOpen(false); setActiveIndex(-1); }
    }
  };

  const onSearchBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    // Klick auf einen Vorschlag / ✕ / „Verlauf leeren" (innerhalb des Wrappers)
    // soll die Teil-Query NICHT committen und das Dropdown offen lassen.
    if (searchBoxRef.current && e.relatedTarget instanceof Node && searchBoxRef.current.contains(e.relatedTarget)) {
      return;
    }
    const q = value.trim();
    if (q) addRecentSearch(q);
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="relative flex-1" ref={searchBoxRef}>
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)]" />
      <input
        ref={inputRef}
        data-tour="search-input"
        value={value}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => setSuggestOpen(true)}
        onKeyDown={onSearchKeyDown}
        onBlur={onSearchBlur}
        disabled={disabled}
        placeholder="Suche oder analytische Frage…"
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded={suggestOpen && suggestions.length > 0}
        aria-autocomplete="list"
        className="w-full h-10 pl-10 pr-10 text-[14px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] disabled:opacity-60"
        style={{ border: '0.5px solid var(--tf-border)' }}
      />
      {showSpinner && (
        <Loader2
          size={16}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--tf-text-tertiary)] animate-spin"
          aria-label="Suche laeuft"
        />
      )}
      {suggestOpen && suggestions.length > 0 && (
        <SearchSuggestions
          items={suggestions}
          activeIndex={activeIndex}
          onSelect={selectSuggestion}
          onRemove={q => { removeRecentSearch(q); inputRef.current?.focus(); }}
          onClear={() => { clearRecentSearches(); setSuggestOpen(false); setActiveIndex(-1); }}
          onHover={setActiveIndex}
        />
      )}
    </div>
  );
}

/**
 * Such-Eingabefeld inkl. Recent-Vorschläge (Konsolidierung 2026-07 aus SuchSeite.tsx
 * extrahiert — die erste der drei TODO-Verantwortungs-Grenzen). Kapselt das
 * Eingabefeld, den Lade-Spinner und das komplette Recent-Search-Dropdown mit
 * Tastatur-Navigation, Blur-Commit und Klick-außerhalb-Logik.
 *
 * Seit v3.50 ein `<textarea>` statt eines `<input>`: der Platzhalter lädt zu
 * einer „analytischen Frage" ein, das Feld war aber eine Zeile hoch und nicht
 * zu vergrößern. Es lässt sich jetzt an der Ecke in beide Richtungen ziehen
 * (`resize: both`), die gewählte Größe überlebt den Reload. Enter behält seine
 * Bedeutung (Vorschlag übernehmen / Anfrage in den Verlauf), Shift+Enter macht
 * den Zeilenumbruch — sonst käme man aus einer mehrzeiligen Frage nicht mehr
 * heraus, ohne sie zu zerstören.
 *
 * Die `query` selbst bleibt beim Aufrufer (sie treibt via `useDeferredValue` die
 * Such-Pipeline); dieses Feld ist ein kontrolliertes Element, das Änderungen über
 * `onValueChange` meldet.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useSucheStore } from './store';
import { SearchSuggestions } from './SearchSuggestions';
import {
  FELD_MIN_BREITE,
  FELD_MIN_HOEHE,
  filterRecentSearches,
  parseFeldGroesse,
  serializeFeldGroesse,
  type FeldGroesse,
} from './suchseite-utils';
import { useClickOutside } from '@/core/hooks/useClickOutside';

const GROESSE_KEY = 'teamflow_suche_feld_groesse';

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Gezogene Breite. Sie muss am WRAPPER hängen, nicht nur am Feld: der Wrapper
  // ist sonst `flex-1`, und ein breiter gezogenes Feld würde die Nachbarn in der
  // Kopfzeile überlappen, statt sie umbrechen zu lassen. `null` = nie gezogen,
  // das Feld füllt wie bisher den freien Platz.
  const [breite, setBreite] = useState<number | null>(null);

  // Gemerkte Größe beim Mount zurückschreiben — als INLINE-Style, genau wie der
  // Browser es beim Ziehen tut. Bewusst nicht über die React-`style`-Prop:
  // Breite/Höhe gehören dem Resizer, React würde sonst bei jedem Render dagegen
  // schreiben.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    let raw: string | null = null;
    try { raw = localStorage.getItem(GROESSE_KEY); } catch { /* ignore */ }
    const g: FeldGroesse | null = parseFeldGroesse(raw);
    if (!g) return;
    el.style.width = `${g.w}px`;
    el.style.height = `${g.h}px`;
    setBreite(g.w);
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      // Nur eine EXPLIZITE Größe zählt. Ohne diese Bedingung würde schon der
      // erste Layout-Durchlauf die Flex-Breite als „gewählt" festschreiben und
      // das Feld könnte nie wieder mitwachsen.
      if (!el.style.width) return;
      const naechste = { w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) };
      setBreite(naechste.w);
      try { localStorage.setItem(GROESSE_KEY, serializeFeldGroesse(naechste)); } catch { /* ignore */ }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Pfeiltasten gehören im mehrzeiligen Feld dem Cursor — sie werden nur
    // abgefangen, solange die Vorschlagsliste tatsächlich offen ist.
    const listeOffen = suggestOpen && suggestions.length > 0;
    if (e.key === 'ArrowDown') {
      if (!listeOffen) return;
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!listeOffen) return;
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Shift+Enter = Zeilenumbruch (die einzige Art, eine längere Frage zu
      // schreiben); Enter allein behält seine bisherige Bedeutung.
      if (e.shiftKey) return;
      e.preventDefault();
      const picked = suggestOpen && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (picked !== undefined) {
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

  const onSearchBlur = (e: React.FocusEvent<HTMLTextAreaElement>): void => {
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
    <div
      className={`relative ${breite === null ? 'flex-1' : ''}`}
      ref={searchBoxRef}
      style={breite === null ? undefined : { width: breite, flex: '0 0 auto' }}
    >
      <Search size={16} className="absolute left-3.5 top-[12px] text-[var(--tf-text-tertiary)]" />
      <textarea
        ref={inputRef}
        data-tour="search-input"
        rows={1}
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
        className="block w-full py-[9px] pl-10 pr-10 text-[14px] leading-[22px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius-lg)] outline-none placeholder:text-[var(--tf-text-tertiary)] focus:border-[var(--tf-primary)] disabled:opacity-60"
        style={{
          border: '0.5px solid var(--tf-border)',
          resize: 'both',
          minWidth: FELD_MIN_BREITE,
          minHeight: FELD_MIN_HOEHE,
          overflowY: 'auto',
        }}
      />
      {showSpinner && (
        <Loader2
          size={16}
          className="absolute right-3.5 top-[12px] text-[var(--tf-text-tertiary)] animate-spin"
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

/**
 * Such-Eingabefeld inkl. Vorschlägen (Konsolidierung 2026-07 aus SuchSeite.tsx
 * extrahiert — die erste der drei TODO-Verantwortungs-Grenzen). Kapselt das
 * Eingabefeld, den Lade-Spinner und das komplette Vorschlags-Dropdown mit
 * Tastatur-Navigation, Blur-Commit und Klick-außerhalb-Logik.
 *
 * Seit v4.71 sind es drei Quellen statt einer: Feldnamen, Werte aus dem Bestand,
 * Verlauf ([vervollstaendigung.ts](src/plugins/suche/vervollstaendigung.ts)).
 * Der Schreibcursor entscheidet mit — vorgeschlagen wird zu dem Stück, an dem
 * gerade geschrieben wird, und nur dieses wird ersetzt. Die `selectionStart`
 * liest ein eigener Zustand mit, weil ein kontrolliertes `<textarea>` bei jeder
 * Änderung neu rendert und die Cursorposition sonst einen Tastendruck
 * hinterherhinkte.
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
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { useSucheStore } from './store';
import { SearchSuggestions } from './SearchSuggestions';
import { berechneVorschlaege, vorschlagslisteSteht, type Vorschlag } from './vervollstaendigung';
import { naechsterSchub, useProbeZahlen } from './useProbeZahlen';
import type { WertIndex } from '@/plugins/antraege/services/wert-index';
import {
  FELD_MIN_BREITE,
  FELD_MIN_HOEHE,
  parseFeldGroesse,
  serializeFeldGroesse,
  type FeldGroesse,
} from './suchseite-utils';
import { useClickOutside } from '@/core/hooks/useClickOutside';

const GROESSE_KEY = 'teamflow_suche_feld_groesse';

/**
 * Wie viele Vorschläge je Stufe gerendert werden.
 *
 * 200 füllt die 320 px hohe Liste rund sechsmal — es ist also nie ein Loch zu
 * sehen — und kostet gemessen unter 60 ms je Stufe. Beim größten Feld (`ast:`,
 * 5 460 Werte) sind das 28 Stufen, die über Message-Tasks nachlaufen, während
 * die Liste schon bedienbar ist.
 */
const STUFE = 200;

export interface SearchInputProps {
  value: string;
  /** Wird bei jedem Tippen UND bei Vorschlags-Auswahl aufgerufen. */
  onValueChange: (next: string) => void;
  disabled: boolean;
  showSpinner: boolean;
  /**
   * Die Anfrage ist fertig und soll laufen — Enter, oder die Auswahl eines
   * VOLLSTÄNDIGEN Vorschlags aus dem Verlauf.
   *
   * Die Stichwortsuche braucht das nicht — sie läuft beim Tippen. Die
   * natürlichsprachige Suche schon: ihr KI-Aufruf hängt an genau dieser einen
   * Geste, nicht am Tastendruck. Bewusst NICHT beim Verlassen des Feldes: ein
   * Klick daneben ist keine Frage.
   *
   * Der Text kommt MIT, statt vom Aufrufer aus seinem Zustand gelesen zu
   * werden: bei der Vorschlags-Auswahl trägt der ihn in demselben Render noch
   * nicht, und der Lauf ginge auf den vorigen Text.
   */
  onSubmit?: (anfrage: string) => void;
  /** Ersetzt den Standardtext, wenn eine andere Art zu fragen erwartet wird. */
  platzhalter?: string;
  /**
   * Der Wertevorrat des Bestands für die Vervollständigung. `null` = noch nicht
   * geladen (dann bleibt es beim Verlauf) oder bewusst aus, wie im Frage-Modus:
   * dort tippt niemand `ort:`.
   */
  wertIndex?: WertIndex | null;
  /**
   * Probelauf für die Trefferzahl am Vorschlag — dieselbe Funktion, die schon
   * die Zahlen des Startzustands rechnet. Eine gerechnete Zahl ist nie falsch,
   * eine gezählte wäre es: 485 Anträge tragen den Ort „Dresden", `ort:Dresden`
   * findet 451.
   */
  zaehle?: (anfrage: string) => number | null;
}

export function SearchInput({
  value, onValueChange, disabled, showSpinner, onSubmit, platzhalter,
  wertIndex = null, zaehle,
}: SearchInputProps): React.ReactElement {
  const recentSearches = useSucheStore(s => s.recentSearches);
  const addRecentSearch = useSucheStore(s => s.addRecentSearch);
  const removeRecentSearch = useSucheStore(s => s.removeRecentSearch);
  const clearRecentSearches = useSucheStore(s => s.clearRecentSearches);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Wo geschrieben wird. Getrennt vom Text, weil die Vorschläge davon abhängen
  // und ein Klick mitten in die Anfrage den Text nicht ändert.
  const [cursor, setCursor] = useState(0);
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

  const suggestions = useMemo(
    () => berechneVorschlaege({ text: value, cursor, index: wertIndex, verlauf: recentSearches }),
    [value, cursor, wertIndex, recentSearches],
  );
  // Die Trefferzahlen kommen NACH der Liste — und in Portionen; die Mechanik
  // dazu steht in [useProbeZahlen](src/plugins/suche/useProbeZahlen.ts), weil
  // der Reiter „Stöbern" im Startzustand dieselbe Zusage macht. Die 150 ms
  // Verzögerung sind hier die halbe Miete: sie verhindern, dass jeder
  // Tastendruck 14 225 Einträge durchgeht.
  //
  // Seit v4.88 ist die Liste ungekappt (bis 5 461 Werte), deshalb rechnet sie
  // nur für Zeilen, die das Dropdown als sichtbar meldet — sonst liefen ~80 s
  // Probeläufe für Zahlen neben Zeilen, die niemand ansieht.
  const wertVorschlaege = useMemo(() => suggestions.filter(v => v.art === 'wert'), [suggestions]);
  const [sichtbareKeys, setSichtbareKeys] = useState<ReadonlySet<string>>(() => new Set());
  const trefferZahlen = useProbeZahlen(wertVorschlaege, zaehle, 150, sichtbareKeys);

  /**
   * Die Liste kommt in Stufen — sonst kostet EIN Tastendruck über eine Sekunde.
   *
   * Ohne Deckel rendert `ast:` 5 460 Zeilen; am echten Bestand gemessen blockiert
   * das den Hauptthread **1 338 ms** (`ort:` 713 ms, `nw:` 458 ms, `deskriptor:`
   * 52 ms). Das ist genau der Hänger, den die ungekappte Liste einbringt — und
   * der Grund, sie trotzdem nicht wieder zu kappen: gefragt war der ganze
   * Katalog, nicht sein Anfang.
   *
   * Also erscheint der Anfang sofort und der Rest wächst über Message-Tasks
   * nach — dieselbe Mechanik wie bei den Trefferzahlen, aus demselben Grund
   * (verschachtelte Timer klemmt der Browser ab, ein Message-Task nicht).
   * Sichtbar ist immer nur, was gerendert ist, also gilt die Stufe auch für
   * Tastatur-Navigation und Zähler — eine Auswahlmarke, die auf eine noch nicht
   * gerenderte Zeile zeigt, gäbe es sonst.
   */
  const [gezeigt, setGezeigt] = useState(STUFE);
  useEffect(() => {
    setGezeigt(STUFE);
    if (suggestions.length <= STUFE) return;
    let abgebrochen = false;
    const weiter = (n: number): void => {
      if (abgebrochen) return;
      setGezeigt(n);
      if (n < suggestions.length) naechsterSchub(() => weiter(n + STUFE));
    };
    naechsterSchub(() => weiter(STUFE * 2));
    return () => { abgebrochen = true; };
  }, [suggestions]);
  const gezeigteVorschlaege = useMemo(
    () => (gezeigt >= suggestions.length ? suggestions : suggestions.slice(0, gezeigt)),
    [suggestions, gezeigt],
  );

  // Wann die Liste steht (und warum sie beim leeren Feld zubleibt), steht in
  // `vorschlagslisteSteht` — dieselbe Bedingung für Anzeige, Tastatur und
  // `aria-expanded`.
  const listeOffen = vorschlagslisteSteht(suggestOpen, value, gezeigteVorschlaege.length);

  useClickOutside(searchBoxRef, () => { setSuggestOpen(false); setActiveIndex(-1); }, suggestOpen);

  /** Cursorposition aus dem Feld nachziehen — nach Tippen, Klicken, Pfeiltasten. */
  const merkeCursor = (): void => {
    const el = inputRef.current;
    if (el) setCursor(el.selectionStart ?? el.value.length);
  };

  const handleInput = (next: string, pos: number): void => {
    onValueChange(next);
    setCursor(pos);
    setSuggestOpen(true);
    setActiveIndex(-1);
  };

  const selectSuggestion = (v: Vorschlag): void => {
    onValueChange(v.anfrage);
    setCursor(v.cursor);
    // Ein Verlaufs-Eintrag IST eine fertige Anfrage — die Auswahl tut deshalb
    // dasselbe wie die Eingabetaste. Im Frage-Modus hieß „auswählen" sonst nur
    // „in das Feld schreiben": die Frage stand da, und es brauchte eine zweite
    // Geste, um sie zu stellen. Für `feld`/`wert` gilt das nicht — die sind ein
    // Stück Anfrage, kein Auftrag.
    if (v.art === 'verlauf') onSubmit?.(v.anfrage);
    // Nach einem Feldnamen (`ort:`) bleibt die Liste offen — der nächste Schritt
    // ist sein Wert, und ihn sofort zu zeigen ist der halbe Sinn der Sache.
    setSuggestOpen(v.weiter);
    setActiveIndex(-1);
    const el = inputRef.current;
    el?.focus();
    // Erst nach dem Rendern des neuen Textes — vorher zeigte die Auswahl noch
    // auf die alte, kürzere Zeichenkette.
    window.requestAnimationFrame(() => el?.setSelectionRange(v.cursor, v.cursor));
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Pfeiltasten gehören im mehrzeiligen Feld dem Cursor — sie werden nur
    // abgefangen, solange die Vorschlagsliste tatsächlich offen ist (oben).
    if (e.key === 'ArrowDown') {
      if (!listeOffen) return;
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, gezeigteVorschlaege.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (!listeOffen) return;
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Shift+Enter = Zeilenumbruch (die einzige Art, eine längere Frage zu
      // schreiben); Enter allein behält seine bisherige Bedeutung.
      if (e.shiftKey) return;
      e.preventDefault();
      const picked = listeOffen && activeIndex >= 0 ? gezeigteVorschlaege[activeIndex] : undefined;
      if (picked !== undefined) {
        selectSuggestion(picked);
      } else {
        const q = value.trim();
        if (q) addRecentSearch(q);
        setSuggestOpen(false);
        setActiveIndex(-1);
        if (q) onSubmit?.(q);
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
        onChange={e => handleInput(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onFocus={() => { setSuggestOpen(true); merkeCursor(); }}
        onKeyDown={onSearchKeyDown}
        // Der Cursor bewegt sich auch ohne Textänderung — Pfeiltasten, Klick,
        // Auswahl. Ohne dieses Nachziehen zeigte die Liste Vorschläge zu einem
        // Stück, an dem gar nicht mehr geschrieben wird.
        onKeyUp={merkeCursor}
        onClick={merkeCursor}
        onSelect={merkeCursor}
        onBlur={onSearchBlur}
        disabled={disabled}
        placeholder={platzhalter ?? 'Suche oder analytische Frage…'}
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded={listeOffen}
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
      {listeOffen && (
        <SearchSuggestions
          items={gezeigteVorschlaege}
          activeIndex={activeIndex}
          onSelect={selectSuggestion}
          onRemove={q => { removeRecentSearch(q); inputRef.current?.focus(); }}
          onClear={() => { clearRecentSearches(); setSuggestOpen(false); setActiveIndex(-1); }}
          onHover={setActiveIndex}
          treffer={trefferZahlen}
          onSichtbareKeys={setSichtbareKeys}
        />
      )}
    </div>
  );
}

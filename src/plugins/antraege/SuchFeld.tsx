/**
 * Das Suchfeld der Förderantrags-Liste — ein Feld, zwei Betriebsarten.
 *
 * **Stichworte** bleiben eine Zeile (`<Input>`, `h-8`): dort steht ein Wort, ein
 * Kennzeichen oder ein Feldausdruck, und ein aufziehbares Feld hätte nichts zu
 * zeigen.
 *
 * **Eine Frage** ist ein ganzer Satz. Ab etwa siebzig Zeichen läuft er aus dem
 * Feld heraus, und wer nachträglich ein Wort in der Mitte ändern will, sucht es
 * im Vorbeiscrollen. Deshalb ein `<textarea>` mit `resize: vertical` —
 * dieselbe Entscheidung wie im Suchfeld der Dokumenten-Suche (v3.50), nur ohne
 * die Breiten-Achse: die Breite gehört hier dem Zeilenlayout, das Feld soll sie
 * ausfüllen und nicht von Hand kleiner gezogen werden.
 *
 * Die gezogene Höhe überlebt Moduswechsel und Reload (`localStorage`). Sie wird
 * als **Inline-Style** gesetzt, genau wie der Browser es beim Ziehen tut, und
 * NICHT über die `style`-Prop: die Höhe gehört dem Resizer, React schriebe
 * sonst bei jedem Render dagegen (die Lehre aus `SearchInput`).
 *
 * **Ein Ref für beide Elemente** (Callback-Ref): der Frage-Modus setzt den
 * Schreibcursor in die nächste Lücke einer Vorlage, und dafür muss
 * `useFrageVorschlaege` das Element erreichen, das gerade dasteht — egal
 * welches.
 */
import { useCallback, useRef } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FrageVorschlaege } from '@/components/frage-vorschlaege';
import type { FrageVorschlaegeSteuerung, SuchFeldElement } from './frage/useFrageVorschlaege';

const HOEHE_KEY = 'teamflow_antraege_fragefeld_hoehe';

/** Eine Zeile — dieselbe Höhe, die `<Input>` im Stichwort-Modus hat (`h-8`). */
const MIN_HOEHE = 32;
/** Genug für rund zehn Zeilen; darüber verdeckte das Feld die Filterleiste. */
const MAX_HOEHE = 240;

/**
 * Der gemerkte Rohwert → brauchbare Höhe, oder `null`.
 *
 * Rein und exportiert, damit die Grenzen prüfbar sind: ein Wert aus dem
 * Speicher überlebt jede Umbenennung und jeden Tippfehler im Entwicklerwerkzeug,
 * und ein Feld von 5 000 px legte die Seite lahm.
 */
export function leseHoehe(roh: string | null): number | null {
  if (roh === null) return null;
  const h = Number(roh);
  if (!Number.isFinite(h) || h < MIN_HOEHE || h > MAX_HOEHE) return null;
  return Math.round(h);
}

function ladeHoehe(): number | null {
  try {
    return leseHoehe(localStorage.getItem(HOEHE_KEY));
  } catch {
    return null;
  }
}

function speichereHoehe(h: number): void {
  try { localStorage.setItem(HOEHE_KEY, String(h)); } catch { /* ignore */ }
}

const PLATZHALTER_FRAGE =
  'Frage stellen, z. B. „alle Netzwerke, die für Phase 2 abgelehnt wurden" — Enter';
const PLATZHALTER_WORT =
  'Anträge durchsuchen (Titel, Akronym, FKZ, Antragsteller, Ort, Dokumente)';

const TITEL_FRAGE =
  'Ganze Frage eingeben und Enter drücken. Die interne KI übersetzt sie in Filter. '
  + 'Die untere Kante lässt sich nach unten ziehen.';
const TITEL_WORT =
  'Wortlaut über Aktenzeichen/Akronym/Titel/Antragsteller/Ort/Bundesland/'
  + 'Verbund-Titel/Kurzbeschreibung UND den Volltext der aufgenommenen Dokumente. '
  + 'Inhaltlich ähnliche Anträge kommen über den Hinweis unter dem Feld dazu.';

export interface SuchFeldProps {
  wert: string;
  setzeWert: (t: string) => void;
  /** `true` = Frage-Modus: mehrzeilig und in der Höhe ziehbar. */
  frageModus: boolean;
  /** Läuft gerade eine Wortlaut-Suche? */
  laedt: boolean;
  /** Zeigt auf das Element, das gerade dasteht (Input ODER Textarea). */
  feldRef: React.RefObject<SuchFeldElement | null>;
  vorschlaege: FrageVorschlaegeSteuerung;
}

export function SuchFeld({
  wert, setzeWert, frageModus, laedt, feldRef, vorschlaege,
}: SuchFeldProps): React.ReactElement {
  const beobachterRef = useRef<ResizeObserver | null>(null);

  /**
   * Höhe herstellen und überwachen **im Callback-Ref**, nicht in einem Effekt
   * (Bug-Klasse 23): das Element wechselt mit dem Modus die Sorte, und ein
   * Effekt, der `feldRef.current` liest, greift je nach Reihenfolge noch das
   * alte. Gemessen: der Beobachter hing dann an gar keinem Knoten, die gezogene
   * Höhe wurde nie gemerkt. Hier ist der Knoten das Argument — es gibt keine
   * Reihenfolge, die schiefgehen kann.
   *
   * `useCallback`, damit React den Ref nicht bei jedem Render ab- und
   * wieder anhängt.
   */
  const setzeRef = useCallback((el: SuchFeldElement | null): void => {
    feldRef.current = el;
    beobachterRef.current?.disconnect();
    beobachterRef.current = null;
    if (!(el instanceof HTMLTextAreaElement)) return;

    const h = ladeHoehe();
    if (h !== null) el.style.height = `${h}px`;
    if (typeof ResizeObserver === 'undefined') return;
    // Nur eine EXPLIZITE Höhe zählt — ohne diese Bedingung schriebe schon der
    // erste Layout-Durchlauf die Zeilenhöhe als „gewählt" fest.
    const ro = new ResizeObserver(() => {
      if (!el.style.height) return;
      speichereHoehe(Math.round(el.offsetHeight));
    });
    ro.observe(el);
    beobachterRef.current = ro;
  }, [feldRef]);

  const gemeinsam = {
    value: wert,
    onFocus: vorschlaege.beiFokus,
    onBlur: vorschlaege.beiVerlust,
    // Im Frage-Modus läuft NICHTS beim Tippen: ein KI-Aufruf je Tastendruck wäre
    // weder bezahlbar noch sinnvoll. Erst Enter — und was Enter dann bedeutet,
    // entscheidet `beiTaste` (Zeile wählen / in die Lücke springen / fragen).
    onKeyDown: vorschlaege.beiTaste,
  };

  // Im mehrzeiligen Feld sitzen Lupe und Spinner an der ERSTEN Zeile, nicht in
  // der Mitte: sonst wanderten sie beim Aufziehen nach unten und stünden
  // irgendwann neben dem Text statt davor.
  const randSymbol = frageModus ? 'top-[9px]' : 'top-1/2 -translate-y-1/2';

  return (
    <div className="relative flex-1 min-w-[340px] max-w-[640px]">
      <Search
        size={13}
        className={`absolute left-2.5 text-[var(--tf-text-tertiary)] pointer-events-none ${randSymbol}`}
      />
      {frageModus ? (
        <textarea
          ref={setzeRef}
          {...gemeinsam}
          onChange={e => { setzeWert(e.target.value); vorschlaege.beiEingabe(); }}
          rows={1}
          placeholder={PLATZHALTER_FRAGE}
          title={TITEL_FRAGE}
          className="block w-full rounded-lg border border-input bg-transparent py-[7px] pl-7 pr-7 text-[12.5px] leading-[16px] text-[var(--tf-text)] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          style={{ resize: 'vertical', minHeight: MIN_HOEHE, maxHeight: MAX_HOEHE, overflowY: 'auto' }}
        />
      ) : (
        <Input
          ref={setzeRef}
          {...gemeinsam}
          onChange={e => { setzeWert(e.target.value); vorschlaege.beiEingabe(); }}
          placeholder={PLATZHALTER_WORT}
          title={TITEL_WORT}
          className="pl-7 pr-7 h-8 w-full text-[12.5px]"
        />
      )}
      {laedt ? (
        <Loader2
          size={12}
          className={`absolute right-2 text-[var(--tf-text-tertiary)] animate-spin pointer-events-none ${randSymbol}`}
          aria-label="Suche läuft"
        />
      ) : null}
      <FrageVorschlaege steuerung={vorschlaege} />
    </div>
  );
}

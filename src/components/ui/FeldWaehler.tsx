/**
 * Feld-Wähler — such-, filter- und sortierbare Auswahl einer Spalte.
 *
 * Ersetzt das nackte `<select>`, in dem eine Bedingung ihr Feld suchte. Dort
 * standen zwei Dutzend bis mehrere hundert Einträge der Form „TIB · tib_kuerz"
 * in einer Reihenfolge, die niemand kennt, ohne Suche, ohne Erklärung, was die
 * Spalte eigentlich enthält — und wer die falsche erwischte, baute eine Regel,
 * die nie zutrifft und nichts sagt.
 *
 * **Domänenfrei.** Der Wähler kennt nur `SpaltenEintrag`. Deshalb bedient er
 * den Bedingungs-Editor (und damit Meilensteine, To-do-Regeln und die eigenen
 * Spalten) genauso wie die Auswahl des Ist-Termin-Feldes — statt dass jede
 * Stelle sich ihre eigene Liste baut, wie es bis hierher der Fall war.
 *
 * Die **Vorschläge** kommen von außen. Woher sie stammen, weiß der Aufrufer;
 * dieser Wähler heftet sie nur an und nennt den mitgelieferten Grund.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  einzeiligesLabel, type SpaltenEintrag, type SpaltenTyp,
} from '@/core/services/csv/spalten-inventar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ToggleChip } from './ToggleChip';

/** Ein angehefteter Kandidat mit Begründung. */
export interface FeldWaehlerVorschlag {
  feldId: string;
  /** Warum dieses Feld? Steht gedämpft hinter der Zeile. */
  grund: string;
}

export interface FeldWaehlerProps {
  spalten: readonly SpaltenEintrag[];
  /** Die gewählte `feldId`. Leerstring = die `leerOption`, falls es eine gibt. */
  wert: string;
  onWaehle: (feldId: string) => void;
  /** Nur Spalten dieses Typs anbieten (Ist-Termin: nur Datumsspalten). */
  nurTyp?: SpaltenTyp;
  /** Oben angeheftete Kandidaten. Leer/fehlend = kein Vorschlags-Abschnitt. */
  vorschlaege?: readonly FeldWaehlerVorschlag[];
  /** Erlaubt „kein Feld" und beschriftet diesen Fall. */
  leerOption?: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Breite des Auslösers; ohne Angabe passt er sich dem Inhalt an. */
  className?: string;
  /**
   * `feld` (Default): Auslöser mit Rahmen, wie ein Eingabefeld.
   * `leise`: nur der Feldname mit gepunkteter Unterkante — für die Karten des
   * Bedingungs-Editors, wo ein Dutzend gerahmter Felder die Regel übertönte.
   */
  variante?: 'feld' | 'leise';
  /**
   * Eine Kennzahl je Feld statt der Programm-Deckung — die Meilensteine zeigen
   * dort, bei wie vielen Verbünden das Feld gefüllt ist. Der Aufrufer liefert
   * den fertigen Text; die Spalte trägt `kennzahlTitel` als Kopf.
   */
  kennzahl?: (feldId: string) => string | undefined;
  kennzahlTitel?: string;
}

type Spalte = 'feldId' | 'label' | 'deckung';
type Richtung = 'auf' | 'ab';

/** Katalog-Reihenfolge (kanonisch zuerst) — der Rückfall, wenn nichts sortiert ist. */
const KATALOG: Spalte | null = null;

function deckungVon(e: SpaltenEintrag): number {
  return e.programmAnzahl ?? e.schemaAnzahl;
}

/** Die kurze Herkunft: woraus entsteht ein kanonisches Feld? */
function herkunft(e: SpaltenEintrag): string {
  if (e.quellCodes.length === 0) return '';
  return e.quellCodes.length <= 2
    ? e.quellCodes.join(', ')
    : `${e.quellCodes.slice(0, 2).join(', ')} +${e.quellCodes.length - 2}`;
}

/** So steht ein Feld im Auslöser und in der Zeile. */
export function feldBeschriftung(e: SpaltenEintrag): string {
  return e.label === e.feldId ? e.feldId : `${einzeiligesLabel(e.label)} · ${e.feldId}`;
}

const ZEILE = 'flex w-full items-center gap-2 px-2 py-1 text-left text-[12px] cursor-pointer';

function Kopf({ spalte, aktiv, richtung, onSort, className, children }: {
  spalte: Spalte;
  aktiv: Spalte | null;
  richtung: Richtung;
  onSort: (s: Spalte) => void;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const ist = aktiv === spalte;
  return (
    <button
      type="button"
      onClick={() => onSort(spalte)}
      aria-sort={ist ? (richtung === 'auf' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'flex items-center gap-0.5 text-[10.5px] uppercase tracking-wide cursor-pointer',
        ist ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]',
        className,
      )}
    >
      {children}
      {ist
        ? (richtung === 'auf' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
        : <ChevronsUpDown size={10} className="opacity-50" />}
    </button>
  );
}

export function FeldWaehler({
  spalten, wert, onWaehle, nurTyp, vorschlaege, leerOption, ariaLabel, disabled, className,
  variante = 'feld', kennzahl, kennzahlTitel = 'Treffer',
}: FeldWaehlerProps): React.ReactElement {
  const leise = variante === 'leise';
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  const [sortSpalte, setSortSpalte] = useState<Spalte | null>(KATALOG);
  const [richtung, setRichtung] = useState<Richtung>('auf');
  const [nurKanonisch, setNurKanonisch] = useState(false);
  const [typFilter, setTypFilter] = useState<SpaltenTyp | null>(null);
  const [cursor, setCursor] = useState(0);
  const listeRef = useRef<HTMLDivElement>(null);

  const gewaehlt = spalten.find(s => s.feldId === wert);

  // Der Typ-Filter des Aufrufers ist bindend; der Chip zeigt ihn nur an.
  const typWirksam = nurTyp ?? typFilter;

  const basis = useMemo(
    () => (nurTyp ? spalten.filter(s => s.typ === nurTyp) : spalten),
    [spalten, nurTyp],
  );

  // Die Deckungs-Spalte zählt Programme. Ein synthetischer Vorrat (die
  // To-do-Regeln bauen ihren aus der Katalog-Fassung) führt sie nicht — dann
  // bleibt die Spalte weg, statt eine leere Spalte zu zeigen.
  const zeigeDeckung = useMemo(
    () => basis.some(e => e.programmAnzahl !== undefined),
    [basis],
  );

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const liste = basis.filter(e => {
      if (typWirksam && e.typ !== typWirksam) return false;
      if (nurKanonisch && e.quelle !== 'kanonisch') return false;
      if (q === '') return true;
      return e.feldId.toLowerCase().includes(q)
        || e.label.toLowerCase().includes(q)
        || e.quellCodes.some(c => c.toLowerCase().includes(q));
    });
    if (sortSpalte === null) return liste;
    const faktor = richtung === 'auf' ? 1 : -1;
    return [...liste].sort((a, b) => {
      if (sortSpalte === 'deckung') return faktor * (deckungVon(a) - deckungVon(b));
      const links = sortSpalte === 'feldId' ? a.feldId : a.label;
      const rechts = sortSpalte === 'feldId' ? b.feldId : b.label;
      return faktor * links.localeCompare(rechts, 'de');
    });
  }, [basis, suche, sortSpalte, richtung, nurKanonisch, typWirksam]);

  // Vorschläge nur, solange nicht gesucht wird: wer tippt, hat sein Feld im
  // Kopf, und eine angeheftete Zeile über den Treffern verschöbe die Auswahl.
  const angeheftet = useMemo(() => {
    if (!vorschlaege?.length || suche.trim() !== '') return [];
    return vorschlaege
      .map(v => ({ v, e: basis.find(s => s.feldId === v.feldId) }))
      .filter((x): x is { v: FeldWaehlerVorschlag; e: SpaltenEintrag } => !!x.e);
  }, [vorschlaege, basis, suche]);

  /** Was die Pfeiltasten durchlaufen: erst die Vorschläge, dann die Liste. */
  const navigierbar = useMemo(
    () => [...angeheftet.map(x => x.e.feldId), ...(leerOption !== undefined ? [''] : []),
      ...gefiltert.map(e => e.feldId)],
    [angeheftet, gefiltert, leerOption],
  );

  // Beim Öffnen frisch anfangen — ein alter Suchbegriff verbirgt beim nächsten
  // Mal genau das Feld, das gesucht wird.
  useEffect(() => {
    if (!offen) return;
    setSuche('');
    setCursor(Math.max(0, navigierbar.indexOf(wert)));
    // `navigierbar` bewusst NICHT in den Abhängigkeiten: es ändert sich mit
    // jedem Tastendruck, und der Cursor soll dann gerade nicht zurückspringen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, wert]);

  // Der Cursor darf nicht ins Leere zeigen, wenn das Filtern die Liste kürzt.
  useEffect(() => {
    setCursor(c => Math.min(c, Math.max(0, navigierbar.length - 1)));
  }, [navigierbar.length]);

  const waehle = (feldId: string): void => {
    onWaehle(feldId);
    setOffen(false);
  };

  const taste = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => {
        const naechst = e.key === 'ArrowDown' ? c + 1 : c - 1;
        const gedeckelt = Math.max(0, Math.min(naechst, navigierbar.length - 1));
        listeRef.current
          ?.querySelector(`[data-index="${gedeckelt}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        return gedeckelt;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const ziel = navigierbar[cursor];
      if (ziel !== undefined) waehle(ziel);
    }
  };

  const ausloeserText = gewaehlt
    ? feldBeschriftung(gewaehlt)
    : (wert === '' && leerOption !== undefined ? leerOption : `${wert} (nicht gemappt)`);

  // Die Quellspalten des gewählten Feldes: kurz in der Zeile (wie in der Liste
  // darunter), vollständig mit Beschriftung im Tooltip. Ein nativer `title`
  // statt des Portal-Tooltips, weil der Auslöser ein Popover öffnet — ein
  // Portal-Tooltip bliebe über der offenen Liste stehen.
  const quelleKurz = gewaehlt ? herkunft(gewaehlt) : '';
  const quellTitel = gewaehlt?.quellSpalten?.length
    ? `\nSpeist sich aus: ${gewaehlt.quellSpalten
      .map(s => (s.label && s.label !== s.code ? `${s.code} (${einzeiligesLabel(s.label)})` : s.code))
      .join(', ')}`
    : '';

  let index = -1;
  const naechsterIndex = (): number => { index += 1; return index; };

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          title={`${ausloeserText}${quellTitel}`}
          className={cn(
            'flex items-center gap-1 rounded text-[12px] text-left text-[var(--tf-text)] cursor-pointer',
            'disabled:cursor-not-allowed disabled:opacity-60',
            leise
              ? 'min-w-0 px-0.5 py-0 bg-transparent hover:bg-[var(--tf-hover)]'
              : 'px-1.5 py-0.5 bg-[var(--tf-bg)] hover:border-[var(--tf-border-hover)]',
            className ?? 'max-w-[240px]',
          )}
          style={leise ? undefined : { border: '0.5px solid var(--tf-border)' }}
        >
          <span className={cn('truncate', leise && 'underline decoration-dotted decoration-[var(--tf-border-hover)] underline-offset-[3px]')}>
            {ausloeserText}
          </span>
          {quelleKurz && (
            <span className="shrink-0 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
              ← {quelleKurz}
            </span>
          )}
          <ChevronsUpDown size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[420px] p-0" onKeyDown={taste}>
        <div className="flex items-center gap-1.5 px-2 pt-2">
          <Search size={12} className="shrink-0 text-[var(--tf-text-tertiary)]" />
          <input
            autoFocus
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="Kürzel, Beschreibung oder Spalte suchen …"
            aria-label="Feld suchen"
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--tf-text)] outline-none"
          />
          <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">
            {gefiltert.length}/{basis.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1 px-2 pt-1.5">
          <ToggleChip
            label="Datum" groesse="dicht"
            selected={typWirksam === 'datum'}
            disabled={!!nurTyp}
            title={nurTyp
              ? 'Hier sind nur Datumsspalten sinnvoll — die Auswahl ist festgelegt.'
              : undefined}
            onToggle={() => setTypFilter(t => (t === 'datum' ? null : 'datum'))}
          />
          <ToggleChip
            label="Wert" groesse="dicht"
            selected={typWirksam === 'wert'}
            disabled={!!nurTyp}
            onToggle={() => setTypFilter(t => (t === 'wert' ? null : 'wert'))}
          />
          <ToggleChip
            label="nur kanonisch" groesse="dicht"
            selected={nurKanonisch}
            title="Felder, die über alle Programme hinweg denselben Namen tragen"
            onToggle={() => setNurKanonisch(v => !v)}
          />
        </div>

        <div className="mt-1.5 flex items-center gap-2 border-t border-b border-[var(--tf-border)] px-2 py-1">
          <Kopf spalte="feldId" aktiv={sortSpalte} richtung={richtung} onSort={sortiere}
            className="w-[130px] shrink-0">
            Kürzel
          </Kopf>
          <Kopf spalte="label" aktiv={sortSpalte} richtung={richtung} onSort={sortiere}
            className="min-w-0 flex-1">
            Beschreibung
          </Kopf>
          {kennzahl ? (
            <span className="w-[74px] shrink-0 text-right text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">
              {kennzahlTitel}
            </span>
          ) : zeigeDeckung && (
            <Kopf spalte="deckung" aktiv={sortSpalte} richtung={richtung} onSort={sortiere}
              className="w-[46px] shrink-0 justify-end">
              Progr.
            </Kopf>
          )}
        </div>

        <div ref={listeRef} className="max-h-[280px] overflow-y-auto py-0.5" role="listbox">
          {angeheftet.length > 0 && (
            <>
              <p className="flex items-center gap-1 px-2 pt-1 pb-0.5 text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">
                <Sparkles size={10} /> Vorschlag aus der Bezeichnung
              </p>
              {angeheftet.map(({ v, e }) => {
                const i = naechsterIndex();
                return (
                  <Zeile
                    key={`v-${e.feldId}`} eintrag={e} index={i}
                    aktiv={i === cursor} gewaehlt={e.feldId === wert}
                    zeigeDeckung={zeigeDeckung} zusatz={v.grund}
                    kennzahlText={kennzahl ? (kennzahl(e.feldId) ?? '') : undefined}
                    onWaehle={() => waehle(e.feldId)}
                  />
                );
              })}
              <div className="my-1 border-t border-[var(--tf-border)]" />
            </>
          )}

          {leerOption !== undefined && (() => {
            const i = naechsterIndex();
            return (
              <button
                type="button" role="option" aria-selected={wert === ''} data-index={i}
                onClick={() => waehle('')}
                onMouseEnter={() => setCursor(i)}
                className={cn(ZEILE, 'text-[var(--tf-text-secondary)]',
                  i === cursor && 'bg-[var(--tf-bg-secondary)]')}
              >
                {leerOption}
              </button>
            );
          })()}

          {gefiltert.map(e => {
            const i = naechsterIndex();
            return (
              <Zeile
                key={e.feldId} eintrag={e} index={i}
                aktiv={i === cursor} gewaehlt={e.feldId === wert}
                zeigeDeckung={zeigeDeckung}
                kennzahlText={kennzahl ? (kennzahl(e.feldId) ?? '') : undefined}
                onWaehle={() => waehle(e.feldId)}
              />
            );
          })}

          {gefiltert.length === 0 && angeheftet.length === 0 && (
            <p className="px-2 py-3 text-[12px] text-[var(--tf-text-tertiary)]">
              Keine Spalte passt zu „{suche}". Der Vorrat kommt aus den gemappten
              Programm-Schemas — fehlt eine Spalte, ist sie dort nicht gemappt.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  function sortiere(s: Spalte): void {
    if (sortSpalte === s) {
      // Dritter Klick führt zurück in die Katalog-Reihenfolge — sonst gäbe es
      // keinen Weg zurück zu der Ordnung, in der die verlässlichen Felder oben
      // stehen.
      if (richtung === 'ab') { setSortSpalte(KATALOG); setRichtung('auf'); return; }
      setRichtung('ab');
      return;
    }
    setSortSpalte(s);
    setRichtung('auf');
  }
}

function Zeile({ eintrag, index, aktiv, gewaehlt, zeigeDeckung, zusatz, kennzahlText, onWaehle }: {
  eintrag: SpaltenEintrag;
  index: number;
  aktiv: boolean;
  gewaehlt: boolean;
  zeigeDeckung: boolean;
  zusatz?: string;
  /** Gesetzt: diese Kennzahl statt der Programm-Deckung. */
  kennzahlText?: string;
  onWaehle: () => void;
}): React.ReactElement {
  const quelle = herkunft(eintrag);
  return (
    <button
      type="button" role="option" aria-selected={gewaehlt} data-index={index}
      onClick={onWaehle}
      title={zusatz ?? (quelle ? `entsteht aus ${quelle}` : undefined)}
      className={cn(ZEILE, aktiv && 'bg-[var(--tf-bg-secondary)]')}
    >
      <span className={cn(
        'w-[130px] shrink-0 truncate font-mono text-[11px]',
        gewaehlt ? 'text-[var(--tf-primary)]' : 'text-[var(--tf-text)]',
      )}>
        {eintrag.feldId}
      </span>
      <span className="min-w-0 flex-1 truncate text-[var(--tf-text-secondary)]">
        {eintrag.label === eintrag.feldId ? '—' : einzeiligesLabel(eintrag.label)}
        {zusatz && (
          <span className="ml-1 text-[11px] text-[var(--tf-text-tertiary)]">· {zusatz}</span>
        )}
        {!zusatz && quelle && (
          <span className="ml-1 font-mono text-[10.5px] text-[var(--tf-text-tertiary)]">
            ← {quelle}
          </span>
        )}
      </span>
      {kennzahlText !== undefined ? (
        <span className="w-[74px] shrink-0 text-right text-[11px] tabular-nums text-[var(--tf-text-secondary)]">
          {kennzahlText}
        </span>
      ) : zeigeDeckung && (
        <span className="w-[46px] shrink-0 text-right text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
          {deckungVon(eintrag)}×
        </span>
      )}
    </button>
  );
}

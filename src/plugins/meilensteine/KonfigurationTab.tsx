/**
 * Konfigurations-Tab: der Meilenstein-Baum der PL. Struktur (wie viele
 * Meilensteine, welche Soll-Woche) und Zuordnung (welche CSV-Spalte erfüllt ihn)
 * an einer Stelle, ohne Code-Änderung.
 *
 * Seit dem Tree-Umbau auf der gemeinsamen `TfTree`-Basis: das Chevron klappt
 * die **Unter-Meilensteine** auf (wie überall in der App), und der
 * Bedingungs-Editor hängt am **ausgewählten** Knoten darunter. Vorher tat das
 * Dreieck beides nicht — es öffnete den Editor, und Unter-Meilensteine waren
 * immer sichtbar.
 *
 * **Umsortiert wird durch Ziehen.** Die Hoch/Runter/Ausrücken-Schalter bleiben
 * als Zweitweg: sie waren bisher der einzige, stehen in jeder Einweisung und
 * funktionieren ohne Maus.
 *
 * Der Regel-Bereich hängt an einem EIGENEN Satz offener Zeilen, nicht an der
 * Auswahl: zwei Meilensteine sollen ihre Bedingungen nebeneinander zeigen
 * können. Vorher schloss jedes Aufklappen das vorige.
 *
 * Unbestätigte Zuordnungen aus dem Auslieferungs-Plan tragen einen sichtbaren
 * Hinweis — wer eine geratene Zahl für bare Münze nimmt, plant falsch.
 */
import { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronUp, GripVertical, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { FeldWaehler, type FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { TfTree } from '@/components/tree';
import { ContextMenuItem, ContextMenuLabel, ContextMenuSeparator } from '@/components/ui/context-menu';
import {
  ANKER_SPALTEN, aendereKnoten, darfUmhaengen, entferneKnoten, fuegeKnotenHinzu, haengeKnotenUm,
  IST_AUS_BEDINGUNG, hebeKnotenAn, knotenOhneBedingung, knotenQuellen, planEndeTage, schlageBedingungVor,
  schlageFelderVor, verschiebeKnoten,
  type MeilensteinKnoten, type SpaltenEintrag,
} from '@/core/meilensteine';
import { bedingungIstLeer, bedingungSatz } from '@/core/status';
import { feldQuellen } from '@/core/status/bedingung-quellen';
import { berechneAutoHoehe } from '@/core/utils/autoGrowHoehe';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import { BedingungEditor } from './BedingungEditor';
import { GruppenProbe, MeilensteinProbe } from './ProbeAnzeige';
import type { MeilensteinProbeApi } from './useMeilensteinProbe';
import { ANKER_ERKLAERUNG, TYP_LABEL, feldStil, spaltenLabel } from './labels';
import {
  MEILENSTEIN_BAUM_ROOT, baueMeilensteinBaum, type MeilensteinBaumKnoten,
} from './meilensteinBaum';

interface Props {
  knoten: MeilensteinKnoten[];
  gesamtfristTage: number;
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onGesamtfrist: (tage: number) => void;
  /** Probe am Bestand — ohne sie zeigt der Reiter keine Zahlen. */
  probe?: MeilensteinProbeApi;
}

/**
 * Was der zugeklappte Meilenstein über sich verrät.
 *
 * Der Plan hat zehn Zeilen; ohne diese Zusammenfassung musste man jede einzeln
 * aufklappen, um zu sehen, WORAN sie hängt — und das Bezeichnungsfeld spannte
 * dabei die volle Breite, ohne etwas zu sagen.
 *
 * Reihenfolge nach Aussagekraft: die Bedingung zuerst, dann die Einschränkung
 * auf Antragstypen, dann die Herkunft des Ist-Termins, zuletzt die Zahl der
 * Unter-Meilensteine. **Was fehlt, fällt weg** — ein „—" je Feld wäre in zehn
 * Zeilen nur Rauschen. Die Gilt-für-Marke erscheint nur, wenn der Meilenstein
 * eben NICHT für alle gilt; sonst stünde sie an jeder Zeile und unterschiede
 * keine.
 */
function KnotenZusammenfassung({ knoten, alle, spalten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
}): React.ReactElement | null {
  const labelVon = useMemo(() => spaltenLabel(spalten), [spalten]);
  const kinder = alle.filter(k => k.elternId === knoten.id).length;

  const teile: string[] = [];
  // Die leere Bedingung sagt nichts (v4.134) — dafür trägt die Zeile bereits
  // die Marke „ohne Bedingung"; hier wäre „()" nur verwirrend.
  if (!bedingungIstLeer(knoten.bedingung)) {
    teile.push(bedingungSatz(knoten.bedingung, labelVon));
  }
  if (knoten.nurTypen.length > 0) teile.push(`nur ${knoten.nurTypen.map(t => TYP_LABEL[t]).join('·')}`);
  const istFeld = knoten.istDatumFeld;
  if (istFeld) teile.push(`Ist: ${labelVon(istFeld)}`);
  if (kinder > 0) teile.push(`${kinder} Unter-${kinder === 1 ? 'Meilenstein' : 'Meilensteine'}`);

  if (teile.length === 0) return null;
  const voll = teile.join(' · ');
  // Der Tooltip nennt die Quellspalten der Bedingung und des Ist-Termins —
  // „TIB gefüllt" sagt nicht, welche CSV-Spalte dahinter steht, und genau dort
  // entstehen die falschen Regeln. Die Feldnamen wie im Satz daneben (`labelVon`).
  return (
    <QuellSpaltenTooltip
      erklaere={idx => knotenQuellen(knoten, idx, labelVon)}
      wrapperClassName="min-w-0 flex-1 truncate"
    >
      <span className="block truncate cursor-help text-[11.5px] text-[var(--tf-text-secondary)]">
        {voll}
      </span>
    </QuellSpaltenTooltip>
  );
}

/**
 * Zwei Zeilen sind der Deckel; darüber scrollt das Feld statt die Liste zu
 * zerreißen. 22 px je Zeile bei `leading-[18px]` plus 2×2 px Polsterung.
 */
const BEZEICHNUNG_GRUND_HOEHE = 22;
const BEZEICHNUNG_MAX_HOEHE = 44;

function messeElement(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${berechneAutoHoehe(
    el.scrollHeight, BEZEICHNUNG_GRUND_HOEHE, undefined, BEZEICHNUNG_MAX_HOEHE,
  )}px`;
}

/** Kopfzeile eines Knotens: Nummer, Bezeichnung, Soll-Woche, Zustandsschalter. */
function KnotenKopf({ knoten, alle, spalten, schreibgeschuetzt, frisch, zusammenfassen, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  /** Gerade angelegt — der Cursor steht dann gleich in der Bezeichnung. */
  frisch: boolean;
  /** Der Regel-Bereich ist zu — dann sagt die Zeile selbst, was drinsteht. */
  zusammenfassen: boolean;
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));
  // Ein Knoten, der weder eine eigene Bedingung noch Kinder hat, kann NIE
  // erfüllt werden. Bis v4.134 galt er ab seiner Soll-Woche für immer als
  // gerissen; jetzt wird er nicht mehr bewertet — und genau deshalb muss die
  // Zeile es sagen, sonst bleibt die Lücke für immer stehen.
  const ohneBedingung = useMemo(
    () => knotenOhneBedingung(alle).some(k => k.id === knoten.id),
    [alle, knoten.id],
  );

  /**
   * Das Bezeichnungsfeld ist ein `textarea`, damit ein langer Titel umbricht
   * statt abgeschnitten zu werden — es hat seit v5.2 nur noch einen Teil der
   * Zeilenbreite, der Rest gehört der Zusammenfassung.
   *
   * Höhe per Callback-Ref, nicht per Mount-Effekt (Bug-Klasse 23): das Feld
   * steht hinter bedingtem Rendern, und ein `[]`-Effekt liefe beim Wieder-
   * Einhängen nie wieder. Zwei Zeilen sind der Deckel — darüber hinaus scrollt
   * das Feld, sonst zerrisse eine einzelne Zeile die Liste.
   */
  const messe = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    messeElement(el);
    if (frisch) { el.focus(); el.select(); }
  }, [frisch]);

  return (
    // Die Eingabefelder dürfen den Zeilen-Klick nicht auslösen — der klappt
    // die Unter-Meilensteine auf.
    <span
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      <span className="text-[12px] font-mono text-[var(--tf-text-tertiary)] w-[46px] shrink-0">
        {knoten.nummer || '—'}
      </span>

      <textarea
        ref={messe}
        rows={1}
        value={knoten.label}
        onChange={e => { messeElement(e.currentTarget); patch({ label: e.target.value }); }}
        disabled={schreibgeschuetzt}
        aria-label="Bezeichnung"
        title={knoten.label}
        className="basis-[42%] min-w-[160px] max-w-[520px] resize-none overflow-y-auto text-[13px] leading-[18px] rounded px-2 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] disabled:opacity-60"
        style={feldStil}
      />

      {zusammenfassen && (
        <KnotenZusammenfassung knoten={knoten} alle={alle} spalten={spalten} />
      )}

      <label className="flex shrink-0 items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
        Woche
        <input
          type="number" min={0}
          value={knoten.sollWoche}
          onChange={e => patch({ sollWoche: Math.max(0, Number(e.target.value) || 0) })}
          disabled={schreibgeschuetzt}
          className="w-[56px] text-[12px] rounded px-1.5 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
          style={feldStil}
        />
      </label>

      <ToggleChip
        label="aktiv" groesse="dicht"
        selected={knoten.aktiv}
        onToggle={() => patch({ aktiv: !knoten.aktiv })}
        disabled={schreibgeschuetzt}
        title="Inaktive Meilensteine werden nie als gerissen gezählt"
      />
      <ToggleChip
        label="Frist" groesse="dicht"
        selected={knoten.relevantFuerFrist}
        onToggle={() => patch({ relevantFuerFrist: !knoten.relevantFuerFrist })}
        disabled={schreibgeschuetzt}
        title="Zählt in die Prognose zur Gesamtfrist"
      />

      {knoten.unbestaetigt && (
        <span title="Vorbelegung aus dem Auslieferungs-Plan — bitte prüfen">
          <Badge variant="warning">unbestätigt</Badge>
        </span>
      )}

      {ohneBedingung && (
        <span title="Weder eine eigene Bedingung noch Unter-Meilensteine — dieser Meilenstein wird nicht bewertet. Bedingung ergänzen oder ihm Unter-Meilensteine geben.">
          <Badge variant="warning">ohne Bedingung</Badge>
        </span>
      )}
    </span>
  );
}

/** Hoch/Runter/Ausrücken/Anlegen/Löschen — rechtsbündig. */
function KnotenAktionen({ knoten, alle, onKnoten, onErgaenzen }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onErgaenzen: (elternId: string | null) => void;
}): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0.5" onClick={e => e.stopPropagation()}>
      <button
        type="button" aria-label="Nach oben" title="Nach oben"
        onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'hoch'))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button" aria-label="Nach unten" title="Nach unten"
        onClick={() => onKnoten(verschiebeKnoten(alle, knoten.id, 'runter'))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <ChevronDown size={13} />
      </button>
      {/* Der Rückweg aus der Unterordnung — ohne ihn hilft nur die Maus. */}
      {knoten.elternId !== null && (
        <button
          type="button" aria-label="Eine Ebene höher"
          title="Eine Ebene höher — dann kein Unter-Meilenstein mehr"
          onClick={() => onKnoten(hebeKnotenAn(alle, knoten.id))}
          className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
        >
          <ChevronLeft size={13} />
        </button>
      )}
      <button
        type="button" aria-label="Unter-Meilenstein anlegen" title="Unter-Meilenstein anlegen"
        onClick={() => onErgaenzen(knoten.id)}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <Plus size={13} />
      </button>
      <button
        type="button" aria-label="Meilenstein löschen" title="Meilenstein und Unter-Meilensteine löschen"
        onClick={() => onKnoten(entferneKnoten(alle, knoten.id))}
        className="p-1 rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}

/**
 * Die linke Beschriftungsspalte des Regel-Bereichs. Feste Breite, damit „Gilt
 * für", „Erfüllt, wenn" und „Ist-Termin" auf EINER Kante stehen — vorher hatte
 * jede Zeile ihren eigenen Einzug, und der Bereich las sich als drei Fragmente.
 */
function Beschriftung({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="w-[84px] shrink-0 pt-[3px] text-[11.5px] text-[var(--tf-text-tertiary)]">
      {children}
    </span>
  );
}

/** Detail-Bereich unter dem ausgewählten Knoten. */
function KnotenKoerper({ knoten, alle, spalten, schreibgeschuetzt, probe, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  probe?: MeilensteinProbeApi;
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));
  const ohneBedingung = useMemo(
    () => knotenOhneBedingung(alle).some(k => k.id === knoten.id),
    [alle, knoten.id],
  );

  // Bezeichnung UND Beschreibung speisen den Vorschlag — das entscheidende Wort
  // steht oft erst in der Beschreibung („Bearbeiter mit passender Expertise …").
  const anhalt = `${knoten.label} ${knoten.beschreibung ?? ''}`;
  const vorschlaege: FeldWaehlerVorschlag[] = useMemo(
    () => schlageFelderVor(anhalt, spalten).map(v => ({ feldId: v.feldId, grund: v.grund })),
    [anhalt, spalten],
  );
  // Ein Meilenstein ohne auswertbare Bedingung wird gar nicht bewertet (v4.134)
  // und trägt oben die Marke „ohne Bedingung". Sie bekommt hier ihren Ausgang:
  // ein Klick statt einer Suche durch den ganzen Spaltenvorrat.
  const startVorschlag = useMemo(
    () => (bedingungIstLeer(knoten.bedingung) ? schlageBedingungVor(anhalt, spalten) : null),
    [knoten.bedingung, anhalt, spalten],
  );
  const labelVon = useMemo(() => spaltenLabel(spalten), [spalten]);

  return (
    <div className="rounded" style={feldStil}>
        <div className="border-[var(--tf-border)] px-3 py-1.5 flex flex-col gap-1">
          <input
            value={knoten.beschreibung ?? ''}
            onChange={e => patch({ beschreibung: e.target.value })}
            disabled={schreibgeschuetzt}
            placeholder="Beschreibung (optional)"
            aria-label="Beschreibung"
            className="text-[12px] rounded px-2 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] disabled:opacity-60"
            style={feldStil}
          />

          <div className="flex items-center gap-1 flex-wrap">
            <Beschriftung>Gilt für</Beschriftung>
            {ANTRAGSTYP_BUCKETS.map(t => {
              const gewaehlt = knoten.nurTypen.length === 0 || knoten.nurTypen.includes(t);
              const letzter = gewaehlt && knoten.nurTypen.length === 1;
              return (
                <ToggleChip
                  key={t}
                  label={TYP_LABEL[t]}
                  groesse="dicht"
                  selected={gewaehlt}
                  disabled={schreibgeschuetzt || letzter}
                  title={letzter
                    ? 'Mindestens ein Antragstyp muss ausgewählt bleiben — ohne Auswahl gälte der Meilenstein wieder für alle.'
                    : undefined}
                  onToggle={() => {
                    const aktuell = knoten.nurTypen.length === 0 ? [...ANTRAGSTYP_BUCKETS] : knoten.nurTypen;
                    const naechste = aktuell.includes(t) ? aktuell.filter(x => x !== t) : [...aktuell, t];
                    // Leere Liste heißt „gilt für alle" — die Abwahl des LETZTEN
                    // Typs schaltete damit alle vier wieder ein, und der
                    // Meilenstein galt danach auch für DL und NW. Also: nicht
                    // wählbar (der Schalter ist oben schon gesperrt), hier nur
                    // die zweite Sicherung.
                    if (naechste.length === 0) return;
                    // Alle ausgewählt ⇒ wieder „gilt für alle" (leere Liste).
                    patch({ nurTypen: naechste.length === ANTRAGSTYP_BUCKETS.length ? [] : naechste });
                  }}
                />
              );
            })}
          </div>

          {/* Beschriftung NEBEN dem Regelwerk, wie „Gilt für" darüber — eine
              eigene Zeile dafür kostet Höhe, die bei zwei offenen Meilensteinen
              fehlt. */}
          <div className="flex items-start gap-1">
            <Beschriftung>Erfüllt, wenn</Beschriftung>
            {schreibgeschuetzt ? (
              <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                Nur Lesezugriff — die Bedingung kann hier nicht geändert werden.
              </p>
            ) : (
              <div className="min-w-0 flex-1">
                {startVorschlag && 'feldId' in startVorschlag && (
                  <p className="flex items-center gap-1.5 pb-1 text-[11.5px] text-[var(--tf-text-secondary)]">
                    <Sparkles size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" />
                    Vorschlag aus der Bezeichnung:
                    <span className="text-[var(--tf-text)]">
                      {bedingungSatz(startVorschlag, labelVon)}
                    </span>
                    <Button
                      variant="ghost" size="xs"
                      onClick={() => patch({ bedingung: startVorschlag })}
                    >
                      Übernehmen
                    </Button>
                  </p>
                )}
                <BedingungEditor
                  bedingung={knoten.bedingung}
                  spalten={spalten}
                  vorschlaege={vorschlaege}
                  // Die Gruppe zählt mit dem Nenner DIESES Meilensteins
                  // (`nurTypen`) — sonst stünde im Kopf eine Zahl über Verbünde,
                  // für die er gar nicht gilt.
                  probe={probe?.bereit
                    ? g => <GruppenProbe zahlen={probe.zaehle(g, knoten.nurTypen)} grundmenge={probe.grundmenge} />
                    : undefined}
                  onChange={b => patch({ bedingung: b })}
                />
                {probe && (
                  <MeilensteinProbe probe={probe} knotenId={knoten.id} ohneBedingung={ohneBedingung} />
                )}
              </div>
            )}
          </div>

          <div className="flex items-start gap-1">
            <Beschriftung>Ist-Termin</Beschriftung>
            <FeldWaehler
              spalten={spalten}
              wert={knoten.istDatumFeld ?? ''}
              onWaehle={feldId => patch({ istDatumFeld: feldId || undefined })}
              nurTyp="datum"
              leerOption="— aus der Bedingung —"
              ariaLabel="Ist-Termin aus Feld"
              disabled={schreibgeschuetzt}
              className="max-w-[280px]"
            />
            {!knoten.istDatumFeld && (
              <span className="ml-2 min-w-0 pt-[3px] text-[11.5px] text-[var(--tf-text-secondary)]">
                {IST_AUS_BEDINGUNG}
              </span>
            )}
          </div>
        </div>
    </div>
  );
}

function Menue({ knoten, alle, onKnoten, onErgaenzen }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onErgaenzen: (elternId: string | null) => void;
}): React.ReactElement {
  return (
    <>
      <ContextMenuLabel>{knoten.nummer || '—'} · Woche {knoten.sollWoche}</ContextMenuLabel>
      <ContextMenuItem onSelect={() => onErgaenzen(knoten.id)}>
        Unter-Meilenstein anlegen
      </ContextMenuItem>
      {knoten.elternId !== null && (
        <ContextMenuItem onSelect={() => onKnoten(hebeKnotenAn(alle, knoten.id))}>
          Eine Ebene höher
        </ContextMenuItem>
      )}
      <ContextMenuItem onSelect={() => onKnoten(aendereKnoten(alle, knoten.id, { aktiv: !knoten.aktiv }))}>
        {knoten.aktiv ? 'Stilllegen' : 'Wieder aktivieren'}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="danger" onSelect={() => onKnoten(entferneKnoten(alle, knoten.id))}>
        Meilenstein und Unter-Meilensteine löschen
      </ContextMenuItem>
    </>
  );
}

/**
 * Bedienelemente der Zeile: ein Klick darauf meint das Element, nicht den
 * Regel-Bereich. Der Zeilen-Klick läuft in der Capture-Phase und sieht deshalb
 * auch die Klicks, die das Element selbst später stoppt.
 *
 * `[role="menu"]`: das ⋯-Menü des Bedingungs-Editors liegt im Portal, React
 * reicht seine Klicks aber durch den Komponenten-Baum bis hierher — und seine
 * Einträge sind `div`s, keine Buttons. Ohne diesen Eintrag klappte „Nach oben"
 * den ganzen Regel-Bereich zu.
 */
const BEDIENELEMENTE = 'input, select, textarea, button, label, [draggable="true"], [role="menu"]';

export function KonfigurationTab({
  knoten, gesamtfristTage, spalten, schreibgeschuetzt, onKnoten, onGesamtfrist, probe,
}: Props): React.ReactElement {
  const [offen, setOffen] = useState<string[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  // Aufgeklappte Regel-Bereiche — bewusst NEBEN der Auswahl, damit zwei
  // Meilensteine gleichzeitig offen stehen können.
  const [koerperOffen, setKoerperOffen] = useState<string[]>([]);
  const [frischeId, setFrischeId] = useState<string | null>(null);
  const { items, rootId } = useMemo(() => baueMeilensteinBaum(knoten), [knoten]);
  const unbestaetigt = knoten.filter(k => k.unbestaetigt).length;
  const planEnde = useMemo(() => planEndeTage(knoten), [knoten]);

  const schalteKoerper = (id: string): void => {
    // Das erste Aufklappen eines Regel-Bereichs lädt die Probe — ein Ereignis,
    // kein Mount-Effekt: wer nur die Liste ansieht, lädt nichts.
    if (!koerperOffen.includes(id)) probe?.starte();
    setKoerperOffen(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]));
  };

  /**
   * Anlegen MIT sichtbarem Ergebnis: der neue Knoten steht unter einer
   * zugeklappten Zeile und war bis v4.4 unsichtbar — der Klick schien wirkungslos
   * und der Meilenstein tauchte erst nach dem nächsten Laden auf. Also: Eltern
   * aufklappen, Regeln zeigen, Cursor in die Bezeichnung.
   */
  const ergaenze = (elternId: string | null): void => {
    const naechste = fuegeKnotenHinzu(knoten, elternId);
    const neu = naechste.find(k => !knoten.some(a => a.id === k.id));
    onKnoten(naechste);
    if (!neu) return;
    if (elternId !== null) setOffen(o => (o.includes(elternId) ? o : [...o, elternId]));
    setKoerperOffen(o => (o.includes(neu.id) ? o : [...o, neu.id]));
    setFrischeId(neu.id);
    probe?.starte();
  };

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
          {/* Die Quellspalten des Ankers — dieselben Codes, die die Rechnung liest. */}
          <QuellSpaltenTooltip
            erklaere={idx => feldQuellen(
              [ANKER_SPALTEN.antragseingang, ANKER_SPALTEN.alleAntraegeDa], idx, ANKER_ERKLAERUNG,
            )}
          >
            <span className="cursor-help">Gesamtfrist ab wirksamem Eingang</span>
          </QuellSpaltenTooltip>
          <input
            type="number" min={1}
            value={gesamtfristTage}
            onChange={e => onGesamtfrist(Math.max(1, Number(e.target.value) || 1))}
            disabled={schreibgeschuetzt}
            className="w-[72px] text-[12.5px] rounded px-2 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] text-right disabled:opacity-60"
            style={feldStil}
          />
          Tage
        </label>
        {!schreibgeschuetzt && (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => ergaenze(null)}>
            Meilenstein
          </Button>
        )}
        {unbestaetigt > 0 && (
          <span className="text-[12px] text-[var(--tf-warning-text)]">
            {unbestaetigt} {unbestaetigt === 1 ? 'Zuordnung wartet' : 'Zuordnungen warten'} auf Bestätigung
          </span>
        )}
      </div>

      {/* Soll-Wochen und Gesamtfrist standen bis v4.118 kommentarlos
          nebeneinander — obwohl der ausgelieferte Plan mit seiner spätesten
          fristrelevanten Woche längst hinter der eigenen Gesamtfrist lag und
          damit JEDEN Verbund auf „Frist nicht haltbar" stellte. */}
      {planEnde > gesamtfristTage && (
        <p className="text-[12px] text-[var(--tf-warning-text)]">
          Der letzte fristrelevante Meilenstein liegt bei Woche {planEnde / 7} ({planEnde} Tage) und
          damit hinter der Gesamtfrist von {gesamtfristTage} Tagen. Solange das so bleibt, gilt jeder
          Verbund als „Frist nicht haltbar" — unabhängig davon, wie er läuft.
        </p>
      )}

      {knoten.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Noch kein Meilenstein angelegt.
        </p>
      ) : (
        <TfTree<MeilensteinBaumKnoten>
          items={items}
          rootId={rootId}
          label="Meilenstein-Plan"
          features={{
            selection: true,
            dnd: !schreibgeschuetzt,
            reorder: !schreibgeschuetzt,
            dragHandle: true,
          }}
          expandedItems={offen}
          onExpandedChange={setOffen}
          selectedItems={gewaehlt}
          onSelectedChange={setGewaehlt}
          onZeilenKlick={(id, _daten, e) => {
            const ziel = e.target as Element | null;
            if (ziel?.closest?.(BEDIENELEMENTE)) return;
            schalteKoerper(id);
          }}
          canDrag={ids => ids.every(i => i !== MEILENSTEIN_BAUM_ROOT)}
          canDrop={(quellen, ziel) => quellen.every(q =>
            darfUmhaengen(knoten, q, ziel === MEILENSTEIN_BAUM_ROOT ? null : ziel))}
          onDrop={(quellen, ziel, index) => {
            const elternId = ziel === MEILENSTEIN_BAUM_ROOT ? null : ziel;
            // Reihum anwenden: jeder Zug rechnet auf dem Ergebnis des
            // vorigen, sonst kollidierten die neu vergebenen Sortierungen.
            let naechste = knoten;
            quellen.forEach((q, i) => {
              naechste = haengeKnotenUm(naechste, q, elternId, index === undefined ? undefined : index + i);
            });
            onKnoten(naechste);
          }}
          slots={{
            leading: p => (p.dragHandleProps && !schreibgeschuetzt ? (
              <span
                {...p.dragHandleProps}
                className="shrink-0 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing"
                title="Ziehen, um umzusortieren oder unterzuordnen"
              >
                <GripVertical size={13} />
              </span>
            ) : null),
            label: p => (p.data.art === 'meilenstein' ? (
              <KnotenKopf
                knoten={p.data.knoten}
                alle={knoten}
                spalten={spalten}
                schreibgeschuetzt={schreibgeschuetzt}
                frisch={p.id === frischeId}
                zusammenfassen={!koerperOffen.includes(p.id)}
                onKnoten={onKnoten}
              />
            ) : null),
            trailing: p => (p.data.art === 'meilenstein' && !schreibgeschuetzt
              ? (
                <KnotenAktionen
                  knoten={p.data.knoten} alle={knoten}
                  onKnoten={onKnoten} onErgaenzen={ergaenze}
                />
              )
              : null),
            // Der Bedingungs-Editor hängt am eigenen Satz offener Zeilen — das
            // Chevron bleibt beim Auf-/Zuklappen der Unter-Meilensteine.
            body: p => (koerperOffen.includes(p.id) && p.data.art === 'meilenstein' ? (
              <KnotenKoerper
                knoten={p.data.knoten}
                alle={knoten}
                spalten={spalten}
                schreibgeschuetzt={schreibgeschuetzt}
                probe={probe}
                onKnoten={onKnoten}
              />
            ) : null),
            // Bei mehreren offenen Bereichen sagt die Kante, welcher Block zu
            // welcher Zeile gehört. `boxShadow` statt Hintergrund, damit der
            // Hover-Zustand der Zeile erhalten bleibt — beim Ziehen tritt sie
            // zurück, sonst verdeckte der Inline-Stil den Drop-Rahmen (auch er
            // ein `box-shadow`).
            zeilenStil: p => (koerperOffen.includes(p.id) && !p.isDropZiel
              ? { boxShadow: 'inset 2px 0 0 var(--tf-primary)' }
              : undefined),
            contextMenu: p => (p.data.art === 'meilenstein' && !schreibgeschuetzt ? (
              <Menue
                knoten={p.data.knoten} alle={knoten}
                onKnoten={onKnoten} onErgaenzen={ergaenze}
              />
            ) : null),
          }}
        />
      )}
    </div>
  );
}

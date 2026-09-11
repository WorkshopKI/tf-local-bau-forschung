/**
 * Die zugeklappte Zeile des Meilenstein-Plans als **Tabellenzeile** und ihr
 * Spaltenkopf (v6.62, aus dem Entwurf von Claude Design übernommen).
 *
 * Vorher stand jede Angabe mit eigener Beschriftung in der Zeile („Woche",
 * „gilt für"), die Bezeichnung in einem gerahmten Feld, fünf Symbole am Ende —
 * und bei 1 360 px brach der rechte Block in JEDER Zeile in eine zweite um, die
 * Regel selbst wurde abgeschnitten („(PreCheck positiv – Verbund gefüllt ODER …)
 * UN…"). Jetzt tragen Spaltenköpfe die Beschriftung einmal, die Felder zeigen
 * ihren Rahmen erst beim Überfahren, und die Regel hat die breite Spalte.
 *
 * **Bündig über alle Ebenen.** Der Baum rückt Unter-Meilensteine per Padding
 * ein; die Titelspalte wird deshalb um genau diesen Einzug schmaler
 * (`titelBreite`), sonst stünde „Erfüllt, wenn" je Ebene versetzt. Ihre Breite
 * wächst mit dem Container (`cqw`), nicht mit dem Fenster — der Wrapper in
 * `KonfigurationTab` ist der Container.
 *
 * Bewusst NICHT übernommen (Befund 11.09.2026): „nur bei positiver
 * Ersteinschätzung" als Eigenschaft — das ist Titeltext, die Bewertung kennt
 * nur aktiv + Antragstyp; der Befund-Punkt an der Woche — er meldet die Regel,
 * nicht die Woche.
 */
import { Fragment, useCallback, useMemo } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronLeft, ChevronUp, GripVertical, Pause, Play, Plus, RotateCcw, Trash2,
  TriangleAlert,
} from 'lucide-react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import {
  aendereKnoten, entferneKnoten, hebeKnotenAn, knotenOhneBedingung, knotenQuellen, verschiebeKnoten,
  type MeilensteinKnoten, type SpaltenEintrag,
} from '@/core/meilensteine';
import { bedingungIstLeer, bedingungUebersicht, type SatzTeil } from '@/core/status';
import { berechneAutoHoehe } from '@/core/utils/autoGrowHoehe';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import type { AktionsEintrag } from './ZeilenAktionen';
import { TYP_LABEL, spaltenLabel } from './labels';

/** Einzug je Ebene — derselbe Wert geht an den Baum, die Titelspalte zieht ihn ab. */
export const EINZUG = 18;

/**
 * Feste Spaltenbreiten — Kopf und Zeile lesen dieselben, sonst stünden sie
 * versetzt. Gemessen (11.09.2026, dev:local): „✓ aktiv" + „✓ Frist" 121 px,
 * „● unbestätigt" 78 px, vier Typen à 30 px. „Erfüllt, wenn" hält mindestens
 * 220 px — darunter scrollt die Tabelle (`KonfigurationTab`), statt die Regel
 * auf eine Handbreit zu quetschen.
 */
const SP = {
  nummer: 'w-[30px]',
  erfuellt: 'min-w-[220px]',
  zuordnung: 'w-[84px]',
  woche: 'w-[48px]',
  zustand: 'w-[124px]',
  giltFuer: 'w-[128px]',
  /** Griff links, ⋯ rechts — nur, wo bearbeitet werden darf. */
  griff: 'w-[13px]',
  aktionen: 'w-[22px]',
} as const;

function titelBreite(level: number): string {
  return `calc(clamp(200px, 28cqw, 420px) - ${level * EINZUG}px)`;
}

const KOPF = 'text-[10px] font-medium uppercase tracking-wider text-[var(--tf-text-secondary)]';

/**
 * Der Spaltenkopf über dem Baum. Er baut das Gerüst der Zeile nach (Griff,
 * Chevron, Zellen, ⋯) mit Platzhaltern gleicher Breite — ein Kopf mit eigenen
 * Maßen liefe beim ersten geänderten Abstand still auseinander.
 */
export function SpaltenKopf({ mitAktionen }: { mitAktionen: boolean }): React.ReactElement {
  return (
    <div
      className="flex items-center gap-1.5 border-b-[0.5px] border-[var(--tf-border)] pb-1.5"
      style={{ paddingLeft: 6, paddingRight: 6 }}
    >
      {mitAktionen && <span aria-hidden className={`${SP.griff} shrink-0`} />}
      {/* Breite des Chevrons in `TfTreeNode`. */}
      <span aria-hidden className="w-[14px] shrink-0" />
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className={`${SP.nummer} shrink-0`} />
        <span className={`shrink-0 px-2 ${KOPF}`} style={{ width: titelBreite(0) }}>Meilenstein</span>
        <span className={`${SP.erfuellt} flex-1 ${KOPF}`}>Erfüllt, wenn</span>
        <span className={`${SP.zuordnung} shrink-0 ${KOPF}`}>Zuordnung</span>
        <span className={`${SP.woche} shrink-0 pr-1.5 text-right ${KOPF}`}>Woche</span>
        <span className={`${SP.zustand} shrink-0 ${KOPF}`}>Zustand</span>
        <span className={`${SP.giltFuer} shrink-0 ${KOPF}`}>Gilt für</span>
      </span>
      {mitAktionen && <span aria-hidden className={`${SP.aktionen} shrink-0`} />}
    </div>
  );
}

/** Der Griff zum Ziehen — in fester Breite, damit der Kopf ihn nachbauen kann. */
export function Griff({ props, className }: {
  /** `dragHandleProps` des Baums. */
  props: Record<string, unknown>;
  className: string;
}): React.ReactElement {
  return (
    <span
      {...props}
      className={`${SP.griff} shrink-0 cursor-grab text-[var(--tf-text-tertiary)] active:cursor-grabbing ${className}`}
      title="Ziehen, um umzusortieren oder unterzuordnen"
    >
      <GripVertical size={13} />
    </span>
  );
}

/** Die ⋯-Zelle in fester Breite. */
export function AktionsZelle({ children, className }: {
  children: React.ReactNode;
  className: string;
}): React.ReactElement {
  return <span className={`${SP.aktionen} flex shrink-0 justify-end ${className}`}>{children}</span>;
}

/**
 * Die Umbau-Schalter eines Meilensteins — EINE Liste für das ⋯-Menü und das
 * Kontextmenü. „Nach oben / unten" standen bis v6.60 als eigene Symbole in
 * jeder Zeile; sie bleiben der Weg ohne Maus (Tab auf ⋯, Enter, Pfeiltasten).
 * Am Rand bleiben sie sichtbar und nennen den Grund, statt zu verschwinden.
 */
export function meilensteinAktionen(
  knoten: MeilensteinKnoten,
  alle: MeilensteinKnoten[],
  onKnoten: (k: MeilensteinKnoten[]) => void,
  onErgaenzen: (elternId: string | null) => void,
): AktionsEintrag[] {
  const geschwister = alle
    .filter(k => k.elternId === knoten.elternId)
    .sort((a, b) => a.sortierung - b.sortierung);
  const pos = geschwister.findIndex(k => k.id === knoten.id);
  const unbestaetigt = knoten.unbestaetigt === true;
  return [
    {
      icon: ChevronUp, label: 'Nach oben',
      onSelect: () => onKnoten(verschiebeKnoten(alle, knoten.id, 'hoch')),
      aus: pos <= 0, grund: 'Steht schon an erster Stelle.',
    },
    {
      icon: ChevronDown, label: 'Nach unten',
      onSelect: () => onKnoten(verschiebeKnoten(alle, knoten.id, 'runter')),
      aus: pos === geschwister.length - 1, grund: 'Steht schon an letzter Stelle.',
    },
    {
      icon: ChevronLeft, label: 'Eine Ebene höher',
      onSelect: () => onKnoten(hebeKnotenAn(alle, knoten.id)),
      aus: knoten.elternId === null, grund: 'Ist schon ein Haupt-Meilenstein.',
    },
    {
      icon: Plus, label: 'Unter-Meilenstein anlegen', trennerDavor: true,
      onSelect: () => onErgaenzen(knoten.id),
    },
    {
      icon: unbestaetigt ? CheckCircle2 : RotateCcw,
      label: unbestaetigt ? 'Zuordnung bestätigen' : 'Wieder als unbestätigt markieren',
      onSelect: () => onKnoten(aendereKnoten(alle, knoten.id, { unbestaetigt: !unbestaetigt })),
    },
    {
      icon: knoten.aktiv ? Pause : Play,
      label: knoten.aktiv ? 'Stilllegen' : 'Wieder aktivieren',
      onSelect: () => onKnoten(aendereKnoten(alle, knoten.id, { aktiv: !knoten.aktiv })),
    },
    {
      icon: Trash2, label: 'Meilenstein und Unter-Meilensteine löschen', gefahr: true, trennerDavor: true,
      onSelect: () => onKnoten(entferneKnoten(alle, knoten.id)),
    },
  ];
}

/** Dieselben Einträge im Kontextmenü (Rechtsklick auf die Zeile). */
export function KontextEintraege({ eintraege }: { eintraege: readonly AktionsEintrag[] }): React.ReactElement {
  return (
    <>
      {eintraege.map((e, i) => (
        <Fragment key={e.label}>
          {e.trennerDavor && i > 0 && <ContextMenuSeparator />}
          <ContextMenuItem
            disabled={e.aus}
            variant={e.gefahr ? 'danger' : undefined}
            onSelect={e.onSelect}
            title={e.aus ? e.grund : undefined}
          >
            {e.label}
          </ContextMenuItem>
        </Fragment>
      ))}
    </>
  );
}

/**
 * Drei Zeilen sind der Deckel; darüber scrollt das Feld statt die Liste zu
 * zerreißen. 18 px je Zeile (`leading-[18px]`) plus 2×2 px Polsterung und der
 * Rand. Zwei Zeilen reichten in der schmaleren Titelspalte nicht: der längste
 * Titel des Plans (MST 4) braucht drei, und der Scrollbalken stand dann in
 * einem Feld, das wie Text aussehen soll.
 */
const BEZEICHNUNG_GRUND_HOEHE = 22;
const BEZEICHNUNG_MAX_HOEHE = 60;

function messeElement(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  // `scrollHeight` zählt den Rand nicht mit, die Höhe (border-box) schon — ohne
  // ihn lief jedes einzeilige Feld um 2 px über und zeigte einen Scrollbalken.
  const rand = el.offsetHeight - el.clientHeight;
  el.style.height = `${berechneAutoHoehe(
    el.scrollHeight + rand, BEZEICHNUNG_GRUND_HOEHE, undefined, BEZEICHNUNG_MAX_HOEHE,
  )}px`;
}

/** Ein Eingabefeld, das wie Text aussieht, bis man es überfährt oder bearbeitet. */
const LEISES_FELD = 'rounded border-[0.5px] border-transparent bg-transparent outline-none '
  + 'hover:border-[var(--tf-border)] focus:border-[var(--tf-border-hover)] focus:bg-[var(--tf-bg)] '
  + 'disabled:cursor-default disabled:hover:border-transparent';

/**
 * Die Zeile eines Meilensteins: Nummer · Bezeichnung · Erfüllt, wenn ·
 * Zuordnung · Woche · Zustand · gilt für. Die Regel steht auch bei offenem
 * Regelbereich da — sie ist die Zeile, der Bereich darunter ihr Detail.
 */
export function KnotenZeile({ knoten, alle, spalten, level, schreibgeschuetzt, frisch, befunde, onKnoten }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  /** Ebene im Baum (0 = Haupt-Meilenstein) — für die bündige Titelspalte. */
  level: number;
  schreibgeschuetzt: boolean;
  /** Gerade angelegt — der Cursor steht dann gleich in der Bezeichnung. */
  frisch: boolean;
  /** Befunde der Probe (trifft keinen/jeden, ohne Ist-Termin) — leer: kein Punkt. */
  befunde: readonly string[];
  onKnoten: (k: MeilensteinKnoten[]) => void;
}): React.ReactElement {
  const patch = (p: Partial<MeilensteinKnoten>): void => onKnoten(aendereKnoten(alle, knoten.id, p));
  const labelVon = useMemo(() => spaltenLabel(spalten), [spalten]);
  const kinder = alle.filter(k => k.elternId === knoten.id).length;
  // Ein aktiver Knoten ohne eigene Bedingung und ohne Kinder wird NIE erfüllt
  // (v4.134: nicht bewertet) — die Zeile muss es sagen, sonst bleibt die Lücke.
  const ohneBedingung = useMemo(
    () => knotenOhneBedingung(alle).some(k => k.id === knoten.id),
    [alle, knoten.id],
  );
  const still = !knoten.aktiv;

  // Höhe per Callback-Ref, nicht per Mount-Effekt (Bug-Klasse 23): das Feld
  // steht hinter bedingtem Rendern, ein `[]`-Effekt liefe beim Wieder-Einhängen
  // nie wieder.
  const messe = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    messeElement(el);
    if (frisch) { el.focus(); el.select(); }
  }, [frisch]);

  return (
    // Die Eingabefelder dürfen den Zeilen-Klick nicht auslösen — der klappt
    // den Regelbereich auf.
    <span
      className="flex min-w-0 flex-1 items-center gap-3"
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    >
      <span className={`${SP.nummer} shrink-0 font-mono text-[12px] text-[var(--tf-text-secondary)]`}>
        {knoten.nummer || '—'}
      </span>

      <span className="flex shrink-0 flex-col" style={{ width: titelBreite(level) }}>
        <textarea
          ref={messe}
          rows={1}
          value={knoten.label}
          onChange={e => { messeElement(e.currentTarget); patch({ label: e.target.value }); }}
          disabled={schreibgeschuetzt}
          aria-label="Bezeichnung"
          title={knoten.label}
          className={`w-full resize-none overflow-y-auto px-2 py-0.5 text-[13px] leading-[18px] ${LEISES_FELD}
            ${still ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}
        />
        {kinder > 0 && (
          <span className="px-2 text-[11px] text-[var(--tf-text-secondary)]">
            {kinder} {kinder === 1 ? 'Unter-Meilenstein' : 'Unter-Meilensteine'}
          </span>
        )}
      </span>

      <ErfuelltZelle
        knoten={knoten} labelVon={labelVon} kinder={kinder}
        ohneBedingung={ohneBedingung} befunde={befunde} still={still}
      />

      <ZuordnungZelle
        unbestaetigt={knoten.unbestaetigt === true}
        schreibgeschuetzt={schreibgeschuetzt}
        onUmschalten={() => patch({ unbestaetigt: knoten.unbestaetigt !== true })}
      />

      <span className={`${SP.woche} shrink-0`}>
        <input
          type="number" min={0}
          value={knoten.sollWoche}
          onChange={e => patch({ sollWoche: Math.max(0, Number(e.target.value) || 0) })}
          disabled={schreibgeschuetzt}
          aria-label="Soll-Woche"
          title="Soll-Termin: Ende dieser Woche nach dem wirksamen Eingang"
          className={`w-full px-1.5 py-0.5 text-right text-[13px] tabular-nums text-[var(--tf-text)] ${LEISES_FELD}`}
        />
      </span>

      <span className={`${SP.zustand} flex shrink-0 items-center gap-1.5`}>
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
      </span>

      <TypSchalter
        nurTypen={knoten.nurTypen}
        disabled={schreibgeschuetzt}
        onChange={nurTypen => patch({ nurTypen })}
      />
    </span>
  );
}

/** Wie die Teile des Satzes aussehen: Feldnamen und Gruppen tragen die Zeile. */
const TEIL_KLASSE: Record<SatzTeil['art'], string> = {
  feld: 'font-medium text-[var(--tf-text)]',
  gruppe: 'font-medium text-[var(--tf-text)]',
  wert: 'text-[var(--tf-text)]',
  text: 'text-[var(--tf-text-secondary)]',
  verknuepfung: 'text-[10.5px] font-medium tracking-wide text-[var(--tf-text-secondary)]',
};

/**
 * „Erfüllt, wenn" — die oberste Ebene der Regel (`bedingungUebersicht`), Gruppen
 * mit Namen oder Nummer; der volle Satz und die Quellspalten stehen im Tooltip.
 * Rechts der Befund-Punkt der Probe: er meldet die REGEL, deshalb hier.
 */
function ErfuelltZelle({ knoten, labelVon, kinder, ohneBedingung, befunde, still }: {
  knoten: MeilensteinKnoten;
  labelVon: (feldId: string) => string;
  kinder: number;
  ohneBedingung: boolean;
  befunde: readonly string[];
  still: boolean;
}): React.ReactElement {
  const leer = bedingungIstLeer(knoten.bedingung);
  const unter: string[] = [];
  let haupt: React.ReactNode;
  if (leer && kinder > 0) {
    haupt = <span className="text-[var(--tf-text-secondary)]">wenn alle aktiven Unter-Meilensteine erreicht sind</span>;
  } else if (leer) {
    // Rot nur, wo es zählt: ein stillgelegter Knoten wird ohnehin nicht bewertet.
    haupt = ohneBedingung
      ? <span className="text-[var(--tf-danger-text)]">keine Bedingung — wird nicht geprüft</span>
      : <span className="text-[var(--tf-text-secondary)]">keine Bedingung</span>;
  } else {
    const u = bedingungUebersicht(knoten.bedingung, labelVon);
    haupt = u.teile.map((t, i) => (
      <span key={i} className={still ? 'text-[var(--tf-text-secondary)]' : TEIL_KLASSE[t.art]}>{t.text}</span>
    ));
    if (u.gruppen > 0) {
      unter.push(`${u.bedingungen} ${u.bedingungen === 1 ? 'Bedingung' : 'Bedingungen'} in `
        + `${u.gruppen} ${u.gruppen === 1 ? 'Gruppe' : 'Gruppen'}`);
    }
  }
  if (knoten.istDatumFeld) unter.push(`Ist-Termin: ${labelVon(knoten.istDatumFeld)}`);

  return (
    <span className={`flex ${SP.erfuellt} flex-1 items-center gap-2`}>
      {/* Der Tooltip nennt den vollen Satz und die Quellspalten — „TIB gefüllt"
          sagt nicht, welche CSV-Spalte dahinter steht, und genau dort entstehen
          die falschen Regeln. */}
      <QuellSpaltenTooltip
        erklaere={idx => knotenQuellen(knoten, idx, labelVon)}
        wrapperClassName="min-w-0 flex-1"
      >
        <span className="flex min-w-0 cursor-help flex-col">
          <span className="line-clamp-2 text-[12.5px] leading-[17px]">{haupt}</span>
          {unter.length > 0 && (
            <span className="truncate text-[11px] text-[var(--tf-text-secondary)]">{unter.join(' · ')}</span>
          )}
        </span>
      </QuellSpaltenTooltip>
      {/* Ein Dreieck, kein Punkt: gleich daneben steht der Punkt der Zuordnung
          in derselben Farbe — zwei gleiche Marken mit verschiedener Bedeutung. */}
      {befunde.length > 0 && (
        <span
          role="img"
          aria-label={`Befund der Probe: ${befunde.join(' · ')}`}
          title={`Befund der Probe: ${befunde.join(' · ')}`}
          className="shrink-0 text-[var(--tf-warning-text)]"
        >
          <TriangleAlert size={12} aria-hidden />
        </span>
      )}
    </span>
  );
}

/**
 * Bestätigt oder nicht — und ein Klick schaltet um. Bis v6.60 setzte nur der
 * Auslieferungs-Plan `unbestaetigt`, und die Oberfläche kannte keinen Weg
 * zurück: „7 Zuordnungen warten auf Bestätigung" hätte für immer dagestanden.
 */
function ZuordnungZelle({ unbestaetigt, schreibgeschuetzt, onUmschalten }: {
  unbestaetigt: boolean;
  schreibgeschuetzt: boolean;
  onUmschalten: () => void;
}): React.ReactElement {
  const text = unbestaetigt ? 'unbestätigt' : 'bestätigt';
  const titel = unbestaetigt
    ? 'Vorbelegt aus dem Auslieferungs-Plan — Spalte und Regel sind noch nicht geprüft.'
    : 'Spalte und Regel sind geprüft.';
  const inhalt = (
    <>
      <span
        aria-hidden
        className="size-[6px] shrink-0 rounded-full"
        style={{ background: unbestaetigt ? 'var(--tf-warning-text)' : 'var(--tf-success-text)' }}
      />
      <span className={unbestaetigt ? 'text-[var(--tf-warning-text)]' : 'text-[var(--tf-text-secondary)]'}>
        {text}
      </span>
    </>
  );
  const basis = `${SP.zuordnung} inline-flex shrink-0 items-center gap-1.5 text-[11.5px]`;
  if (schreibgeschuetzt) return <span className={basis} title={titel}>{inhalt}</span>;
  return (
    <span className={`${SP.zuordnung} shrink-0`}>
      <button
        type="button"
        onClick={onUmschalten}
        aria-label={`Zuordnung ${text} — ${unbestaetigt ? 'bestätigen' : 'wieder als unbestätigt markieren'}`}
        title={`${titel} Klicken: ${unbestaetigt ? 'bestätigen' : 'wieder als unbestätigt markieren'}.`}
        className="-mx-1 inline-flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] hover:bg-[var(--tf-bg-secondary)]"
      >
        {inhalt}
      </button>
    </span>
  );
}

/**
 * „Gilt für" als zusammenhängende Gruppe — eine **Mehrfachauswahl** (je Knopf
 * `aria-pressed`), deshalb nicht `SegmentedToggle`, das eine Einfachauswahl ist.
 * Gewählt ist dunkel gefüllt wie eine aktive Filter-Pill (DESIGN_GUIDE Kap. 5),
 * ohne Haken: die Breite bleibt so ohnehin konstant.
 *
 * Leere Liste heißt „gilt für alle": die Abwahl des LETZTEN Typs ist gesperrt,
 * alle vier gewählt wird wieder zur leeren Liste. Der gesperrte Knopf bleibt
 * gefüllt — vorher sah er als gesperrter Chip wie abgewählt aus.
 */
function TypSchalter({ nurTypen, disabled, onChange }: {
  nurTypen: MeilensteinKnoten['nurTypen'];
  disabled: boolean;
  onChange: (nurTypen: MeilensteinKnoten['nurTypen']) => void;
}): React.ReactElement {
  return (
    <span
      role="group"
      aria-label="Gilt für"
      className={`${SP.giltFuer} inline-flex shrink-0 items-center gap-px rounded-[6px] p-px`}
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
    >
      {ANTRAGSTYP_BUCKETS.map(t => {
        const gewaehlt = nurTypen.length === 0 || nurTypen.includes(t);
        const letzter = gewaehlt && nurTypen.length === 1;
        const gesperrt = disabled || letzter;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={gewaehlt}
            disabled={gesperrt}
            title={letzter
              ? 'Mindestens ein Antragstyp muss ausgewählt bleiben — ohne Auswahl gälte der Meilenstein wieder für alle.'
              : `Gilt für ${TYP_LABEL[t]}`}
            onClick={() => {
              const aktuell = nurTypen.length === 0 ? [...ANTRAGSTYP_BUCKETS] : nurTypen;
              const naechste = aktuell.includes(t) ? aktuell.filter(x => x !== t) : [...aktuell, t];
              if (naechste.length === 0) return;
              onChange(naechste.length === ANTRAGSTYP_BUCKETS.length ? [] : naechste);
            }}
            className={`h-[20px] min-w-0 flex-1 rounded-[5px] text-[11.5px] font-medium transition-colors
              ${gesperrt ? 'cursor-default' : 'cursor-pointer'}
              ${gewaehlt ? '' : 'hover:bg-[var(--tf-bg-secondary)] hover:text-[var(--tf-text)]'}`}
            style={gewaehlt ? { background: 'var(--tf-text)', color: 'var(--tf-bg)' } : { color: 'var(--tf-text-secondary)' }} // allow-cta-fill: Mehrfachauswahl gewählt = aktive Filter-Pill (DESIGN_GUIDE Kap. 5), kein Klick-CTA
          >
            {TYP_LABEL[t]}
          </button>
        );
      })}
    </span>
  );
}

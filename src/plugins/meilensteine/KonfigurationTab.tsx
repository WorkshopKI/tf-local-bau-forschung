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
 * Seit v6.62 ist die zugeklappte Liste eine **Tabelle mit Spaltenköpfen**
 * (`MeilensteinZeile.tsx`): Zeile, Kopf und die Umbau-Schalter leben dort.
 *
 * **Umsortiert wird durch Ziehen.** „Nach oben / unten" bleiben als Zweitweg im
 * ⋯-Menü der Zeile: sie stehen in jeder Einweisung und funktionieren ohne Maus.
 *
 * Der Regel-Bereich hängt an einem EIGENEN Satz offener Zeilen, nicht an der
 * Auswahl: zwei Meilensteine sollen ihre Bedingungen nebeneinander zeigen
 * können. Vorher schloss jedes Aufklappen das vorige.
 *
 * Unbestätigte Zuordnungen aus dem Auslieferungs-Plan tragen einen sichtbaren
 * Hinweis — wer eine geratene Zahl für bare Münze nimmt, plant falsch.
 */
import { Fragment, useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FeldWaehler, type FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { TfTree } from '@/components/tree';
import {
  ANKER_SPALTEN, aendereKnoten, darfUmhaengen, fuegeKnotenHinzu, haengeKnotenUm,
  istDatumsFeldAus, istTerminErklaerung, knotenOhneBedingung, misstNurZeitpunkt,
  planEndeTage, probeBefund, schlageBedingungVor, schlageFelderVor,
  type KnotenProbe, type MeilensteinKnoten, type SpaltenEintrag,
} from '@/core/meilensteine';
import {
  alsBedingungsGruppe, bedingungIstLeer, bedingungSatz, entferneBedingungAn, gruppenKinder,
  istBedingungsGruppe, type Bedingung,
} from '@/core/status';
import { feldQuellen } from '@/core/status/bedingung-quellen';
import { BedingungEditor } from './BedingungEditor';
import { Verbinder } from './BedingungsFugen';
import {
  BlattTreffer, GruppenProbe, Wirkungsleiste, zahlenKurz, zahlenText, type IstTerminAnzeige,
} from './ProbeAnzeige';
import type { MeilensteinProbeApi } from './useMeilensteinProbe';
import { ANKER_ERKLAERUNG, feldStil, spaltenLabel } from './labels';
import {
  MEILENSTEIN_BAUM_ROOT, baueMeilensteinBaum, type MeilensteinBaumKnoten,
} from './meilensteinBaum';
import {
  AktionsZelle, EINZUG, Griff, KnotenZeile, KontextEintraege, SpaltenKopf, meilensteinAktionen,
} from './MeilensteinZeile';
import { ZeilenAktionen } from './ZeilenAktionen';

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
 * Detail-Bereich unter dem ausgewählten Knoten (v6.60): Beschreibung, die Karten
 * des Bedingungs-Editors und darunter die Wirkungsleiste. Die linke
 * Beschriftungsspalte („Gilt für / Erfüllt, wenn / Ist-Termin") ist weg — „gilt
 * für" steht im Kopf, der Kopfsatz sagt „Erfüllt, wenn …", der Ist-Termin hat
 * seine Spalte in der Leiste.
 *
 * Ein **Sammel-Meilenstein** (keine eigene Bedingung, aber Unter-Meilensteine)
 * zeigt seine Kinder als Karten — vorher stand dort eine leere Regel, obwohl er
 * über seine Kinder sehr wohl bewertet wird.
 */
function KnotenKoerper({ knoten, alle, spalten, schreibgeschuetzt, probe, onKnoten, onOeffneKind }: {
  knoten: MeilensteinKnoten;
  alle: MeilensteinKnoten[];
  spalten: SpaltenEintrag[];
  schreibgeschuetzt: boolean;
  probe?: MeilensteinProbeApi;
  onKnoten: (k: MeilensteinKnoten[]) => void;
  onOeffneKind: (id: string) => void;
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
  const istDatum = useMemo(() => istDatumsFeldAus(spalten), [spalten]);
  const kinder = useMemo(
    () => alle.filter(k => k.elternId === knoten.id).sort((a, b) => a.sortierung - b.sortierung),
    [alle, knoten.id],
  );
  const sammel = bedingungIstLeer(knoten.bedingung) && kinder.length > 0;
  const wurzel = useMemo(() => alsBedingungsGruppe(knoten.bedingung), [knoten.bedingung]);
  const nurTypen = knoten.nurTypen;
  // Die Zahlen zählen mit dem Nenner DIESES Meilensteins (`nurTypen`) — sonst
  // stünde an einer Karte eine Zahl über Verbünde, für die er gar nicht gilt.
  const p = probe?.bereit ? probe : null;
  // „Trifft jeden" ist bei einem reinen Zeitpunkt-Meilenstein gewollt, kein Befund.
  const zeitpunkt = misstNurZeitpunkt(knoten.bedingung, knoten.istDatumFeld);

  const ist: IstTerminAnzeige = sammel
    ? {
      keinDatum: false,
      text: 'Das späteste Datum seiner aktiven Unter-Meilensteine — ein Sammel-Meilenstein ist erst fertig, '
        + 'wenn sein letzter Teil fertig ist.',
    }
    : {
      ...istTerminErklaerung(knoten.bedingung, knoten.istDatumFeld, labelVon, istDatum),
      auswahl: (
        <FeldWaehler
          spalten={spalten}
          wert={knoten.istDatumFeld ?? ''}
          onWaehle={feldId => patch({ istDatumFeld: feldId || undefined })}
          nurTyp="datum"
          leerOption="— aus der Bedingung —"
          ariaLabel="Ist-Termin aus Feld"
          disabled={schreibgeschuetzt}
          className="max-w-full"
        />
      ),
    };

  return (
    // `data-regelbereich`: Klicks hier drin meinen den Regelbereich, nie die
    // Zeile darüber (siehe BEDIENELEMENTE) — ein Klick auf eine Kartenfläche
    // klappte den Bereich sonst zu.
    <div data-regelbereich className="flex flex-col gap-2 rounded px-3 pb-3 pt-1.5" style={feldStil}>
      <input
        value={knoten.beschreibung ?? ''}
        onChange={e => patch({ beschreibung: e.target.value })}
        disabled={schreibgeschuetzt}
        placeholder="Beschreibung (optional)"
        aria-label="Beschreibung"
        className="rounded border-[0.5px] border-transparent bg-transparent px-1.5 py-0.5 text-[12px] text-[var(--tf-text-secondary)]
          outline-none hover:border-[var(--tf-border)] focus:border-[var(--tf-border-hover)] disabled:opacity-60"
      />

      {sammel && <SammelKinder kinder={kinder} probe={p} onOeffne={onOeffneKind} />}

      {schreibgeschuetzt ? (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Nur Lesezugriff — die Bedingung kann hier nicht geändert werden.
        </p>
      ) : (
        <>
          {!sammel && startVorschlag && 'feldId' in startVorschlag && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
              <Sparkles size={11} className="shrink-0 text-[var(--tf-text-tertiary)]" />
              Vorschlag aus der Bezeichnung:
              <span className="text-[var(--tf-text)]">
                {bedingungSatz(startVorschlag, labelVon)}
              </span>
              <Button variant="ghost" size="xs" onClick={() => patch({ bedingung: startVorschlag })}>
                Übernehmen
              </Button>
            </p>
          )}
          {sammel && (
            <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
              Oder eine eigene Bedingung — dann ist er auch erreicht, sobald sie zutrifft:
            </p>
          )}
          <BedingungEditor
            bedingung={knoten.bedingung}
            spalten={spalten}
            vorschlaege={vorschlaege}
            probe={p ? g => <GruppenProbe zahlen={p.zaehle(g, nurTypen)} grundmenge={p.grundmenge} /> : undefined}
            trefferBlatt={p ? (b, pfad) => {
              const z = p.zaehle(b, nurTypen);
              // Trifft sie jeden Verbund, zählt die Regel ohne sie mit — der
              // Anlass war „VB Kurzname ist gefüllt" in MST 4.3.
              const ohne = !zeitpunkt && probeBefund(z) === 'alle'
                ? p.zaehle(entferneBedingungAn(wurzel, pfad), nurTypen)
                : null;
              return <BlattTreffer zahlen={z} ohne={ohne} grundmenge={p.grundmenge} ohneBefund={zeitpunkt} />;
            } : undefined}
            kennzahlFeld={p ? feldId => zahlenKurz(p.zaehleFeld(feldId, nurTypen)) : undefined}
            onChange={b => patch({ bedingung: b })}
          />
        </>
      )}

      <Wirkungsleiste probe={probe} knotenId={knoten.id} ohneBedingung={ohneBedingung} ist={ist} ohneBefund={zeitpunkt} />
    </div>
  );
}

/**
 * Die Unter-Meilensteine eines Sammel-Meilensteins als Karten — ein Klick öffnet
 * den Unter-Meilenstein. Zwischen den aktiven steht „und" (ohne Schalter: die
 * Eltern-ODER-Regel verlangt immer ALLE relevanten Kinder); inaktive stehen
 * gestrichelt am Ende und „zählen nicht mit".
 */
function SammelKinder({ kinder, probe, onOeffne }: {
  kinder: MeilensteinKnoten[];
  probe: MeilensteinProbeApi | null;
  onOeffne: (id: string) => void;
}): React.ReactElement {
  const aktive = kinder.filter(k => k.aktiv);
  const inaktive = kinder.filter(k => !k.aktiv);
  const karte = (k: MeilensteinKnoten, inaktiv: boolean): React.ReactElement => {
    const z = probe?.entwurf?.get(k.id);
    return (
      <button
        key={k.id}
        type="button"
        onClick={() => onOeffne(k.id)}
        title={`${k.nummer} ${k.label} — öffnen`}
        className="flex w-[190px] shrink-0 cursor-pointer flex-col gap-0.5 rounded-[8px] px-2.5 py-1.5 text-left hover:bg-[var(--tf-hover)]"
        style={{
          border: `0.5px ${inaktiv ? 'dashed' : 'solid'} var(--tf-border-hover)`,
          background: inaktiv ? 'transparent' : 'var(--tf-bg)',
        }}
      >
        <span className="font-mono text-[10.5px] text-[var(--tf-text-secondary)]">{k.nummer}{inaktiv ? ' · inaktiv' : ''}</span>
        <span className={`line-clamp-2 text-[12px] ${inaktiv ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}>
          {k.label}
        </span>
        <span className="text-[11px] tabular-nums text-[var(--tf-text-secondary)]">
          {inaktiv ? 'zählt nicht mit' : (z ? `erfüllt bei ${zahlenText(z)}` : '')}
        </span>
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] text-[var(--tf-text)]">
        Erfüllt über seine Unter-Meilensteine{' '}
        <span className="text-[11.5px] text-[var(--tf-text-secondary)]">
          — wenn alle aktiven erreicht sind. Ein Klick öffnet den Unter-Meilenstein.
        </span>
      </p>
      <div className="flex flex-wrap items-stretch gap-2">
        {aktive.map((k, i) => (
          <Fragment key={k.id}>
            {i > 0 && <Verbinder verknuepfung="alle" />}
            {karte(k, false)}
          </Fragment>
        ))}
        {inaktive.map(k => karte(k, true))}
      </div>
    </div>
  );
}

type BlattBedingung = Extract<Bedingung, { feldId: string }>;

function blaetterVon(b: Bedingung, out: BlattBedingung[] = []): BlattBedingung[] {
  if (istBedingungsGruppe(b)) for (const k of gruppenKinder(b)) blaetterVon(k, out);
  else out.push(b);
  return out;
}

/**
 * Was die Probe an einem Meilenstein auffällig findet — für den Punkt in der
 * Zeile, damit auch ein zugeklappter Meilenstein es zeigt. Dieselben Fakten wie
 * in der Wirkungsleiste, keine Schwellen (`probeBefund`).
 */
function knotenBefunde(
  k: MeilensteinKnoten,
  entwurf: ReadonlyMap<string, KnotenProbe> | null,
  zaehle: MeilensteinProbeApi['zaehle'],
  labelVon: (feldId: string) => string,
): string[] {
  const out: string[] = [];
  if (misstNurZeitpunkt(k.bedingung, k.istDatumFeld)) return out;
  const z = entwurf?.get(k.id) ?? null;
  const gesamt = probeBefund(z);
  if (gesamt) out.push(gesamt === 'alle' ? 'erfüllt bei allen' : 'erfüllt bei keinem');
  for (const blatt of blaetterVon(k.bedingung)) {
    const b = probeBefund(zaehle(blatt, k.nurTypen));
    if (b) out.push(`„${labelVon(blatt.feldId)}" ${b === 'alle' ? 'trifft jeden Verbund' : 'trifft keinen Verbund'}`);
  }
  if (z && z.ohneDatum.offen + z.ohneDatum.abgeschlossen > 0) {
    out.push(`${z.ohneDatum.offen.toLocaleString('de-DE')} offene ohne Ist-Termin`);
  }
  return out;
}

const KEINE_BEFUNDE: readonly string[] = [];

/**
 * Bedienelemente der Zeile: ein Klick darauf meint das Element, nicht den
 * Regel-Bereich. Der Zeilen-Klick läuft in der Capture-Phase und sieht deshalb
 * auch die Klicks, die das Element selbst später stoppt.
 *
 * `[role="menu"]`: das ⋯-Menü liegt im Portal, React reicht seine Klicks aber
 * durch den Komponenten-Baum bis hierher — und seine Einträge sind `div`s,
 * keine Buttons. Ohne diesen Eintrag klappte „Nach oben" den ganzen
 * Regel-Bereich zu.
 *
 * `[data-regelbereich]` (v6.60): die Karten des Editors sind Flächen — ein Klick
 * darauf, neben ein Feld, meint die Karte, nicht die Zeile.
 */
const BEDIENELEMENTE = 'input, select, textarea, button, label, [draggable="true"], [role="menu"], [data-regelbereich]';

/**
 * Griff und ⋯ erscheinen beim Überfahren der Zeile — fünf Symbole in jeder der
 * zehn Zeilen waren der größte Unruheherd. Mit der Tastatur (Fokus im Baum oder
 * auf ⋯), bei offenem Menü und bei offenem Regelbereich bleiben sie stehen.
 * Deckkraft statt Ausblenden: die Breite bleibt, die Spalten wandern nicht.
 */
const NUR_BEIM_UEBERFAHREN = 'opacity-0 transition-opacity duration-150 group-hover/zeile:opacity-100 '
  + 'focus-within:opacity-100 has-[[data-state=open]]:opacity-100';

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
  const labelVon = useMemo(() => spaltenLabel(spalten), [spalten]);

  // Befunde je Knoten für den Punkt in der Zeile. Aus den Einzelteilen der
  // Probe statt aus ihrem Objekt — das entsteht bei jedem Rendern neu.
  const probeBereit = probe?.bereit ?? false;
  const probeEntwurf = probe?.entwurf ?? null;
  const probeZaehle = probe?.zaehle;
  const befunde = useMemo(() => {
    const out = new Map<string, string[]>();
    if (!probeBereit || !probeZaehle) return out;
    for (const k of knoten) out.set(k.id, knotenBefunde(k, probeEntwurf, probeZaehle, labelVon));
    return out;
  }, [knoten, probeBereit, probeEntwurf, probeZaehle, labelVon]);

  /** Aus der Sammel-Ansicht: Eltern aufklappen, Kind auswählen und seine Regeln zeigen. */
  const oeffneKind = (id: string): void => {
    const eltern = knoten.find(k => k.id === id)?.elternId ?? null;
    if (eltern !== null) setOffen(o => (o.includes(eltern) ? o : [...o, eltern]));
    setKoerperOffen(o => (o.includes(id) ? o : [...o, id]));
    setGewaehlt([id]);
  };

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

  /** Griff und ⋯ einer Zeile: sichtbar bei Fokus und offenem Regelbereich, sonst beim Überfahren. */
  const aktionenKlasse = (id: string, fokus: boolean): string =>
    (fokus || koerperOffen.includes(id) ? '' : NUR_BEIM_UEBERFAHREN);

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
          <span title="Vorbelegt aus dem Auslieferungs-Plan — in der Spalte „Zuordnung“ per Klick bestätigen.">
            <Badge variant="warning">
              {unbestaetigt} {unbestaetigt === 1 ? 'Zuordnung' : 'Zuordnungen'} unbestätigt
            </Badge>
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
        // Der Container misst die Titelspalte (`cqw`); unter der Summe der
        // Mindestbreiten (Titel 200 + „Erfüllt, wenn" 220 + feste Spalten,
        // Abstände, Griff, ⋯ ≈ 985 px) scrollt die Tabelle waagerecht, statt die
        // Regel zu quetschen oder Zeilen umzubrechen.
        <div className="@container overflow-x-auto">
          <div className="min-w-[990px]">
            <SpaltenKopf mitAktionen={!schreibgeschuetzt} />
            <TfTree<MeilensteinBaumKnoten>
              items={items}
              rootId={rootId}
              label="Meilenstein-Plan"
              indent={EINZUG}
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
                  <Griff props={p.dragHandleProps} className={aktionenKlasse(p.id, p.isFocused)} />
                ) : null),
                label: p => (p.data.art === 'meilenstein' ? (
                  <KnotenZeile
                    knoten={p.data.knoten}
                    alle={knoten}
                    spalten={spalten}
                    level={p.level}
                    schreibgeschuetzt={schreibgeschuetzt}
                    frisch={p.id === frischeId}
                    befunde={befunde.get(p.id) ?? KEINE_BEFUNDE}
                    onKnoten={onKnoten}
                  />
                ) : null),
                trailing: p => (p.data.art === 'meilenstein' && !schreibgeschuetzt ? (
                  <AktionsZelle className={aktionenKlasse(p.id, p.isFocused)}>
                    <ZeilenAktionen
                      was="Meilenstein"
                      eintraege={meilensteinAktionen(p.data.knoten, knoten, onKnoten, ergaenze)}
                    />
                  </AktionsZelle>
                ) : null),
                zeilenKlasse: () => 'group/zeile',
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
                    onOeffneKind={oeffneKind}
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
                  <KontextEintraege eintraege={meilensteinAktionen(p.data.knoten, knoten, onKnoten, ergaenze)} />
                ) : null),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

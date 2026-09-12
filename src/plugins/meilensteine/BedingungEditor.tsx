/**
 * Struktureller Bedingungs-Editor — als **Karten** (v6.60). Feld · Vergleich ·
 * Wert je Bedingung stehen in [BlattZeile.tsx](./BlattZeile.tsx).
 *
 * Die Komponente ist bewusst domänenfrei gegenüber den Meilensteinen: sie kennt
 * nur `Bedingung`. Deshalb bedient dieselbe Datei auch die To-do-Regeln des
 * Status-Cockpits und den Dialog „Eigene Spalte".
 *
 * **Warum Karten.** Die PL fand den Bereich nach v6.59 noch „nicht übersichtlich
 * genug, gerade bei verschachtelten Gruppen". Aus vier Entwürfen und einem
 * klickbaren Prototyp mit echten Probe-Zahlen (Spec
 * `docs/superpowers/specs/2026-09-11-regelbereich-karten.md`) wurde:
 * - Über allem der **Kopfsatz** (`bedingungKopfsatz`): „Erfüllt, wenn „PreCheck
 *   AB" und „PreCheck FB" zutreffen." — im Quellspalten-Tooltip.
 * - Jedes Kind der Wurzel ist eine **Karte**: eine Gruppe mit Name,
 *   Verknüpfungstext, ⋯, Probe-Slot und ihren Bedingungen; eine Einzelbedingung
 *   als kleine Karte. Das häufigste Muster des Plans — „alle von: eine von …" —
 *   liest sich so auf einen Blick.
 * - Eine Gruppe in einer Gruppe ist eine **Innenkarte**, rekursiv bis `MAX_TIEFE`.
 * - Die **Verbinder** („und" / „oder") zwischen Karten und zwischen Bedingungen
 *   sind die Schalter der Verknüpfung ([BedingungsFugen.tsx](./BedingungsFugen.tsx)).
 * - Die gestrichelte Karte am Ende legt eine Einzelbedingung oder Gruppe an.
 *
 * Probe-Zahlen, Treffer je Bedingung und die Kennzahl der Feld-Suche reicht der
 * Aufrufer als Render-Funktionen herein (Meilensteine); To-do-Regeln und Eigene
 * Spalte reichen nichts.
 *
 * **Ziehen bleibt**: Griff an jeder Bedingung, Marken zwischen den Bedingungen
 * einer Karte, die Karte selbst als „hier hinein"-Ziel, die Kartenreihe als
 * „ans Ende". Karten wandern über ⋯ (links / rechts). Die Drag-Ereignisse enden
 * an der Wurzel dieses Editors, damit der Meilenstein-Baum darüber sie nicht als
 * Meilenstein-Zug missversteht.
 *
 * **Warum kein `TfTree`.** Er liefe im Meilenstein-Tab INNERHALB des
 * `body`-Slots des äußeren `TfTree` — zwei Drag-Instanzen im selben
 * Ereignispfad. Dazu kommt, dass Pfad-Adressen sich bei jeder Bearbeitung
 * ändern. Was hier steht, ist ein **Formular** mit Verschachtelung.
 */
import { Fragment, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Group, IndentDecrease, IndentIncrease, Plus, Ungroup, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { bedingungQuellen } from '@/core/status/bedingung-quellen';
import {
  MAX_GRUPPENNAME, alsBedingungsGruppe, aufloesenAendertAussage, bedingungKopfsatz, benenneBedingungsGruppe,
  darfBedingungAusruecken, darfBedingungEinruecken, darfBedingungVerschieben, dupliziereBedingung,
  entferneBedingungAn, ersetzeBedingungAn, fuegeBedingungEin, gruppenKinder, holeBedingungAn,
  istBedingungsGruppe, loeseGruppeAuf, mitVerknuepfung, rueckeBedingungAus, rueckeBedingungEin,
  verknuepfungVon, verpackeBedingungInGruppe, verschiebeBedingung, verschiebeBedingungsGeschwister,
  type Bedingung, type BedingungsGruppe, type BedingungsPfad, type Verknuepfung,
} from '@/core/status';
import type { SpaltenEintrag } from '@/core/meilensteine';
import { BlattZeile, type Blatt, type FeldPruefung } from './BlattZeile';
import { Marke, Verbinder, type DropZiel } from './BedingungsFugen';
import { ZeilenAktionen, type AktionsEintrag } from './ZeilenAktionen';
import { spaltenLabel } from './labels';

export type { FeldPruefung } from './BlattZeile';

/**
 * Einrück-Deckel. Bei sechs Ebenen ist die Einrückung breiter als eine Karte,
 * und die Regel wäre ohnehin nicht mehr zu lesen.
 */
const MAX_TIEFE = 6;

const gleich = (a: BedingungsPfad, b: BedingungsPfad): boolean =>
  a.length === b.length && a.every((x, i) => b[i] === x);

const andere = (v: Verknuepfung): Verknuepfung => (v === 'alle' ? 'einige' : 'alle');

function verknuepfungsText(v: Verknuepfung, kinder: number): string {
  if (kinder < 2) return '';
  return v === 'alle' ? 'alle müssen zutreffen' : 'eine genügt';
}

interface EditorProps {
  bedingung: Bedingung;
  spalten: SpaltenEintrag[];
  /** Ohne diese Prop verhält sich der Editor wie vor v2.386 (Meilensteine). */
  pruefeFeld?: FeldPruefung;
  /** Angeheftete Feld-Kandidaten für den Wähler. */
  vorschlaege?: readonly FeldWaehlerVorschlag[];
  /** Was eine Gruppe am Bestand trifft — im Kopf ihrer Karte (nicht in Innenkarten). */
  probe?: (gruppe: Bedingung) => React.ReactNode;
  /** Was eine einzelne Bedingung trifft — rechts in ihrer zweiten Zeile. */
  trefferBlatt?: (blatt: Bedingung, pfad: BedingungsPfad) => React.ReactNode;
  /** Kennzahl je Feld in der Feld-Suche. */
  kennzahlFeld?: (feldId: string) => string | undefined;
  onChange: (b: Bedingung) => void;
}

/** Was jede Karte und Zelle braucht — einmal gebündelt statt durch fünf Ebenen gereicht. */
interface Ctx extends Omit<EditorProps, 'bedingung' | 'onChange'> {
  wurzel: BedingungsGruppe;
  aendere: (b: Bedingung) => void;
  gezogen: BedingungsPfad | null;
  ziel: DropZiel | null;
  setGezogen: (p: BedingungsPfad | null) => void;
  setZiel: (z: DropZiel | null) => void;
  ablegen: () => void;
  ersteSpalte: string;
}

export function BedingungEditor({ bedingung, onChange, ...rest }: EditorProps): React.ReactElement {
  // Ein Blatt als Wurzel wird angehoben, damit immer eine Verknüpfung da ist.
  const wurzel = alsBedingungsGruppe(bedingung);
  const [gezogen, setGezogen] = useState<BedingungsPfad | null>(null);
  const [ziel, setZiel] = useState<DropZiel | null>(null);
  const labelVon = useMemo(() => spaltenLabel(rest.spalten), [rest.spalten]);
  const kinder = gruppenKinder(wurzel);
  const v = verknuepfungVon(wurzel);

  const beendeZug = (): void => { setGezogen(null); setZiel(null); };
  const ablegen = (): void => {
    if (gezogen && ziel && darfBedingungVerschieben(wurzel, gezogen, ziel.elternPfad)) {
      onChange(verschiebeBedingung(wurzel, gezogen, ziel.elternPfad, ziel.index));
    }
    beendeZug();
  };
  const ctx: Ctx = {
    ...rest, wurzel, aendere: onChange, gezogen, ziel, setGezogen, setZiel, ablegen,
    ersteSpalte: rest.spalten[0]?.feldId ?? 'status',
  };
  const schalteWurzel = (): void => onChange(mitVerknuepfung(wurzel, andere(v)));
  const reiheIstZiel = !!gezogen && darfBedingungVerschieben(wurzel, gezogen, []);
  const reiheLeuchtet = !!ziel && ziel.elternPfad.length === 0;
  let gruppenNr = 0;

  return (
    // Die Drag-Ereignisse enden hier: ein Meilenstein-Baum kann darüber liegen.
    <div
      onDragOver={e => { if (gezogen) e.stopPropagation(); }}
      onDrop={e => { if (gezogen) e.stopPropagation(); }}
      onDragEnd={beendeZug}
    >
      {kinder.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <QuellSpaltenTooltip erklaere={idx => bedingungQuellen(wurzel, idx, labelVon)}>
            <span className="cursor-help text-[13px] text-[var(--tf-text)]">{bedingungKopfsatz(wurzel, labelVon)}</span>
          </QuellSpaltenTooltip>
          {kinder.length > 1 && (
            <span className="text-[11px] text-[var(--tf-text-secondary)]">„und" / „oder" anklicken schaltet um</span>
          )}
        </div>
      )}

      <div
        className="mt-2 flex flex-wrap items-stretch gap-2.5 rounded-[8px]"
        style={reiheLeuchtet ? { outline: '1px dashed var(--tf-primary)', outlineOffset: 3 } : undefined}
        // Die Reihe selbst ist das Ziel „ans Ende der Wurzel" — die Karten
        // stoppen ihre Ereignisse, also greift sie nur in den Lücken.
        onDragOver={e => {
          if (!reiheIstZiel) return;
          e.preventDefault();
          e.stopPropagation();
          setZiel({ elternPfad: [], index: kinder.length });
        }}
        onDrop={e => { if (!reiheIstZiel) return; e.preventDefault(); e.stopPropagation(); ablegen(); }}
      >
        {kinder.map((kind, i) => {
          const pfad = [i];
          const gruppe = istBedingungsGruppe(kind);
          if (gruppe) gruppenNr += 1;
          return (
            <Fragment key={i}>
              {i > 0 && <Verbinder verknuepfung={v} onSchalte={schalteWurzel} />}
              {gruppe
                ? <Karte ctx={ctx} pfad={pfad} gruppe={kind} platzhalter={`Gruppe ${gruppenNr}`} />
                : <EinzelKarte ctx={ctx} pfad={pfad} blatt={kind as Blatt} />}
            </Fragment>
          );
        })}

      </div>

      {/* Anlegen steht UNTER den Karten, nicht in einer eigenen Spalte daneben
          (v6.64): die gestrichelte Karte am Zeilenende hielt rund 140 px — 12 %
          der Bereichsbreite — für zwei Knöpfe frei, die den Blick nichts
          angehen, solange man liest. */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Button
          variant="ghost" size="xs" icon={Plus}
          title="Eine einzelne Bedingung als eigene Karte"
          onClick={() => onChange(fuegeBedingungEin(wurzel, [], kinder.length, { feldId: ctx.ersteSpalte, op: 'gefuellt' }))}
        >
          Bedingung
        </Button>
        <Button
          variant="ghost" size="xs" icon={Plus}
          title="Eine neue Karte für mehrere Bedingungen, die zusammen gelten"
          onClick={() => onChange(fuegeBedingungEin(wurzel, [], kinder.length, { einige: [] }))}
        >
          Gruppe
        </Button>
      </div>
    </div>
  );
}

/** Verschieben unter Geschwistern — auf der Kartenebene heißt es links / rechts. */
function verschiebeEintraege(ctx: Ctx, pfad: BedingungsPfad): AktionsEintrag[] {
  const { wurzel, aendere } = ctx;
  const i = pfad[pfad.length - 1] ?? 0;
  const eltern = holeBedingungAn(wurzel, pfad.slice(0, -1));
  const n = eltern && istBedingungsGruppe(eltern) ? gruppenKinder(eltern).length : 0;
  const karte = pfad.length === 1;
  return [
    {
      icon: karte ? ArrowLeft : ArrowUp, label: karte ? 'Nach links' : 'Nach oben',
      aus: i === 0, grund: 'Steht schon am Anfang.',
      onSelect: () => aendere(verschiebeBedingungsGeschwister(wurzel, pfad, 'hoch')),
    },
    {
      icon: karte ? ArrowRight : ArrowDown, label: karte ? 'Nach rechts' : 'Nach unten',
      aus: i >= n - 1, grund: 'Steht schon am Ende.',
      onSelect: () => aendere(verschiebeBedingungsGeschwister(wurzel, pfad, 'runter')),
    },
  ];
}

function blattAktionen(ctx: Ctx, pfad: BedingungsPfad): AktionsEintrag[] {
  const { wurzel, aendere } = ctx;
  const karte = pfad.length === 1;
  return [
    ...verschiebeEintraege(ctx, pfad),
    {
      icon: Group, label: karte ? 'Zur Gruppe machen' : 'In eine eigene Gruppe verpacken', trennerDavor: true,
      aus: pfad.length >= MAX_TIEFE, grund: 'Die tiefste Ebene ist erreicht.',
      onSelect: () => aendere(verpackeBedingungInGruppe(wurzel, pfad, 'einige')),
    },
    {
      icon: IndentIncrease, label: 'In die Gruppe davor',
      aus: !darfBedingungEinruecken(wurzel, pfad), grund: 'Nur möglich, wenn direkt davor eine Gruppe steht.',
      onSelect: () => aendere(rueckeBedingungEin(wurzel, pfad)),
    },
    {
      icon: IndentDecrease, label: 'Aus der Gruppe lösen',
      aus: !darfBedingungAusruecken(pfad), grund: 'Steht bereits als eigene Karte da.',
      onSelect: () => aendere(rueckeBedingungAus(wurzel, pfad)),
    },
    {
      icon: X, label: 'Bedingung entfernen', gefahr: true, trennerDavor: true,
      onSelect: () => aendere(entferneBedingungAn(wurzel, pfad)),
    },
  ];
}

function gruppenAktionen(ctx: Ctx, pfad: BedingungsPfad): AktionsEintrag[] {
  const { wurzel, aendere } = ctx;
  return [
    ...verschiebeEintraege(ctx, pfad),
    {
      icon: Copy, label: 'Duplizieren', trennerDavor: true,
      onSelect: () => aendere(dupliziereBedingung(wurzel, pfad)),
    },
    {
      icon: Ungroup,
      label: aufloesenAendertAussage(wurzel, pfad) ? 'Auflösen — ändert die Aussage' : 'Auflösen — ändert nichts',
      onSelect: () => aendere(loeseGruppeAuf(wurzel, pfad)),
    },
    {
      icon: IndentDecrease, label: 'Aus der Gruppe lösen',
      aus: !darfBedingungAusruecken(pfad), grund: 'Steht bereits als eigene Karte da.',
      onSelect: () => aendere(rueckeBedingungAus(wurzel, pfad)),
    },
    {
      icon: X, label: 'Gruppe entfernen', gefahr: true, trennerDavor: true,
      onSelect: () => aendere(entferneBedingungAn(wurzel, pfad)),
    },
  ];
}

function Zelle({ ctx, pfad, blatt }: { ctx: Ctx; pfad: BedingungsPfad; blatt: Blatt }): React.ReactElement {
  return (
    <BlattZeile
      blatt={blatt}
      spalten={ctx.spalten}
      pruefeFeld={ctx.pruefeFeld}
      vorschlaege={ctx.vorschlaege}
      kennzahlFeld={ctx.kennzahlFeld}
      treffer={ctx.trefferBlatt?.(blatt, pfad)}
      onChange={b => ctx.aendere(ersetzeBedingungAn(ctx.wurzel, pfad, b))}
      aktionen={(
        <ZeilenAktionen
          was="Bedingung"
          eintraege={blattAktionen(ctx, pfad)}
          griffProps={{
            draggable: true,
            onDragStart: e => {
              e.stopPropagation();
              // Der gezogene Knoten steht im Zustand, NICHT im `dataTransfer`:
              // der Zug bleibt in diesem Editor, und eine Datei aus dem
              // Betriebssystem bleibt wirkungslos (`gezogen` ist dann `null`).
              ctx.setGezogen(pfad);
            },
          }}
        />
      )}
    />
  );
}

/**
 * Karten wachsen mit der Reihe (Grundbreite 380 px, höchstens 480 px): drei
 * nebeneinander genügen, lesbar muss vor allem der Feldname sein. Feste 320 px
 * schnitten ihn ab — „alle Anträge in C16 eingegeben · D…" war nur per Tooltip
 * zu lesen. In schmalen Wirten (To-do-Detail, Dialog) steht eine Karte je Zeile.
 */
const KARTEN_BREITE = 'min-w-[260px] max-w-[480px] flex-[1_1_380px]';

/** Eine Einzelbedingung auf oberster Ebene — eine kleine Karte ohne Kopf. */
function EinzelKarte({ ctx, pfad, blatt }: { ctx: Ctx; pfad: BedingungsPfad; blatt: Blatt }): React.ReactElement {
  const wirdGezogen = !!ctx.gezogen && gleich(ctx.gezogen, pfad);
  return (
    <div
      className={cn(KARTEN_BREITE, 'flex flex-col justify-center rounded-[8px] bg-[var(--tf-bg)] p-1')}
      style={{ border: '0.5px solid var(--tf-border)', ...(wirdGezogen ? { outline: '1px dashed var(--tf-border-hover)' } : {}) }}
    >
      <Zelle ctx={ctx} pfad={pfad} blatt={blatt} />
    </div>
  );
}

/** Eine Gruppe als Karte — oder, eine Ebene tiefer, als Innenkarte. */
function Karte({ ctx, pfad, gruppe, platzhalter, innen = false }: {
  ctx: Ctx;
  pfad: BedingungsPfad;
  gruppe: BedingungsGruppe;
  platzhalter: string;
  innen?: boolean;
}): React.ReactElement {
  const { wurzel, aendere, gezogen, ziel, setZiel, ablegen } = ctx;
  const kinder = gruppenKinder(gruppe);
  const v = verknuepfungVon(gruppe);
  const dropErlaubt = !!gezogen && darfBedingungVerschieben(wurzel, gezogen, pfad);
  const kastenAktiv = !!ziel && gleich(ziel.elternPfad, pfad);
  const wirdGezogen = !!gezogen && gleich(gezogen, pfad);
  const schalte = (): void => aendere(ersetzeBedingungAn(wurzel, pfad, mitVerknuepfung(gruppe, andere(v))));
  const ergaenze = (k: Bedingung): void => aendere(fuegeBedingungEin(wurzel, pfad, kinder.length, k));

  const marke = (index: number): React.ReactElement => (
    <Marke
      elternPfad={pfad} index={index}
      aktiv={!!ziel && ziel.index === index && gleich(ziel.elternPfad, pfad)}
      erlaubt={dropErlaubt} zeigen={!!gezogen}
      setZiel={setZiel} onAblegen={ablegen}
    />
  );

  /** Die nähere Kante einer Zelle gewinnt: obere Hälfte = davor. */
  const kante = (i: number) => (e: React.DragEvent): void => {
    if (!dropErlaubt) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setZiel({ elternPfad: pfad, index: e.clientY < r.top + r.height / 2 ? i : i + 1 });
  };

  let innerNr = 0;
  return (
    <div
      className={innen
        ? 'mx-1 my-0.5 flex flex-col rounded-[6px] bg-[var(--tf-bg-secondary)]'
        : cn(KARTEN_BREITE, 'flex flex-col rounded-[8px] bg-[var(--tf-bg)]')}
      style={{
        border: '0.5px solid var(--tf-border)',
        ...(kastenAktiv ? { outline: '1px solid var(--tf-primary)' } : {}),
        ...(wirdGezogen ? { outline: '1px dashed var(--tf-border-hover)' } : {}),
      }}
      // Die Karte selbst ist das „hier hinein"-Ziel: an ihr Ende. Marken und
      // Zellkanten darin stoppen ihre Ereignisse — die feinere Geste gewinnt.
      onDragOver={e => {
        if (!dropErlaubt) return;
        e.preventDefault();
        e.stopPropagation();
        setZiel({ elternPfad: pfad, index: kinder.length });
      }}
      onDrop={e => { if (!dropErlaubt) return; e.preventDefault(); e.stopPropagation(); ablegen(); }}
    >
      <div className={cn('flex min-w-0 items-center gap-1.5', innen ? 'px-2 pt-1.5' : 'px-2.5 pb-1 pt-2')}>
        {/* `key`: ein von außen geänderter Name (Laden, Fassung übernehmen)
            setzt den Entwurf im Feld zurück. */}
        <GruppenName
          key={gruppe.name ?? ''}
          name={gruppe.name ?? ''}
          platzhalter={platzhalter}
          klein={innen}
          onBenenne={name => aendere(benenneBedingungsGruppe(wurzel, pfad, name))}
        />
        <span className="truncate text-[11.5px] text-[var(--tf-text-secondary)]">{verknuepfungsText(v, kinder.length)}</span>
        {/* Die Zahl der Gruppe steht IM Kopf, rechts — nicht mehr als eigene
            Zeile mit Balken darunter (v6.64): zwei Zeilen Höhe für dieselbe
            Auskunft machten die Nebensache größer als die Bedingung. */}
        {!innen && ctx.probe && <span className="ml-auto shrink-0">{ctx.probe(gruppe)}</span>}
        <span className={cn('shrink-0', innen || !ctx.probe ? 'ml-auto' : '')}>
          <ZeilenAktionen
            was="Gruppe"
            eintraege={gruppenAktionen(ctx, pfad)}
            griffProps={innen ? {
              draggable: true,
              onDragStart: e => { e.stopPropagation(); ctx.setGezogen(pfad); },
            } : undefined}
          />
        </span>
      </div>

      {!innen && <div className="mb-1 mt-1 h-px bg-[var(--tf-border)]" />}

      <div className="flex flex-col px-1">
        {marke(0)}
        {kinder.map((kind, i) => {
          const kindPfad = [...pfad, i];
          const istGruppe = istBedingungsGruppe(kind);
          if (istGruppe) innerNr += 1;
          return (
            <Fragment key={i}>
              {i > 0 && <Verbinder verknuepfung={v} onSchalte={schalte} linie />}
              <div
                onDragOver={istGruppe ? undefined : kante(i)}
                onDrop={istGruppe ? undefined : (e => {
                  if (!dropErlaubt) return;
                  e.preventDefault(); e.stopPropagation(); ablegen();
                })}
                style={!istGruppe && gezogen && gleich(gezogen, kindPfad)
                  ? { outline: '1px dashed var(--tf-border-hover)', borderRadius: 6 }
                  : undefined}
              >
                {istGruppe
                  ? <Karte ctx={ctx} pfad={kindPfad} gruppe={kind} platzhalter={`${platzhalter}.${innerNr}`} innen />
                  : <Zelle ctx={ctx} pfad={kindPfad} blatt={kind as Blatt} />}
              </div>
              {marke(i + 1)}
            </Fragment>
          );
        })}

        {kinder.length === 0 && (
          <p className="px-2 py-2 text-[11.5px] text-[var(--tf-text-secondary)]">
            {v === 'alle' ? 'Leer = immer erfüllt — bitte Bedingung ergänzen.' : 'Leer = nie erfüllt — bitte Bedingung ergänzen.'}
          </p>
        )}
        {innen && kinder.length === 1 && (
          <p className="px-2 pb-1 text-[11px] leading-snug text-[var(--tf-text-secondary)]">
            Gruppe mit einer Bedingung — wirkt wie die Bedingung allein.{' '}
            <button
              type="button"
              className="cursor-pointer text-[var(--tf-primary)] hover:underline"
              onClick={() => aendere(loeseGruppeAuf(wurzel, pfad))}
            >
              Auflösen
            </button>
          </p>
        )}
      </div>

      <div className={cn('mt-auto flex items-center gap-1', innen ? 'px-1.5 pb-1.5' : 'px-2 pb-2 pt-1')}>
        <Button variant="ghost" size="xs" icon={Plus} onClick={() => ergaenze({ feldId: ctx.ersteSpalte, op: 'gefuellt' })}>
          Bedingung
        </Button>
        {!innen && pfad.length < MAX_TIEFE && (
          <Button
            variant="ghost" size="xs" icon={Plus}
            title="Eine Gruppe in dieser Karte — ihre Bedingungen hängen mit eigener Verknüpfung zusammen"
            onClick={() => ergaenze({ einige: [] })}
          >
            Gruppe
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Der Name einer Gruppe, direkt im Kartenkopf editierbar.
 *
 * Übernommen wird mit Enter oder beim Verlassen, Esc verwirft — nicht bei jedem
 * Tastendruck: jede Übernahme ist eine Änderung am Plan, und ein halb getippter
 * Name soll nicht zwischendurch im Kopfsatz stehen. Ohne Namen steht der
 * Platzhalter „Gruppe n" da; er wird nicht gespeichert.
 */
function GruppenName({ name, platzhalter, klein, onBenenne }: {
  name: string;
  platzhalter: string;
  klein?: boolean;
  onBenenne: (name: string) => void;
}): React.ReactElement {
  const [text, setText] = useState(name);
  /** Esc setzt zurück UND verlässt das Feld — das Verlassen darf dann nicht übernehmen. */
  const verwerfen = useRef(false);
  const breite = Math.max(text.length, platzhalter.length) + 2;

  return (
    <input
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        if (verwerfen.current) { verwerfen.current = false; return; }
        if (text.trim() !== name) onBenenne(text);
      }}
      onKeyDown={e => {
        // Tasten meinen das Feld, nicht den Meilenstein-Baum darüber.
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          verwerfen.current = true;
          setText(name);
          e.currentTarget.blur();
        }
      }}
      placeholder={platzhalter}
      maxLength={MAX_GRUPPENNAME}
      aria-label="Name der Gruppe"
      title="Name der Gruppe — steht auch im Kopfsatz. Enter übernimmt, Esc verwirft."
      className={cn(
        'min-w-0 rounded-sm px-1 py-0.5 bg-transparent font-semibold text-[var(--tf-text)]',
        'placeholder:font-medium placeholder:text-[var(--tf-text-secondary)]',
        'hover:bg-[var(--tf-bg)] focus:bg-[var(--tf-bg)] focus:outline-1 focus:outline-[var(--tf-primary)]',
        klein ? 'text-[12px]' : 'text-[12.5px]',
      )}
      style={{ width: `${breite}ch`, borderBottom: '0.5px dashed var(--tf-border-hover)' }}
    />
  );
}

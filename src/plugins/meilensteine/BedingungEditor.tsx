/**
 * Struktureller Bedingungs-Editor — verschachtelte UND/ODER-Gruppen, je Blatt
 * Feld · Operator · Wert (siehe [BlattZeile.tsx](./BlattZeile.tsx)).
 *
 * Die Komponente ist bewusst domänenfrei gegenüber den Meilensteinen: sie kennt
 * nur `Bedingung`. Deshalb bedient dieselbe Datei auch den Regel-Tab des
 * Status-Cockpits und den Dialog „Eigene Spalte".
 *
 * **Die Hierarchie ist nachträglich änderbar** (v5.3). Bis dahin war sie beim
 * Anlegen zementiert: kein Ein-/Ausrücken, kein Umsortieren, kein Ziehen, und
 * ab Stufe 2 verschwand „+ Gruppe" wortlos. Der Umbau selbst rechnet nicht
 * hier, sondern in der reinen [bedingung-baum.ts](../../core/status/bedingung-baum.ts);
 * diese Datei hält nur den Zeiger darauf, welcher Knoten gemeint ist — einen
 * **Kind-Index-Pfad**, weil `Bedingung` keine Ids kennt.
 *
 * **Geschwister sehen wie Geschwister aus** (v6.3). Eine Gruppe neben zwei
 * Blättern IST deren Geschwister, sah aber wie ihre Untergruppe aus: der Kasten
 * bringt eigene Polsterung und eine zweite Einrück-Spalte mit, sein Kopf begann
 * damit rechts der Nachbarzeilen. Drei Dinge halten das jetzt gerade:
 * das Verknüpfungs-Wort in der linken Rinne jeder Zeile
 * ([BedingungsFugen.tsx](./BedingungsFugen.tsx)) — man liest wörtlich
 * „A UND B UND (Gruppe 1) UND C"; ein Gruppenkopf, der sich benennt
 * („Gruppe 1 · EINE genügt"); und dasselbe Bedienbündel an derselben rechten
 * Kante für Blätter wie für Gruppen.
 *
 * **Warum kein `TfTree`.** Er wäre die architekturtreue Wahl für einen Baum mit
 * Ziehen — liefe im Meilenstein-Tab aber INNERHALB des `body`-Slots des äußeren
 * `TfTree`, also zwei Drag-Instanzen im selben Ereignispfad, deren Drop-Ziele
 * sich überlagern. Dazu kommt, dass Pfad-Ids sich bei jeder Bearbeitung ändern
 * und den Aufklapp-/Auswahl-Zustand eines Baums damit bei jedem Tastendruck
 * zerrissen. Was hier steht, ist ein **Formular** mit Verschachtelung: kein
 * Aufklappen, keine Knoten-Auswahl, keine Baum-Tastatur. Die Drag-Ereignisse
 * werden deshalb an der Wurzel dieses Editors gestoppt, damit der äußere Baum
 * sie nicht als Meilenstein-Zug missversteht.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import {
  alsBedingungsGruppe, darfBedingungAusruecken, darfBedingungEinruecken,
  darfBedingungVerschieben, entferneBedingungAn, ersetzeBedingungAn, fuegeBedingungEin,
  gruppenKinder, holeBedingungAn, istBedingungsGruppe,
  rueckeBedingungAus, rueckeBedingungEin, verpackeBedingungInGruppe, verschiebeBedingung,
  verschiebeBedingungsGeschwister,
  type Bedingung, type BedingungsGruppe, type BedingungsPfad,
} from '@/core/status';
import type { SpaltenEintrag } from '@/core/meilensteine';
import { BlattZeile, type Blatt, type FeldPruefung } from './BlattZeile';
import { Marke, Rinne, type DropZiel } from './BedingungsFugen';
import { ZeilenAktionen } from './ZeilenAktionen';
import { feldStil } from './labels';

export type { FeldPruefung } from './BlattZeile';

/**
 * Einrück-Deckel. Bis v5.1 lag die Grenze bei 2 und blendete „+ Gruppe"
 * kommentarlos aus — eine Regel mit drei Ebenen ließ sich schlicht nicht bauen.
 * Jetzt ist sie so hoch, dass sie im Alltag nicht greift, und dort, wo sie
 * greift, sagt sie es: bei sechs Ebenen ist die Einrückung breiter als der
 * Bereich, und die Regel wäre ohnehin nicht mehr zu lesen.
 */
const MAX_TIEFE = 6;

/** Einzug der Bedienzeilen, damit sie unter den Bedingungen stehen, nicht unter der Rinne. */
const UNTER_RINNE = 'pl-[38px]';

const gleich = (a: BedingungsPfad, b: BedingungsPfad): boolean =>
  a.length === b.length && a.every((x, i) => b[i] === x);

export function BedingungEditor({ bedingung, spalten, pruefeFeld, vorschlaege, onChange }: {
  bedingung: Bedingung;
  spalten: SpaltenEintrag[];
  /** Ohne diese Prop verhält sich der Editor wie vor v2.386 (Meilensteine). */
  pruefeFeld?: FeldPruefung;
  /**
   * Angeheftete Feld-Kandidaten für den Wähler. Der Editor weiß nicht, woher
   * sie kommen — die Meilensteine leiten sie aus der Bezeichnung ab, andere
   * Aufrufer reichen nichts herein.
   */
  vorschlaege?: readonly FeldWaehlerVorschlag[];
  onChange: (b: Bedingung) => void;
}): React.ReactElement {
  // Ein Blatt als Wurzel wird angehoben, damit immer eine Verknüpfung sichtbar
  // ist. Der Aufrufer bekommt danach ebenfalls eine Gruppe zurück.
  const wurzel: Bedingung = alsBedingungsGruppe(bedingung);
  const [gezogen, setGezogen] = useState<BedingungsPfad | null>(null);
  const [ziel, setZiel] = useState<DropZiel | null>(null);

  const beendeZug = (): void => { setGezogen(null); setZiel(null); };

  const ablegen = (): void => {
    if (gezogen && ziel && darfBedingungVerschieben(wurzel, gezogen, ziel.elternPfad)) {
      onChange(verschiebeBedingung(wurzel, gezogen, ziel.elternPfad, ziel.index));
    }
    beendeZug();
  };

  return (
    // Die Drag-Ereignisse enden hier: ein Meilenstein-Baum kann darüber liegen.
    <div
      onDragOver={e => { if (gezogen) e.stopPropagation(); }}
      onDrop={e => { if (gezogen) e.stopPropagation(); }}
      onDragEnd={beendeZug}
    >
      <Gruppe
        wurzel={wurzel}
        pfad={[]}
        spalten={spalten}
        pruefeFeld={pruefeFeld}
        vorschlaege={vorschlaege}
        onWurzel={onChange}
        gezogen={gezogen}
        ziel={ziel}
        setGezogen={setGezogen}
        setZiel={setZiel}
        onAblegen={ablegen}
      />
    </div>
  );
}

interface BaumProps {
  wurzel: Bedingung;
  pfad: BedingungsPfad;
  spalten: SpaltenEintrag[];
  pruefeFeld?: FeldPruefung;
  vorschlaege?: readonly FeldWaehlerVorschlag[];
  onWurzel: (b: Bedingung) => void;
  gezogen: BedingungsPfad | null;
  ziel: DropZiel | null;
  setGezogen: (p: BedingungsPfad | null) => void;
  setZiel: (z: DropZiel | null) => void;
  onAblegen: () => void;
  /** Das Bedienbündel DIESER Gruppe — steht in ihrem Kopf. Die Wurzel hat keins. */
  aktionen?: React.ReactNode;
  /** 1-basiert unter den Geschwister-Gruppen derselben Liste. */
  nummer?: number;
}

function Gruppe(p: BaumProps): React.ReactElement {
  const {
    wurzel, pfad, spalten, pruefeFeld, vorschlaege, onWurzel,
    gezogen, ziel, setGezogen, setZiel, onAblegen, aktionen, nummer,
  } = p;
  const knoten = holeBedingungAn(wurzel, pfad);
  if (!knoten || !istBedingungsGruppe(knoten)) return <></>;
  const gruppe: BedingungsGruppe = knoten;
  const kinder = gruppenKinder(gruppe);
  const istUnd = 'alle' in gruppe;
  const wort = istUnd ? 'UND' : 'ODER';
  const tiefe = pfad.length;
  const istWurzel = tiefe === 0;
  const ersteSpalte = spalten[0]?.feldId ?? 'status';
  const darfTiefer = tiefe < MAX_TIEFE;

  const setzeGruppe = (g: Bedingung): void => onWurzel(ersetzeBedingungAn(wurzel, pfad, g));
  const ergaenzeKind = (kind: Bedingung): void =>
    onWurzel(fuegeBedingungEin(wurzel, pfad, kinder.length, kind));

  /** Darf hier abgelegt werden? Nicht in den eigenen Teilbaum. */
  const dropErlaubt = !!gezogen && darfBedingungVerschieben(wurzel, gezogen, pfad);
  /** Zielt der laufende Zug in genau DIESE Liste? Dann leuchtet der Kasten. */
  const kastenAktiv = !!ziel && gleich(ziel.elternPfad, pfad);

  const marke = (index: number): React.ReactElement => (
    <Marke
      elternPfad={pfad} index={index}
      aktiv={!!ziel && ziel.index === index && gleich(ziel.elternPfad, pfad)}
      erlaubt={dropErlaubt} zeigen={!!gezogen}
      setZiel={setZiel} onAblegen={onAblegen}
    />
  );

  /** Die nähere Kante einer Blattzeile gewinnt: obere Hälfte = davor. */
  const kante = (i: number) => (e: React.DragEvent): void => {
    if (!dropErlaubt) return;
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setZiel({ elternPfad: pfad, index: e.clientY < r.top + r.height / 2 ? i : i + 1 });
  };

  return (
    <div
      className="flex flex-col gap-1 rounded px-2 py-1"
      style={{
        ...(istWurzel ? { background: 'var(--tf-bg)' } : feldStil),
        ...(kastenAktiv ? { outline: '1px solid var(--tf-primary)' } : {}),
      }}
      // Der Kasten selbst ist das „hier hinein"-Ziel: an das Ende dieser Gruppe.
      // Die Marken und Zeilenkanten darin stoppen ihre Ereignisse, also gewinnt
      // immer die feinere Geste.
      onDragOver={e => {
        if (!dropErlaubt) return;
        e.preventDefault();
        e.stopPropagation();
        setZiel({ elternPfad: pfad, index: kinder.length });
      }}
      onDrop={e => { if (!dropErlaubt) return; e.preventDefault(); e.stopPropagation(); onAblegen(); }}
    >
      <div className="flex items-center gap-1">
        {!istWurzel && (
          <span className="shrink-0 text-[10.5px] font-semibold tracking-[0.06em] text-[var(--tf-text-secondary)]">
            GRUPPE {nummer ?? 1}
          </span>
        )}
        <select
          value={istUnd ? 'alle' : 'einige'}
          onChange={e => setzeGruppe(e.target.value === 'alle' ? { alle: kinder } : { einige: kinder })}
          className="text-[12px] rounded px-1.5 py-0.5 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer"
          style={feldStil}
          aria-label="Verknüpfung"
        >
          <option value="alle">ALLE müssen zutreffen</option>
          <option value="einige">EINE genügt</option>
        </select>

        {/* Der Gruppen-Knopf steht OBEN, neben der Verknüpfung, auf die er sich
            bezieht. Unten in der eingerückten Liste las er sich als
            „Untergruppe" — dabei legt er eine Gruppe auf DIESER Ebene an. */}
        {darfTiefer && (
          <Button
            variant="ghost" size="xs" icon={Plus}
            title="Gruppe auf dieser Ebene — sie liegt neben den Bedingungen, nicht darin"
            onClick={() => ergaenzeKind({ einige: [] })}
          >
            Gruppe
          </Button>
        )}
        {!darfTiefer && (
          <span
            className="text-[11px] text-[var(--tf-text-tertiary)]"
            title={`Ab ${MAX_TIEFE} Ebenen ist die Einrückung breiter als der Bereich — die Regel wäre nicht mehr zu lesen.`}
          >
            tiefste Ebene
          </span>
        )}

        {kinder.length === 0 && (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {istUnd
              ? 'Leer = immer erfüllt — bitte Bedingung ergänzen.'
              : 'Leer = nie direkt erfüllt (nur über Unter-Meilensteine).'}
          </span>
        )}

        {aktionen && <span className="ml-auto pl-2">{aktionen}</span>}
      </div>

      <div className="flex flex-col pl-2.5 border-l border-[var(--tf-border)]">
        {marke(0)}
        {kinder.map((kind, i) => {
          const kindPfad = [...pfad, i];
          const istGruppe = istBedingungsGruppe(kind);
          const kindAktionen = (
            <ZeilenAktionen
              was={istGruppe ? 'Gruppe' : 'Bedingung'}
              griffProps={{
                draggable: true,
                onDragStart: e => {
                  e.stopPropagation();
                  // Der gezogene Knoten steht im Zustand, NICHT im `dataTransfer`:
                  // der Zug bleibt in diesem Editor, und was ihn verlässt, ist
                  // kein Bedingungs-Pfad. Zugleich bleibt damit das Ablegen einer
                  // Datei aus dem Betriebssystem wirkungslos (`gezogen` ist dann
                  // `null`, und ohne `preventDefault` gibt es kein Drop).
                  setGezogen(kindPfad);
                },
              }}
              kannHoch={i > 0}
              kannRunter={i < kinder.length - 1}
              kannEinruecken={darfBedingungEinruecken(wurzel, kindPfad) && darfTiefer}
              einrueckenGrund={darfTiefer
                ? 'Nur möglich, wenn direkt darüber eine Gruppe steht — sonst entstünde eine Gruppe, die niemand gewählt hat.'
                : 'Die tiefste Ebene ist erreicht.'}
              kannAusruecken={darfBedingungAusruecken(kindPfad)}
              ausrueckenGrund="Steht bereits auf der obersten Ebene — parallel zu den übrigen Bedingungen."
              kannVerpacken={tiefe + 1 < MAX_TIEFE}
              onHoch={() => onWurzel(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'hoch'))}
              onRunter={() => onWurzel(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'runter'))}
              onEinruecken={() => onWurzel(rueckeBedingungEin(wurzel, kindPfad))}
              onAusruecken={() => onWurzel(rueckeBedingungAus(wurzel, kindPfad))}
              onVerpacken={() => onWurzel(verpackeBedingungInGruppe(wurzel, kindPfad, 'alle'))}
              onEntfernen={() => onWurzel(entferneBedingungAn(wurzel, kindPfad))}
            />
          );
          const wirdGezogen = !!gezogen && gleich(gezogen, kindPfad);
          // 1-basiert unter den Geschwister-GRUPPEN, nicht unter allen Kindern:
          // „Gruppe 2" soll die zweite Gruppe meinen, nicht das zweite Kind.
          const gruppenNummer = istGruppe
            ? kinder.slice(0, i + 1).filter(istBedingungsGruppe).length
            : undefined;
          return (
            <div key={i} style={wirdGezogen ? { outline: '1px dashed var(--tf-border-hover)' } : undefined}>
              <div className="flex items-start" onDragOver={istGruppe ? undefined : kante(i)}
                onDrop={istGruppe ? undefined : (e => {
                  if (!dropErlaubt) return;
                  e.preventDefault(); e.stopPropagation(); onAblegen();
                })}
              >
                <Rinne wort={i > 0 ? wort : null} />
                <div className="flex-1 min-w-0">
                  {istGruppe ? (
                    <Gruppe {...p} pfad={kindPfad} aktionen={kindAktionen} nummer={gruppenNummer} />
                  ) : (
                    <BlattZeile
                      blatt={kind as Blatt}
                      spalten={spalten}
                      pruefeFeld={pruefeFeld}
                      vorschlaege={vorschlaege}
                      onChange={b => onWurzel(ersetzeBedingungAn(wurzel, kindPfad, b))}
                      aktionen={kindAktionen}
                    />
                  )}
                </div>
              </div>
              {marke(i + 1)}
            </div>
          );
        })}

        {kinder.length === 0 && dropErlaubt && (
          <div
            aria-hidden
            className={`${UNTER_RINNE} my-1 rounded py-1 text-center text-[11px] text-[var(--tf-text-secondary)]`}
            style={{ border: '1px dashed var(--tf-primary)' }}
          >
            hierher ziehen
          </div>
        )}

        <div className={`flex items-center gap-1 pt-0.5 ${UNTER_RINNE}`}>
          <Button
            variant="ghost" size="xs" icon={Plus}
            onClick={() => ergaenzeKind({ feldId: ersteSpalte, op: 'gefuellt' })}
          >
            Bedingung
          </Button>
        </div>
      </div>
    </div>
  );
}

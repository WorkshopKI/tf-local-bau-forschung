/**
 * Struktureller Bedingungs-Editor — verschachtelte UND/ODER-Gruppen, je Blatt
 * Feld · Operator · Wert (siehe [BlattZeile.tsx](./BlattZeile.tsx)).
 *
 * Die Komponente ist bewusst domänenfrei gegenüber den Meilensteinen: sie kennt
 * nur `Bedingung`. Deshalb bedient dieselbe Datei auch den Regel-Tab des
 * Status-Cockpits und den Dialog „Eigene Spalte".
 *
 * **Die Hierarchie ist nachträglich änderbar** (v5.2). Bis dahin war sie beim
 * Anlegen zementiert: kein Ein-/Ausrücken, kein Umsortieren, kein Ziehen, und
 * ab Stufe 2 verschwand „+ Gruppe" wortlos. Der Umbau selbst rechnet nicht
 * hier, sondern in der reinen [bedingung-baum.ts](../../core/status/bedingung-baum.ts);
 * diese Datei hält nur den Zeiger darauf, welcher Knoten gemeint ist — einen
 * **Kind-Index-Pfad**, weil `Bedingung` keine Ids kennt.
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
  rueckeBedingungAus, rueckeBedingungEin, verschiebeBedingung,
  verschiebeBedingungsGeschwister,
  type Bedingung, type BedingungsGruppe, type BedingungsPfad,
} from '@/core/status';
import type { SpaltenEintrag } from '@/core/meilensteine';
import { BlattZeile, type Blatt, type FeldPruefung } from './BlattZeile';
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

/** Wohin ein gezogener Knoten fällt: in diese Liste, an diese Stelle. */
interface DropZiel { elternPfad: BedingungsPfad; index: number }

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
}

/**
 * Die Einfüge-Marke zwischen zwei Geschwistern. Zeilen selbst sind **keine**
 * Drop-Ziele: „auf die Zeile" wäre zwischen „davor" und „hinein" nicht zu
 * unterscheiden, und die Regel bekäme beim Loslassen eine andere Bedeutung, als
 * die Geste zeigte. In eine Gruppe hinein führt deren eigene Marke.
 */
function Marke({ elternPfad, index, aktiv, erlaubt, setZiel, onAblegen }: {
  elternPfad: BedingungsPfad;
  index: number;
  aktiv: boolean;
  erlaubt: boolean;
  setZiel: (z: DropZiel | null) => void;
  onAblegen: () => void;
}): React.ReactElement {
  return (
    <div
      onDragOver={e => {
        if (!erlaubt) return;
        e.preventDefault();
        e.stopPropagation();
        setZiel({ elternPfad, index });
      }}
      onDrop={e => { if (!erlaubt) return; e.preventDefault(); e.stopPropagation(); onAblegen(); }}
      aria-hidden
      className="h-[5px] -my-[2px] rounded-full"
      style={aktiv ? { background: 'var(--tf-primary)' } : undefined}
    />
  );
}

function Gruppe(p: BaumProps): React.ReactElement {
  const {
    wurzel, pfad, spalten, pruefeFeld, vorschlaege, onWurzel,
    gezogen, ziel, setGezogen, setZiel, onAblegen,
  } = p;
  const knoten = holeBedingungAn(wurzel, pfad);
  if (!knoten || !istBedingungsGruppe(knoten)) return <></>;
  const gruppe: BedingungsGruppe = knoten;
  const kinder = gruppenKinder(gruppe);
  const istUnd = 'alle' in gruppe;
  const tiefe = pfad.length;
  const istWurzel = tiefe === 0;
  const ersteSpalte = spalten[0]?.feldId ?? 'status';
  const darfTiefer = tiefe < MAX_TIEFE;

  const setzeGruppe = (g: Bedingung): void => onWurzel(ersetzeBedingungAn(wurzel, pfad, g));
  const ergaenzeKind = (kind: Bedingung): void =>
    onWurzel(fuegeBedingungEin(wurzel, pfad, kinder.length, kind));

  /** Darf hier abgelegt werden? Nicht in den eigenen Teilbaum. */
  const dropErlaubt = !!gezogen && darfBedingungVerschieben(wurzel, gezogen, pfad);

  const marke = (index: number): React.ReactElement => (
    <Marke
      elternPfad={pfad} index={index}
      aktiv={!!ziel && ziel.index === index && gleich(ziel.elternPfad, pfad)}
      erlaubt={dropErlaubt}
      setZiel={setZiel} onAblegen={onAblegen}
    />
  );

  return (
    <div
      className="flex flex-col gap-1 rounded px-2 py-1"
      style={istWurzel ? { background: 'var(--tf-bg)' } : feldStil}
    >
      <div className="flex items-center gap-1">
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
      </div>

      <div className="flex flex-col pl-2.5 border-l border-[var(--tf-border)]">
        {marke(0)}
        {kinder.map((kind, i) => {
          const kindPfad = [...pfad, i];
          const aktionen = (
            <ZeilenAktionen
              was={istBedingungsGruppe(kind) ? 'Gruppe' : 'Bedingung'}
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
              onHoch={() => onWurzel(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'hoch'))}
              onRunter={() => onWurzel(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'runter'))}
              onEinruecken={() => onWurzel(rueckeBedingungEin(wurzel, kindPfad))}
              onAusruecken={() => onWurzel(rueckeBedingungAus(wurzel, kindPfad))}
              onEntfernen={() => onWurzel(entferneBedingungAn(wurzel, kindPfad))}
            />
          );
          const wirdGezogen = !!gezogen && gleich(gezogen, kindPfad);
          return (
            <div key={i} style={wirdGezogen ? { outline: '1px dashed var(--tf-border-hover)' } : undefined}>
              {istBedingungsGruppe(kind) ? (
                <div className="flex items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <Gruppe {...p} pfad={kindPfad} />
                  </div>
                  <span className="pt-1.5">{aktionen}</span>
                </div>
              ) : (
                <BlattZeile
                  blatt={kind as Blatt}
                  spalten={spalten}
                  pruefeFeld={pruefeFeld}
                  vorschlaege={vorschlaege}
                  onChange={b => onWurzel(ersetzeBedingungAn(wurzel, kindPfad, b))}
                  aktionen={aktionen}
                />
              )}
              {marke(i + 1)}
            </div>
          );
        })}

        <div className="flex items-center gap-1 pt-0.5">
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

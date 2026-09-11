/**
 * Struktureller Bedingungs-Editor — verschachtelte UND/ODER-Gruppen, je Blatt
 * Feld · Operator · Wert (siehe [BlattZeile.tsx](./BlattZeile.tsx)).
 *
 * Die Komponente ist bewusst domänenfrei gegenüber den Meilensteinen: sie kennt
 * nur `Bedingung`. Deshalb bedient dieselbe Datei auch den Regel-Tab des
 * Status-Cockpits und den Dialog „Eigene Spalte".
 *
 * **Die Hierarchie ist nachträglich änderbar** (v5.3). Der Umbau selbst rechnet
 * nicht hier, sondern in der reinen [bedingung-baum.ts](../../core/status/bedingung-baum.ts);
 * diese Datei hält nur den Zeiger darauf, welcher Knoten gemeint ist — einen
 * **Kind-Index-Pfad**, weil `Bedingung` keine Ids kennt.
 *
 * **Geschwister sehen wie Geschwister aus** (v6.3): das Verknüpfungs-Wort steht
 * in der linken Rinne jeder Zeile ([BedingungsFugen.tsx](./BedingungsFugen.tsx))
 * — man liest wörtlich „A und B und (PreCheck AB) und C".
 *
 * **Benannte Kästen** (v6.59). Die PL fand den Bereich beim ersten Anlegen
 * „nicht intuitiv und übersichtlich genug, gerade bei verschachtelten Gruppen".
 * Vier Dinge antworten darauf:
 * - Eine Gruppe trägt einen **Namen**, direkt im Kopf editierbar; ohne Namen
 *   steht „Gruppe n" als Platzhalter. Der Name steht auch im Kurzsatz
 *   („PreCheck AB: (…)") und hat keine Wirkung auf die Auswertung.
 * - **Ein Vokabular**: der Kopf schaltet „alle | eine", die Rinne sagt „und /
 *   oder" als sein Echo. Vorher standen ALLE/EINE im Kopf und UND/ODER in der
 *   Rinne — zwei Wortfamilien für eine Sache, und ein Dropdown für zwei Werte.
 * - Gruppen lassen sich **zuklappen** und zeigen dann ihren Kurzsatz.
 * - Die Umbau-Schalter stehen in einem **⋯-Menü** direkt am Inhalt statt als
 *   sieben Icons am rechten Rand ([ZeilenAktionen.tsx](./ZeilenAktionen.tsx)).
 *
 * **Zuklappen hängt am Pfad** — und Pfade sind flüchtig: nach einem Umbau der
 * Struktur (verschieben, ein-/ausrücken, verpacken, entfernen, ablegen) zeigt
 * ein gemerkter Pfad auf einen anderen Knoten. Deshalb läuft jeder solche
 * Umbau über `umbau()`, das die Klappen zurücksetzt. Anhängen, Umbenennen,
 * Umschalten und Blatt-Änderungen verschieben keinen Pfad und behalten sie.
 *
 * **Warum kein `TfTree`.** Er wäre die architekturtreue Wahl für einen Baum mit
 * Ziehen — liefe im Meilenstein-Tab aber INNERHALB des `body`-Slots des äußeren
 * `TfTree`, also zwei Drag-Instanzen im selben Ereignispfad, deren Drop-Ziele
 * sich überlagern. Dazu kommt, dass Pfad-Ids sich bei jeder Bearbeitung ändern
 * und den Aufklapp-/Auswahl-Zustand eines Baums damit bei jedem Tastendruck
 * zerrissen. Was hier steht, ist ein **Formular** mit Verschachtelung. Die
 * Drag-Ereignisse werden an der Wurzel dieses Editors gestoppt, damit der
 * äußere Baum sie nicht als Meilenstein-Zug missversteht.
 */
import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import type { FeldWaehlerVorschlag } from '@/components/ui/FeldWaehler';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { bedingungQuellen } from '@/core/status/bedingung-quellen';
import {
  MAX_GRUPPENNAME, alsBedingungsGruppe, bedingungSatz, benenneBedingungsGruppe,
  darfBedingungAusruecken, darfBedingungEinruecken,
  darfBedingungVerschieben, entferneBedingungAn, ersetzeBedingungAn, fuegeBedingungEin,
  gruppenKinder, holeBedingungAn, istBedingungsGruppe, mitVerknuepfung,
  rueckeBedingungAus, rueckeBedingungEin, verknuepfungVon, verpackeBedingungInGruppe,
  verschiebeBedingung, verschiebeBedingungsGeschwister,
  type Bedingung, type BedingungsGruppe, type BedingungsPfad, type Verknuepfung,
} from '@/core/status';
import type { SpaltenEintrag } from '@/core/meilensteine';
import { BlattZeile, type Blatt, type FeldPruefung } from './BlattZeile';
import { Marke, Rinne, type DropZiel } from './BedingungsFugen';
import { ZeilenAktionen } from './ZeilenAktionen';
import { spaltenLabel } from './labels';

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

const VERKNUEPFUNGEN = [
  { id: 'alle' as const, label: 'alle' },
  { id: 'einige' as const, label: 'eine' },
];

const gleich = (a: BedingungsPfad, b: BedingungsPfad): boolean =>
  a.length === b.length && a.every((x, i) => b[i] === x);

const pfadSchluessel = (p: BedingungsPfad): string => p.join('.');

export function BedingungEditor({ bedingung, spalten, pruefeFeld, vorschlaege, probe, onChange }: {
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
  /**
   * Was eine Gruppe am Bestand trifft — vom Aufrufer gerendert, hier nur
   * platziert (im Kopf jeder Gruppe außer der Wurzel). Der Editor weiß nicht,
   * gegen welchen Bestand gezählt wird; die Meilensteine zählen die aktuelle
   * Richtlinie, andere Aufrufer reichen nichts herein.
   *
   * Die Wurzel bekommt bewusst keine Zahl: für sie steht die Zahl des ganzen
   * Meilensteins daneben, und die rechnet mit Unter-Meilensteinen — zwei
   * verschiedene Zahlen für scheinbar dasselbe wären ein Widerspruch.
   */
  probe?: (gruppe: Bedingung) => React.ReactNode;
  onChange: (b: Bedingung) => void;
}): React.ReactElement {
  // Ein Blatt als Wurzel wird angehoben, damit immer eine Verknüpfung sichtbar
  // ist. Der Aufrufer bekommt danach ebenfalls eine Gruppe zurück.
  const wurzel: Bedingung = alsBedingungsGruppe(bedingung);
  const [gezogen, setGezogen] = useState<BedingungsPfad | null>(null);
  const [ziel, setZiel] = useState<DropZiel | null>(null);
  const [zu, setZu] = useState<ReadonlySet<string>>(() => new Set());
  const labelVon = useMemo(() => spaltenLabel(spalten), [spalten]);

  /** Ein Umbau der Struktur: gemerkte Klappen zeigen danach auf andere Knoten. */
  const umbau = (neu: Bedingung): void => {
    setZu(new Set());
    onChange(neu);
  };

  const schalteZu = (pfad: BedingungsPfad): void => setZu(vorher => {
    const neu = new Set(vorher);
    const k = pfadSchluessel(pfad);
    if (neu.has(k)) neu.delete(k); else neu.add(k);
    return neu;
  });

  const beendeZug = (): void => { setGezogen(null); setZiel(null); };

  const ablegen = (): void => {
    if (gezogen && ziel && darfBedingungVerschieben(wurzel, gezogen, ziel.elternPfad)) {
      umbau(verschiebeBedingung(wurzel, gezogen, ziel.elternPfad, ziel.index));
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
        probe={probe}
        labelVon={labelVon}
        zu={zu}
        schalteZu={schalteZu}
        onWurzel={onChange}
        onUmbau={umbau}
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
  probe?: (gruppe: Bedingung) => React.ReactNode;
  labelVon: (feldId: string) => string;
  /** Pfade der zugeklappten Gruppen. */
  zu: ReadonlySet<string>;
  schalteZu: (pfad: BedingungsPfad) => void;
  /** Änderung ohne Pfad-Verschiebung (Blatt, Name, Verknüpfung, Anhängen). */
  onWurzel: (b: Bedingung) => void;
  /** Änderung der Struktur — setzt die Klappen zurück. */
  onUmbau: (b: Bedingung) => void;
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
    wurzel, pfad, spalten, pruefeFeld, vorschlaege, probe, labelVon, zu, schalteZu,
    onWurzel, onUmbau, gezogen, ziel, setGezogen, setZiel, onAblegen, aktionen, nummer,
  } = p;
  const knoten = holeBedingungAn(wurzel, pfad);
  if (!knoten || !istBedingungsGruppe(knoten)) return <></>;
  const gruppe: BedingungsGruppe = knoten;
  const kinder = gruppenKinder(gruppe);
  const verknuepfung = verknuepfungVon(gruppe);
  const istUnd = verknuepfung === 'alle';
  const wort = istUnd ? 'und' : 'oder';
  const tiefe = pfad.length;
  const istWurzel = tiefe === 0;
  const zugeklappt = !istWurzel && zu.has(pfadSchluessel(pfad));
  const platzhalter = `Gruppe ${nummer ?? 1}`;
  const anzeigeName = gruppe.name ?? platzhalter;
  const ersteSpalte = spalten[0]?.feldId ?? 'status';
  const darfTiefer = tiefe < MAX_TIEFE;

  const setzeVerknuepfung = (v: Verknuepfung): void =>
    onWurzel(ersetzeBedingungAn(wurzel, pfad, mitVerknuepfung(gruppe, v)));
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

  // Der Kurzsatz der zugeklappten Gruppe — ohne ihren Namen, der steht schon
  // im Eingabefeld davor. Nur Anzeige, nichts davon wird gespeichert.
  const ohneName: Bedingung = istUnd ? { alle: kinder } : { einige: kinder };
  const kurzsatz = zugeklappt && kinder.length > 0 ? bedingungSatz(ohneName, labelVon) : '';
  const verknuepfungsText = istUnd ? 'alle müssen zutreffen' : 'eine genügt';

  return (
    <div
      className="flex flex-col gap-1 rounded px-2 py-1"
      style={{
        ...(istWurzel
          ? { background: 'var(--tf-bg)' }
          : { background: 'var(--tf-bg-secondary)', border: '0.5px solid var(--tf-border)' }),
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
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {!istWurzel && (
          <button
            type="button"
            onClick={() => schalteZu(pfad)}
            aria-expanded={!zugeklappt}
            aria-label={`${anzeigeName} ${zugeklappt ? 'aufklappen' : 'zuklappen'}`}
            title={zugeklappt ? 'Aufklappen' : 'Zuklappen — die Gruppe zeigt dann ihren Kurzsatz'}
            className="p-0.5 rounded cursor-pointer text-[var(--tf-text-secondary)]
              hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
          >
            {zugeklappt ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
        {!istWurzel && (
          // `key`: ein von außen geänderter Name (Laden, Fassung übernehmen)
          // setzt den Entwurf im Feld zurück.
          <GruppenName
            key={gruppe.name ?? ''}
            name={gruppe.name ?? ''}
            platzhalter={platzhalter}
            onBenenne={name => onWurzel(benenneBedingungsGruppe(wurzel, pfad, name))}
          />
        )}

        {zugeklappt && kinder.length === 0 && (
          <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{verknuepfungsText} · leer</span>
        )}
        {zugeklappt && kinder.length > 0 && (
          // Wie die zugeklappte Meilenstein-Zeile: der Tooltip nennt die
          // Quellspalten — „TIB gefüllt" sagt nicht, welche CSV-Spalte dahinter
          // steht, und genau dort entstehen die falschen Regeln.
          <QuellSpaltenTooltip
            erklaere={idx => bedingungQuellen(ohneName, idx, labelVon)}
            wrapperClassName="min-w-0 max-w-[560px] truncate"
          >
            <span className="block cursor-help truncate text-[11.5px] text-[var(--tf-text-secondary)]">
              {verknuepfungsText} · {kurzsatz}
            </span>
          </QuellSpaltenTooltip>
        )}
        {!zugeklappt && (
          <>
            <SegmentedToggle
              dicht rolle="auswahl" ariaLabel="Verknüpfung"
              value={verknuepfung} options={VERKNUEPFUNGEN} onChange={setzeVerknuepfung}
            />
            <span className="text-[12px] text-[var(--tf-text-secondary)]">
              {istWurzel
                ? (istUnd ? 'der folgenden zutreffen' : 'der folgenden zutrifft')
                : (istUnd ? 'müssen zutreffen' : 'genügt')}
            </span>

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
          </>
        )}

        {!istWurzel && probe && <span className="shrink-0">{probe(gruppe)}</span>}
        {aktionen && <span className="shrink-0">{aktionen}</span>}
      </div>

      {!zugeklappt && (
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
                onHoch={() => onUmbau(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'hoch'))}
                onRunter={() => onUmbau(verschiebeBedingungsGeschwister(wurzel, kindPfad, 'runter'))}
                onEinruecken={() => onUmbau(rueckeBedingungEin(wurzel, kindPfad))}
                onAusruecken={() => onUmbau(rueckeBedingungAus(wurzel, kindPfad))}
                onVerpacken={() => onUmbau(verpackeBedingungInGruppe(wurzel, kindPfad, 'alle'))}
                onEntfernen={() => onUmbau(entferneBedingungAn(wurzel, kindPfad))}
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
            {/* Der Knopf nennt sein Ziel: bei drei verschachtelten Gruppen war
                „+ Bedingung" nicht anzusehen, WOHIN sie kommt. */}
            <Button
              variant="ghost" size="xs" icon={Plus}
              onClick={() => ergaenzeKind({ feldId: ersteSpalte, op: 'gefuellt' })}
            >
              {istWurzel ? 'Bedingung' : `Bedingung in „${anzeigeName}"`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Der Name einer Gruppe, direkt im Kopf editierbar.
 *
 * Übernommen wird mit Enter oder beim Verlassen, Esc verwirft — nicht bei jedem
 * Tastendruck: jede Übernahme ist eine Änderung am Plan, und ein halb getippter
 * Name soll nicht zwischendurch im Kurzsatz stehen.
 *
 * Ohne Namen steht der Platzhalter „Gruppe n" da (1-basiert unter den
 * Geschwister-Gruppen). Er wird nicht gespeichert und wandert mit der Position.
 * Die gestrichelte Unterkante sagt, dass hier etwas einzugeben ist; sonst läse
 * sich der Platzhalter wie eine feste Beschriftung.
 */
function GruppenName({ name, platzhalter, onBenenne }: {
  name: string;
  platzhalter: string;
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
      title="Name der Gruppe — steht auch im Kurzsatz. Enter übernimmt, Esc verwirft."
      className="min-w-0 rounded-sm px-1 py-0.5 bg-transparent text-[12.5px] font-medium text-[var(--tf-text)]
        placeholder:font-medium placeholder:text-[var(--tf-text-secondary)]
        hover:bg-[var(--tf-bg)] focus:bg-[var(--tf-bg)] focus:outline-1 focus:outline-[var(--tf-primary)]"
      style={{ width: `${breite}ch`, borderBottom: '0.5px dashed var(--tf-border-hover)' }}
    />
  );
}

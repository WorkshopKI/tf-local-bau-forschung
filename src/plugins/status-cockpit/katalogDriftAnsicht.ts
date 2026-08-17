/**
 * Das **Ansichts-Modell** der Katalog-Drift — ohne React, damit es prüfbar ist.
 *
 * Die Bilanz erscheint an einer Stelle in zwei Gestalten: als ein Satz über dem
 * Ansichtsumschalter und als aufgeklappte Aufzählung darunter. Beide beschreiben
 * dieselben Zahlen; stünden sie in der Komponente, wäre die Grammatik ungetestet
 * und die kurze Fassung könnte irgendwann etwas anderes behaupten als die lange.
 *
 * **Wortwahl.** „gegenüber der Auslieferung", nicht „Abweichung", nicht
 * „Konflikt", nicht „veraltet". Der kuratierte Schnitt ist der spätere Stand,
 * nicht der falsche — die Bilanz ist die Grundlage für den späteren Abgleich mit
 * dem Code, keine Mängelliste.
 *
 * Rein: keine IO, keine Uhr, kein React.
 */
import { zaehlwort } from '@/core/utils/zaehlwort';
import { katalogDrift, zahPhaseLabel } from '@/core/status';
import type {
  KatalogDrift, MappingVersion, PhasenPaket, UebernahmeBericht, ZahPhase, ZahPhaseId,
} from '@/core/status';
import { PROMINENZ_LABEL } from './labels';

/** Der Satz, der im ausgeklappten Bereich steht — wofür die Bilanz da ist. */
export const DRIFT_ZWECK = 'Diese Aufstellung hält fest, wie weit die gepflegte Fassung vom '
  + 'ausgelieferten Stand entfernt ist. Sie ist die Grundlage für den späteren Abgleich mit dem '
  + 'Programm — nichts davon wird automatisch übernommen oder zurückgesetzt.';

/**
 * Die einzeilige Bilanz, ohne die Einleitung „Gegenüber der Auslieferung:".
 *
 * Innerhalb der Phasen trägt nur die ERSTE Angabe das Substantiv („1 Phase
 * entfernt · 2 umbenannt"); die Wiederholung läse sich wie fünf verschiedene
 * Gegenstände. Die übrigen Gruppen benennen ihren eigenen.
 *
 * Leer, wenn es nichts zu berichten gibt — die Zeile erscheint dann gar nicht.
 */
export function driftSatz(d: KatalogDrift): string {
  const p = d.phasen;
  const phasenTeile: { n: number; wort: string }[] = [
    { n: p.entfernt.length, wort: 'entfernt' },
    { n: p.hinzugefuegt.length, wort: 'hinzugefügt' },
    { n: p.umbenannt.length, wort: 'umbenannt' },
    { n: p.umsortiert.length, wort: 'umsortiert' },
    { n: p.vorgabeGeaendert.length, wort: 'mit geänderter Vorgabe' },
  ].filter(t => t.n > 0);

  const teile = [
    ...phasenTeile.map((t, i) => (i === 0
      ? `${zaehlwort(t.n, 'Phase', 'Phasen')} ${t.wort}`
      : `${t.n} ${t.wort}`)),
    ...(d.zuordnungen.length > 0
      ? [`${zaehlwort(d.zuordnungen.length, 'Zuordnung', 'Zuordnungen')} geändert`] : []),
    ...(d.zieltage.length > 0
      ? [`${zaehlwort(d.zieltage.length, 'Zieltag', 'Zieltage')} gepflegt`] : []),
    ...(d.statuswerte.stillgelegt.length > 0
      ? [`${zaehlwort(d.statuswerte.stillgelegt.length, 'Wert', 'Werte')} stillgelegt`] : []),
    ...(d.statuswerte.wiederAktiviert.length > 0
      ? [`${zaehlwort(d.statuswerte.wiederAktiviert.length, 'Wert', 'Werte')} wieder aktiviert`] : []),
    ...(d.prominenz.length > 0
      ? [`${zaehlwort(d.prominenz.length, 'Prominenz', 'Prominenzen')} geändert`] : []),
  ];
  return teile.join(' · ');
}

/** Wie viele fremde Codes/Kürzel beim Namen genannt werden, bevor abgekürzt
 *  wird. Eine Liste, die über die Zeile hinausläuft, wird nicht gelesen. */
const NAMENTLICH_MAX = 8;

function auflistung(namen: readonly (string | number)[]): string {
  const gezeigt = namen.slice(0, NAMENTLICH_MAX).join(', ');
  return namen.length > NAMENTLICH_MAX
    ? `${gezeigt} … und ${namen.length - NAMENTLICH_MAX} weitere`
    : gezeigt;
}

/**
 * Der Satz nach einer Phasen-Übernahme — **dieselbe Grammatik wie die Bilanz**,
 * nur mit einem anderen Bezugspunkt: nicht „gegenüber der Auslieferung", sondern
 * „gegenüber dem Stand von eben". Deshalb `driftSatz` über (nachher, vorher)
 * statt eine zweite Zählweise für dieselben Zahlen.
 *
 * Was die Bilanz nicht misst, steht daneben: die umgehängten Datums-Kürzel (die
 * Drift kennt nur die Statuswert-Achse) und was das Paket nannte, ohne dass es
 * hier existiert. Letzteres ist der Satz, der einen falschen Datenstand verrät —
 * er muss dastehen, auch wenn sonst alles glattging.
 */
export function uebernahmeSatz(
  paket: PhasenPaket,
  bericht: UebernahmeBericht,
  vorher: MappingVersion,
  nachher: MappingVersion,
): string {
  if (bericht.fehler.length > 0) {
    return `Phasen aus v${paket.herkunft.fassung} nicht übernommen: ${bericht.fehler.join(' ')}`;
  }

  const bilanz = driftSatz(katalogDrift(nachher, vorher));
  const teile = [
    ...(bilanz === '' ? [] : [bilanz]),
    ...(bericht.felder > 0
      ? [`${zaehlwort(bericht.felder, 'Kürzel', 'Kürzel')} umgehängt`] : []),
  ];
  const kopf = teile.length > 0
    ? `Phasen aus v${paket.herkunft.fassung} übernommen: ${teile.join(' · ')}.`
    : `Phasen aus v${paket.herkunft.fassung} übernommen — der Schnitt stand hier schon so.`;

  // Verwaiste zuerst: sie sind das Einzige hier, wozu jemand etwas TUN kann.
  const verwaist = bericht.verwaist.werte + bericht.verwaist.felder;
  const rest = [
    ...(verwaist > 0
      ? [`${zaehlwort(verwaist, 'Zuordnung zeigt', 'Zuordnungen zeigen')} jetzt auf einen `
        + 'Schritt, den dieser Zuschnitt nicht mehr führt — im Baum unter „Ohne Phase" '
        + 'als verwaist markiert.'] : []),
    ...(bericht.unbekannteCodes.length > 0
      ? [`${zaehlwort(bericht.unbekannteCodes.length, 'Code', 'Codes')} aus dem Paket `
        + `kennt dieser Katalog nicht (${auflistung(bericht.unbekannteCodes)}).`] : []),
    ...(bericht.unbekannteFelder.length > 0
      ? [`${zaehlwort(bericht.unbekannteFelder.length, 'Kürzel', 'Kürzel')} aus dem Paket `
        + `fehlt hier (${auflistung(bericht.unbekannteFelder)}).`] : []),
  ];

  return [kopf, ...rest].join(' ');
}

/** Eine Zeile der Aufstellung. Die Id kommt aus den Daten, nie aus dem Text:
 *  zwei Katalogzeilen desselben Codes können denselben Satz ergeben. */
export interface DriftZeile {
  id: string;
  text: string;
}

/** Eine Gruppe der ausgeklappten Aufstellung. */
export interface DriftGruppe {
  titel: string;
  zeilen: DriftZeile[];
}

/** Anführungszeichen wie im Rest der Oberfläche. */
function q(s: string): string {
  return `„${s}“`;
}

/** 0-basierte Position als Ordnungszahl — „an 5. Stelle" statt „an Position 4". */
function stelle(i: number): string {
  return `${i + 1}.`;
}

/**
 * Die Einzelheiten, nach den Gruppen der Bilanz sortiert.
 *
 * Die Phasen-Beschriftungen der Zuordnungen werden aus BEIDEN Seiten aufgelöst:
 * links die ausgelieferte, rechts die gepflegte. Nähme man nur eine, hieße eine
 * umbenannte Zielphase auf beiden Seiten gleich und die Zeile sähe aus wie
 * „Prüfung → Prüfung".
 */
export function driftGruppen(
  d: KatalogDrift,
  fassungPhasen: readonly ZahPhase[] | undefined,
  seedPhasen: readonly ZahPhase[] | undefined,
): DriftGruppe[] {
  const alt = (id: ZahPhaseId | null): string => zahPhaseLabel(id, seedPhasen);
  const neu = (id: ZahPhaseId | null): string => zahPhaseLabel(id, fassungPhasen);

  const p = d.phasen;
  const phasenZeilen: DriftZeile[] = [
    ...p.entfernt.map(x => ({ id: `entfernt:${x.id}`, text: `${q(x.label)} entfernt` })),
    ...p.hinzugefuegt.map(x => ({ id: `neu:${x.id}`, text: `${q(x.label)} hinzugefügt` })),
    ...p.umbenannt.map(x => ({
      id: `umbenannt:${x.id}`, text: `${q(x.alt)} heißt jetzt ${q(x.neu)}`,
    })),
    ...p.umsortiert.map(x => ({
      id: `umsortiert:${x.id}`,
      text: `${q(x.label)} steht an ${stelle(x.nachher)} statt an ${stelle(x.vorher)} Stelle`,
    })),
    // Die Arbeitsliste stand hier bis v4.86 als zweiter Teil daneben; sie hängt
    // seit v4.87 am Code und kann zwischen Fassungen nicht mehr abweichen.
    ...p.vorgabeGeaendert.map(x => ({
      id: `vorgabe:${x.id}`,
      text: `${q(x.label)}: `
        + `${x.zieltageRelevant?.neu ? 'Zieltage gelten jetzt' : 'Zieltage gelten nicht mehr'}`
        + ` (${zaehlwort(x.codeAnzahl, 'Code', 'Codes')})`,
    })),
  ];

  return [
    { titel: 'Verfahrensschritte', zeilen: phasenZeilen },
    {
      titel: 'Zuordnungen',
      zeilen: d.zuordnungen.map(z => ({
        id: `zuordnung:${z.code}`,
        text: `${z.code}${z.bezeichnung ? ` ${z.bezeichnung}` : ''}: `
          + `${alt(z.vorher)} → ${neu(z.nachher)}`,
      })),
    },
    {
      titel: d.seedKenntZieltage
        ? 'Zieltage'
        : 'Zieltage (die Auslieferung führt keine)',
      zeilen: d.zieltage.map(z => ({
        id: `zieltag:${z.id}`,
        text: `${z.code !== null ? `${z.code} ` : ''}${z.wert}: `
          + `${zaehlwort(z.neu, 'Tag', 'Tage')}${z.alt !== null ? ` (war ${z.alt})` : ''}`,
      })),
    },
    {
      titel: 'Statuswerte',
      zeilen: [
        ...d.statuswerte.stillgelegt.map(w => ({
          id: `still:${w.id}`, text: `${w.wert} stillgelegt`,
        })),
        ...d.statuswerte.wiederAktiviert.map(w => ({
          id: `aktiv:${w.id}`, text: `${w.wert} wieder aktiviert`,
        })),
      ],
    },
    {
      titel: 'Prominenz',
      zeilen: d.prominenz.map(x => ({
        id: `prominenz:${x.id}`,
        text: `${x.wert}: ${PROMINENZ_LABEL[x.alt]} → ${PROMINENZ_LABEL[x.neu]}`,
      })),
    },
  ].filter(g => g.zeilen.length > 0);
}

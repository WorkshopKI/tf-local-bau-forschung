/**
 * Der Ist-Termin eines Meilensteins als Satz — für genau DIESE Regel.
 *
 * Die Regel selbst rechnet die Bewertung (`erfuellungsDatum`, v6.59.2): ein Blatt
 * liefert das früheste Datum seines Feldes über die Teilvorhaben, „alle" das
 * späteste seiner Teile, „eine" das früheste der erfüllten. `IST_AUS_BEDINGUNG`
 * sagt das allgemein; dieser Satz übersetzt es auf die Regel, die gerade
 * dasteht („das spätere Datum von „PreCheck AB" und „PreCheck FB"; je Gruppe das
 * frühere ihrer gefüllten Datumsspalten").
 *
 * **Und er sagt, wenn aus der Bedingung gar kein Datum kommen KANN.** MST 2 prüft
 * die Kürzel TIB und BIB, MST 5 nur den Status — beide Meilensteine gelten dann
 * als „erreicht ohne Termin", und die Abweichung der Auswertung bleibt für immer
 * leer. Gemessen im ausgelieferten Plan (11.09.2026), bis dahin von niemandem
 * bemerkt.
 *
 * Rein: kein React, keine Probe. Welche Felder Datumsspalten sind, reicht der
 * Aufrufer herein ({@link istDatumsFeldAus}).
 */
import {
  gruppenKinder, istBedingungsGruppe, verknuepfungVon, type Bedingung, type Verknuepfung,
} from '@/core/status';
import type { SpaltenEintrag } from './spalten-katalog';

export interface IstTerminErklaerung {
  /** Der Satz für genau diese Regel. */
  text: string;
  /** Aus der Bedingung kann kein Datum kommen — der Meilenstein bliebe ohne Termin. */
  keinDatum: boolean;
}

type Blatt = Extract<Bedingung, { feldId: string }>;

/**
 * Welche Felder tragen ein Datum? Laut Spalten-Katalog (`typ: 'datum'`) — oder
 * nach der Code-Konvention des Fachsystems: `D_…` ist eine Datumsspalte, auch wo
 * das Inventar sie aus seinen Stichproben als „wert" führt (D_XPC-, D_ALS u. a.,
 * gemessen 11.09.2026). Die Bewertung liest jeden Wert ohnehin über
 * `parseGermanDate`; die Frage hier ist nur, ob ein Datum zu ERWARTEN ist.
 */
export function istDatumsFeldAus(spalten: readonly SpaltenEintrag[]): (feldId: string) => boolean {
  const datum = new Set(spalten.filter(s => s.typ === 'datum').map(s => s.feldId));
  return feldId => datum.has(feldId) || feldId.startsWith('D_');
}

/**
 * Misst dieser Meilenstein nur einen **Zeitpunkt**? Seine Regel verlangt allein,
 * dass das Ist-Termin-Feld gefüllt ist — MST 9 „Antrag im System eingegeben":
 * „Antrags eingang gefüllt", Ist-Termin = Antragseingang. So eine Regel SOLL bei
 * jedem Verbund zutreffen; ein Befund „trifft jeden Verbund" wäre dort Lärm, der
 * die echten Befunde (MST 4.3, gemessen 11.09.2026) entwertet.
 */
export function misstNurZeitpunkt(b: Bedingung, istDatumFeld: string | undefined): boolean {
  if (!istDatumFeld) return false;
  let kern: Bedingung = b;
  while (istBedingungsGruppe(kern) && gruppenKinder(kern).length === 1) kern = gruppenKinder(kern)[0] as Bedingung;
  return !istBedingungsGruppe(kern) && kern.op === 'gefuellt' && kern.feldId === istDatumFeld;
}

function blaetter(b: Bedingung, out: Blatt[] = []): Blatt[] {
  if (istBedingungsGruppe(b)) for (const k of gruppenKinder(b)) blaetter(k, out);
  else out.push(b);
  return out;
}

function traegtDatum(b: Bedingung, istDatum: (feldId: string) => boolean): boolean {
  return istBedingungsGruppe(b) ? gruppenKinder(b).some(k => traegtDatum(k, istDatum)) : istDatum(b.feldId);
}

function komparativ(v: Verknuepfung, anzahl: number): string {
  if (v === 'alle') return anzahl > 2 ? 'späteste' : 'spätere';
  return anzahl > 2 ? 'früheste' : 'frühere';
}

function liste(teile: readonly string[]): string {
  if (teile.length <= 1) return teile[0] ?? '';
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

export function istTerminErklaerung(
  b: Bedingung,
  istDatumFeld: string | undefined,
  labelVon: (feldId: string) => string,
  istDatum: (feldId: string) => boolean,
): IstTerminErklaerung {
  if (istDatumFeld) {
    return { text: `Datum aus „${labelVon(istDatumFeld)}", über die Teilvorhaben das früheste.`, keinDatum: false };
  }
  const wurzel = istBedingungsGruppe(b) ? b : { alle: [b] };
  if (!traegtDatum(wurzel, istDatum)) {
    return {
      text: 'Die Bedingung prüft keine Datumsspalte — daraus ergibt sich kein Termin. Bitte ein Datumsfeld wählen.',
      keinDatum: true,
    };
  }

  const kinder = gruppenKinder(wurzel);
  let gruppe = 0;
  const teile = kinder.map(k => {
    if (!istBedingungsGruppe(k)) return { k, name: `„${labelVon(k.feldId)}"` };
    gruppe += 1;
    return { k, name: k.name ? `„${k.name}"` : `Gruppe ${gruppe}` };
  });
  const mitDatum = teile.filter(t => traegtDatum(t.k, istDatum)).map(t => t.name);
  const v = verknuepfungVon(wurzel);
  const saetze: string[] = [mitDatum.length === 1
    ? `das Datum von ${mitDatum[0]}`
    : `das ${komparativ(v, mitDatum.length)} Datum von ${liste(mitDatum)}${v === 'alle' ? '' : ', soweit erfüllt'}`];

  const gruppen = teile.flatMap(t => {
    if (!istBedingungsGruppe(t.k)) return [];
    const d = gruppenKinder(t.k).filter(c => traegtDatum(c, istDatum)).length;
    return d >= 2 ? [{ name: t.name, komp: komparativ(verknuepfungVon(t.k), d) }] : [];
  });
  const erste = gruppen[0];
  if (erste && gruppen.length > 1 && gruppen.every(g => g.komp === erste.komp)) {
    saetze.push(`je Gruppe das ${erste.komp} ihrer gefüllten Datumsspalten`);
  } else {
    for (const g of gruppen) saetze.push(`in ${g.name} das ${g.komp} ihrer gefüllten Datumsspalten`);
  }

  const ohne = [...new Set(blaetter(wurzel).filter(x => !istDatum(x.feldId)).map(x => `„${labelVon(x.feldId)}"`))];
  const nachsatz = ohne.length ? ` ${liste(ohne)} ${ohne.length === 1 ? 'trägt' : 'tragen'} kein Datum.` : '';
  return { text: `Hier: ${saetze.join('; ')}.${nachsatz}`, keinDatum: false };
}

/**
 * Umbau eines `Bedingung`-Baums — Verschieben, Ein-/Ausrücken, Umsortieren.
 *
 * Geschwister von [bedingung.ts](./bedingung.ts) (dem einen Evaluator) und
 * [bedingung-text.ts](./bedingung-text.ts) (dem einen Formatierer): dieselbe
 * Datenstruktur, dritte Frage. Herausgelöst statt in den Editor gelegt, weil
 * Pfad-Arithmetik auf einem verschachtelten Baum genau die Sorte Logik ist, die
 * in einer `.tsx` nicht geprüft wird — hier ist sie rein und getestet.
 *
 * **Adresse ist ein Kind-Index-Pfad**, kein Id: `Bedingung`-Knoten tragen keine
 * Identität (`{ alle: [...] }`), und eine erfundene Id müsste irgendwo
 * mitgespeichert werden. `[0, 2]` heißt „drittes Kind des ersten Kindes der
 * Wurzel". Der leere Pfad `[]` ist die Wurzel selbst.
 *
 * **Pfade sind flüchtig.** Nach jeder Operation kann sich jeder Pfad geändert
 * haben; Aufrufer halten sie nie über eine Änderung hinweg fest.
 *
 * Alle Funktionen sind rein und geben einen NEUEN Baum zurück. Ist eine
 * Operation nicht möglich (Pfad zeigt ins Leere, Regel verletzt), kommt der
 * Baum unverändert zurück — der Editor sperrt seine Schalter ohnehin vorab über
 * die `darf…`-Prädikate, und ein Wurf mitten im Klick-Handler hälfe niemandem.
 *
 * Die Namen tragen ihr Präfix, weil dieses Modul über das App-Barrel
 * (`@/core/status`) läuft und dort schon ein `kinderVon` wohnt — das der
 * Kategorien-Bäume. Zwei gleichnamige Kind-Zugriffe auf zwei verschiedene Bäume
 * wären eine Falle, die erst beim falschen Import auffällt.
 */
import type { Bedingung } from './typen';

/** Adresse eines Knotens: Kind-Indizes von der Wurzel aus. `[]` = Wurzel. */
export type BedingungsPfad = readonly number[];

/** Eine UND- oder ODER-Gruppe, optional benannt. */
export type BedingungsGruppe = Extract<Bedingung, { alle: Bedingung[] } | { einige: Bedingung[] }>;

/** UND (`alle`) oder ODER (`einige`). */
export type Verknuepfung = 'alle' | 'einige';

/**
 * Obergrenze eines Gruppennamens — eine Quelle für Editor und Normalisierung.
 * Ein Name ist ein Etikett im Gruppenkopf und im Kurzsatz, kein Beschreibungsfeld.
 */
export const MAX_GRUPPENNAME = 80;

export function istBedingungsGruppe(b: Bedingung): b is BedingungsGruppe {
  return 'alle' in b || 'einige' in b;
}

export function gruppenKinder(g: BedingungsGruppe): Bedingung[] {
  return 'alle' in g ? g.alle : g.einige;
}

export function verknuepfungVon(g: BedingungsGruppe): Verknuepfung {
  return 'alle' in g ? 'alle' : 'einige';
}

/**
 * Die EINE Stelle, an der eine Gruppe neu entsteht. Jeder Umbau läuft hier
 * durch — deshalb überlebt der Name jeden Umbau, und ein leerer Name wird gar
 * nicht erst geschrieben.
 */
function baueGruppe(v: Verknuepfung, kinder: Bedingung[], name?: string): BedingungsGruppe {
  const g: BedingungsGruppe = v === 'alle' ? { alle: kinder } : { einige: kinder };
  return name ? { ...g, name } : g;
}

/** Dieselbe Verknüpfung, derselbe Name, andere Kinder. */
export function mitGruppenKindern(g: BedingungsGruppe, kinder: Bedingung[]): BedingungsGruppe {
  return baueGruppe(verknuepfungVon(g), kinder, g.name);
}

/**
 * Andere Verknüpfung, dieselben Kinder, derselbe Name. Vorher baute der Editor
 * hier `{ alle: kinder }` von Hand — der Weg, auf dem ein Name beim ersten
 * Umschalten still verloren ginge.
 */
export function mitVerknuepfung(g: BedingungsGruppe, v: Verknuepfung): BedingungsGruppe {
  return baueGruppe(v, gruppenKinder(g), g.name);
}

/**
 * Hebt ein Blatt in eine UND-Gruppe, damit ein Editor immer eine Gruppe zeigt.
 * Eine Gruppe bleibt, wie sie ist.
 */
export function alsBedingungsGruppe(b: Bedingung): BedingungsGruppe {
  return istBedingungsGruppe(b) ? b : { alle: [b] };
}

/** Wie tief liegt der Knoten? Wurzel = 0, ihre Kinder = 1. */
export function bedingungsTiefe(pfad: BedingungsPfad): number {
  return pfad.length;
}

/** Der Knoten an dieser Adresse, oder `null`, wenn der Pfad ins Leere zeigt. */
export function holeBedingungAn(root: Bedingung, pfad: BedingungsPfad): Bedingung | null {
  let aktuell: Bedingung = root;
  for (const i of pfad) {
    if (!istBedingungsGruppe(aktuell)) return null;
    const kind = gruppenKinder(aktuell)[i];
    if (kind === undefined) return null;
    aktuell = kind;
  }
  return aktuell;
}

/**
 * Ersetzt den Knoten an `pfad`. Rekursiv statt in-place, damit der Aufrufer den
 * alten Baum weiterhalten kann (React-Zustand vergleicht Referenzen).
 */
export function ersetzeBedingungAn(
  root: Bedingung,
  pfad: BedingungsPfad,
  neu: Bedingung,
): Bedingung {
  const kopf = pfad[0];
  if (kopf === undefined) return neu;
  if (!istBedingungsGruppe(root)) return root;
  const kinder = gruppenKinder(root);
  if (kinder[kopf] === undefined) return root;
  const rest = pfad.slice(1);
  return mitGruppenKindern(
    root,
    kinder.map((k, i) => (i === kopf ? ersetzeBedingungAn(k, rest, neu) : k)),
  );
}

/** Zerlegt einen Pfad in „Elternpfad" + „Index dort". `null` bei der Wurzel. */
function zerlege(pfad: BedingungsPfad): { eltern: BedingungsPfad; index: number } | null {
  const index = pfad[pfad.length - 1];
  if (index === undefined) return null;
  return { eltern: pfad.slice(0, -1), index };
}

/** Entfernt den Knoten an `pfad`. Die Wurzel selbst lässt sich nicht entfernen. */
export function entferneBedingungAn(root: Bedingung, pfad: BedingungsPfad): Bedingung {
  const teil = zerlege(pfad);
  if (!teil) return root;
  const eltern = holeBedingungAn(root, teil.eltern);
  if (!eltern || !istBedingungsGruppe(eltern)) return root;
  const kinder = gruppenKinder(eltern);
  if (kinder[teil.index] === undefined) return root;
  return ersetzeBedingungAn(
    root,
    teil.eltern,
    mitGruppenKindern(eltern, kinder.filter((_, i) => i !== teil.index)),
  );
}

/**
 * Fügt `knoten` als Kind von `elternPfad` an Position `index` ein. Ein `index`
 * jenseits der Liste hängt hinten an — der Drop auf die letzte Lücke soll nicht
 * wirkungslos sein.
 */
export function fuegeBedingungEin(
  root: Bedingung,
  elternPfad: BedingungsPfad,
  index: number,
  knoten: Bedingung,
): Bedingung {
  const eltern = holeBedingungAn(root, elternPfad);
  if (!eltern || !istBedingungsGruppe(eltern)) return root;
  const kinder = [...gruppenKinder(eltern)];
  const pos = Math.max(0, Math.min(index, kinder.length));
  kinder.splice(pos, 0, knoten);
  return ersetzeBedingungAn(root, elternPfad, mitGruppenKindern(eltern, kinder));
}

/** Liegt `pfad` auf oder unter `moeglicherAhne`? */
export function pfadLiegtUnter(pfad: BedingungsPfad, moeglicherAhne: BedingungsPfad): boolean {
  if (moeglicherAhne.length > pfad.length) return false;
  return moeglicherAhne.every((i, k) => pfad[k] === i);
}

/**
 * Darf `von` unter `elternPfad` gehängt werden?
 *
 * Verboten ist genau eins: eine Gruppe in den eigenen Teilbaum zu schieben. Das
 * ergäbe einen Zyklus — und zwar einen, den erst der Evaluator als
 * Endlosschleife bemerkt.
 */
export function darfBedingungVerschieben(
  root: Bedingung,
  von: BedingungsPfad,
  elternPfad: BedingungsPfad,
): boolean {
  if (von.length === 0) return false;
  const ziel = holeBedingungAn(root, elternPfad);
  if (!ziel || !istBedingungsGruppe(ziel)) return false;
  if (!holeBedingungAn(root, von)) return false;
  return !pfadLiegtUnter(elternPfad, von);
}

/**
 * Verschiebt den Knoten von `von` unter `elternPfad` an Position `index`.
 *
 * **Erst entfernen, dann einfügen** — und der Ziel-Index wird dabei korrigiert,
 * wenn der Knoten aus derselben Liste VOR der Zielposition stammt. Ohne diese
 * Korrektur landet ein Zug „eins nach unten" auf der Stelle, weil das Entfernen
 * die Liste schon um eins verkürzt hat.
 */
export function verschiebeBedingung(
  root: Bedingung,
  von: BedingungsPfad,
  elternPfad: BedingungsPfad,
  index: number,
): Bedingung {
  if (!darfBedingungVerschieben(root, von, elternPfad)) return root;
  const knoten = holeBedingungAn(root, von);
  const teil = zerlege(von);
  if (!knoten || !teil) return root;

  const gleicheListe = teil.eltern.length === elternPfad.length
    && teil.eltern.every((i, k) => elternPfad[k] === i);
  const zielIndex = gleicheListe && teil.index < index ? index - 1 : index;

  const ohne = entferneBedingungAn(root, von);
  // Der Zielpfad kann sich durch das Entfernen verschoben haben: liegt er in
  // derselben Liste HINTER dem entnommenen Knoten, rutscht sein Index um eins.
  return fuegeBedingungEin(ohne, korrigierePfadNachEntfernen(elternPfad, von), zielIndex, knoten);
}

/**
 * Wie liest sich `pfad`, nachdem `entfernt` aus dem Baum genommen wurde?
 *
 * Betroffen ist nur der Fall „gleiche Elternliste, größerer Index": dort rückt
 * jeder nachfolgende Geschwisterzweig um eine Position vor. Alles andere bleibt.
 */
function korrigierePfadNachEntfernen(
  pfad: BedingungsPfad,
  entfernt: BedingungsPfad,
): BedingungsPfad {
  if (entfernt.length === 0 || entfernt.length > pfad.length) return pfad;
  const elternTiefe = entfernt.length - 1;
  const entfernterIndex = entfernt[elternTiefe];
  const hier = pfad[elternTiefe];
  if (entfernterIndex === undefined || hier === undefined) return pfad;
  const gleicherAst = entfernt.slice(0, elternTiefe).every((i, k) => pfad[k] === i);
  if (!gleicherAst || hier <= entfernterIndex) return pfad;
  const kopie = [...pfad];
  kopie[elternTiefe] = hier - 1;
  return kopie;
}

/** Ein Platz nach oben/unten unter den Geschwistern. */
export function verschiebeBedingungsGeschwister(
  root: Bedingung,
  pfad: BedingungsPfad,
  richtung: 'hoch' | 'runter',
): Bedingung {
  const teil = zerlege(pfad);
  if (!teil) return root;
  const eltern = holeBedingungAn(root, teil.eltern);
  if (!eltern || !istBedingungsGruppe(eltern)) return root;
  const kinder = gruppenKinder(eltern);
  const ziel = richtung === 'hoch' ? teil.index - 1 : teil.index + 1;
  const hier = kinder[teil.index];
  const dort = kinder[ziel];
  if (hier === undefined || dort === undefined) return root;
  const kopie = [...kinder];
  kopie[teil.index] = dort;
  kopie[ziel] = hier;
  return ersetzeBedingungAn(root, teil.eltern, mitGruppenKindern(eltern, kopie));
}

/**
 * Einrücken heißt: **ans Ende der Gruppe direkt darüber**.
 *
 * Bewusst NUR, wenn der direkte Vorgänger schon eine Gruppe ist. Die bequemere
 * Variante — Vorgänger und Knoten in eine frisch erfundene Gruppe stecken —
 * ändert die Aussage der Regel, ohne dass jemand eine Verknüpfung gewählt hat:
 * aus „A UND B UND C" würde „(A UND B) UND C", und beim nächsten Umschalten der
 * äußeren Verknüpfung auf ODER bedeutet der Plan etwas völlig anderes, als die
 * Geste versprach. Wer eine Gruppe will, legt eine an.
 */
export function darfBedingungEinruecken(root: Bedingung, pfad: BedingungsPfad): boolean {
  const teil = zerlege(pfad);
  if (!teil || teil.index === 0) return false;
  const vorgaenger = holeBedingungAn(root, [...teil.eltern, teil.index - 1]);
  return !!vorgaenger && istBedingungsGruppe(vorgaenger);
}

export function rueckeBedingungEin(root: Bedingung, pfad: BedingungsPfad): Bedingung {
  if (!darfBedingungEinruecken(root, pfad)) return root;
  const teil = zerlege(pfad);
  if (!teil) return root;
  const zielPfad = [...teil.eltern, teil.index - 1];
  const ziel = holeBedingungAn(root, zielPfad);
  if (!ziel || !istBedingungsGruppe(ziel)) return root;
  return verschiebeBedingung(root, pfad, zielPfad, gruppenKinder(ziel).length);
}

/**
 * Verpackt **genau einen** Knoten in eine frische Gruppe.
 *
 * Das ist der Gegenpol zur Regel, die {@link darfBedingungEinruecken} zieht —
 * und der Unterschied ist kein Geschmack, sondern die Aussage der Regel:
 * eine Gruppe mit **einem** Kind wertet unter `alle` wie unter `einige`
 * identisch aus, das Verpacken eines einzelnen Knotens ändert also nichts.
 * Vorgänger UND Knoten in eine erfundene Gruppe zu stecken änderte sie sehr
 * wohl (aus „A UND B UND C" würde „(A UND B) UND C"), und genau deshalb bleibt
 * das dort gesperrt.
 *
 * Die Wurzel wird nicht verpackt: sie ist bereits die äußerste Gruppe, ein
 * weiterer Ring darum wäre eine Ebene ohne Aussage.
 */
export function verpackeBedingungInGruppe(
  root: Bedingung,
  pfad: BedingungsPfad,
  verknuepfung: 'alle' | 'einige' = 'alle',
): Bedingung {
  if (pfad.length === 0) return root;
  const knoten = holeBedingungAn(root, pfad);
  if (!knoten) return root;
  const huelle: Bedingung = verknuepfung === 'alle' ? { alle: [knoten] } : { einige: [knoten] };
  return ersetzeBedingungAn(root, pfad, huelle);
}

/**
 * Benennt die Gruppe an `pfad`. Getrimmt und auf {@link MAX_GRUPPENNAME}
 * gekappt; ein leerer Name **entfernt** das Feld, statt `name: ''` zu speichern.
 * Ein Blatt oder ein toter Pfad lässt den Baum unverändert.
 */
export function benenneBedingungsGruppe(
  root: Bedingung,
  pfad: BedingungsPfad,
  name: string,
): Bedingung {
  const knoten = holeBedingungAn(root, pfad);
  if (!knoten || !istBedingungsGruppe(knoten)) return root;
  const sauber = name.trim().slice(0, MAX_GRUPPENNAME).trimEnd();
  return ersetzeBedingungAn(
    root, pfad, baueGruppe(verknuepfungVon(knoten), gruppenKinder(knoten), sauber || undefined),
  );
}

/** Ausrücken heißt: eine Ebene höher, direkt HINTER die eigene Gruppe. */
export function darfBedingungAusruecken(pfad: BedingungsPfad): boolean {
  return pfad.length >= 2;
}

export function rueckeBedingungAus(root: Bedingung, pfad: BedingungsPfad): Bedingung {
  if (!darfBedingungAusruecken(pfad)) return root;
  const elternPfad = pfad.slice(0, -1);
  const elternIndex = elternPfad[elternPfad.length - 1];
  if (elternIndex === undefined) return root;
  return verschiebeBedingung(root, pfad, elternPfad.slice(0, -1), elternIndex + 1);
}

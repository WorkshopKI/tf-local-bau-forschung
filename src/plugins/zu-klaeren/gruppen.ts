/**
 * Aus Punkten und Stand wird die Ansicht: Gruppen, Zeilen, Zähler, Filter.
 *
 * **Gruppen statt Wiederholung**: die Phase steht in der Überschrift, nicht in
 * jeder Zeile. Bei 30 Zeilen wäre eine Phasen-Spalte 30-mal fast dasselbe Wort und
 * verdrängte den Platz, den die Bezeichnung braucht.
 *
 * Die Gruppenüberschrift trägt Anzahl Codes UND Summe der Vorkommen: eine
 * Zuordnung mit 222 Vorgängen wiegt anders als eine mit dreien, und ohne die Zahl
 * diskutiert man im Leeren.
 *
 * Rein: keine IO, keine Uhr.
 */
// Gegen die AUSLIEFERUNG, nicht gegen den geltenden Schnitt: siehe `zielLabel`.
import { SEED_ZAH_PHASEN, ZAH_MARKER_LABEL, zahPhaseLabel } from '@/core/status';
import type { ZahPhase } from '@/core/status';
import { fassungLabel, zielLabel } from './labels';
import { konsens, type PunktBefund } from './konsens';
import {
  OHNE_PHASE, urteilSchluessel, normalisiereAutor,
  type KlaerungPunkt, type KlaerungStand, type UrteilStand, type ZielWert,
} from './typen';

/**
 * Welche Zeilen die Tabelle zeigt.
 *
 * `unklar` ist keine Uneinigkeit (siehe `konsens.ts`), und `nichtUmgesetzt` ist
 * keine Aussage über den Konsens, sondern über den Katalog — vier Filter, weil
 * es vier verschiedene Fragen sind.
 */
export type ZeilenFilter = 'alle' | 'strittig' | 'unklar' | 'nichtUmgesetzt';

/** Eine Zeile der Zuordnungstabelle, fertig für die Anzeige. */
export interface ZeileAnsicht {
  punkt: KlaerungPunkt;
  befund: PunktBefund;
  /** Das eigene Urteil — `undefined`, solange man sich nicht geäußert hat. */
  meinUrteil?: UrteilStand;
  kommentarAnzahl: number;
  vorkommen: number | null;
  /** Was der Katalog heute führt — `null`, solange keine Fassung geladen ist. */
  istStand: IstStandMarke | null;
}

/**
 * Wie Beschluss und Katalog zueinander stehen. Drei Lagen, **disjunkt**:
 *
 * - `umgesetzt` — Konsens und Fassung stimmen überein,
 * - `offen` — Konsens weicht ab, die Fassung steht noch auf der Auslieferung
 *   (die Entscheidung ist notiert, aber nicht vollzogen),
 * - `abweichend` — die Fassung trägt eine Änderung, zu der es keinen oder einen
 *   anderen Konsens gibt.
 */
export type IstStandVermerk = 'umgesetzt' | 'offen' | 'abweichend';

/** Der Ist-Stand einer Zeile, fertig beschriftet. */
export interface IstStandMarke {
  vermerk: IstStandVermerk;
  /** Die gepflegte Phase, beschriftet wie die FASSUNG sie führt. */
  phase: string;
  /** Kurzform des Vermerks — das, was in der Zelle steht. */
  text: string;
  title: string;
  /** Gedämpft: nur eine Änderung ohne passenden Beschluss verlangt Aufmerksamkeit. */
  leise: boolean;
}

/** Was die Zeilen über den Katalog wissen müssen — alles als reine Eingabe. */
export interface IstStandKontext {
  /**
   * Code → gepflegte Phase, **nur für die abweichenden Codes**. Kommt aus
   * `katalogDrift`; alles, was nicht darin steht, steht auf der Auslieferung.
   * Damit rechnet diese Datei den Vergleich nicht ein zweites Mal.
   */
  abweichend: ReadonlyMap<number, ZielWert>;
  /** Die Phasen der Fassung — für die Beschriftung, siehe `fassungLabel`. */
  fassungPhasen: readonly ZahPhase[] | undefined;
}

const VERMERK_TEXT: Record<IstStandVermerk, string> = {
  umgesetzt: 'umgesetzt',
  offen: 'noch offen',
  abweichend: 'abweichend beschlossen',
};

/**
 * Der Ist-Stand einer Zeile — oder `null`, wenn es nichts zu vermerken gibt.
 *
 * Ohne Konsens **und** ohne Änderung im Katalog schweigt die Spalte: eine Zeile,
 * die niemand beantwortet hat und die niemand angefasst hat, ist keine Nachricht.
 *
 * Der Fall vom 05.08. (Code 29: einig auf „Abgeschlossen", der Baum hält ihn
 * weiterhin ohne Phase) landet unter `offen` — der Beschluss steht da, vollzogen
 * ist er nicht. Ihn `abweichend` zu nennen hieße, dem Katalog eine Änderung zu
 * unterstellen, die er nicht trägt; sichtbar wird der Widerspruch so oder so,
 * weil beide Lagen zum Filter „nicht umgesetzt" zählen.
 */
export function istStandVon(
  befund: PunktBefund,
  seedZiel: ZielWert,
  fassungZiel: ZielWert,
  fassungPhasen: readonly ZahPhase[] | undefined,
): IstStandMarke | null {
  const phase = fassungLabel(fassungZiel, fassungPhasen);
  const marke = (vermerk: IstStandVermerk, title: string, leise: boolean): IstStandMarke =>
    ({ vermerk, phase, text: VERMERK_TEXT[vermerk], title, leise });

  const konsensZiel = befund.zustand === 'einig' ? befund.ziel : null;
  if (konsensZiel === null) {
    if (fassungZiel === seedZiel) return null;
    return marke(
      'abweichend',
      'Der Katalog weicht hier von der Auslieferung ab — einen Konsens dazu gibt es nicht.',
      false,
    );
  }
  if (konsensZiel === fassungZiel) {
    return marke('umgesetzt', 'Der Konsens steht so auch im Katalog.', true);
  }
  if (fassungZiel === seedZiel) {
    return marke('offen', 'Beschlossen, im Katalog aber noch nicht vollzogen.', true);
  }
  return marke(
    'abweichend',
    `Der Katalog führt „${phase}“ — beschlossen wurde „${zielLabel(konsensZiel)}“.`,
    false,
  );
}

/** Eine Phasen-Gruppe der Tabelle. */
export interface GruppeAnsicht {
  id: ZielWert;
  label: string;
  /** Die Marker stehen NEBEN dem Verfahren — die Anzeige setzt sie darum ab. */
  istMarker: boolean;
  zeilen: ZeileAnsicht[];
  codeAnzahl: number;
  /** `null`, solange die Vorkommen noch nicht geladen sind — nicht 0. */
  vorkommenSumme: number | null;
}

/** Baut die Zeilen-Ansichten aller Zuordnungspunkte. */
export function baueZeilen(
  punkte: readonly KlaerungPunkt[],
  stand: KlaerungStand,
  autoren: readonly string[],
  meinName: string | undefined,
  vorkommen: ReadonlyMap<number, number> | null,
  /** `null`, solange die Katalog-Fassung nicht geladen ist — dann schweigt die Spalte,
   *  statt „steht auf Auslieferungsstand" zu behaupten. */
  istStand: IstStandKontext | null,
): ZeileAnsicht[] {
  return punkte.filter(p => p.art === 'phasenzuordnung').map(punkt => {
    const meins = meinName !== undefined
      ? stand.urteile.get(urteilSchluessel(meinName, punkt.id))
      : undefined;
    const befund = konsens(stand, punkt, autoren);
    const seedZiel = punkt.seedZiel ?? OHNE_PHASE;
    return {
      punkt,
      befund,
      ...(meins !== undefined ? { meinUrteil: meins } : {}),
      kommentarAnzahl: stand.kommentare.get(punkt.id)?.length ?? 0,
      vorkommen: vorkommen === null ? null : (vorkommen.get(punkt.code ?? -1) ?? 0),
      istStand: istStand === null ? null : istStandVon(
        befund,
        seedZiel,
        istStand.abweichend.get(punkt.code ?? -1) ?? seedZiel,
        istStand.fassungPhasen,
      ),
    };
  });
}

/** Was in der Spalte „Stand" steht — oder `null`, wenn die Zeile nichts zu melden hat. */
export interface StandMarke {
  text: string;
  title: string;
  /** Gedämpft darstellen: Uneinigkeit ist das einzige, was Aufmerksamkeit verlangt. */
  leise: boolean;
}

/**
 * Der ruhige Marker einer Zeile — **eine** Quelle für Anzeige und Spalten-Sichtbarkeit.
 *
 * Ohne Antworten meldet jede Zeile `null`; die Spalte stünde dann 30-mal leer und
 * nähme der Bezeichnung die Breite. Deshalb entscheidet dieselbe Funktion, ob die
 * Spalte überhaupt erscheint (`zeigtStand`) — zwei Bedingungen nebeneinander wären
 * zwei Wahrheiten, und die falsche fiele erst im Termin auf.
 */
export function standMarke(zeile: ZeileAnsicht): StandMarke | null {
  const { zustand, unklarVon, ziel } = zeile.befund;
  if (zustand === 'strittig') {
    return {
      text: 'strittig', title: 'Zwei oder mehr verschiedene Zielphasen genannt', leise: false,
    };
  }
  if (unklarVon.length > 0) {
    return { text: 'Rückfrage', title: `Rückfrage von ${unklarVon.join(', ')}`, leise: true };
  }
  if (zustand === 'einig' && ziel !== null && ziel !== zeile.punkt.seedZiel) {
    return { text: `→ ${zielLabel(ziel)}`, title: 'Einig — aber anders als ausgeliefert', leise: true };
  }
  return null;
}

/** Trägt mindestens eine sichtbare Zeile eine Marke? Sonst bleibt die Spalte weg. */
export function zeigtStand(gruppen: readonly GruppeAnsicht[]): boolean {
  return gruppen.some(g => g.zeilen.some(z => standMarke(z) !== null));
}

/** Dasselbe für den Ist-Stand — dieselbe Quelle für Anzeige und Spalten-Sichtbarkeit. */
export function zeigtIstStand(gruppen: readonly GruppeAnsicht[]): boolean {
  return gruppen.some(g => g.zeilen.some(z => z.istStand !== null));
}

/** Beschlossen, aber (noch) nicht so im Katalog — beide Lagen zählen dazu. */
export function nichtUmgesetzt(zeile: ZeileAnsicht): boolean {
  const v = zeile.istStand?.vermerk;
  return v === 'offen' || v === 'abweichend';
}

/** Passt eine Zeile zum Filter? */
export function passtZumFilter(zeile: ZeileAnsicht, filter: ZeilenFilter): boolean {
  if (filter === 'strittig') return zeile.befund.zustand === 'strittig';
  if (filter === 'unklar') return zeile.befund.unklarVon.length > 0;
  if (filter === 'nichtUmgesetzt') return nichtUmgesetzt(zeile);
  return true;
}

/**
 * Gruppiert die Zeilen nach der ausgelieferten Phase.
 *
 * Die Gruppenstruktur bleibt auch unter einem Filter erhalten — leere Gruppen
 * fallen weg, aber eine gefilterte Zeile wandert nie in eine andere Gruppe.
 * Gezählt werden dabei die **sichtbaren** Zeilen: eine Überschrift, die 7 Codes
 * behauptet und 2 zeigt, wäre eine falsche Zusage.
 */
export function baueGruppen(
  zeilen: readonly ZeileAnsicht[], filter: ZeilenFilter = 'alle',
): GruppeAnsicht[] {
  const sichtbar = zeilen.filter(z => passtZumFilter(z, filter));
  const reihenfolge: ZielWert[] = [...SEED_ZAH_PHASEN.map(p => p.id), OHNE_PHASE];

  return reihenfolge.flatMap(id => {
    const meine = sichtbar.filter(z => (z.punkt.seedZiel ?? OHNE_PHASE) === id);
    if (meine.length === 0) return [];
    const mitZahl = meine.filter(z => z.vorkommen !== null);
    return [{
      id,
      label: id === OHNE_PHASE ? ZAH_MARKER_LABEL : zahPhaseLabel(id, SEED_ZAH_PHASEN),
      istMarker: id === OHNE_PHASE,
      zeilen: meine,
      codeAnzahl: meine.length,
      vorkommenSumme: mitZahl.length === 0
        ? null
        : mitZahl.reduce((s, z) => s + (z.vorkommen ?? 0), 0),
    }];
  });
}

/**
 * Wie viele Punkte man selbst **fertig** beantwortet hat.
 *
 * Drei Fälle zählen bewusst nicht:
 * - ein zurückgezogenes Urteil — sonst zeigte der Zähler Arbeit an, die man
 *   ausdrücklich zurückgenommen hat;
 * - „andere" ohne gewählte Zielphase — die Auswertung liest daraus nichts,
 *   also darf der Zähler nicht „erledigt" behaupten und jemanden in dem Glauben
 *   lassen, er sei durch;
 * - bei Freitext-Punkten alles außer einem eigenen Beitrag; ein Urteil gibt es dort
 *   nicht.
 */
export function beantwortetVon(
  punkte: readonly KlaerungPunkt[], stand: KlaerungStand, meinName: string | undefined,
): number {
  if (meinName === undefined) return 0;
  const ich = normalisiereAutor(meinName);
  return punkte.filter(p => {
    if (p.art === 'freitext') {
      // Beiträge tragen die Anzeigeform — verglichen wird trotzdem normalisiert.
      return (stand.kommentare.get(p.id) ?? []).some(b => normalisiereAutor(b.autor) === ich);
    }
    const u = stand.urteile.get(urteilSchluessel(meinName, p.id));
    if (u === undefined || u.urteil === 'zurueckgezogen') return false;
    return u.urteil !== 'andere' || u.zielWert !== undefined;
  }).length;
}

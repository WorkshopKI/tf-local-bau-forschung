/**
 * Die Rollen des Fachsystems: wer einen Statuseintrag setzt.
 *
 * Quelle ist die Kürzel-Zuarbeit (Spalte „wird gesetzt von:"). Sie führt sechs
 * Ausprägungen — AB, FB, QS, PA, Juristen und **neutral** — in beliebigen
 * Kombinationen (`AB/FB/QS`, `AB/QS/Juristen`).
 *
 * **Neutral ist keine Rolle, sondern deren Abwesenheit**: „jeder darf setzen".
 * Deshalb ist es KEIN eigener Enum-Wert, sondern das leere Rollen-Array — und
 * deshalb matcht ein neutraler Eintrag jede Rollenwahl, statt aus allen Filtern
 * herauszufallen. Wer das umdreht, blendet 143 der 505 Codes überall aus.
 *
 * Alles hier ist rein: kein IDB-Zugriff, keine Mutation. Die Rollen filtern und
 * sortieren die Anzeige, sperren nichts und gehen nicht in die Ableitung ein.
 */
import type { Rolle, StatusFeldEintrag } from './typen';

/** Kanonische Reihenfolge — bestimmt Chip-Reihenfolge und Label-Ausgabe. */
export const ROLLEN: readonly Rolle[] = ['ab', 'fb', 'qs', 'pa', 'jur'];

/** Kurzform für Chips und Badges — passt in eine Tabellenzelle. */
export const ROLLE_LABEL: Record<Rolle, string> = {
  ab: 'AB',
  fb: 'FB',
  qs: 'QS',
  pa: 'PA',
  jur: 'Jur',
};

/** Langform für Tooltips und die Profil-Auswahl. */
export const ROLLE_LANG: Record<Rolle, string> = {
  ab: 'AB — administrative Bearbeitung',
  fb: 'FB — fachliche Bearbeitung',
  qs: 'QS — Qualitätssicherung',
  pa: 'PA — Projektadministration',
  jur: 'Juristen',
};

/** Wie ein neutraler Eintrag beschriftet wird (leeres Rollen-Array). */
export const NEUTRAL_LABEL = 'alle';

/** Nur die Felder, die für die Rollen-Auflösung zählen. */
type MitRollen = Pick<StatusFeldEintrag, 'rollen' | 'zustaendigkeit'>;

/**
 * Die Rollen eines Feldes — die EINZIGE Lesestelle.
 *
 * Übersetzt die abgelöste `zustaendigkeit` zur Lesezeit mit, damit
 * Bestandsfassungen (IDB und Share) ohne Daten-Migration weiterlaufen:
 * `ab`/`fb` werden zur einelementigen Liste, `beide` zu AB+FB. Ein Feld, das
 * beides trägt, wird von `rollen` entschieden.
 */
export function rollenVonFeld(feld: MitRollen): readonly Rolle[] {
  if (feld.rollen) return feld.rollen;
  switch (feld.zustaendigkeit) {
    case 'ab': return ['ab'];
    case 'fb': return ['fb'];
    case 'beide': return ['ab', 'fb'];
    default: return [];
  }
}

/** Neutral = ohne Rollen = jeder darf setzen. */
export function istNeutral(feld: MitRollen): boolean {
  return rollenVonFeld(feld).length === 0;
}

/**
 * Ist das Feld für diese Rollenwahl sichtbar?
 *
 * `alle` zeigt alles; ein neutrales Feld ist immer sichtbar (siehe Modulkopf).
 */
export function betrifftRolle(feld: MitRollen, wahl: Rolle | 'alle'): boolean {
  if (wahl === 'alle') return true;
  const rollen = rollenVonFeld(feld);
  return rollen.length === 0 || rollen.includes(wahl);
}

/** Anzeige-Text: `AB/FB` bzw. `alle` für neutrale Einträge. */
export function rollenLabel(feld: MitRollen): string {
  const rollen = rollenVonFeld(feld);
  if (rollen.length === 0) return NEUTRAL_LABEL;
  return sortiereRollen(rollen).map(r => ROLLE_LABEL[r]).join('/');
}

/** Kanonisch sortieren, damit `FB/AB` und `AB/FB` dasselbe Label ergeben. */
export function sortiereRollen(rollen: readonly Rolle[]): Rolle[] {
  return ROLLEN.filter(r => rollen.includes(r));
}

/**
 * Die im Profil gespeicherte Rollen-Vorauswahl lesen.
 *
 * Nimmt den rohen Wert (nicht das Profil), damit `status/` nichts aus
 * `core/types/config` importieren muss. `beide` ist die abgelöste Fassung aus
 * v2.344, als es nur die AB/FB-Achse gab: sie war der „nichts ausblenden"-Wert
 * und wird deshalb zu `alle` — nicht zu einer AB+FB-Filterung, die dem
 * Bestandsnutzer plötzlich QS-, PA- und Juristen-Einträge nähme.
 */
export function leseStatusRolle(roh: string | undefined): Rolle | 'alle' {
  if (!roh || roh === 'beide' || roh === 'alle') return 'alle';
  return (ROLLEN as readonly string[]).includes(roh) ? (roh as Rolle) : 'alle';
}

/**
 * Die Bearbeiter-Kürzel des Fachsystems und ihre Rolle — die **einzige** Stelle,
 * an der diese Zuordnung steht (Schlüssel: `normKey`).
 *
 * Gebraucht wird sie für die Mail-Trigger: `TRG.VorgEintragMail` adressiert
 * `TIB`/`BIB`/`PFM`, und ohne diese Tabelle stünde im Satz ein Kürzel ohne
 * Bedeutung. Die Zuarbeit („Erklärung Parameter", Zeilen der Art „Bearbeiter")
 * führt dieselbe Zuordnung — der Import **prüft** dagegen und warnt bei
 * Unbekanntem, statt eine zweite Tabelle daneben anzulegen (Pitfall #43).
 *
 * Verwandt, aber nicht dasselbe: `ROLLEN_SPALTEN` in `bearbeiterFilter.ts`
 * bildet Rollen auf CSV-SPALTEN ab (`bib_kuerz`), hier stehen die Token selbst.
 */
export const MAIL_ROLLE: Readonly<Record<string, Rolle>> = {
  bib: 'ab',
  bfm: 'ab',
  pfm: 'ab',
  tib: 'fb',
  ztp: 'fb',
};

const SPALTEN_TOKEN: Record<string, Rolle> = {
  AB: 'ab',
  FB: 'fb',
  QS: 'qs',
  PA: 'pa',
  JURISTEN: 'jur',
};

/**
 * Die Rollenspalte der Zuarbeit lesen: `AB/FB/QS` → `['ab','fb','qs']`,
 * `neutral` → `[]`.
 *
 * Unbekannte Tokens werden verworfen statt zu werfen — die Zuarbeit ist
 * Fremddaten. Dass sie heute keine enthält, sichert ein Test am Datenmodul.
 */
export function parseRollenSpalte(roh: string): Rolle[] {
  const treffer: Rolle[] = [];
  for (const teil of roh.split('/')) {
    const rolle = SPALTEN_TOKEN[teil.trim().toUpperCase()];
    if (rolle && !treffer.includes(rolle)) treffer.push(rolle);
  }
  return sortiereRollen(treffer);
}

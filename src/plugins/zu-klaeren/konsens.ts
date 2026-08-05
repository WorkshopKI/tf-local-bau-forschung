/**
 * Ob sich die Kollegen zu einem Punkt einig sind — und wer überhaupt antworten darf.
 *
 * **Verglichen wird der Zielwert, nicht der gedrückte Knopf.** Wer `passt`
 * anklickt, meint die ausgelieferte Phase; wer `andere → Prüfung` anklickt, meint
 * Prüfung. Steht im Seed ohnehin Prüfung, sagen beide dasselbe — verglichen man
 * die Knöpfe, sähe der Termin hier einen Konflikt, wo keiner ist, und verbrennte
 * Zeit an Nicht-Konflikten. Umgekehrt sind zweimal `andere` auf verschiedene
 * Phasen sehr wohl ein Konflikt.
 *
 * **`unklar` ist keine Gegenstimme, sondern fehlende Information.** „Zwei sagen
 * passt, einer sagt unklar" braucht eine Rückfrage, nicht eine Entscheidung —
 * das sind zwei verschiedene Handlungen, also zwei verschiedene Achsen und zwei
 * verschiedene Marker. Deshalb ist auch der Filter dreiwertig statt ein Häkchen.
 *
 * Rein: keine IO, keine Uhr.
 */
import { urteilSchluessel, type KlaerungPunkt, type KlaerungStand, type ZielWert } from './typen';

/** Wie ein Punkt dasteht. */
export type PunktZustand = 'offen' | 'einig' | 'strittig';

/** Das Ergebnis der Auswertung eines Punktes. */
export interface PunktBefund {
  zustand: PunktZustand;
  /** Der gemeinsame Zielwert — nur bei `einig`, sonst `null`. */
  ziel: ZielWert | null;
  /** Namen derer, die den Punkt nicht beurteilen konnten. */
  unklarVon: string[];
  /** Namen derer, die ein zählendes Urteil abgegeben haben. */
  urteilVon: string[];
}

/**
 * Wertet einen Punkt aus.
 *
 * `unklar` und `zurueckgezogen` zählen nicht mit: ein zurückgezogenes Urteil wirkt
 * wie „nie geantwortet", bleibt aber als Zeile in der Datei stehen. Freitext-Punkte
 * haben keine Urteile und sind deshalb nie strittig — sonst versteckte ein Filter
 * „nur strittige" ausgerechnet die Grundsatzfragen, über die am meisten zu reden ist.
 */
export function konsens(
  stand: KlaerungStand, punkt: KlaerungPunkt, autoren: readonly string[],
): PunktBefund {
  const ziele = new Set<ZielWert>();
  const unklarVon: string[] = [];
  const urteilVon: string[] = [];

  if (punkt.art === 'phasenzuordnung') {
    for (const autor of autoren) {
      const u = stand.urteile.get(urteilSchluessel(autor, punkt.id));
      if (!u || u.urteil === 'zurueckgezogen') continue;
      if (u.urteil === 'unklar') { unklarVon.push(autor); continue; }
      const ziel = u.urteil === 'andere' ? u.zielWert : punkt.seedZiel;
      if (ziel === undefined) continue;   // `andere` ohne Zielwahl sagt noch nichts
      ziele.add(ziel);
      urteilVon.push(autor);
    }
  }

  const [erstes] = [...ziele];
  if (erstes === undefined) return { zustand: 'offen', ziel: null, unklarVon, urteilVon };
  if (ziele.size === 1) return { zustand: 'einig', ziel: erstes, unklarVon, urteilVon };
  return { zustand: 'strittig', ziel: null, unklarVon, urteilVon };
}

/**
 * Alle Namen, die im Stand vorkommen — in stabiler Reihenfolge, in der
 * Schreibweise ihres Profils.
 *
 * Gelesen wird `stand.namen`, nicht der Schlüssel-Präfix: der trägt die
 * Vergleichsform (`THOMAS HÜBSCH`), und sie stünde sonst als Spaltenkopf in der
 * Tabelle und im Export. Die zurückgegebenen Namen treffen über
 * `urteilSchluessel` wieder ihr Fach — die Normalisierung sitzt dort.
 */
export function autorenVon(stand: KlaerungStand): string[] {
  return [...stand.namen.values()].sort((a, b) => a.localeCompare(b, 'de'));
}

/**
 * Ob jemand antworten kann — dafür braucht es genau eines: einen Namen.
 *
 * **Autorschaft ist eine Person, kein Kürzel.** Bis v2.414 hing die Klärung am
 * `bearbeiter_kuerzel`; damit waren PL und Kurator ausgesperrt, weil sie im
 * Fachsystem keine Bearbeiterrolle haben, und die Sammelwerte `alle` /
 * `MUE,SCH` mussten eigens abgewehrt werden. Ein Profilname meint immer genau
 * einen Menschen, also fällt beides weg. Lesen bleibt ohnehin für alle offen;
 * gesperrt ist nur das Antworten, und zwar mit Hinweissatz statt als grauer
 * Knopf.
 */
export function istAntwortfaehig(name: string | undefined): boolean {
  return name !== undefined && name.trim() !== '';
}

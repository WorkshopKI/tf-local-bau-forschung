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
  /** Kürzel derer, die den Punkt nicht beurteilen konnten. */
  unklarVon: string[];
  /** Kürzel derer, die ein zählendes Urteil abgegeben haben. */
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

/** Alle Kürzel, die im Stand vorkommen — in stabiler Reihenfolge. */
export function autorenVon(stand: KlaerungStand): string[] {
  const namen = new Set<string>();
  for (const schluessel of stand.urteile.keys()) {
    const autor = schluessel.split('|')[0];
    if (autor !== undefined && autor !== '') namen.add(autor);
  }
  for (const liste of stand.kommentare.values()) for (const b of liste) namen.add(b.autor);
  return [...namen].sort();
}

/**
 * Ob ein Kürzel eine Person meint.
 *
 * Das Profilfeld trägt legitim auch `alle` (kein Bearbeiter-Filter) oder eine
 * Vertretungsliste wie `MUE,SCH` — beides sind keine Absender. Ließe man sie
 * durch, teilten sich zwei Menschen ein Faltungsfach und überschrieben einander,
 * und die Auswertung sähe eine Stimme, wo zwei sind. Lesen bleibt für alle offen;
 * gesperrt ist nur das Antworten, und zwar mit Hinweissatz statt als grauer Knopf.
 */
export function istAntwortfaehig(kuerzel: string | undefined): boolean {
  if (kuerzel === undefined) return false;
  const t = kuerzel.trim();
  if (t === '' || t.includes(',')) return false;
  return t.toLowerCase() !== 'alle';
}

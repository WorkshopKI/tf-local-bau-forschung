/**
 * Die **Ebenen des Zeitverlaufs** — was auf der gemeinsamen Achse gezeigt wird.
 * Rein, ohne React.
 *
 * Vier Schichten, aber **drei Pillen**: die Verbundbahn, die Kürzel-Etage über
 * den Balken und die Meilenstein-Marken lassen sich schalten. Die Bahnen der
 * Teilvorhaben nicht — sie sind der Zeitverlauf selbst. Eine Pille, die den
 * Inhalt einer Ansicht wegnimmt, ist keine Ebene, sondern ein Ausschalter;
 * deshalb steht „Phasen" seit v3.41 gar nicht mehr in der Leiste.
 *
 * **Nicht jede Ebene ist überall steuerbar.** Auf einer verdichteten
 * Verbundzeile IST die Verbundbahn der Vorgang — sie trägt das Urteil des
 * Stillstands-Wächters am Achsenende. Sie abschaltbar zu machen hieße, das
 * Urteil wegklicken zu können; die Pille erscheint dort deshalb gar nicht.
 * Eine Ebene ohne Pille bleibt sichtbar, statt still zu verschwinden — sonst
 * entschiede eine Voreinstellung über etwas, das niemand umschalten kann.
 */
import type { VerlaufsSpur } from '@/core/status/verlauf';

export type Ebene = 'verbund' | 'kuerzel' | 'meilensteine';

/** Reihenfolge der Pillen — von der Bezugsgröße zur Zusatzschicht. */
export const EBENEN: readonly Ebene[] = ['verbund', 'kuerzel', 'meilensteine'];

export const EBENE_LABEL: Record<Ebene, string> = {
  verbund: 'Verbund',
  kuerzel: 'Kürzel',
  meilensteine: 'Meilensteine',
};

export const EBENE_TITEL: Record<Ebene, string> = {
  verbund: 'Die Bahn des Verbunds als Bezugsgröße über den Teilvorhaben.',
  kuerzel: 'Die Kürzel des Fachsystems über den Balken — der Griff zum Gespräch mit C16.',
  meilensteine: 'Erreichte Stufen als Punkt, gerissene als Balken vom Soll bis heute.',
};

/**
 * Voreinstellung: Verbund und Kürzel an, Meilensteine aus.
 *
 * Die beiden ersten beschreiben denselben Vorgang wie die Bahnen darunter, nur
 * gröber bzw. feiner — sie gehören zum Bild. Die Meilenstein-Ebene bringt eine
 * **zweite Datenquelle** auf dieselbe Achse (den Plan, nicht den Export) und
 * fordert rechts Platz für ihre Verzugslabels; sie startet deshalb zu und
 * bleibt einen Klick entfernt.
 */
export const EBENEN_DEFAULT: readonly Ebene[] = ['verbund', 'kuerzel'];

export interface EbenenLage {
  /** Führt der Vorgang überhaupt eine Verbundbahn? */
  hatVerbundSpur: boolean;
  /** Verdichtete Verbundzeile — dort ist die Verbundbahn der Vorgang selbst. */
  istVerbundZeile: boolean;
  /** Gibt es Meilensteine zum Anzeigen? */
  hatMeilensteine: boolean;
}

/** Welche Pillen die Leiste zeigt. */
export function verfuegbareEbenen(lage: EbenenLage): Ebene[] {
  const out: Ebene[] = ['kuerzel'];
  if (lage.hatVerbundSpur && !lage.istVerbundZeile) out.push('verbund');
  if (lage.hatMeilensteine) out.push('meilensteine');
  return EBENEN.filter(e => out.includes(e));
}

/** Startzustand: die Voreinstellung, beschnitten auf das, was es hier gibt. */
export function initialeEbenen(verfuegbar: readonly Ebene[]): Set<Ebene> {
  return new Set(EBENEN_DEFAULT.filter(e => verfuegbar.includes(e)));
}

/** Umschalten — neue Menge, die alte bleibt unberührt. */
export function schalte(an: ReadonlySet<Ebene>, e: Ebene): Set<Ebene> {
  const next = new Set(an);
  if (next.has(e)) next.delete(e); else next.add(e);
  return next;
}

/**
 * Die Bahnen, die das Band zeichnen soll.
 *
 * Die Bahnen der Teilvorhaben bleiben **immer** stehen — sie sind der
 * Zeitverlauf. Gefiltert wird nur die Verbundbahn, und auch die nur dort, wo sie
 * eine Pille hat: was nicht schaltbar ist, wird nicht still ausgeblendet.
 */
export function filtereSpuren(
  spuren: readonly VerlaufsSpur[], an: ReadonlySet<Ebene>, verfuegbar: readonly Ebene[],
): VerlaufsSpur[] {
  return spuren.filter(s => {
    if (s.art !== 'verbund') return true;
    return verfuegbar.includes('verbund') ? an.has('verbund') : true;
  });
}

/**
 * Die **Ebenen des Zeitverlaufs** — was auf der gemeinsamen Achse gezeigt wird.
 * Rein, ohne React.
 *
 * Vier Schichten, vier Pillen: die Bahnen der Teilvorhaben (*Phasen*), die
 * Meilenstein-Marken, die Kürzel-Etage über den Balken und die Verbundbahn.
 *
 * **Nicht jede Ebene ist überall steuerbar.** Auf einer verdichteten
 * Verbundzeile IST die Verbundbahn der Vorgang — sie trägt das Urteil des
 * Stillstands-Wächters am Achsenende. Sie abschaltbar zu machen hieße, das
 * Urteil wegklicken zu können; die Pille erscheint dort deshalb gar nicht.
 * Eine Ebene ohne Pille bleibt sichtbar, statt still zu verschwinden — sonst
 * entschiede eine Voreinstellung über etwas, das niemand umschalten kann.
 */
import type { VerlaufsSpur } from '@/core/status/verlauf';

export type Ebene = 'phasen' | 'meilensteine' | 'kuerzel' | 'verbund';

/** Reihenfolge der Pillen — zugleich die Reihenfolge im Entwurf. */
export const EBENEN: readonly Ebene[] = ['phasen', 'meilensteine', 'kuerzel', 'verbund'];

export const EBENE_LABEL: Record<Ebene, string> = {
  phasen: 'Phasen',
  meilensteine: 'Meilensteine',
  kuerzel: 'Kürzel',
  verbund: 'Verbund',
};

export const EBENE_TITEL: Record<Ebene, string> = {
  phasen: 'Die Bahnen der Teilvorhaben — je Abschnitt ein Balken.',
  meilensteine: 'Erreichte Stufen als Punkt, gerissene als Balken vom Soll bis heute.',
  kuerzel: 'Die Kürzel des Fachsystems über den Balken — der Griff zum Gespräch mit C16.',
  verbund: 'Die Bahn des Verbunds als Bezugsgröße über den Teilvorhaben.',
};

/**
 * Voreinstellung aus dem Entwurf: Phasen und Meilensteine an, Kürzel und
 * Verbund aus.
 *
 * Die Kürzel-Etage war seit v3.38 immer sichtbar. Sie startet jetzt zu, weil
 * die Achse mit der Meilenstein-Ebene eine Schicht mehr trägt — einen Klick
 * entfernt bleibt sie.
 */
export const EBENEN_DEFAULT: readonly Ebene[] = ['phasen', 'meilensteine'];

export interface EbenenLage {
  /** Führt der Vorgang überhaupt eine Verbundbahn? */
  hatVerbundSpur: boolean;
  /** Verdichtete Verbundzeile — dort ist die Verbundbahn der Vorgang selbst. */
  istVerbundZeile: boolean;
  /** Führt der Vorgang Bahnen von Teilvorhaben? */
  hatTvSpur: boolean;
  /** Gibt es Meilensteine zum Anzeigen? */
  hatMeilensteine: boolean;
}

/** Welche Pillen die Leiste zeigt. */
export function verfuegbareEbenen(lage: EbenenLage): Ebene[] {
  const out: Ebene[] = [];
  if (lage.hatTvSpur) out.push('phasen');
  if (lage.hatMeilensteine) out.push('meilensteine');
  out.push('kuerzel');
  if (lage.hatVerbundSpur && !lage.istVerbundZeile) out.push('verbund');
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
 * Nur steuerbare Ebenen werden gefiltert: was keine Pille hat, bleibt stehen.
 */
export function filtereSpuren(
  spuren: readonly VerlaufsSpur[], an: ReadonlySet<Ebene>, verfuegbar: readonly Ebene[],
): VerlaufsSpur[] {
  return spuren.filter(s => {
    const ebene: Ebene = s.art === 'verbund' ? 'verbund' : 'phasen';
    return verfuegbar.includes(ebene) ? an.has(ebene) : true;
  });
}

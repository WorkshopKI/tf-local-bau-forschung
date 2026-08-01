/**
 * Diff-Vorschau für Referenz-Importe: „3 neue Kürzel, 1 geänderter Trigger, 2
 * entfallen" — **bevor** etwas übernommen wird.
 *
 * Warum überhaupt: die Kataloge sind Fremddaten, die alle paar Monate neu
 * kommen. Ohne Vorschau ist jeder Import ein Blindflug, und ein
 * versehentlich falsches Blatt fällt erst auf, wenn die halbe App anders
 * rechnet. Entfallene Einträge sind dabei das wichtigste Signal — sie sind der
 * Fingerabdruck einer unvollständigen Datei.
 *
 * Rein und generisch: keine IO, kein Wissen über Status oder Trigger.
 */

export type DiffArt = 'neu' | 'geaendert' | 'entfallen';

export interface DiffEintrag<T> {
  art: DiffArt;
  /** Der Schlüssel, unter dem verglichen wurde (Code, Kürzel+Folge …). */
  schluessel: string;
  vorher?: T;
  nachher?: T;
  /** Bei `geaendert`: die Feldnamen, die sich unterscheiden. */
  felder?: string[];
}

export interface Diff<T> {
  neu: DiffEintrag<T>[];
  geaendert: DiffEintrag<T>[];
  entfallen: DiffEintrag<T>[];
  unveraendert: number;
  /** Nichts zu tun — die Datei entspricht dem aktuellen Stand. */
  leer: boolean;
}

/**
 * Vergleicht zwei Listen über einen Schlüssel. `felderVon` bestimmt, welche
 * Eigenschaften verglichen werden — alles andere (Reihenfolge, abgeleitete
 * Anzeigefelder) bleibt außen vor und erzeugt keine Scheinänderung.
 */
export function berechneDiff<T>(
  vorher: readonly T[],
  nachher: readonly T[],
  schluesselVon: (t: T) => string,
  felderVon: (t: T) => Record<string, unknown>,
): Diff<T> {
  const alt = new Map(vorher.map(t => [schluesselVon(t), t]));
  const neuIdx = new Map(nachher.map(t => [schluesselVon(t), t]));

  const neu: DiffEintrag<T>[] = [];
  const geaendert: DiffEintrag<T>[] = [];
  const entfallen: DiffEintrag<T>[] = [];
  let unveraendert = 0;

  for (const t of nachher) {
    const schluessel = schluesselVon(t);
    const vor = alt.get(schluessel);
    if (!vor) {
      neu.push({ art: 'neu', schluessel, nachher: t });
      continue;
    }
    const a = felderVon(vor);
    const b = felderVon(t);
    const felder = [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null))
      .sort();
    if (felder.length === 0) unveraendert++;
    else geaendert.push({ art: 'geaendert', schluessel, vorher: vor, nachher: t, felder });
  }

  for (const t of vorher) {
    const schluessel = schluesselVon(t);
    if (!neuIdx.has(schluessel)) entfallen.push({ art: 'entfallen', schluessel, vorher: t });
  }

  return {
    neu,
    geaendert,
    entfallen,
    unveraendert,
    leer: neu.length === 0 && geaendert.length === 0 && entfallen.length === 0,
  };
}

/** Kurzfassung für die Oberfläche: „3 neu · 1 geändert · 2 entfallen". */
export function diffZusammenfassung<T>(d: Diff<T>): string {
  if (d.leer) return 'Keine Änderungen — die Datei entspricht dem aktuellen Stand.';
  const teile: string[] = [];
  if (d.neu.length > 0) teile.push(`${d.neu.length} neu`);
  if (d.geaendert.length > 0) teile.push(`${d.geaendert.length} geändert`);
  if (d.entfallen.length > 0) teile.push(`${d.entfallen.length} entfallen`);
  return `${teile.join(' · ')} (${d.unveraendert} unverändert)`;
}

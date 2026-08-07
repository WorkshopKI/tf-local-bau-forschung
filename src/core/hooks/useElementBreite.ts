/**
 * Die Breite eines Elements messen — **eine** Implementierung für alle, die
 * ihre Zeichnung an den verfügbaren Platz hängen.
 *
 * Vorher lagen zwei Kopien nebeneinander: `useGanttBreite` (Aufbereitung) und
 * `useContainerBreite` (`SortableTable`). Die zweite bleibt, wo sie ist — ihr
 * Vertrag ist ein anderer (`aktiv`-Gatter, und `undefined` heißt dort „nicht
 * anwendbar", nicht „noch nicht gemessen"). Dieser Hook beantwortet nur die
 * schlichte Frage: wie breit ist das Element gerade?
 *
 * **`null` heißt „nichts Belastbares".** Eine 0-Breite ist kein Messwert,
 * sondern die Auskunft „liegt (noch) nicht im Layout" — verborgene Pane, erster
 * Rahmen, kein `ResizeObserver`. Wer misst, braucht dafür ein festes Rückfallmaß;
 * eine 0 durchzureichen zerquetschte die Zeichnung.
 *
 * **Erstmessung synchron, vor dem Beobachter.** `useLayoutEffect` landet noch
 * vor dem ersten Anstrich; ohne die synchrone Messung blitzt ein Rahmen lang das
 * Rückfallmaß auf, weil der `ResizeObserver` erst danach feuert.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Welches Maß gemeint ist:
 * - `'inhalt'` — `clientWidth`: die Innenbreite ohne Rahmen und ohne einen
 *   etwaigen senkrechten Scrollbalken. Das richtige Maß für „wie viel Platz habe
 *   ich zum Zeichnen".
 * - `'rahmen'` — `getBoundingClientRect().width`: das äußere Maß, inklusive
 *   Rahmen und Transformationen. Nötig bei `<svg>`, wo `clientWidth` nicht
 *   überall belastbar ist.
 */
export type BreitenMass = 'inhalt' | 'rahmen';

export function useElementBreite<T extends Element>(
  mass: BreitenMass = 'inhalt',
): [RefObject<T | null>, number | null] {
  const ref = useRef<T | null>(null);
  const [breite, setBreite] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = (): void => {
      const roh = mass === 'inhalt'
        ? (el as Element & { clientWidth: number }).clientWidth
        : el.getBoundingClientRect().width;
      setBreite(roh > 0 ? Math.round(roh) : null);
    };
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mass]);

  return [ref, breite];
}

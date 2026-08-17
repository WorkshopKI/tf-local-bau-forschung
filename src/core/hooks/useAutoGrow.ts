/**
 * Ein Textfeld, das bis `maxZeilen` mitwächst und danach ziehbar ist.
 *
 * Die Verdrahtung zur Rechnung in
 * [autoGrowHoehe.ts](../utils/autoGrowHoehe.ts) — DOM-Messung, Zieh-Erkennung,
 * Layout-Effekt. Als Hook, weil es im Chat zwei Eingabefelder gibt (der volle
 * Composer der Suche und die schlanke `<textarea>` des Shell-Docks) und ein
 * drittes Exemplar derselben zwanzig Zeilen die Stelle wäre, an der sie
 * auseinanderlaufen.
 *
 * Der Aufrufer setzt am Feld selbst nur zwei Dinge: `rows` (die Grundhöhe, die
 * hier einmal gemessen wird) und `resize: vertical` im CSS. Eine `max-height`
 * im CSS ist die ZIEH-Grenze, nicht der Auto-Deckel — `maxZeilen` deckelt nur
 * das Wachsen, sonst wäre das Feld genau bis zu der Höhe ziehbar, die es
 * ohnehin von selbst erreicht.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { berechneAutoHoehe } from '@/core/utils/autoGrowHoehe';

export interface AutoGrow {
  /** Ans Feld hängen — erkennt die Zieh-Geste. */
  onPointerDown: () => void;
}

export function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  wert: string,
  maxZeilen: number,
): AutoGrow {
  /** Höhe des leeren Feldes (= `rows`), EINMAL vor dem ersten `height:'auto'`. */
  const grundHoehe = useRef(0);
  /**
   * Vom Nutzer gezogene MINDESThöhe — nur für diese Sitzung, bewusst nicht
   * gemerkt: das Feld steht in zwei Hosts und in jeder Unterhaltung neu, und
   * eine einmal groß gezogene Höhe würde sonst jedes spätere Panel dominieren.
   */
  const [gezogen, setGezogen] = useState<number | undefined>(undefined);

  // Layout-Effekt statt useEffect, damit die Höhe vor dem Paint steht (sonst
  // blitzt beim Öffnen die Ein-Zeilen-Höhe auf). Die Grundhöhe muss VOR dem
  // ersten `height:'auto'` gemessen werden — das hebelt `rows` aus, und das
  // leere Feld fiele danach auf eine Zeile zusammen.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    if (grundHoehe.current === 0) grundHoehe.current = ta.offsetHeight;
    const stil = getComputedStyle(ta);
    // `lineHeight: normal` liefert keine Zahl — dann ist die Schriftgröße mal
    // 1.2 die brauchbarste Näherung, und 20 px der letzte Notnagel.
    const zeile = parseFloat(stil.lineHeight)
      || (parseFloat(stil.fontSize) || 0) * 1.2
      || 20;
    const rahmen = (parseFloat(stil.paddingTop) || 0) + (parseFloat(stil.paddingBottom) || 0);
    ta.style.height = 'auto';
    ta.style.height = `${berechneAutoHoehe(
      ta.scrollHeight, grundHoehe.current, gezogen, maxZeilen * zeile + rahmen,
    )}px`;
  }, [ref, wert, gezogen, maxZeilen]);

  /**
   * Zieh-Geste: Höhe beim Zeiger-Druck merken, beim Loslassen vergleichen.
   * Bewusst KEIN `ResizeObserver` — der kann Tipp-Wachstum nicht vom Ziehen
   * unterscheiden und ratschte die Mindesthöhe beim Schreiben hoch. Ein bloßer
   * Klick ins Feld ändert nichts (Schwelle 1 px).
   */
  const onPointerDown = (): void => {
    const ta = ref.current;
    if (!ta) return;
    const vorher = ta.offsetHeight;
    window.addEventListener('pointerup', () => {
      const nachher = ref.current?.offsetHeight ?? vorher;
      if (Math.abs(nachher - vorher) <= 1) return;
      setGezogen(nachher);
    }, { once: true });
  };

  return { onPointerDown };
}

/**
 * Die reinen Regeln fürs Ziehen im Phasen-Editor.
 *
 * Getrennt vom Component aus demselben Grund wie `ordnerDrag.ts`: ob ein Zug
 * erlaubt ist, entscheidet die Struktur, nicht die Anzeige — und genau das lässt
 * sich ohne DOM prüfen.
 *
 * Der Baum kennt zwei Sorten Knoten, und die Regeln folgen daraus:
 * **Codes wandern zwischen Phasen, Phasen wandern nur untereinander.** Ein Code
 * auf einen Code gezogen hieße „mach diesen Status zum Unterpunkt jenes Status"
 * — dafür gibt es keine Bedeutung. Eine Phase in eine Phase hieße Unterphasen,
 * und die gibt es bewusst nicht: die Leiste im Verbund-Kopf ist eine Reihe, kein
 * Baum.
 */
import { WURZEL_ID, OHNE_PHASE_ID, codeAusKnotenId, type PhasenBaumKnoten } from './phasenKnoten';
import type { TfTreeItems } from '@/components/tree';

/** Was ein Drop bewirken soll — oder warum er nichts bewirkt. */
export type PhasenZug =
  | { art: 'code-umhaengen'; codes: number[]; zielPhase: string | null }
  | { art: 'phase-sortieren'; phaseId: string; index: number }
  | { art: 'nichts' };

/** Ist `id` ein Knoten, unter den Codes einziehen können? */
function istPhasenZiel(items: TfTreeItems<PhasenBaumKnoten>, id: string): boolean {
  const art = items[id]?.data.art;
  return art === 'phase' || art === 'ohne-phase';
}

/**
 * Darf die Auswahl unter `zielId` abgelegt werden?
 *
 * Gemischte Auswahlen (Phase UND Code gleichzeitig) werden abgelehnt: es gäbe
 * kein Ziel, das für beide dasselbe bedeutet.
 */
export function darfAblegen(
  items: TfTreeItems<PhasenBaumKnoten>, quellIds: readonly string[], zielId: string,
): boolean {
  if (quellIds.length === 0) return false;
  const arten = new Set(quellIds.map(id => items[id]?.data.art));
  if (arten.size !== 1) return false;
  const [art] = [...arten];

  if (art === 'code') {
    // Ein Code zieht in eine Phase oder in die Gruppe „ohne Phase" — sonst
    // nirgendwohin. Insbesondere nicht auf die Wurzel: „oberste Ebene" ist für
    // Codes kein Zustand, den es gibt.
    if (!istPhasenZiel(items, zielId)) return false;
    // Ein Zug, der nichts ändert, wird gar nicht erst als Ziel angeboten.
    return quellIds.some(id => elternVon(items, id) !== zielId);
  }

  if (art === 'phase') {
    // Phasen sortieren sich nur auf oberster Ebene. „Ohne Phase" ist kein Ziel:
    // sie ist keine Verfahrensphase und hat keine Position im Ablauf.
    return zielId === WURZEL_ID;
  }

  // Die Gruppe „ohne Phase" selbst wird nicht gezogen — sie steht immer am Ende.
  return false;
}

/** Wer ist der Elternknoten von `id`? */
function elternVon(items: TfTreeItems<PhasenBaumKnoten>, id: string): string | null {
  for (const knoten of Object.values(items)) {
    if (knoten.children?.includes(id)) return knoten.id;
  }
  return null;
}

/** Darf gezogen werden? Die Wurzel und die Gruppe „ohne Phase" bleiben, wo sie sind. */
export function darfZiehen(quellIds: readonly string[]): boolean {
  return quellIds.length > 0
    && quellIds.every(id => id !== WURZEL_ID && id !== OHNE_PHASE_ID);
}

/**
 * Übersetzt einen Drop in die Aktion, die der Store ausführen soll.
 *
 * Reine Übersetzung, keine Prüfung: `darfAblegen` hat vorher entschieden. Was
 * hier `'nichts'` liefert, ist ein Drop, den der Baum trotz `canDrop` gemeldet
 * hat — etwa weil sich der Bestand zwischen Aufheben und Ablegen geändert hat.
 */
export function deuteZug(
  items: TfTreeItems<PhasenBaumKnoten>,
  quellIds: readonly string[],
  zielId: string,
  index: number | undefined,
): PhasenZug {
  const arten = new Set(quellIds.map(id => items[id]?.data.art));
  if (arten.size !== 1) return { art: 'nichts' };
  const [art] = [...arten];

  if (art === 'code') {
    if (!istPhasenZiel(items, zielId)) return { art: 'nichts' };
    const codes = quellIds.map(codeAusKnotenId).filter((c): c is number => c !== null);
    if (codes.length === 0) return { art: 'nichts' };
    return {
      art: 'code-umhaengen',
      codes,
      zielPhase: zielId === OHNE_PHASE_ID ? null : zielId,
    };
  }

  if (art === 'phase' && zielId === WURZEL_ID && quellIds.length === 1) {
    // Ohne `reorder` liefert der Baum keinen Index — dann ist der Zug ein
    // Nichts, statt die Phase kommentarlos ans Ende zu setzen.
    if (index === undefined) return { art: 'nichts' };
    const phaseId = quellIds[0]!;
    return {
      art: 'phase-sortieren',
      phaseId,
      index: grenzeEin(items, zielPosition(items, phaseId, index)),
    };
  }

  return { art: 'nichts' };
}

/**
 * Vom **Einfüge**-Index des Baums zur **Ziel-Position** des Stores.
 *
 * Zwei verschiedene Zählungen, die nur bei Aufwärts-Zügen übereinstimmen. Der
 * Baum meldet, vor welches Kind der Ablegepunkt fällt — gezählt in der Liste,
 * wie sie NOCH dasteht. `verschiebeZahPhase` nimmt die Phase dagegen erst heraus
 * und setzt sie dann an `index`; alles hinter ihr ist da schon um eins
 * nachgerückt. Ein Zug nach unten landete deshalb exakt eine Position zu weit,
 * ein Zug nach oben richtig — der Versatz war immer genau 1 und sah aus wie
 * „der Baum hat mich nicht verstanden".
 */
function zielPosition(
  items: TfTreeItems<PhasenBaumKnoten>, phaseId: string, index: number,
): number {
  const kinder = items[WURZEL_ID]?.children ?? [];
  const aktuell = kinder.indexOf(phaseId);
  if (aktuell < 0) return index;
  return index > aktuell ? index - 1 : index;
}

/**
 * Der Einfügeindex, auf die Phasen begrenzt.
 *
 * Die Wurzel führt die Phasen UND die Gruppe „ohne Phase" als letztes Kind. Ein
 * Drop hinter diese Gruppe würde sonst als „Phase an letzter Stelle" gelesen und
 * schöbe sie hinter etwas, das gar keine Phase ist.
 */
function grenzeEin(items: TfTreeItems<PhasenBaumKnoten>, index: number): number {
  const anzahlPhasen = (items[WURZEL_ID]?.children?.length ?? 1) - 1;
  return Math.max(0, Math.min(anzahlPhasen - 1, index));
}

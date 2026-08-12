/**
 * Verbindet ein Kanban-Widget mit seinem Vollbild-Fenster.
 *
 * ── Warum der Griff ein Modul-Singleton ist und kein `useRef` ─────────────────
 * Ein Klick auf eine Karte navigiert die App zum Antrag — und hängt damit die
 * Startseite samt Widget aus dem Baum. Läge der Griff im Widget, wäre das
 * Fenster nach dem ersten Karten-Klick unerreichbar: kein Schließen, kein
 * Weiterzeichnen, und beim Zurückkehren auf die Startseite ein zweites Fenster
 * daneben. Der Register-Eintrag überlebt das Aus- und Wiedereinhängen; das
 * Widget klinkt sich beim nächsten Mounten einfach wieder ein.
 *
 * Gekeyt nach Widget-Instanz: die Config erlaubt mehrere Kanban-Widgets, und
 * ein geteiltes Fenster liessen sie sich gegenseitig überschreiben.
 *
 * ── Was passiert, wenn die Startseite weg ist ────────────────────────────────
 * Nichts Stilles. Beim Aushängen bekommt das Fenster EINEN letzten Zustand mit
 * `verwaist` — es sagt dann selbst, dass es nicht mehr nachgeführt wird. Ein
 * Fenster stillschweigend einfrieren zu lassen wäre eine Lüge, es zuzumachen
 * eine Frechheit (der Karten-Klick löst das Aushängen ja selbst aus).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { oeffneAppFenster, type AppFensterGriff } from '@/components/fenster/appFenster';
import { berechneGrossGeometrie } from '@/components/fenster/fensterGeometrie';

/** Offene Fenster je Widget-Instanz — überlebt das Aushängen des Widgets. */
const register = new Map<string, AppFensterGriff>();

function lebender(id: string): AppFensterGriff | null {
  const g = register.get(id);
  if (g && g.offen()) return g;
  if (g) register.delete(id);
  return null;
}

export interface VollbildSteuerung {
  /** SYNCHRON aus dem Klick aufrufen (Popup-Blocker). Ein zweiter Klick holt
   *  ein bereits offenes Fenster nach vorn. */
  oeffne: () => void;
  /** Ob gerade ein Fenster dieser Instanz offen ist. Der Aufrufer rechnet den
   *  Inhalt nur dann aus. */
  offen: boolean;
  /** Der Browser hat das Fenster verweigert — der Aufrufer muss es sagen. */
  blockiert: boolean;
}

/**
 * @param instanzId  Widget-Instanz (Fenstername + Register-Schlüssel).
 * @param titel      Fenstertitel.
 * @param zeichne    Baut den Inhalt. Wird NUR bei offenem Fenster gerufen; in
 *                   `useCallback` mit den Daten-Abhängigkeiten wickeln, sonst
 *                   zeichnet das Fenster bei jedem Rendern neu.
 *                   `verwaist` ist beim Abschieds-Zustand `true`.
 */
export function useKanbanVollbild(
  instanzId: string,
  titel: string,
  zeichne: (verwaist: boolean) => React.ReactNode,
): VollbildSteuerung {
  const [offen, setOffen] = useState<boolean>(() => lebender(instanzId) !== null);
  const [blockiert, setBlockiert] = useState(false);
  // Der Abschieds-Zustand wird beim Aushängen gezeichnet — dort ist `zeichne`
  // aus der Closure des letzten Rendervorgangs die richtige Fassung.
  const letzte = useRef(zeichne);
  letzte.current = zeichne;

  const oeffne = useCallback((): void => {
    const da = lebender(instanzId);
    if (da) { da.fokussiere(); setOffen(true); return; }
    const griff = oeffneAppFenster({
      name: `teamflow-kanban-${instanzId}`,
      titel,
      geo: berechneGrossGeometrie(window.screen),
      beiEnde: () => { register.delete(instanzId); setOffen(false); },
    });
    if (!griff) { setBlockiert(true); setOffen(false); return; }
    register.set(instanzId, griff);
    setBlockiert(false);
    setOffen(true);
  }, [instanzId, titel]);

  // Nachführen, solange Widget und Fenster beide da sind.
  useEffect(() => {
    if (!offen) return;
    const griff = lebender(instanzId);
    if (!griff) { setOffen(false); return; }
    griff.rendere(zeichne(false));
  }, [offen, instanzId, zeichne]);

  // Abschied: EIN letzter Zustand, der den Stillstand benennt. Kein Schließen —
  // das Aushängen ist oft die Folge eines Klicks IM Fenster.
  useEffect(() => () => {
    lebender(instanzId)?.rendere(letzte.current(true));
  }, [instanzId]);

  return { oeffne, offen, blockiert };
}

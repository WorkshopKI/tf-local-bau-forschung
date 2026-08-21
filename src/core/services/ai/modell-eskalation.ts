/**
 * Die letzte Modell-Anhebung, damit sie jemand sieht.
 *
 * Ein Auto-Wechsel, den niemand bemerkt, ist ein stiller Modellwechsel — und
 * dann steht später eine Antwort da, von der niemand weiß, welches Modell sie
 * erzeugt hat. Skill-Läufe tragen ihre Wahl am Ergebnis (`SkillRunResult.modellWahl`);
 * die Pfade daneben — Assistent-Turn, Chat, Aufbereitungs-Bausteine, Feedback,
 * Gedächtnis — haben kein solches Ergebnis-Objekt, an dem ein Hinweis hängen
 * könnte. Für die führt der Transport hier mit, was er zuletzt angehoben hat.
 *
 * **Session-only, kein Persistieren**: die Meldung gehört zu einem Lauf, nicht zu
 * einem Zustand. Über einen Reload hinweg stehenzubleiben würde sie zur
 * Behauptung über etwas machen, das längst vorbei ist.
 *
 * Importiert NUR `zustand` + den Typ → keine Kante zurück in den Transport.
 */

import { create } from 'zustand';
import type { ModellWahl } from './modell-wahl';
import type { BridgeZiel } from './transports/streamlit';

export interface ModellEskalation {
  /** Was der Bearbeiter gewählt hatte. */
  von: BridgeZiel;
  /** Worauf der Lauf angehoben wurde. */
  nach: BridgeZiel;
  /** Umfang, der den Ausschlag gab (Zeichen). */
  zeichen: number;
  /** true = auch das größere Fenster reicht nicht, es wurde zusätzlich gekürzt. */
  reichtTrotzdemNicht: boolean;
  /** Wann (Date.now()) — damit eine Anzeige alte Meldungen ausblenden kann. */
  zeitpunkt: number;
}

interface ModellEskalationStore {
  letzte: ModellEskalation | null;
  melde: (von: BridgeZiel, wahl: ModellWahl, zeitpunkt: number) => void;
  /** Nach dem Anzeigen zurücksetzen (die Meldung ist einmalig, kein Dauerzustand). */
  quittiere: () => void;
}

export const useModellEskalation = create<ModellEskalationStore>((set) => ({
  letzte: null,

  melde: (von, wahl, zeitpunkt) => set({
    letzte: {
      von,
      nach: wahl.modell,
      zeichen: wahl.zeichen,
      reichtTrotzdemNicht: wahl.reichtTrotzdemNicht,
      zeitpunkt,
    },
  }),

  quittiere: () => set({ letzte: null }),
}));

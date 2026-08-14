/**
 * Die beiden übrigen Suchoptionen neben der Wortverknüpfung (v4.5):
 * „Wortformen mitsuchen" und „Suchen in".
 *
 * Schwester von [[useSuchVerknuepfung]] — dort steht, WIE die Wörter verknüpft
 * werden, hier, WOMIT und WORIN gesucht wird. Beide persistieren, weil sie
 * Arbeitsgewohnheiten sind und nichts kosten.
 *
 * `stammSuche` ist NICHT die Ähnlichkeitssuche: die lädt ein Embedding-Modell
 * (~200 MB) und bleibt deshalb ihr eigener, opt-in-Schalter
 * ([[useSemanticSearchMode]]). Der Wortstamm-Vergleich ist deterministisch und
 * kostenlos — die beiden zu einem Schalter zusammenzuziehen hieße, ein
 * Modell-Nachladen hinter einer harmlosen Beschriftung zu verstecken.
 */
import { create } from 'zustand';
import { parseSuchbereich, type Suchbereich } from '@/core/services/search/suchbereich';

/**
 * Der Schlüssel trägt seit v4.44.0 ein `_v2`, und das ist der Zweck: ein einmal
 * gewählter enger Bereich lag sonst für immer im Speicher und schlug jeden
 * Code-Standard. Wer irgendwann „nur Ort & Bundesland" eingestellt hatte, suchte
 * Monate später immer noch dort — und las das Ergebnis als „steht nicht im
 * Bestand" statt als „hier habe ich nicht nachgesehen". Genau dieser Fall wurde
 * gemeldet. Der Bump kostet eine Dropdown-Wahl und setzt alle einmal auf „alle
 * Felder" zurück; sichtbar bleibt die Einstellung danach über die Markierung an
 * der Auswahl ([[SuchOptionenZeile]]).
 */
const BEREICH_KEY = 'teamflow_suche_bereich_v2';
const STAMM_KEY = 'teamflow_suche_stammsuche';

function ladeBereich(): Suchbereich {
  try {
    return parseSuchbereich(localStorage.getItem(BEREICH_KEY));
  } catch {
    return 'alles';
  }
}

function ladeStammSuche(): boolean {
  try {
    return localStorage.getItem(STAMM_KEY) === '1';
  } catch {
    return false;
  }
}

interface SuchOptionenState {
  /** Worin gesucht wird. */
  bereich: Suchbereich;
  setBereich: (b: Suchbereich) => void;
  /** Wortstamm-Varianten mitsuchen („Normen" findet „Normung"). */
  stammSuche: boolean;
  setStammSuche: (an: boolean) => void;
  /**
   * Abgewählte Stamm-Varianten, klein geschrieben.
   *
   * NICHT persistiert und an die aktuelle Anfrage gebunden: „Normung" abwählen
   * heißt „bei DIESER Suche nicht", nicht „nie wieder". Die Suche setzt die
   * Liste beim Wechsel der Anfrage selbst zurück.
   */
  abgewaehlteVarianten: string[];
  toggleVariante: (v: string) => void;
  setzeVariantenZurueck: () => void;
}

export const useSuchOptionen = create<SuchOptionenState>((set, get) => ({
  bereich: ladeBereich(),
  setBereich: (bereich) => {
    try { localStorage.setItem(BEREICH_KEY, bereich); } catch { /* ignore */ }
    set({ bereich });
  },
  stammSuche: ladeStammSuche(),
  setStammSuche: (stammSuche) => {
    try { localStorage.setItem(STAMM_KEY, stammSuche ? '1' : '0'); } catch { /* ignore */ }
    // Beim Ausschalten die Abwahl mit aufräumen: sonst wirkt sie unsichtbar
    // weiter, sobald jemand den Schalter wieder anstellt.
    set(stammSuche ? { stammSuche } : { stammSuche, abgewaehlteVarianten: [] });
  },

  abgewaehlteVarianten: [],
  toggleVariante: (v) => {
    const klein = v.toLowerCase();
    const aktuell = get().abgewaehlteVarianten;
    set({
      abgewaehlteVarianten: aktuell.includes(klein)
        ? aktuell.filter(x => x !== klein)
        : [...aktuell, klein],
    });
  },
  setzeVariantenZurueck: () => {
    // Referenz-Identität wahren: ein leeres Array bei jedem Aufruf neu zu setzen
    // triggerte den Such-Effekt endlos.
    if (get().abgewaehlteVarianten.length > 0) set({ abgewaehlteVarianten: [] });
  },
}));

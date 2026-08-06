/**
 * Stellung des „Beendet"-Schalters im „Alle"-Tab: stehen terminale Anträge in
 * der Liste oder nicht (Journey-Paket 2 Phase 5, eigene Achse seit v3.5).
 *
 * Genau EIN Boolean, global statt pro Reiter — der Schalter existiert nur im
 * „Alle"-Tab (`hatBeendetAchse`), eine Per-View-Karte hätte also nur einen
 * belegten Eintrag. Default = ausgeblendet: der Arbeitsvorrat steht oben, das
 * Beendete ist einen Klick entfernt.
 *
 * Bewusst ein eigener Store statt `useStatusSectionCollapsed`: Letzterer ist
 * per `StatusPhaseLabel` (Offen/NF/Bewilligt/… ) gekeyt und trägt eine
 * Phase-spezifische Migration — die binäre Beendet-Sichtbarkeit hat eine andere
 * Semantik und würde das Label „Abgeschlossen" kollidieren lassen.
 *
 * Persistenz: localStorage `teamflow_antraege_archiv_collapsed` ('1'|'0'). Der
 * **Schlüssel bleibt bewusst der alte** — die gespeicherte Aussage ist
 * unverändert („terminale Anträge nicht in der Liste"), nur ihre Bedienung
 * heißt jetzt Schalter statt Einklappen. Ein neuer Key hätte jeden bestehenden
 * Wunsch stillschweigend verworfen.
 */
import { create } from 'zustand';

const STORAGE_KEY = 'teamflow_antraege_archiv_collapsed';

function loadAusgeblendet(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return true; // Default: Beendetes ausgeblendet
    return raw === '1';
  } catch {
    return true;
  }
}

function saveAusgeblendet(v: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* ignore quota / unavailable */
  }
}

interface BeendetSichtbarkeitState {
  /** `true` = beendete Anträge stehen nicht in der Liste. */
  ausgeblendet: boolean;
  setAusgeblendet: (v: boolean) => void;
}

export const useBeendetSichtbarkeit = create<BeendetSichtbarkeitState>((set) => ({
  ausgeblendet: loadAusgeblendet(),
  setAusgeblendet: (v) => {
    saveAusgeblendet(v);
    set({ ausgeblendet: v });
  },
}));

/**
 * „Ist das Modul JETZT benutzbar?" — die Laufzeit-Antwort (v3.0).
 *
 * Zwei Fragen, die man sauber trennen muss:
 *
 *   - `isAuslastungEnabled()` / `isKuratorMenusEnabled()` (feature-flags.ts)
 *     = **Bauzeit**: ist das Modul ueberhaupt einkompiliert?
 *   - `isAuslastungFreigeschaltet()` / `isKuratorFreigeschaltet()` (hier)
 *     = **Bauzeit UND Laufzeit**: darf der Mensch davor es gerade sehen?
 *
 * Bis v2.x fielen beide zusammen, weil eigene Build-Varianten die Zielgruppen
 * trennten. Seit der Zusammenlegung entscheidet ein Passwort — und fast jede
 * Sichtbarkeits-Abfrage meint die zweite Frage.
 *
 * **Warum ein eigenes Modul statt feature-flags.ts?** Ein Store-Import dort
 * schloesse den Zyklus feature-flags → useKuratorSession → kurator-config →
 * smb-handle → feature-flags. `npm run cycles` hat eine leere Allowlist. Der
 * Nebeneffekt ist willkommen: jede umgestellte Aufrufstelle wird als
 * Import-Aenderung im Diff sichtbar.
 *
 * Siehe docs/architecture/modul-freischaltung.md.
 */

import { modulSichtbar, type ModulSlot } from '@/config/modul-schloss';
import { hatModulSchloss, isAuslastungEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';

export type { ModulSlot };

/**
 * Ist der Slot in dieser Sitzung frei? Ohne Schloss immer `true`.
 *
 * Routet je Slot an die richtige Quelle: `kurator` haengt an der bestehenden
 * Kurator-Session (die auch die Schreibrechte traegt), `auslastung` am eigenen
 * Freischalt-Store.
 */
export function istModulFrei(slot: ModulSlot): boolean {
  if (!hatModulSchloss(slot)) return true;
  return slot === 'kurator'
    ? useKuratorSession.getState().isActive
    : useModulFreischaltung.getState().auslastungFrei;
}

/** Auslastungs-Modul sichtbar? (einkompiliert UND freigeschaltet) */
export function isAuslastungFreigeschaltet(): boolean {
  return modulSichtbar({
    imBuild: isAuslastungEnabled(),
    hatSchloss: hatModulSchloss('auslastung'),
    frei: istModulFrei('auslastung'),
  });
}

/** Kurations-Oberflaeche sichtbar? (einkompiliert UND freigeschaltet) */
export function isKuratorFreigeschaltet(): boolean {
  return modulSichtbar({
    imBuild: isKuratorMenusEnabled(),
    hatSchloss: hatModulSchloss('kurator'),
    frei: istModulFrei('kurator'),
  });
}

/**
 * React-Varianten — nur diese abonnieren den Store.
 *
 * `getState()` in einem Render abonniert NICHT: eine Komponente, die das reine
 * Praedikat liest, bekaeme ein Ablaufen oder eine Freischaltung mitten in der
 * Sitzung nicht mit. Dienste und Nicht-React-Aufrufer (widgetCatalog,
 * feedbackService, Plugin-onInit) nutzen die Praedikate oben, Komponenten diese
 * Hooks.
 */
export function useAuslastungFrei(): boolean {
  const frei = useModulFreischaltung(s => s.auslastungFrei);
  return modulSichtbar({
    imBuild: isAuslastungEnabled(),
    hatSchloss: hatModulSchloss('auslastung'),
    frei: hatModulSchloss('auslastung') ? frei : true,
  });
}

export function useKuratorFrei(): boolean {
  const aktiv = useKuratorSession(s => s.isActive);
  return modulSichtbar({
    imBuild: isKuratorMenusEnabled(),
    hatSchloss: hatModulSchloss('kurator'),
    frei: hatModulSchloss('kurator') ? aktiv : true,
  });
}

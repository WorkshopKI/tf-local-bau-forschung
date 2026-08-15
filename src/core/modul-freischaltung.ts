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
import { runtimeConfig } from '@/config/runtime-config';
import { hatModulSchloss, isAuslastungEnabled, isKuratorMenusEnabled } from '@/config/feature-flags';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useModulFreischaltung } from '@/core/hooks/useModulFreischaltung';
import type { IDBStore } from '@/core/services/storage/idb-store';

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

/**
 * Schliesst jedes Modul, das ein Schloss traegt — aufgerufen, BEVOR die
 * Anmelde-Wall erscheint (v3.27).
 *
 * **Die Anmeldung LEGT den Freischalt-Zustand FEST, sie ergaenzt ihn nicht.** Eine
 * Freischaltung ist eine Aussage ueber das zuletzt getippte Passwort, nicht ueber
 * die naechsten 12 Stunden. Ohne diesen Schnitt zeigte eine Anmeldung mit dem
 * Basis-Passwort weiter, was eine fruehere Sitzung mit einem Modul-Passwort
 * geoeffnet hatte — genau das war in zah-pl v3.25 zu sehen. Der Gate oeffnet
 * danach genau den Slot, dessen Passwort getroffen hat.
 *
 * Warum hier und nicht im Gate: laeuft der Schnitt erst nach dem Login, haben
 * Plugin-Registrierung, `onInit`-Warmup und modul-globale Konstanten den alten
 * Zustand laengst aufgeloest.
 *
 * Module OHNE Schloss bleiben unberuehrt (dev/local) — dort gibt es nichts zu
 * schuetzen, und ein Ruecksetzen wuerfe nur die Kurator-Session der
 * Abnahme-Umgebung weg. `hatSchloss` ist injizierbar, weil Vitest
 * `__TEAMFLOW_CONFIG__` fest auf eine Config ohne `moduleAuth` verdrahtet.
 */
export async function schliesseGesperrteModule(
  idb: IDBStore,
  hatSchloss: (slot: ModulSlot) => boolean = hatModulSchloss,
): Promise<void> {
  if (hatSchloss('auslastung')) {
    await useModulFreischaltung.getState().sperren(idb);
  }
  if (hatSchloss('kurator')) {
    await useKuratorSession.getState().deactivate(idb);
  }
}

/**
 * Ohne Schloss folgt die Kurator-SITZUNG dem Schalter im Profil.
 *
 * **Warum das nötig ist:** die Sitzung traegt die Schreibrechte (jede
 * Schreib-Aktion prueft `session.isActive`), geoeffnet wird sie aber nur vom
 * Passwort-Weg (`ZusatzModuleGruppe/ModulZeile`). In einem Build OHNE
 * `moduleAuth.kurator` gibt es diesen Weg nicht — dort steht statt des
 * Passwortfelds der freie Schalter, und der setzte bis v4.59 nur die
 * Profil-Flagge. Ergebnis: die Kurations-Menues waren sichtbar, aber JEDE
 * Schreib-Aktion darin blieb grau („Mapping bearbeiten", „Spalten neu mappen",
 * „Antrags-Daten zuruecksetzen") — ohne dass irgendwo stand, warum.
 *
 * Mit Schloss aendert diese Funktion nichts: dort entscheidet allein das
 * Passwort, und die Profil-Flagge waere die offene Hintertuer daneben.
 *
 * `hatSchloss` ist injizierbar (Vitest verdrahtet `__TEAMFLOW_CONFIG__` fest auf
 * eine Config ohne `moduleAuth`).
 */
export async function spiegleKuratorSchalterInSession(
  idb: IDBStore,
  istKurator: boolean,
  hatSchloss: (slot: ModulSlot) => boolean = hatModulSchloss,
): Promise<void> {
  if (hatSchloss('kurator')) return;
  const session = useKuratorSession.getState();
  if (istKurator && !session.isActive) {
    await session.aktiviere(idb, `${runtimeConfig.build.label} · Kurator`);
    return;
  }
  if (!istKurator && session.isActive) await session.deactivate(idb);
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

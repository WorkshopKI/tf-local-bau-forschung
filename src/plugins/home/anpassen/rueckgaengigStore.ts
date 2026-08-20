/**
 * „Rückgängig" der Startseite — EIN Mechanismus für alle umkehrbaren Eingriffe.
 *
 * **Gemerkt wird die UMKEHRUNG, nicht der ganze Vorstand** (v4.131). Bis dahin
 * hielt der Eintrag den kompletten Config-Stand von vor der Änderung und schrieb
 * ihn beim Klick zurück. Das nahm alles mit, was seither passiert war: wer ein
 * Widget ausblendete und danach ein anderes einklappte, verlor beim Klick auf
 * „Rückgängig" auch das Einklappen — obwohl die Leiste nur vom Ausblenden
 * sprach. Einklappen legt bewusst keinen Eintrag an (Handoff §2.4) und war
 * deshalb nicht wiederherstellbar; ein Lost Update, das die Leiste nicht ankündigte.
 *
 * Jetzt liefert der Aufrufer eine Funktion, die den AKTUELLEN Stand nimmt und
 * genau die Felder zurückdreht, die seine Aktion verändert hat. „Startseite
 * zurücksetzen" ist der eine Fall, der legitim alles zurückschreibt — die
 * Aktion selbst war global.
 *
 * Transient (kein Persist): ein Reload verwirft die Reue-Frist, nicht die
 * Änderung. Die Frist hängt an `seit` (Zeitstempel) und nicht an der Lebensdauer
 * der Leiste — sonst kehrte sie nach einem Seitenwechsel innerhalb der Frist
 * zurück und bot einen beliebig alten Stand an.
 */
import { create } from 'zustand';
import type { HomeWidgetConfig } from '../widgets/types';

/** Reue-Frist. Lang genug zum Lesen und Zielen, kurz genug, um nicht im Weg zu
 *  stehen. Liegt hier, weil Store und Leiste dieselbe Frist meinen müssen. */
export const RUECKGAENGIG_MS = 7000;

export interface RueckgaengigEintrag {
  /** Satz in der Leiste, z.B. „Meine Anträge ausgeblendet". */
  text: string;
  /** Dreht die eigene Änderung auf dem AKTUELLEN Stand zurück. */
  wende: (aktuell: HomeWidgetConfig) => HomeWidgetConfig;
  /** Unterscheidet aufeinanderfolgende Meldungen mit gleichem Text (Timer-Reset). */
  nr: number;
  /** `Date.now()` beim Merken — Grundlage der Reue-Frist. */
  seit: number;
}

interface RueckgaengigState {
  eintrag: RueckgaengigEintrag | null;
  merke: (text: string, wende: ((aktuell: HomeWidgetConfig) => HomeWidgetConfig) | null) => void;
  leere: () => void;
}

export const useRueckgaengigStore = create<RueckgaengigState>((set, get) => ({
  eintrag: null,
  // Ohne Umkehrung gibt es nichts zurückzunehmen — dann auch keine Leiste,
  // die etwas verspricht, das der Knopf nicht halten könnte.
  merke: (text, wende) => {
    if (!wende) return;
    set({
      eintrag: { text, wende, nr: (get().eintrag?.nr ?? 0) + 1, seit: Date.now() },
    });
  },
  leere: () => set({ eintrag: null }),
}));

/**
 * Stellt die Sichtbarkeit der genannten Instanzen wieder her — die Umkehrung
 * hinter „Ausblenden" und dem „alle"-Schalter einer Spalte. Alles andere am
 * aktuellen Stand bleibt, wie es ist.
 */
export function stelleSichtbarkeitHer(
  vorher: ReadonlyMap<string, boolean>,
): (aktuell: HomeWidgetConfig) => HomeWidgetConfig {
  return aktuell => ({
    ...aktuell,
    widgets: aktuell.widgets.map(w =>
      (vorher.has(w.id) ? { ...w, sichtbar: vorher.get(w.id)! } : w)),
  });
}

/**
 * Transienter Offen-Zustand des Startseiten-Menüs (v4.6).
 *
 * Vier Auslöser, EIN Menü: Rechtsklick auf die freie Fläche, Rechtsklick auf ein
 * Widget, der Knopf im Seitenkopf, das `⋯` im Widget-Kopf und „Widget
 * hinzufügen" am Spaltenende. Weil die Auslöser über drei Komponenten-Ebenen
 * verstreut sind (HomePage · WidgetShell · HomeWidgetStack), liegt der Zustand in
 * einem Modul-Store statt in Props — dieselbe Wahl wie beim transienten
 * [feedbackNavStore](../../../components/feedback/feedbackNavStore.ts).
 *
 * Bewusst KEIN zweites Menü über Radix' `ContextMenu`: zwei Implementierungen
 * desselben Inhalts laufen auseinander, sobald jemand einen Eintrag nur an einer
 * Stelle ergänzt (Lehre aus `TicketMenue`, v3.18). Persistiert wird hier nichts —
 * die Widget-Config schreibt `useHomeWidgets`.
 */
import { create } from 'zustand';

/** Bildschirm-Koordinate, an der das Menü hängt (`position: fixed`). */
export interface MenuePunkt {
  x: number;
  y: number;
}

/** Flächen-Menü („Startseite anpassen") vs. Menü eines einzelnen Widgets. */
export type MenueZiel =
  | { art: 'flaeche' }
  | { art: 'widget'; instanzId: string };

export type UntermenueId = 'widgets' | 'darstellung';

/** Zweite Ansicht im selben Panel (TicketMenue-Muster) statt zweitem Popover. */
export type MenueAnsicht = 'menue' | 'einstellungen';

interface OeffnenOptionen {
  /** Direkt mit offenem Untermenü starten — „Widget hinzufügen". */
  untermenue?: UntermenueId;
}

interface StartseiteMenueState {
  /** null = geschlossen. */
  offen: { ziel: MenueZiel; punkt: MenuePunkt } | null;
  untermenue: UntermenueId | null;
  /**
   * Y-Versatz des Untermenü-Panels in Pixeln — es soll an der auslösenden Zeile
   * kleben, nicht am Kopf des Hauptmenüs (Handoff-Screenshots 03/04).
   */
  untermenueVersatz: number;
  ansicht: MenueAnsicht;
  oeffne: (ziel: MenueZiel, punkt: MenuePunkt, opts?: OeffnenOptionen) => void;
  schliesse: () => void;
  zeigeUntermenue: (id: UntermenueId | null, versatz?: number) => void;
  zeigeAnsicht: (ansicht: MenueAnsicht) => void;
}

export const useStartseiteMenueStore = create<StartseiteMenueState>(set => ({
  offen: null,
  untermenue: null,
  untermenueVersatz: 0,
  ansicht: 'menue',
  oeffne: (ziel, punkt, opts) => set({
    offen: { ziel, punkt },
    untermenue: opts?.untermenue ?? null,
    untermenueVersatz: 0,
    ansicht: 'menue',
  }),
  schliesse: () => set({ offen: null, untermenue: null, untermenueVersatz: 0, ansicht: 'menue' }),
  zeigeUntermenue: (id, versatz = 0) => set({ untermenue: id, untermenueVersatz: versatz }),
  zeigeAnsicht: ansicht => set({ ansicht, untermenue: null }),
}));

/** Ankerpunkt eines Knopfes: unter seiner linken Kante, wie ein Dropdown. */
export function punktUnter(el: HTMLElement | null): MenuePunkt {
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 4 };
}

/**
 * Soll dieser Rechtsklick das Startseiten-Menü öffnen? Nein in Eingabefeldern und
 * bei markiertem Text — dort gehört das Browser-Menü hin (Einfügen im
 * Notizen-Widget, Kopieren einer markierten Zeile). Rein, damit die Regel
 * ohne DOM-Test nachweisbar ist.
 */
export function darfMenueOeffnen(opts: {
  tagName: string;
  istEingabefeld: boolean;
  hatTextauswahl: boolean;
}): boolean {
  if (opts.istEingabefeld) return false;
  if (opts.hatTextauswahl) return false;
  const tag = opts.tagName.toLowerCase();
  return tag !== 'input' && tag !== 'textarea' && tag !== 'select';
}

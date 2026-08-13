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

/**
 * Wo das Untermenü-Panel liegt. Es hängt absolut am Hauptmenü, damit dessen
 * Position beim Aufklappen unverändert bleibt — deshalb rechnet der Aufrufer
 * Seite, Versatz und Deckel selbst aus (Handoff §2.5).
 */
export interface UntermenueLage {
  /** Y-Versatz gegen den Kopf des Hauptmenüs (das Panel klebt an seiner Zeile). */
  versatz: number;
  /** `links`, wenn rechts neben dem Hauptmenü kein Platz mehr ist. */
  seite: 'links' | 'rechts';
  /** Platz nach unten in Pixeln (0 = kein Deckel, dann greift `78vh`). */
  maxHoehe: number;
  /**
   * Falsch, solange die Lage nur geraten ist. Ein Flag statt eines Vergleichs
   * mit der Start-Referenz: die trägt nach einem Modul-Neustart nicht mehr.
   */
  gemessen: boolean;
}

/** Lage vor der ersten Messung: oben am Hauptmenü, rechts, ohne Deckel. */
export const UNTERMENUE_LAGE_START: UntermenueLage = {
  versatz: 0, seite: 'rechts', maxHoehe: 0, gemessen: false,
};

interface StartseiteMenueState {
  /** null = geschlossen. */
  offen: { ziel: MenueZiel; punkt: MenuePunkt } | null;
  untermenue: UntermenueId | null;
  lage: UntermenueLage;
  ansicht: MenueAnsicht;
  oeffne: (ziel: MenueZiel, punkt: MenuePunkt, opts?: OeffnenOptionen) => void;
  schliesse: () => void;
  zeigeUntermenue: (id: UntermenueId | null, lage?: UntermenueLage) => void;
  zeigeAnsicht: (ansicht: MenueAnsicht) => void;
}

export const useStartseiteMenueStore = create<StartseiteMenueState>(set => ({
  offen: null,
  untermenue: null,
  lage: UNTERMENUE_LAGE_START,
  ansicht: 'menue',
  oeffne: (ziel, punkt, opts) => set({
    offen: { ziel, punkt },
    untermenue: opts?.untermenue ?? null,
    lage: UNTERMENUE_LAGE_START,
    ansicht: 'menue',
  }),
  schliesse: () => set({ offen: null, untermenue: null, lage: UNTERMENUE_LAGE_START, ansicht: 'menue' }),
  zeigeUntermenue: (id, lage = UNTERMENUE_LAGE_START) => set({ untermenue: id, lage }),
  zeigeAnsicht: ansicht => set({ ansicht, untermenue: null }),
}));

/** Sicherheitsabstand zum Fensterrand, wie `collisionPadding` des Popovers. */
const RAND = 8;
/** Unter diesem Wert lohnt kein gerechneter Deckel — dann greift `78vh`. */
const MIN_HOEHE = 180;

/**
 * Wohin gehört das Untermenü neben ein Hauptmenü-Panel? Rein, damit die
 * Kollisionsregel ohne Browser prüfbar ist: nach links nur, wenn rechts kein
 * Platz ist UND links einer wäre — sonst bliebe es lieber rechts angeschnitten
 * als links aus dem Bild zu laufen.
 */
export function berechneUntermenueLage(opts: {
  /** Rechteck des Hauptmenü-Panels. */
  panel: { top: number; left: number; right: number };
  /** Oberkante der auslösenden Zeile. */
  zeileOben: number;
  breite: number;
  abstand: number;
  fensterBreite: number;
  fensterHoehe: number;
}): UntermenueLage {
  const { panel, breite, abstand, fensterBreite, fensterHoehe } = opts;
  const bedarf = breite + abstand + RAND;
  const passtRechts = fensterBreite - panel.right >= bedarf;
  const passtLinks = panel.left >= bedarf;
  const versatz = Math.max(0, opts.zeileOben - panel.top - 4);
  const platzUnten = fensterHoehe - panel.top - versatz - RAND * 2;
  return {
    versatz,
    seite: !passtRechts && passtLinks ? 'links' : 'rechts',
    maxHoehe: platzUnten >= MIN_HOEHE ? platzUnten : 0,
    gemessen: true,
  };
}

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

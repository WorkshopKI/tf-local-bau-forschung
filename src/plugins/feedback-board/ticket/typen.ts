/**
 * Geteilte Typen der Ticket-Oberfläche (v3.12). Karte, Zeile und Detail-Panel
 * bekommen denselben Kontext herein — sie unterscheiden sich in der Darstellung,
 * nicht in dem, was sie dürfen.
 */
import type { BeitragArt } from '@/components/feedback/FeedbackBeitragFeld';
import type { EffortEstimate, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
import type { Auswahl } from '../auswahl';
import type { BoardRolle } from '../smartViews';

/**
 * Was sich an einem Ticket per Chip ändern lässt. Bewusst eine kleine, feste
 * Menge: alles andere (Titel, Text, Anhänge) läuft über eigene Abläufe mit
 * eigener Bestätigung.
 */
export interface TicketPatch {
  kurator_status?: FeedbackStatus;
  effort_estimate?: EffortEstimate;
  effort_hours?: number;
  assignee?: string;
  bereich?: string;
}

export interface TicketKontext {
  rolle: BoardRolle;
  /** Darf überhaupt geschrieben werden? (canManageFeedback — nicht die Rollen-Vorschau.) */
  darfVerwalten: boolean;
  /**
   * Schreibrecht UND Entwickler-Sicht — die EINE Bedingung, an der jedes
   * verändernde Bedienelement des Boards hängt (v4.129).
   *
   * Karte, Zeile und `⋯`-Menü rechneten sie sich bis dahin je selbst aus
   * (`darfVerwalten && rolle === 'entwickler'`), und die Mehrfachauswahl samt
   * Bulk-Leiste fragte gar nichts: in der Nutzer-Vorschau trugen alle Karten ein
   * (unsichtbares, aber per Tab erreichbares) Auswahl-Häkchen, und ein Klick
   * darauf öffnete eine voll bedienbare Leiste mit „Archivieren". Die Oberfläche
   * verbarg damit, was sie nicht verbot.
   */
  darfSchreiben: boolean;
  /** Gehört das Ticket mir? Kommt aus der toleranten Identität der Seite. */
  istMeins: (t: FeedbackItem) => boolean;
  /** Ungelesene Team-Antwort auf ein eigenes Ticket. */
  istUngelesen: (t: FeedbackItem) => boolean;
  /** Anzahl neuer fremder Kommentare seit dem letzten Öffnen. */
  neueKommentare: (t: FeedbackItem) => number;
  /** Wählbare Zuständige — Kürzel/Namen, die schon im Bestand vorkommen. */
  personen: readonly string[];
  /** Meine kanonische Schreib-Id („Mir zuweisen"). */
  meineId: string | undefined;
  /** Feld ändern + Toast mit Rückgängig. Fire-and-forget: Fehler landen im Toast. */
  aendere: (t: FeedbackItem, patch: TicketPatch, meldung: string) => void;
  /** Dieselbe Änderung auf mehrere Tickets (Bulk-Leiste, Drag&Drop einer Auswahl). */
  aendereViele: (tickets: readonly FeedbackItem[], patch: TicketPatch, meldung: string) => void;
  /**
   * Einen Kommentar anhängen; `rueckfrage` setzt zusätzlich den Status.
   * Liefert `false`, wenn nichts geschrieben wurde — der Aufrufer darf den
   * Entwurf dann NICHT verwerfen, er ist die einzige Kopie.
   */
  kommentiere: (t: FeedbackItem, text: string, art: KommentarArt) => Promise<boolean>;
  /** Ticket im Detail-Panel öffnen. */
  oeffne: (t: FeedbackItem) => void;
  /** Welches Ticket ist gerade offen? */
  offeneId: string | undefined;
  // ── Mehrfachauswahl ───────────────────────────────────────────────────────
  /** Ids der markierten Tickets. */
  auswahl: Auswahl;
  /** Markierung eines Tickets umschalten. */
  schalteAuswahl: (id: string) => void;
  /**
   * Status auf mehrere Tickets ziehen (Board-Drop). Getrennt von `aendereViele`,
   * weil hier die Auswahl-Regel gilt: eine markierte Karte nimmt die ganze
   * Auswahl mit, eine unmarkierte nur sich selbst.
   */
  ziehePer: (gezogeneId: string, zielStatus: FeedbackStatus) => void;
  /** Darf gezogen werden? (Entwickler-Sicht mit Schreibrecht.) */
  darfZiehen: boolean;
}

/**
 * Art eines Beitrags im Verlauf — `rueckfrage` setzt zusätzlich den Status.
 * EIN Union, nicht zwei: die Menge ist `FeedbackComment['kind']` aus dem
 * Datenmodell, hier nur unter dem Namen, den die Ticket-Oberfläche benutzt.
 */
export type KommentarArt = BeitragArt;

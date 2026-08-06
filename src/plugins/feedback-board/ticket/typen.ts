/**
 * Geteilte Typen der Ticket-Oberfläche (v3.12). Karte, Zeile und Detail-Panel
 * bekommen denselben Kontext herein — sie unterscheiden sich in der Darstellung,
 * nicht in dem, was sie dürfen.
 */
import type { EffortEstimate, FeedbackItem, FeedbackStatus } from '@/core/types/feedback';
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
  /** Ticket im Detail-Panel öffnen. */
  oeffne: (t: FeedbackItem) => void;
  /** Welches Ticket ist gerade offen? */
  offeneId: string | undefined;
}

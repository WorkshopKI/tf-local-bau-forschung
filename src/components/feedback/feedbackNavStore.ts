/**
 * Transienter Navigations-Slot fürs Feedback-Board (v1.1).
 *
 * Das Board hält `selectedId` als internes `useState` und kennt keinen
 * Routen-/Store-Deep-Link. Damit read-only Widgets (z.B. das Feedback-Kanban
 * auf der Startseite) ein bestimmtes Ticket öffnen können, hinterlegen sie hier
 * eine „bitte öffnen"-ID; `FeedbackBoardPage` konsumiert (und leert) sie einmalig
 * beim Mount. Rein gerätelokal, kein Persist, kein Share-Write — nur Navigation.
 * Muster analog zum transienten `ampelQuickfilter` (Antragsliste, v2.229).
 */
import { create } from 'zustand';

interface FeedbackNavState {
  pendingTicketId: string | null;
  /** Vor `navigate('feedback-board')` aufrufen — das Board öffnet das Ticket. */
  requestOpenTicket: (id: string) => void;
  /** Board-Mount: liefert die vorgemerkte ID einmalig und leert den Slot. */
  consumePendingTicket: () => string | null;
}

export const useFeedbackNavStore = create<FeedbackNavState>((set, get) => ({
  pendingTicketId: null,
  requestOpenTicket: (id) => set({ pendingTicketId: id }),
  consumePendingTicket: () => {
    const id = get().pendingTicketId;
    if (id) set({ pendingTicketId: null });
    return id;
  },
}));

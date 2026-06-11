/**
 * Trivialer UI-Zustand für das Aufnahme-Overlay (kein IDB). Header-Button und
 * Page-Overlay teilen sich diesen Store, um Prop-Drilling zu vermeiden.
 */
import { create } from 'zustand';

interface AufnahmeUiState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

export const useAufnahmeUiStore = create<AufnahmeUiState>(set => ({
  open: false,
  toggle: () => set(s => ({ open: !s.open })),
  close: () => set({ open: false }),
}));

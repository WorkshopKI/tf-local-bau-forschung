/**
 * Session-Schalter für die Ähnlichkeitssuche (v2.62).
 *
 * Hintergrund: Das Embedding-Modell (~200 MB Download, entpackt ~0,5–1 GB
 * WASM/GPU im Main-Thread, Pitfall #8) wurde bisher beim bloßen Öffnen von
 * Förderanträgen/Suchseite ungefragt im Idle vorgeladen — auf RAM-knappen
 * Citrix-Umgebungen ein erheblicher Teil des Tab-Speichers, obwohl die meisten
 * Sitzungen nur Substring-Suche brauchen („schnell Metadaten checken").
 *
 * Dieser Store macht die semantische Suche opt-in: Standard ist AUS, der User
 * schaltet sie pro Sitzung über das Dropdown neben dem Suchfeld ein
 * (Förderanträge-Header + Suchseite teilen denselben Schalter — das Modell
 * wird ohnehin nur einmal geladen). Bewusst NICHT persistiert: jede Sitzung
 * startet neutral mit „Ohne Ähnlichkeitssuche", damit kein einmaliges Opt-in
 * dauerhaft ~1 GB pro Sitzung kostet.
 *
 * Das Auslastungs-Modul ist unabhängig davon — dessen Stage-2-Matching lädt
 * das Modell weiterhin selbst bei Bedarf (ensureEmbeddingReady ist idempotent).
 *
 * Non-React-Konsumenten (Such-Services) lesen `getState().enabled` über
 * `isSemanticSearchActive()` in antraege-search-service.ts.
 */
import { create } from 'zustand';

interface SemanticSearchModeState {
  /** true = User hat „Mit Ähnlichkeitssuche" gewählt (Modell darf laden). */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useSemanticSearchMode = create<SemanticSearchModeState>(set => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));

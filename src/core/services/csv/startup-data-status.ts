import { create } from 'zustand';

/**
 * Status des Start-Datenaktualisierungs-Passes (`runDataUpdate` aus App.tsx).
 *
 * Zweck: Der Snapshot-Watcher ([useSnapshotWatcher]) UND der Start-Orchestrator
 * reagieren beide auf einen neuen Datenbestand auf dem Share. Ohne Koordination
 * zeigt der Watcher seinen „Neuer Datenbestand verfügbar — Jetzt laden"-Banner
 * GLEICHZEITIG, während der Orchestrator denselben Snapshot bereits automatisch
 * lädt (Toast „Datenbestand wird aktualisiert…") — doppelte, widersprüchliche UI.
 *
 * Lösung: Der Watcher unterdrückt seinen Banner, solange der Start-Pass nicht
 * `'done'` ist. Nach Abschluss gleicht der Orchestrator den lokalen Stand an →
 * der Watcher-Check findet keinen Unterschied → kein Banner. Schlägt der
 * Start-Sync fehl (Handle verloren o.ä.), bleibt die lokale Version alt → der
 * Banner erscheint dann doch und dient als Recovery-Pfad.
 *
 * `'running'` wird in App.tsx gesetzt, sobald die Idle-Phase den Orchestrator
 * startet; `'done'` im finally (auch wenn kein Daten-Share-Handle vorliegt).
 */
export type StartupDataPhase = 'idle' | 'running' | 'done';

interface StartupDataStatusState {
  phase: StartupDataPhase;
  setPhase: (p: StartupDataPhase) => void;
}

export const useStartupDataStatus = create<StartupDataStatusState>((set) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
}));

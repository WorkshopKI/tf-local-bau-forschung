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

/**
 * Laufender Fortschritt des Start-Passes für die Banner-Anzeige im ShellLayout
 * ([StartupDataUpdateBanner]). `null` = kein Pass aktiv → Banner blendet aus.
 * `label` ist das phasen-basierte Toast-/Banner-Label, `fraction` der Anteil
 * 0..1 innerhalb der aktuellen Phase. Getrennt von `phase` (Watcher-Koordination),
 * damit Selektor-Konsumenten von `s => s.phase` nicht bei jedem Fortschritts-Tick
 * re-rendern.
 */
export interface StartupDataProgress {
  label: string;
  fraction: number;
}

interface StartupDataStatusState {
  phase: StartupDataPhase;
  setPhase: (p: StartupDataPhase) => void;
  progress: StartupDataProgress | null;
  setProgress: (p: StartupDataProgress | null) => void;
}

export const useStartupDataStatus = create<StartupDataStatusState>((set) => ({
  phase: 'idle',
  setPhase: (phase) => set({ phase }),
  progress: null,
  setProgress: (progress) => set({ progress }),
}));

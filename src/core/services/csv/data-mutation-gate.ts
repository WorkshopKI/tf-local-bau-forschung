import { create } from 'zustand';

/**
 * Geteiltes In-Tab-Gate gegen überlappende Daten-Mutationen.
 *
 * Hintergrund (Bug „2 Quellen aktualisiert — 1 Fehler"): Der Start-Sync
 * (`runDataUpdate`), der CSV-Auto-Refresh-Banner (`doRefresh` → `runAutoRefresh`)
 * und der Snapshot-Watcher-Banner (`applyNow` → `syncProgrammSnapshot`) mutieren
 * ALLE dieselben IndexedDB-Stores + Share-Snapshot-Dateien. Laufen zwei davon
 * gleichzeitig (zwei Banner-CTAs gleichzeitig geklickt), kollidieren `clear()`/
 * `put()` bzw. die `atomicWrite`-Temp-Renames (gemeinsame `<file>.tmp`-Namen) →
 * genau ein Quell-Import wirft einen nicht-Lock-Fehler.
 *
 * Die frühere modulweite `running`-Flag in `data-update.ts` schützte NUR
 * `runDataUpdate` — die beiden Banner-CTAs riefen sie nie auf. Dieses Gate ist der
 * EINE geteilte Serializer über alle mutierenden Flows.
 *
 * Synchron (Check-and-Set in EINEM Tick), weil JS single-threaded ist: wer zuerst
 * `acquireDataMutation()` ruft, gewinnt; alle anderen bekommen `false` und werden
 * zum No-op. `busy` ist zusätzlich als Zustand-Store exponiert, damit die Banner
 * ihre CTAs deaktivieren können, solange ein fremder Flow läuft.
 */
interface DataMutationGateState {
  busy: boolean;
}

const useGate = create<DataMutationGateState>(() => ({ busy: false }));

/**
 * Reserviert das Gate. Gibt `true` zurück, wenn frei (und markiert es synchron als
 * belegt); `false`, wenn bereits ein anderer Flow mutiert. Der Aufrufer MUSS bei
 * `true` später `releaseDataMutation()` rufen (im `finally`).
 */
export function acquireDataMutation(): boolean {
  if (useGate.getState().busy) return false;
  useGate.setState({ busy: true });
  return true;
}

/** Gibt das Gate frei. Idempotent. */
export function releaseDataMutation(): void {
  useGate.setState({ busy: false });
}

/** `true`, solange irgendein Daten-Mutations-Flow läuft. */
export function isDataMutationBusy(): boolean {
  return useGate.getState().busy;
}

/** React-Hook: re-rendert, wenn sich der Busy-Zustand ändert. */
export function useDataMutationBusy(): boolean {
  return useGate(s => s.busy);
}

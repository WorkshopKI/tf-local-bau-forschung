/**
 * NewSnapshotBanner — User-Benachrichtigung bei neuem Datenbestand.
 *
 * Wird im ShellLayout oberhalb des Contents gerendert. Sichtbar, wenn der
 * `useSnapshotWatcher` einen Snapshot mit hoeherer `snapshotVersion` auf
 * dem Daten-Share findet (z.B. weil ein Kurator zwischendurch
 * aktualisiert hat).
 *
 * Klick "Jetzt laden" laesst den Watcher `syncProgrammSnapshot({ force })`
 * fuer alle betroffenen Programme aufrufen. Nach Erfolg verschwindet der
 * Banner und ein Toast wird gezeigt (Toast wird vom App.tsx Caller
 * gehandhabt, ueber den `onSynced`-Callback des Watchers).
 */

import { Download, X, AlertTriangle } from 'lucide-react';
import type { SnapshotWatcherState } from '@/core/hooks/useSnapshotWatcher';
import { ProgressBar } from '@/ui/ProgressBar';

interface Props {
  state: SnapshotWatcherState;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NewSnapshotBanner({ state }: Props): React.ReactElement | null {
  if (state.availableUpdates.length === 0 && !state.applying && !state.applyError) return null;
  if (state.dismissed && !state.applying && !state.applyError) return null;

  // Zeige die "neueste" Info, wenn mehrere Programme Updates haben.
  const newest = state.availableUpdates.reduce<typeof state.availableUpdates[number] | null>((acc, u) => {
    if (!acc) return u;
    return u.createdAt > acc.createdAt ? u : acc;
  }, null);
  const count = state.availableUpdates.length;

  return (
    <div
      className="w-full px-4 py-2 flex items-center gap-2.5 text-[12.5px]"
      style={{
        background: 'var(--tf-info-bg, #eff6ff)',
        color: 'var(--tf-info-text, #1e3a8a)',
        borderBottom: '0.5px solid var(--tf-info-border, #bfdbfe)',
      }}
      role="status"
      aria-live="polite"
    >
      <Download size={14} className="shrink-0" />

      {state.applying ? (
        <span className="flex-1 flex flex-col gap-1">
          <span>Lade neuen Datenbestand…</span>
          {/* Kleiner Floor (~5%), damit der Balken sofort sichtbar startet —
              die SMB-Verzeichnis-Navigation + der Manifest-Read am Anfang melden
              noch keinen feinen Fortschritt. */}
          <ProgressBar value={Math.max(state.progress ?? 0, 0.05)} />
        </span>
      ) : state.applyError ? (
        <span className="flex-1 inline-flex items-center gap-1.5">
          <AlertTriangle size={13} className="shrink-0" />
          Laden fehlgeschlagen: {state.applyError}
        </span>
      ) : newest ? (
        <span className="flex-1">
          Neuer Datenbestand vom <strong>{formatDate(newest.createdAt)}</strong>
          {newest.createdBy ? ` (von ${newest.createdBy})` : ''}
          {count > 1 ? ` — ${count} Programme betroffen` : ''} verfügbar.
        </span>
      ) : (
        <span className="flex-1">Neue Daten verfügbar.</span>
      )}

      {!state.applying && state.availableUpdates.length > 0 ? (
        <button
          type="button"
          onClick={() => { void state.applyNow(); }}
          disabled={state.applying}
          className="shrink-0 px-2.5 py-1 rounded text-[11.5px] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          style={{
            background: 'var(--tf-info-text, #1e3a8a)',
            color: 'white',
            border: '0.5px solid var(--tf-info-text, #1e3a8a)',
          }}
        >
          Jetzt laden
        </button>
      ) : null}

      {!state.applying ? (
        <button
          type="button"
          onClick={state.dismiss}
          aria-label="Schließen"
          title="Schließen"
          className="shrink-0 p-1 rounded hover:bg-[var(--tf-hover)] text-[var(--tf-text-tertiary)] cursor-pointer"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Kurator-Tab "Inbox" (v2.0).
 *
 * Sammelt Feedback-Outboxen aller User ein. Kurator pickt einmalig den
 * Wurzel-Ordner aller Home-Laufwerke (z.B. `\\share\home-laufwerke\`), die
 * App scannt `<user>/ZAH/feedback/outbox/*.json`. Beim "Genehmigen"
 * landet das Ticket in der zentralen `_intern/feedback/feedback.json`,
 * "Ablehnen" schreibt den Status zurueck in die Outbox-Datei des Users.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Check, X, RefreshCcw, Inbox, MessageSquare } from 'lucide-react';
import { Button, SectionHeader } from '@/ui';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getUserFoldersRootHandle,
  pickAndStoreUserFoldersRootHandle,
} from '@/core/services/infrastructure/smb-handle';
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';
import {
  listOutboxItems,
  writeOutboxStatus,
  type FeedbackOutboxItem,
} from '@/core/services/personal-storage';
import { getFeedbackList, submitFeedback as submitFeedbackToShared } from '@/core/services/feedback';
import type { FeedbackContext } from '@/core/types/feedback';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';

interface InboxItem {
  /** User-Ordner (Name aus dem Verzeichnis-Listing, fuer Anzeige). */
  userDirName: string;
  /** Teamflow-Subdir-Handle des Users — Ziel fuer Status-Writes. */
  teamflowHandle: FileSystemDirectoryHandle;
  /** Outbox-Eintrag. */
  item: FeedbackOutboxItem;
}

export function FeedbackInboxTab(): React.ReactElement {
  const storage = useStorage();
  const reviewerKuerzel = useMeinKuerzel() ?? 'KURATOR';
  const [rootConnected, setRootConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const h = await getUserFoldersRootHandle(storage.idb).catch(() => null);
      if (!cancelled) setRootConnected(!!h);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const handleConnect = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await pickAndStoreUserFoldersRootHandle(storage.idb);
      if (!res.ok) {
        if (res.reason !== 'aborted') {
          setError(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
        }
        return;
      }
      setRootConnected(true);
      await loadInbox();
    } finally {
      setBusy(false);
    }
  };

  const loadInbox = useCallback(async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const root = await getUserFoldersRootHandle(storage.idb);
      if (!root) {
        setRootConnected(false);
        return;
      }
      const collected: InboxItem[] = [];
      for await (const entry of (root as FileSystemDirectoryHandle & {
        values(): AsyncIterableIterator<FileSystemHandle>;
      }).values()) {
        if (entry.kind !== 'directory') continue;
        try {
          const userDir = await root.getDirectoryHandle(entry.name);
          const teamflowHandle = await userDir.getDirectoryHandle(PERSOENLICH_ZAH_DIR);
          const userItems = await listOutboxItems(teamflowHandle);
          for (const item of userItems) {
            collected.push({ userDirName: entry.name, teamflowHandle, item });
          }
        } catch {
          /* User-Ordner ohne ZAH/ wird ignoriert */
        }
      }
      collected.sort((a, b) => b.item.submitted_at.localeCompare(a.item.submitted_at));
      setItems(collected);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [storage]);

  const visibleItems = useMemo(() => {
    if (filterStatus === 'all') return items;
    return items.filter(i => i.item.status === 'pending');
  }, [items, filterStatus]);

  const handleApprove = async (entry: InboxItem): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      // 1. In zentrale feedback.json schreiben (Kurator-Pfad)
      const all = await getFeedbackList(storage);
      const exists = all.some(it => it.id === entry.item.id);
      if (!exists) {
        await submitFeedbackToShared(
          storage,
          {
            user_id: entry.item.kuerzel,
            user_display_name: entry.item.kuerzel,
            text: entry.item.text,
            context: (entry.item.context as FeedbackContext) ?? makeFallbackContext(entry.item),
          },
          { isKurator: true }, // erzwingt Shared-File-Write
        );
      }
      // 2. Status in der Outbox-Datei zurueckschreiben
      const updated: FeedbackOutboxItem = {
        ...entry.item,
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewer_kuerzel: reviewerKuerzel,
      };
      await writeOutboxStatus(entry.teamflowHandle, updated);
      // 3. Lokal aktualisieren
      setItems(prev => prev.map(p =>
        p.userDirName === entry.userDirName && p.item.id === entry.item.id
          ? { ...p, item: updated }
          : p));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (entry: InboxItem): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const updated: FeedbackOutboxItem = {
        ...entry.item,
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewer_kuerzel: reviewerKuerzel,
      };
      await writeOutboxStatus(entry.teamflowHandle, updated);
      setItems(prev => prev.map(p =>
        p.userDirName === entry.userDirName && p.item.id === entry.item.id
          ? { ...p, item: updated }
          : p));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!rootConnected) {
    return (
      <div className="p-6 max-w-xl">
        <div className="flex items-center gap-2.5 mb-3">
          <Inbox size={20} className="text-[var(--tf-primary)]" />
          <h2 className="text-[16px] font-medium text-[var(--tf-text)]">User-Feedback einsammeln</h2>
        </div>
        <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mb-5">
          Verbinden Sie einmalig den übergeordneten Ordner aller User-Home-Laufwerke
          (z.B. <code>\\share\home-laufwerke\</code>). Die App scannt dort die
          Feedback-Outboxen und zeigt sie hier zur Freigabe an.
        </p>
        <Button icon={FolderOpen} onClick={handleConnect} disabled={busy}>
          User-Wurzel verbinden
        </Button>
        {error && <p className="mt-4 text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SectionHeader label={`${visibleItems.length} ${filterStatus === 'pending' ? 'offene' : ''} Outbox-Einträge`} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
            className="px-2.5 py-1 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            {filterStatus === 'pending' ? 'Alle anzeigen' : 'Nur offene'}
          </button>
          <Button variant="secondary" icon={RefreshCcw} onClick={loadInbox} disabled={busy}>
            Neu laden
          </Button>
        </div>
      </div>

      {error && <p className="text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>}

      {visibleItems.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[var(--tf-text-tertiary)]">
          {filterStatus === 'pending'
            ? 'Keine offenen Outbox-Einträge.'
            : 'Noch keine Outbox-Einträge gefunden.'}
        </p>
      ) : (
        <div className="space-y-2.5">
          {visibleItems.map((entry, idx) => (
            <div
              key={`${entry.userDirName}-${entry.item.id}-${idx}`}
              className="p-3 rounded-[var(--tf-radius)] bg-[var(--tf-bg)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-[12px] text-[var(--tf-text-tertiary)]">
                    <span className="font-mono">{entry.item.kuerzel}</span>
                    {' · '}
                    {new Date(entry.item.submitted_at).toLocaleString('de-DE')}
                    {' · '}
                    Ordner: <code>{entry.userDirName}</code>
                  </p>
                </div>
                <StatusBadge status={entry.item.status} />
              </div>
              <p className="text-[13px] text-[var(--tf-text)] leading-relaxed whitespace-pre-wrap mb-3 flex items-start gap-2">
                <MessageSquare size={14} className="text-[var(--tf-text-tertiary)] mt-0.5 shrink-0" />
                <span>{entry.item.text}</span>
              </p>
              {entry.item.status === 'pending' && (
                <div className="flex gap-2">
                  <Button icon={Check} onClick={() => handleApprove(entry)} disabled={busy}>
                    Genehmigen
                  </Button>
                  <Button variant="secondary" icon={X} onClick={() => handleReject(entry)} disabled={busy}>
                    Ablehnen
                  </Button>
                </div>
              )}
              {entry.item.reviewer_kuerzel && entry.item.status !== 'pending' && (
                <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                  Reviewt von {entry.item.reviewer_kuerzel} am{' '}
                  {entry.item.reviewed_at && new Date(entry.item.reviewed_at).toLocaleString('de-DE')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FeedbackOutboxItem['status'] }): React.ReactElement {
  if (status === 'pending') {
    return <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">Offen</span>;
  }
  if (status === 'approved') {
    return <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]">Genehmigt</span>;
  }
  return <span className="px-2 py-0.5 rounded text-[11px] bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]">Abgelehnt</span>;
}

function makeFallbackContext(item: FeedbackOutboxItem): FeedbackContext {
  return {
    route: 'inbox',
    page: 'Outbox-Import',
    device: 'Desktop',
    viewport: '0x0',
    sessionDuration: 0,
    errors: [],
    timestamp: item.submitted_at,
  };
}

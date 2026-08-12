/**
 * Kurator-Tab "Inbox" (v2.0).
 *
 * Sammelt Feedback-Outboxen aller User ein. Der Kurator verbindet je Gruppe den
 * Wurzel-Ordner der Home-Laufwerke (z.B. `\\share\home-laufwerke\`), die App
 * scannt `<user>/ZAH/feedback/outbox/*.json`. Beim "Genehmigen" landet das
 * Ticket in der zentralen `_intern/feedback/feedback.json`, "Ablehnen" schreibt
 * den Status zurueck in die Outbox-Datei des Users.
 *
 * v4.1: mehrere Wurzeln. Der Ordnername ist damit nicht mehr eindeutig — jeder
 * Eintrag traegt seine Wurzel mit, und Dubletten (dieselbe Person unter zwei
 * Wurzeln) fallen ueber die Eintrags-Id auf den juengsten Stand zusammen. Damit
 * gewinnt zugleich dessen `teamflowHandle`: der Status-Writeback landet dort,
 * wo die lebende Kopie liegt.
 */

import { useCallback, useMemo, useState } from 'react';
import { Check, X, RefreshCcw, Inbox, MessageSquare, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useStorage } from '@/core/hooks/useStorage';
import { usePersoenlicheWurzeln, nurNutzbare } from '@/core/hooks/usePersoenlicheWurzeln';
import { WurzelnVerbinden } from '@/core/components/WurzelnVerbinden';
import {
  jeWurzel,
  juengsterGewinnt,
  formatiereSammelBericht,
  summeGelesen,
} from '@/core/services/personal-roots';
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';
import {
  listOutboxItems,
  writeOutboxStatus,
  type FeedbackOutboxItem,
} from '@/core/services/personal-storage';
import {
  getFeedbackList,
  submitFeedback as submitFeedbackToShared,
  autoCollectSponsorVotes,
  autoCollectFeedbackVotes,
  autoCollectFeedbackComments,
} from '@/core/services/feedback';
import type { FeedbackContext } from '@/core/types/feedback';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';

interface InboxItem {
  /** User-Ordner (Name aus dem Verzeichnis-Listing, fuer Anzeige). */
  userDirName: string;
  /** Beschriftung der Wurzel — der Ordnername allein ist nicht mehr eindeutig. */
  wurzelLabel: string;
  /** Teamflow-Subdir-Handle des Users — Ziel fuer Status-Writes. */
  teamflowHandle: FileSystemDirectoryHandle;
  /** Outbox-Eintrag. */
  item: FeedbackOutboxItem;
}

/** Liest die Outbox-Eintraege UNTER einer Wurzel. */
async function sammleAusWurzel(
  root: FileSystemDirectoryHandle,
  wurzelLabel: string,
): Promise<InboxItem[]> {
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
        collected.push({ userDirName: entry.name, wurzelLabel, teamflowHandle, item });
      }
    } catch {
      /* User-Ordner ohne ZAH/ wird ignoriert */
    }
  }
  return collected;
}

export function FeedbackInboxTab(): React.ReactElement {
  const storage = useStorage();
  const reviewerKuerzel = useMeinKuerzel() ?? 'KURATOR';
  const { wurzeln, zustaende, laden, verbinde, entferne } = usePersoenlicheWurzeln();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all'>('pending');
  const [sponsorMsg, setSponsorMsg] = useState<string | null>(null);

  const nutzbare = nurNutzbare(wurzeln, zustaende);

  /** Sammelt die Sponsoring-Stimmen (Feedback-Board) aller User ein + merged sie. */
  const handleCollectSponsorVotes = async (): Promise<void> => {
    setError(null);
    setSponsorMsg(null);
    setBusy(true);
    try {
      // Streng sequenziell: die drei autoCollect* lesen UND schreiben
      // `feedback.json` im selben Aufruf (kein Lock) — parallel verlöre der
      // zweite Write die Änderungen des ersten.
      let uebernommen = 0;
      const bericht = await jeWurzel(wurzeln, async root => {
        const res = await autoCollectSponsorVotes(storage, root.handle);
        const votes = await autoCollectFeedbackVotes(storage, root.handle);
        const comments = await autoCollectFeedbackComments(storage, root.handle);
        uebernommen += res.merged + votes.merged + comments.merged;
        return res.scanned + votes.scanned + comments.scanned;
      });
      setSponsorMsg(
        `${formatiereSammelBericht(bericht, { einheit: 'Datei(en) gelesen' })} · ` +
        `${uebernommen} Änderung(en) übernommen.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const loadInbox = useCallback(async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const alle: InboxItem[] = [];
      const bericht = await jeWurzel(wurzeln, async root => {
        const teil = await sammleAusWurzel(root.handle, root.label);
        alle.push(...teil);
        return teil.length;
      });
      // Derselbe Eintrag kann unter zwei Wurzeln liegen (Gruppenwechsel,
      // Ordnerleiche). Ueber die Eintrags-Id auf den juengsten Stand falten —
      // damit gewinnt auch dessen `teamflowHandle`, und der Status-Writeback
      // landet bei der lebenden Kopie.
      const eindeutig = juengsterGewinnt(alle, e => e.item.id, e => e.item.submitted_at);
      eindeutig.sort((a, b) => b.item.submitted_at.localeCompare(a.item.submitted_at));
      setItems(eindeutig);
      if (wurzeln.length > 1) {
        setSponsorMsg(`${formatiereSammelBericht(bericht, { einheit: 'Einträge' })} · ${summeGelesen(bericht)} gesamt`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [wurzeln]);

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
          { isKurator: true, writeToShared: true }, // erzwingt Shared-File-Write
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
        p.item.id === entry.item.id
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
        p.item.id === entry.item.id
          ? { ...p, item: updated }
          : p));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Vollbild-Hinweis nur, wenn KEINE Wurzel nutzbar ist. Sonst laeuft der Tab
  // normal und die Lueckenmeldung steht als Zeile darueber — Teil-Einsammeln
  // soll sichtbar sein, aber nicht blockieren.
  if (!laden && nutzbare.length === 0) {
    return (
      <div className="p-6 max-w-xl">
        <div className="flex items-center gap-2.5 mb-3">
          <Inbox size={20} className="text-[var(--tf-primary)]" />
          <h2 className="text-[16px] font-medium text-[var(--tf-text)]">User-Feedback einsammeln</h2>
        </div>
        <p className="text-[13px] text-[var(--tf-text-secondary)] leading-relaxed mb-5">
          Verbinden Sie je Gruppe den übergeordneten Ordner der User-Home-Laufwerke
          (z.B. <code>\\share\home-laufwerke\</code>). Die App scannt dort die
          Feedback-Outboxen und zeigt sie hier zur Freigabe an.
        </p>
        <WurzelnVerbinden
          wurzeln={wurzeln}
          zustaende={zustaende}
          verbinde={async r => { await verbinde(r); await loadInbox(); }}
          entferne={entferne}
        />
        {error && <p className="mt-4 text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <WurzelnVerbinden
        wurzeln={wurzeln}
        zustaende={zustaende}
        verbinde={async r => { await verbinde(r); await loadInbox(); }}
        entferne={entferne}
        hinweis="Aus diesen Gruppen wird noch nicht eingesammelt."
      />
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
          <Button variant="secondary" icon={Coins} onClick={handleCollectSponsorVotes} disabled={busy}>
            Sponsor-Stimmen einsammeln
          </Button>
          <Button variant="secondary" icon={RefreshCcw} onClick={loadInbox} disabled={busy}>
            Neu laden
          </Button>
        </div>
      </div>

      {error && <p className="text-[12.5px] text-[var(--tf-danger-text)]">{error}</p>}
      {sponsorMsg && <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{sponsorMsg}</p>}

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
              key={`${entry.wurzelLabel}-${entry.userDirName}-${entry.item.id}-${idx}`}
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
                    {' · '}
                    {entry.wurzelLabel}
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

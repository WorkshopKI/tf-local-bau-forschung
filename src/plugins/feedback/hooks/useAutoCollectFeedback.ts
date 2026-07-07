/**
 * useAutoCollectFeedback (v2.22) — sammelt beim Oeffnen des Feedback-Admins
 * automatisch die User-Feedback-Outboxen ein und importiert sie OHNE Review
 * in die zentrale `feedback.json`.
 *
 * Spiegel von `useAutoCollectTeamProfiles`: einmal pro App-Session, best-effort.
 * Ist der User-Folders-Root nicht verbunden, passiert nichts (KEIN Picker im
 * Auto-Pfad — der einmalige Connect bleibt im Inbox-Tab, FSAPI braucht dafuer
 * eine User-Geste). Geschrieben wird nur bei readwrite-Daten-Share
 * (`writeSharedFile` ist self-gated) → faktisch nur Kurator/dev.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getUserFoldersRootHandle } from '@/core/services/infrastructure/smb-handle';
import {
  autoCollectFeedbackOutboxes,
  autoCollectSponsorVotes,
  autoCollectFeedbackVotes,
  autoCollectFeedbackComments,
} from '@/core/services/feedback';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';

/** Einmal pro App-Session (ueberlebt Plugin-/Tab-Wechsel-Remounts). */
let autoCollectFeedbackDone = false;

/** Nur fuer Tests — setzt das Session-Flag zurueck. */
export function resetAutoCollectFeedbackForTests(): void {
  autoCollectFeedbackDone = false;
}

export function useAutoCollectFeedback(): void {
  const storage = useStorage();
  const reviewerKuerzel = useMeinKuerzel() ?? 'KURATOR';

  useEffect(() => {
    if (autoCollectFeedbackDone) return;
    autoCollectFeedbackDone = true;

    void (async () => {
      const root = await getUserFoldersRootHandle(storage.idb).catch(() => null);
      if (!root) return; // Root nicht verbunden — still ueberspringen.
      try {
        await autoCollectFeedbackOutboxes(storage, root, reviewerKuerzel);
      } catch {
        // Best-effort — manuelles Einsammeln im Inbox-Tab bleibt verfuegbar.
      }
      try {
        // Sponsoring-Stimmen (Feedback-Board) der read-only prod-User einsammeln.
        await autoCollectSponsorVotes(storage, root);
      } catch {
        // Best-effort — manuelles Einsammeln im Inbox-Tab bleibt verfuegbar.
      }
      try {
        // Leichte Votes + Kommentare (Redesign v2.199) der read-only prod-User einsammeln.
        await autoCollectFeedbackVotes(storage, root);
        await autoCollectFeedbackComments(storage, root);
      } catch {
        // Best-effort — manuelles Einsammeln im Inbox-Tab bleibt verfuegbar.
      }
    })();
  }, [storage, reviewerKuerzel]);
}

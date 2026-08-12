/**
 * useAutoCollectFeedback (v2.22) — sammelt beim Oeffnen des Feedback-Admins
 * automatisch die User-Feedback-Outboxen ein und importiert sie OHNE Review
 * in die zentrale `feedback.json`.
 *
 * Spiegel von `useAutoCollectTeamProfiles`: einmal pro App-Session, best-effort.
 * Ist keine Wurzel verbunden, passiert nichts (KEIN Picker im Auto-Pfad — der
 * einmalige Connect bleibt im Inbox-Tab, FSAPI braucht dafuer eine User-Geste).
 * Geschrieben wird nur bei readwrite-Daten-Share (`writeSharedFile` ist
 * self-gated) → faktisch nur Kurator/dev.
 *
 * v4.1: mehrere Wurzeln, STRENG SEQUENZIELL (`jeWurzel`). Die vier
 * `autoCollect*` sind keine reinen Sammler, sondern vollstaendige
 * Read-Modify-Write-Zyklen auf `feedback.json` — parallel laesen zwei Wurzeln
 * dieselbe Basis (der zweite Write verwuerfe die Items des ersten), und zwei
 * gleichzeitige `atomicWrite` auf denselben Pfad teilen sich `.tmp`/`.backup`.
 * Ein Lock auf `feedback.json` gibt es nicht.
 */
import { useEffect } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getUserFoldersRoots } from '@/core/services/infrastructure/smb-handle';
import { jeWurzel } from '@/core/services/personal-roots';
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
      const wurzeln = await getUserFoldersRoots(storage.idb).catch(() => []);
      // Best-effort: `jeWurzel` faengt Fehler je Wurzel ab (eine unerreichbare
      // Gruppe stoppt die andere nicht) und wirft selbst nie. Der Bericht wird
      // hier verworfen — im Auto-Pfad gibt es keine Oberflaeche dafuer; die
      // sichtbare Bilanz liefert der Inbox-Tab.
      await jeWurzel(wurzeln, async root => {
        let n = (await autoCollectFeedbackOutboxes(storage, root.handle, reviewerKuerzel)).imported;
        // Sponsoring-Stimmen (Feedback-Board) der read-only prod-User einsammeln.
        n += (await autoCollectSponsorVotes(storage, root.handle)).merged;
        // Leichte Votes + Kommentare (Redesign v2.199) der read-only prod-User einsammeln.
        n += (await autoCollectFeedbackVotes(storage, root.handle)).merged;
        n += (await autoCollectFeedbackComments(storage, root.handle)).merged;
        return n;
      });
    })();
  }, [storage, reviewerKuerzel]);
}

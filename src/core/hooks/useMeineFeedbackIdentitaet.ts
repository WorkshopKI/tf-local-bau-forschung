/**
 * useMeineFeedbackIdentitaet (v3.7) — meine Identität im Feedback-System.
 *
 * Reicht `useMeinKuerzel()` (Pitfall #27) und den Profilnamen an die reine
 * `baueIdentitaet` weiter: das Kürzel ist die kanonische Schreib-Id, der
 * Profilname bleibt als Lese-Alias erhalten, weil Bestands-Tickets unter ihm
 * erfasst wurden. Begründung im Detail: `feedbackIdentitaet.ts`.
 */
import { useMemo } from 'react';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { baueIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';
import type { MeineIdentitaet } from '@/core/services/feedback/feedbackIdentitaet';

export function useMeineFeedbackIdentitaet(): MeineIdentitaet {
  const kuerzel = useMeinKuerzel();
  const { profile } = useProfile();
  const name = profile?.name;
  return useMemo(() => baueIdentitaet(kuerzel, name), [kuerzel, name]);
}

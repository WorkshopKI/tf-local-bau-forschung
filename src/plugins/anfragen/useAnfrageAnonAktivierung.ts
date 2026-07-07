/**
 * Einmalige Auto-Reconciliation der Skill-Registry auf einem Bestands-Share.
 *
 * `mergeMissingSeeds` überschreibt bestehende Registry-Einträge nie (schützt
 * kuratierte Edits) — geänderte Seed-Voreinstellungen (Anonymisierer-Freischaltung,
 * Journey-Paket-4-Beleg-Kontrakt für A + B, …) greifen daher NICHT von selbst auf
 * einem Share, der die Skills bereits trägt. Dieser Hook holt alle ausstehenden
 * marker-gesicherten Migrationen einmalig nach: sobald der Share online ist und der
 * Client schreibberechtigt (pl direkt, kurator nach Login, dev), lädt er die Registry,
 * wendet `reconcileEinmaligeAktivierungen` an und schreibt bei Änderung zurück. Die
 * Marker (`angewandteMigrationen`) machen das team-weit einmalig und respektieren
 * spätere bewusste Kurator-Änderungen (jede Migration lässt editierte Skills unberührt).
 *
 * Gemountet im App-Shell (`ShellLayout`) → läuft automatisch nach dem Share-Grant.
 * Gate: Anfragen- ODER Gutachten-Varianten (die Träger der aktuellen Migrationen).
 */
import { useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import {
  canEditSkillRegistry,
  isAnfragenEnabled,
  isGutachtenKurzfassungEnabled,
  isGutachtenWorkflowEnabled,
} from '@/config/feature-flags';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  loadSkillRegistry,
  writeSkillRegistry,
  reconcileEinmaligeAktivierungen,
} from '@/core/services/skills';

export function useAnfrageAnonAktivierung(): void {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();
  const canEdit = canEditSkillRegistry(session.isActive);
  const doneRef = useRef(false);

  useEffect(() => {
    // Varianten, die eine der aktuellen Registry-Migrationen tragen können.
    if (!isAnfragenEnabled() && !isGutachtenKurzfassungEnabled() && !isGutachtenWorkflowEnabled()) return;
    if (!canEdit) return;                  // nur schreibberechtigte Clients reconcilen
    if (smbStatus.status !== 'online') return;
    if (doneRef.current) return;
    doneRef.current = true;
    void (async () => {
      try {
        const loaded = await loadSkillRegistry(storage);
        const { file, geaendert, angewandt } = reconcileEinmaligeAktivierungen(loaded.file);
        if (!geaendert) return;
        const ok = await writeSkillRegistry(storage, file);
        if (ok) {
          await logAudit(storage.idb, {
            action: 'skill_registry_updated',
            user: session.kuratorName ?? 'PL',
            details: { migrationen: angewandt },
          });
        } else {
          // Handle (noch) nicht schreibbar → erneut versuchen, wenn sich der Zustand ändert.
          doneRef.current = false;
        }
      } catch (err) {
        console.warn('[anfrage-anon] Auto-Freischaltung fehlgeschlagen', err);
        doneRef.current = false;
      }
    })();
  }, [storage, canEdit, smbStatus.status, session.kuratorName]);
}

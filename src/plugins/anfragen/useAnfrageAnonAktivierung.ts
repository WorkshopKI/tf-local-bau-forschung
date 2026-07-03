/**
 * Einmalige Auto-Freischaltung des Anonymisierer-Skills auf einem Bestands-Share.
 *
 * Der Seed steht nach dem Recall-Gate auf `aktiv: true`, aber `mergeMissingSeeds`
 * überschreibt bestehende Registry-Einträge nie — ein Share, dessen `registry.json`
 * den Skill noch mit `aktiv: false` trägt, bliebe sonst gesperrt. Dieser Hook holt
 * die Freischaltung einmalig nach: sobald der Share online ist und der Client
 * schreibberechtigt (pl direkt, kurator nach Login, dev), lädt er die Registry,
 * wendet `reconcileEinmaligeAktivierungen` an und schreibt bei Änderung zurück.
 * Der Marker in der Registry (`angewandteMigrationen`) macht das team-weit
 * einmalig und respektiert eine spätere bewusste Deaktivierung.
 *
 * Gemountet im App-Shell (`ShellLayout`) → läuft automatisch nach dem Share-Grant,
 * ohne dass jemand die Skill-Verwaltung öffnen muss.
 */
import { useEffect, useRef } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { canEditSkillRegistry, isAnfragenEnabled } from '@/config/feature-flags';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  loadSkillRegistry,
  writeSkillRegistry,
  reconcileEinmaligeAktivierungen,
  ANFRAGE_ANON_AKTIV_MIGRATION,
} from '@/core/services/skills';

export function useAnfrageAnonAktivierung(): void {
  const storage = useStorage();
  const session = useKuratorSession();
  const smbStatus = useSmbStatus();
  const canEdit = canEditSkillRegistry(session.isActive);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!isAnfragenEnabled()) return;      // Modul-Varianten (dev/pl/as/kurator)
    if (!canEdit) return;                  // nur schreibberechtigte Clients reconcilen
    if (smbStatus.status !== 'online') return;
    if (doneRef.current) return;
    doneRef.current = true;
    void (async () => {
      try {
        const loaded = await loadSkillRegistry(storage);
        const { file, geaendert } = reconcileEinmaligeAktivierungen(loaded.file);
        if (!geaendert) return;
        const ok = await writeSkillRegistry(storage, file);
        if (ok) {
          await logAudit(storage.idb, {
            action: 'skill_registry_updated',
            user: session.kuratorName ?? 'PL',
            details: { migration: ANFRAGE_ANON_AKTIV_MIGRATION },
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

/**
 * Lädt + persistiert die Skill-Registry für die Kurationsseite. Schreiben ist
 * über `canEditSkillRegistry` gegated (pl direkt, kurator/dev via Kurator-
 * Session); der physische Guard sitzt in `writeSkillRegistry`.
 *
 * Seed-on-open: existiert noch keine `registry.json` (source === 'seed') und der
 * Nutzer darf schreiben, wird der Startbestand einmalig persistiert.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canEditSkillRegistry } from '@/config/feature-flags';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  loadSkillRegistry,
  writeSkillRegistry,
  SEED_REGISTRY,
  type SkillRegistryFile,
} from '@/core/services/skill-registry';

export interface SkillRegistryController {
  file: SkillRegistryFile | null;
  source: 'share' | 'cache' | 'seed';
  stale: boolean;
  loading: boolean;
  /** Darf der aktuelle Nutzer Änderungen speichern? */
  canEdit: boolean;
  /** Persistiert einen kompletten neuen Stand (ein Write). Wirft bei Fehler. */
  persist: (next: SkillRegistryFile) => Promise<void>;
}

export function useSkillRegistry(): SkillRegistryController {
  const storage = useStorage();
  const session = useKuratorSession();
  const canEdit = canEditSkillRegistry(session.isActive);

  const [file, setFile] = useState<SkillRegistryFile | null>(null);
  const [source, setSource] = useState<'share' | 'cache' | 'seed'>('seed');
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

  const persist = useCallback(async (next: SkillRegistryFile): Promise<void> => {
    const ok = await writeSkillRegistry(storage, next);
    if (!ok) {
      throw new Error('Speichern fehlgeschlagen — keine Schreibberechtigung auf dem Daten-Share.');
    }
    await logAudit(storage.idb, { action: 'skill_registry_updated', user: session.kuratorName ?? 'PL' });
    setFile(next);
    setSource('share');
    setStale(false);
  }, [storage, session.kuratorName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const loaded = await loadSkillRegistry(storage);
      if (cancelled) return;
      // Seed-on-open: noch keine Registry vorhanden + Schreibrecht → Startbestand
      // einmalig persistieren (writeSkillRegistry self-gated auf Permission).
      if (loaded.source === 'seed' && canEdit && !seededRef.current) {
        seededRef.current = true;
        const ok = await writeSkillRegistry(storage, SEED_REGISTRY);
        if (cancelled) return;
        if (ok) {
          await logAudit(storage.idb, { action: 'skill_registry_updated', user: session.kuratorName ?? 'PL' });
          setFile(SEED_REGISTRY);
          setSource('share');
          setStale(false);
          setLoading(false);
          return;
        }
      }
      setFile(loaded.file);
      setSource(loaded.source);
      setStale(loaded.stale);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage, canEdit, session.kuratorName]);

  return { file, source, stale, loading, canEdit, persist };
}

/**
 * Lädt + persistiert den Textbaustein-Katalog für die Kurationsseite. Schreiben ist
 * über `canEditSkillRegistry` gegated (pl direkt, kurator/dev via Kurator-Session);
 * der physische Guard sitzt in `writeTextbausteinKatalog` (self-gated auf Permission).
 *
 * Muster `useSkillRegistry`, aber ohne Seed-on-open-Zwang: der Katalog schreibt sich
 * NICHT beim ersten Öffnen selbst auf den Share (STOPP-R-Entscheidung „Erst-Write erst
 * beim Speichern"). Ein Kurator/PL, der ergänzte Seed-Bausteine sichern will, speichert
 * die erste bewusste Änderung — dann geht der ganze Stand (inkl. Migration) hinaus.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canEditSkillRegistry } from '@/config/feature-flags';
import { logAudit } from '@/core/services/infrastructure/audit-log';
import {
  loadTextbausteinKatalog,
  writeTextbausteinKatalog,
  type TextbausteinKatalog,
} from '@/core/services/skills';

export interface TextbausteinKatalogController {
  katalog: TextbausteinKatalog | null;
  quelle: 'share' | 'cache' | 'seed';
  stale: boolean;
  loading: boolean;
  /** Darf der aktuelle Nutzer Änderungen speichern? */
  canEdit: boolean;
  /**
   * IDs, die die NF-Seed-Migration beim Laden ergänzt hat (noch nicht auf dem
   * Share gesichert). Leer, sobald einmal gespeichert wurde.
   */
  ergaenzt: string[];
  /** Persistiert einen kompletten neuen Stand (ein Write). Wirft bei Fehler. */
  persist: (next: TextbausteinKatalog) => Promise<void>;
}

export function useTextbausteinKatalog(): TextbausteinKatalogController {
  const storage = useStorage();
  const session = useKuratorSession();
  const canEdit = canEditSkillRegistry(session.isActive);

  const [katalog, setKatalog] = useState<TextbausteinKatalog | null>(null);
  const [quelle, setQuelle] = useState<'share' | 'cache' | 'seed'>('seed');
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ergaenzt, setErgaenzt] = useState<string[]>([]);

  const persist = useCallback(async (next: TextbausteinKatalog): Promise<void> => {
    const ok = await writeTextbausteinKatalog(storage, next);
    if (!ok) {
      throw new Error('Speichern fehlgeschlagen — keine Schreibberechtigung auf dem Daten-Share.');
    }
    await logAudit(storage.idb, { action: 'textbaustein_katalog_updated', user: session.kuratorName ?? 'PL' });
    setKatalog(next);
    setQuelle('share');
    setStale(false);
    setErgaenzt([]);
  }, [storage, session.kuratorName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const loaded = await loadTextbausteinKatalog(storage);
      if (cancelled) return;
      setKatalog(loaded.katalog);
      setQuelle(loaded.quelle);
      setStale(loaded.stale);
      setErgaenzt(loaded.ergaenzt);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  return { katalog, quelle, stale, loading, canEdit, ergaenzt, persist };
}

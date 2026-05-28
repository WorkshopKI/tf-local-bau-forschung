/**
 * useMyAuslastungProfil — liefert den "effektiven" MA-Record des aktuellen Users.
 *
 * Hintergrund: Seit v2.6 schreibt „Meine Technologien" das Selbst-Profil in den
 * persoenlichen Ordner (`ZAH/auslastung-profil.json`), NICHT mehr in das
 * geteilte `auslastung.json`. Self-Ansichten (z.B. Home „Neue Anträge für dich")
 * muessen die eigenen Felder daher aus dem persoenlichen Profil lesen — sonst
 * sehen sie erst nach einer PL-Aggregation etwas.
 *
 * Liefert `effectiveMa = mergeSelfProfile(storeRecord, persoenlichesProfil)`:
 * MA-pflegbare Felder aus dem persoenlichen Profil, PL-only-Felder (Kapazitaet,
 * Abschlag, Override) aus dem `auslastung.json`-Store-Record.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';
import { resolveAnonIdForUser } from '../services/anonym-map';
import { loadAuslastungProfil } from '../services/persoenliches-profil';
import { mergeSelfProfile } from '../services/profil-einsammeln';
import type { AnonymerMitarbeiter, PersoenlichesAuslastungProfil } from '../types';

export interface MyAuslastungProfil {
  /** AnonId des aktuellen Users (aus der AnonymMap) oder null. */
  myAnonId: string | null;
  /** Effektiver MA-Record (persoenliches Profil ueber Store-Record gelegt). */
  effectiveMa: AnonymerMitarbeiter | undefined;
  /** Effektive Hauptkategorie ('' wenn nicht gesetzt). */
  hauptKategorie: string;
  /** true bis das persoenliche Profil (Share/IDB-Cache) geladen ist. */
  loading: boolean;
}

export function useMyAuslastungProfil(): MyAuslastungProfil {
  const storage = useStorage();
  const { profile } = useProfile();
  const cache = useAntraegeCache();
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);

  const myAnonId = resolveAnonIdForUser(profile?.bearbeiter_kuerzel, cache.anonymMap);
  const storeRecord = myAnonId ? mitarbeiter[myAnonId] : undefined;

  const [personal, setPersonal] = useState<PersoenlichesAuslastungProfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const p = await loadAuslastungProfil(storage.idb, persHandle);
      if (cancelled) return;
      setPersonal(p);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage]);

  const effectiveMa = useMemo(
    () => mergeSelfProfile(storeRecord, personal, myAnonId),
    [storeRecord, personal, myAnonId],
  );

  return {
    myAnonId,
    effectiveMa,
    hauptKategorie: effectiveMa?.hauptKategorie ?? '',
    loading,
  };
}

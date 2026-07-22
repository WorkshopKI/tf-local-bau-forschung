/**
 * Persönliche Ebene eines Skills in der Skill-Verwaltung.
 *
 * Trennlinie: der Team-Stand liegt in der geteilten `registry.json` und ist nur
 * mit Kurator-/PL-Schreibrecht änderbar; die persönliche Ebene liegt im
 * `kv`-Store + gespiegelt in `ZAH/skill-tweaks.json` im persönlichen Ordner und
 * ist für JEDEN Nutzer änderbar. Beide Pfade existieren bereits (`tweaks/store`)
 * — dieser Hook macht sie nur in der Verwaltungsseite verfügbar, statt nur im
 * Gutachten-Kontext (`TweakEditor`).
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import { loadSkillTweak, saveSkillTweak, deleteSkillTweak, type SkillTweak } from '@/core/services/skills';

export interface SkillTweakController {
  tweak: SkillTweak | null;
  loading: boolean;
  /** Speichert den kompletten neuen Stand (IDB + best-effort persönlicher Ordner). */
  save: (next: SkillTweak) => Promise<void>;
  /** Entfernt die persönliche Ebene dieses Skills vollständig. */
  remove: () => Promise<void>;
}

/** Leerer Tweak für einen Skill (Basis, bevor der Nutzer etwas eingibt). */
export function leererTweak(skillId: string, skillVersion: number): SkillTweak {
  return {
    skillId,
    angelegtFuerSkillVersion: skillVersion,
    aktiv: true,
    stilHinweise: '',
    beispielFormulierungen: '',
    geaendert_am: new Date().toISOString(),
  };
}

export function useSkillTweak(skillId: string | null): SkillTweakController {
  const storage = useStorage();
  const [tweak, setTweak] = useState<SkillTweak | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!skillId) { setTweak(null); setLoading(false); return; }
    setLoading(true);
    void (async () => {
      // getPersoenlichHandle liest nur den gespeicherten Handle (kein Prompt);
      // ohne Ordner/Permission bleibt der IDB-Cache die Quelle.
      const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
      const geladen = await loadSkillTweak(storage.idb, persHandle, skillId).catch(() => null);
      if (cancelled) return;
      setTweak(geladen);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storage, skillId]);

  const save = useCallback(async (next: SkillTweak): Promise<void> => {
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await saveSkillTweak(storage.idb, persHandle, next);
    setTweak(next);
  }, [storage]);

  const remove = useCallback(async (): Promise<void> => {
    if (!skillId) return;
    const persHandle = await getPersoenlichHandle(storage.idb).catch(() => null);
    await deleteSkillTweak(storage.idb, persHandle, skillId);
    setTweak(null);
  }, [storage, skillId]);

  return { tweak, loading, save, remove };
}

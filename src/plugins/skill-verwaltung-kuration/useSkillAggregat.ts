/**
 * Lädt das S1-Skill-Aggregat (Nutzung, 👍/👎, Kommentare je Skill) einmalig
 * on-mount für die Browse-/Karten-Ansicht. Tolerant: bei Fehler/leerem Share eine
 * leere Map (die Verwaltung funktioniert auch ohne Feedback-Signale).
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { readAggregate, type SkillAggregatMap } from '@/core/services/skill-feedback';

export function useSkillAggregat(): SkillAggregatMap | null {
  const storage = useStorage();
  const [agg, setAgg] = useState<SkillAggregatMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const map = await readAggregate(storage);
        if (!cancelled) setAgg(map);
      } catch {
        if (!cancelled) setAgg(new Map());
      }
    })();
    return () => { cancelled = true; };
  }, [storage]);
  return agg;
}

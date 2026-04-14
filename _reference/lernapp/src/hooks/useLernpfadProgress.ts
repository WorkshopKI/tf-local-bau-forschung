import { useMemo } from "react";
import { useSyncContext } from "@/contexts/SyncContext";
import { requiredModules } from "@/data/learningPath";
import { loadConstraints } from "@/services/constraintService";
import { loadKIContext } from "@/services/kiContextService";
import { loadArrayFromStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export interface StufeProgress {
  nr: number;
  progress: number;
  unlocked: boolean;
  isCurrent: boolean;
}

export function useLernpfadProgress(): StufeProgress[] {
  const { completedLessons, exercises } = useSyncContext();

  return useMemo(() => {
    // Stufe 1: Basierend auf Pflicht-Module (mit Abwärtskompatibilität)
    const effectiveLessons = [...completedLessons];
    if (
      completedLessons.includes("grundlagen") ||
      completedLessons.includes("acta-methode") ||
      completedLessons.includes("acta-challenge")
    ) {
      if (!effectiveLessons.includes("acta-einfuehrung")) {
        effectiveLessons.push("acta-einfuehrung");
      }
    }

    const requiredComplete = requiredModules.filter(m => effectiveLessons.includes(m.id)).length;
    const stufe1Progress = Math.round((requiredComplete / requiredModules.length) * 100);
    const stufe1Done = stufe1Progress === 100;

    // Stufe 2: Basierend auf Übungen/Prüfungen
    const exerciseCount = exercises?.length ?? 0;
    const stufe2Progress = stufe1Done ? Math.min(100, Math.round((exerciseCount / 5) * 100)) : 0;
    const stufe2Done = stufe2Progress === 100;

    // Stufe 3: Basierend auf "Erkenne den Unterschied" Übungen
    const compHistory = loadArrayFromStorage<string>(LS_KEYS.COMPARISON_HISTORY);
    const stufe3Progress = stufe2Done ? Math.min(100, Math.round((compHistory.length / 3) * 100)) : 0;
    const stufe3Done = stufe3Progress === 100;

    // Stufe 4: Basierend auf Constraints aus Ablehnungen
    const constraints = loadConstraints();
    const rejectionConstraints = constraints.filter(c => c.source === "rejection");
    const stufe4Progress = stufe3Done ? Math.min(100, Math.round((rejectionConstraints.length / 3) * 100)) : 0;
    const stufe4Done = stufe4Progress === 100;

    // Stufe 5: Basierend auf KI-Kontext + aktive Constraints
    const ctx = loadKIContext();
    const hasProfile = !!(ctx.profile.abteilung || ctx.profile.fachgebiet);
    const activeRules = ctx.workRules.filter(r => r.active).length;
    const activeConstraints = constraints.filter(c => c.active).length;
    const stufe5Items = (hasProfile ? 1 : 0) + Math.min(activeRules, 2) + Math.min(activeConstraints, 2);
    const stufe5Progress = stufe4Done ? Math.min(100, Math.round((stufe5Items / 5) * 100)) : 0;

    // Aktive Stufe: Die erste mit Progress < 100
    const progresses = [stufe1Progress, stufe2Progress, stufe3Progress, stufe4Progress, stufe5Progress];
    const currentNr = progresses.findIndex(p => p < 100) + 1 || 5;

    return [
      { nr: 1, progress: stufe1Progress, unlocked: true, isCurrent: currentNr === 1 },
      { nr: 2, progress: stufe2Progress, unlocked: stufe1Done, isCurrent: currentNr === 2 },
      { nr: 3, progress: stufe3Progress, unlocked: stufe2Done, isCurrent: currentNr === 3 },
      { nr: 4, progress: stufe4Progress, unlocked: stufe3Done, isCurrent: currentNr === 4 },
      { nr: 5, progress: stufe5Progress, unlocked: stufe4Done, isCurrent: currentNr === 5 },
    ];
  }, [completedLessons, exercises]);
}

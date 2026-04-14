import { useMemo } from "react";
import { dailyChallenges } from "@/data/dailyChallenges";
import { useOrgContext } from "@/contexts/OrgContext";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import type { DailyChallenge } from "@/types";

interface ChallengeHistory {
  [dateKey: string]: { challengeId: string; completed: boolean; score?: number };
}

function getDateKey(): string {
  return new Date().toISOString().split("T")[0];
}

function selectChallenge(scope: string, pool: DailyChallenge[]): DailyChallenge {
  const dateNum = parseInt(getDateKey().replace(/-/g, ""), 10);
  const index = dateNum % pool.length;
  return pool[index];
}

export function useDailyChallenge() {
  const { scope, isDepartment } = useOrgContext();

  const challenge = useMemo(() => {
    let pool = dailyChallenges;
    if (isDepartment) {
      const deptPool = dailyChallenges.filter(
        (c) => c.targetDepartment === scope || !c.targetDepartment
      );
      if (deptPool.length > 0) pool = deptPool;
    }
    return selectChallenge(scope, pool);
  }, [scope, isDepartment]);

  const history = loadFromStorage<ChallengeHistory>(LS_KEYS.DAILY_CHALLENGE, {});
  const today = getDateKey();
  const todayEntry = history[today];
  const isCompleted = todayEntry?.completed === true;

  const markCompleted = (score?: number) => {
    const updated = { ...history, [today]: { challengeId: challenge.id, completed: true, score } };
    saveToStorage(LS_KEYS.DAILY_CHALLENGE, updated);
  };

  const streak = useMemo(() => {
    let count = 0;
    const d = new Date();
    if (isCompleted) count++;
    d.setDate(d.getDate() - 1);
    while (true) {
      const key = d.toISOString().split("T")[0];
      if (history[key]?.completed) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [history, isCompleted]);

  return { challenge, isCompleted, markCompleted, streak, todayScore: todayEntry?.score };
}

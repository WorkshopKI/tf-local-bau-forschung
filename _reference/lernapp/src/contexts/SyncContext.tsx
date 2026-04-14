import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import type { ExerciseResult, LocalProgress, SyncStatus } from "@/types";

export type { SyncStatus } from "@/types";

export interface SyncContextType {
  /* exercise / werkstatt */
  exercises: ExerciseResult[];
  saveExercise: (exerciseId: number, userPrompt: string, score: number, feedback: string) => Promise<void>;
  getBestScore: (exerciseId: number) => number | null;

  /* lessons */
  completedLessons: string[];
  markLessonComplete: (lessonId: string) => Promise<void>;

  /* quiz */
  quizScores: Record<string, number>;
  saveQuizScore: (quizId: string, score: number) => Promise<void>;

  /* challenge cards */
  challengeCards: string[];
  markChallengeCard: (cardId: string) => Promise<void>;

  /* meta */
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
}

export const SyncContext = createContext<SyncContextType | null>(null);

export const useSyncContext = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be inside SyncProvider");
  return ctx;
};

/* ── LocalStorage helpers ── */


function emptyProgress(): LocalProgress {
  return {
    exercises: [],
    completedLessons: [],
    quizScores: {},
    challengeCards: [],
    updatedAt: new Date().toISOString(),
  };
}

function loadLocal(): LocalProgress {
  return loadFromStorage(LS_KEYS.PROGRESS, emptyProgress());
}

function saveLocal(p: LocalProgress) {
  p.updatedAt = new Date().toISOString();
  saveToStorage(LS_KEYS.PROGRESS, p);
}

/* ── Merge logic ── */

function mergeProgress(local: LocalProgress, cloud: LocalProgress): LocalProgress {
  // Use the most recent version as base, then union unique entries
  const base = local.updatedAt > cloud.updatedAt ? local : cloud;
  const other = base === local ? cloud : local;

  // Exercises: union by exercise_id + completed_at composite key
  const exerciseKeys = new Set(base.exercises.map((e) => `${e.exercise_id}|${e.completed_at}`));
  const mergedExercises = [...base.exercises];
  for (const e of other.exercises) {
    if (!exerciseKeys.has(`${e.exercise_id}|${e.completed_at}`)) {
      mergedExercises.push(e);
    }
  }

  // Lessons & challenge cards: union
  const mergedLessons = [...new Set([...base.completedLessons, ...other.completedLessons])];
  const mergedCards = [...new Set([...base.challengeCards, ...other.challengeCards])];

  // Quiz scores: highest score wins
  const mergedQuiz: Record<string, number> = { ...other.quizScores, ...base.quizScores };
  for (const key of Object.keys(other.quizScores)) {
    if ((other.quizScores[key] ?? 0) > (mergedQuiz[key] ?? 0)) {
      mergedQuiz[key] = other.quizScores[key];
    }
  }

  return {
    exercises: mergedExercises,
    completedLessons: mergedLessons,
    quizScores: mergedQuiz,
    challengeCards: mergedCards,
    updatedAt: new Date().toISOString(),
  };
}

/* ── Provider ── */

export const SyncProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoggedIn } = useAuthContext();
  const [progress, setProgress] = useState<LocalProgress>(loadLocal);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncInFlight = useRef(false);

  /* ── Cloud pull & merge ── */
  const pullFromCloud = useCallback(async () => {
    if (!user || syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncStatus("syncing");

    try {
      const { data, error } = await supabase
        .from("user_progress")
        .select("werkstatt_progress, completed_lessons, quiz_scores, challenge_cards_completed, updated_at")
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        setSyncStatus("error");
        syncInFlight.current = false;
        return;
      }

      const wp = (data.werkstatt_progress ?? {}) as { exercises?: ExerciseResult[] };
      const cloudProgress: LocalProgress = {
        exercises: wp.exercises ?? [],
        completedLessons: data.completed_lessons ?? [],
        quizScores: (data.quiz_scores ?? {}) as Record<string, number>,
        challengeCards: data.challenge_cards_completed ?? [],
        updatedAt: data.updated_at,
      };

      const local = loadLocal();
      const merged = mergeProgress(local, cloudProgress);
      setProgress(merged);
      saveLocal(merged);

      // Push merged state back to cloud
      await supabase
        .from("user_progress")
        .update({
          werkstatt_progress: JSON.parse(JSON.stringify({ exercises: merged.exercises })),
          completed_lessons: merged.completedLessons,
          quiz_scores: JSON.parse(JSON.stringify(merged.quizScores)),
          challenge_cards_completed: merged.challengeCards,
          updated_at: merged.updatedAt,
        })
        .eq("user_id", user.id);

      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());
    } catch {
      setSyncStatus("error");
    }
    syncInFlight.current = false;
  }, [user]);

  /* ── Push to cloud ── */
  const pushToCloud = useCallback(
    async (p: LocalProgress) => {
      if (!user) return;
      setSyncStatus("syncing");
      try {
        const { error } = await supabase
          .from("user_progress")
          .update({
          werkstatt_progress: JSON.parse(JSON.stringify({ exercises: p.exercises })),
          completed_lessons: p.completedLessons,
          quiz_scores: JSON.parse(JSON.stringify(p.quizScores)),
            challenge_cards_completed: p.challengeCards,
            updated_at: p.updatedAt,
          })
          .eq("user_id", user.id);

        setSyncStatus(error ? "error" : "synced");
        if (!error) setLastSyncedAt(new Date().toISOString());
      } catch {
        setSyncStatus("error");
      }
    },
    [user],
  );

  /* ── Initial sync on login ── */
  useEffect(() => {
    if (isLoggedIn && user) {
      pullFromCloud();
    } else {
      setSyncStatus("offline");
      setProgress(loadLocal());
    }
  }, [isLoggedIn, user, pullFromCloud]);

  /* ── Mutators ── */

  const updateAndSync = useCallback(
    async (updater: (prev: LocalProgress) => LocalProgress) => {
      setProgress((prev) => {
        const next = updater(prev);
        saveLocal(next);
        if (isLoggedIn) pushToCloud(next);
        return next;
      });
    },
    [isLoggedIn, pushToCloud],
  );

  const saveExercise = useCallback(
    async (exerciseId: number, userPrompt: string, score: number, feedback: string) => {
      const result: ExerciseResult = {
        exercise_id: exerciseId,
        score,
        feedback,
        user_prompt: userPrompt,
        completed_at: new Date().toISOString(),
      };
      await updateAndSync((p) => ({ ...p, exercises: [...p.exercises, result] }));
    },
    [updateAndSync],
  );

  const getBestScore = useCallback(
    (exerciseId: number): number | null => {
      const results = progress.exercises.filter((e) => e.exercise_id === exerciseId);
      if (results.length === 0) return null;
      return Math.max(...results.map((r) => r.score));
    },
    [progress.exercises],
  );

  const markLessonComplete = useCallback(
    async (lessonId: string) => {
      await updateAndSync((p) => ({
        ...p,
        completedLessons: p.completedLessons.includes(lessonId) ? p.completedLessons : [...p.completedLessons, lessonId],
      }));
    },
    [updateAndSync],
  );

  const saveQuizScore = useCallback(
    async (quizId: string, score: number) => {
      await updateAndSync((p) => ({
        ...p,
        quizScores: { ...p.quizScores, [quizId]: Math.max(p.quizScores[quizId] ?? 0, score) },
      }));
    },
    [updateAndSync],
  );

  const markChallengeCard = useCallback(
    async (cardId: string) => {
      await updateAndSync((p) => ({
        ...p,
        challengeCards: p.challengeCards.includes(cardId) ? p.challengeCards : [...p.challengeCards, cardId],
      }));
    },
    [updateAndSync],
  );

  return (
    <SyncContext.Provider
      value={{
        exercises: progress.exercises,
        saveExercise,
        getBestScore,
        completedLessons: progress.completedLessons,
        markLessonComplete,
        quizScores: progress.quizScores,
        saveQuizScore,
        challengeCards: progress.challengeCards,
        markChallengeCard,
        syncStatus,
        lastSyncedAt,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

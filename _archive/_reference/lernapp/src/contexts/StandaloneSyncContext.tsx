import { useState, useCallback, type ReactNode } from "react";
import { SyncContext } from "./SyncContext";
import type { SyncContextType } from "./SyncContext";
import type { ExerciseResult } from "@/types";
import { loadFromStorage, saveToStorage, loadArrayFromStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";

export const StandaloneSyncProvider = ({ children }: { children: ReactNode }) => {
  const [exercises, setExercises] = useState<ExerciseResult[]>(() =>
    loadArrayFromStorage<ExerciseResult>(LS_KEYS.STANDALONE_EXERCISES)
  );
  const [completedLessons, setCompletedLessons] = useState<string[]>(() =>
    loadArrayFromStorage<string>(LS_KEYS.STANDALONE_LESSONS)
  );
  const [quizScores, setQuizScores] = useState<Record<string, number>>(() =>
    loadFromStorage<Record<string, number>>(LS_KEYS.STANDALONE_QUIZZES, {})
  );
  const [challengeCards, setChallengeCards] = useState<string[]>(() =>
    loadArrayFromStorage<string>(LS_KEYS.STANDALONE_CHALLENGES)
  );

  const saveExercise = useCallback(
    async (exerciseId: number, userPrompt: string, score: number, feedback: string) => {
      const result: ExerciseResult = {
        exercise_id: exerciseId,
        user_prompt: userPrompt,
        score,
        feedback,
        completed_at: new Date().toISOString(),
      };
      setExercises((prev) => {
        const updated = [...prev, result];
        saveToStorage(LS_KEYS.STANDALONE_EXERCISES, updated);
        return updated;
      });
    },
    []
  );

  const getBestScore = useCallback(
    (exerciseId: number): number | null => {
      const scores = exercises.filter((e) => e.exercise_id === exerciseId);
      if (scores.length === 0) return null;
      return Math.max(...scores.map((e) => e.score));
    },
    [exercises]
  );

  const markLessonComplete = useCallback(async (lessonId: string) => {
    setCompletedLessons((prev) => {
      if (prev.includes(lessonId)) return prev;
      const updated = [...prev, lessonId];
      saveToStorage(LS_KEYS.STANDALONE_LESSONS, updated);
      return updated;
    });
  }, []);

  const saveQuizScore = useCallback(async (quizId: string, score: number) => {
    setQuizScores((prev) => {
      const updated = { ...prev, [quizId]: Math.max(prev[quizId] || 0, score) };
      saveToStorage(LS_KEYS.STANDALONE_QUIZZES, updated);
      return updated;
    });
  }, []);

  const markChallengeCard = useCallback(async (cardId: string) => {
    setChallengeCards((prev) => {
      if (prev.includes(cardId)) return prev;
      const updated = [...prev, cardId];
      saveToStorage(LS_KEYS.STANDALONE_CHALLENGES, updated);
      return updated;
    });
  }, []);

  const value: SyncContextType = {
    exercises,
    saveExercise,
    getBestScore,
    completedLessons,
    markLessonComplete,
    quizScores,
    saveQuizScore,
    challengeCards,
    markChallengeCard,
    syncStatus: "idle",
    lastSyncedAt: null,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};

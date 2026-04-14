import { useSyncContext } from "@/contexts/SyncContext";

export const useExerciseProgress = () => {
  const { exercises, saveExercise, getBestScore, syncStatus } = useSyncContext();

  return {
    progress: exercises,
    loading: syncStatus === "syncing",
    saveProgress: saveExercise,
    getBestScore,
  };
};

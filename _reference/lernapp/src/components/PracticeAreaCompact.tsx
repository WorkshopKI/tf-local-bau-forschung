import { Lightbulb } from "lucide-react";
import { ExerciseCard } from "./ExerciseCard";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import { useAuthContext } from "@/contexts/AuthContext";
import { exercises } from "@/data/exercises";

export const PracticeAreaCompact = () => {
  const { isLoggedIn } = useAuthContext();
  const { getBestScore } = useExerciseProgress();

  // Nur die ersten 3 Übungen (Einstiegs-Level)
  const compactExercises = exercises.slice(0, 3);

  return (
    <div>
      <div className="text-center mb-5">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-3">
          Dein erster guter Prompt
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto text-sm">
          Verbessere diese schwachen Prompts mit der ACTA-Methode.
          Im nächsten Modul lernst du dann die RAKETE-Erweiterung kennen. Die KI bewertet deinen Prompt automatisch.
        </p>
      </div>

      {!isLoggedIn && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground">Tipp:</strong> Melde dich an, um deine Prompts
            von der KI bewerten zu lassen und deinen Fortschritt zu speichern.
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {compactExercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            bestScore={getBestScore(exercise.id)}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Weitere Übungen findest du nach dem Onboarding in der Prompt Sammlung.
      </p>
    </div>
  );
};

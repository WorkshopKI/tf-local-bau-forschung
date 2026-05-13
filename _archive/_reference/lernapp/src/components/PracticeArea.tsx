import { useState } from "react";
import { ExerciseCard } from "./ExerciseCard";
import { Lightbulb } from "lucide-react";
import { useExerciseProgress } from "@/hooks/useExerciseProgress";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exercises } from "@/data/exercises";

export const PracticeArea = () => {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const { user } = useAuth();
  const { saveProgress, getBestScore } = useExerciseProgress();

  const filteredExercises = exercises.filter(ex => ex.level === selectedLevel);

  const handleEvaluated = async (exerciseId: number, prompt: string, score: number, feedback: string) => {
    if (user) {
      await saveProgress(exerciseId, prompt, score, feedback);
    }
  };

  return (
    <section className="mb-16">
      <div className="text-center mb-12">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
          Interaktiver Übungsbereich
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
          Verbessere Prompts und erhalte KI-gestütztes Feedback mit Verbesserungsvorschlägen
        </p>

        <Tabs defaultValue="1" onValueChange={(v) => setSelectedLevel(Number(v))}>
          <TabsList className="mx-auto">
            <TabsTrigger value="1">Fragen</TabsTrigger>
            <TabsTrigger value="2">Gestalten</TabsTrigger>
            <TabsTrigger value="3">Steuern</TabsTrigger>
            <TabsTrigger value="4">Spezifizieren</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {filteredExercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            bestScore={user ? getBestScore(exercise.id) : undefined}
            onEvaluated={handleEvaluated}
          />
        ))}
      </div>
    </section>
  );
};

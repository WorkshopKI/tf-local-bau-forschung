import { useState, useCallback } from "react";
import { toast } from "sonner";
import { streamChat } from "@/services/llmService";
import { hasApiKey } from "@/services/apiKeyService";
import { evaluatePromptDirect } from "@/services/evaluationService";
import { DEFAULT_MODEL } from "@/data/models";
import type { Msg, Exercise } from "@/types";

export interface EvaluationResult {
  hasContext: boolean;
  isSpecific: boolean;
  hasConstraints: boolean;
  feedback: string;
}

interface UseExerciseEvaluationOptions {
  exercise: Exercise;
  preferredModel?: string;
  onEvaluated?: (exerciseId: number, prompt: string, score: number, feedback: string) => void;
}

export function useExerciseEvaluation({ exercise, preferredModel, onEvaluated }: UseExerciseEvaluationOptions) {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [coachSuggestion, setCoachSuggestion] = useState("");
  const [isCoaching, setIsCoaching] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  const evaluatePrompt = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim()) {
      toast.error("Bitte gib einen verbesserten Prompt ein!");
      return;
    }

    setIsEvaluating(true);

    try {
      let result: EvaluationResult;

      if (hasApiKey()) {
        const directResult = await evaluatePromptDirect(
          userPrompt.trim(),
          exercise.badPrompt,
          exercise.context,
          preferredModel ?? DEFAULT_MODEL,
        );
        result = {
          hasContext: (directResult.score ?? 0) >= 40,
          isSpecific: (directResult.score ?? 0) >= 60,
          hasConstraints: (directResult.score ?? 0) >= 80,
          feedback: directResult.feedback,
        };
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("evaluate-prompt", {
          body: {
            userPrompt: userPrompt.trim(),
            badPrompt: exercise.badPrompt,
            context: exercise.context,
            goodExample: exercise.goodExample,
            improvementHints: exercise.improvementHints,
            model: preferredModel ?? DEFAULT_MODEL,
          },
        });

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          return;
        }

        result = data as EvaluationResult;
      }
      setEvaluation(result);

      const score = [result.hasContext, result.isSpecific, result.hasConstraints].filter(Boolean).length;

      if (score === 3) {
        toast.success("Ausgezeichnet! Dein Prompt enthält alle wichtigen Elemente.");
      } else if (score === 2) {
        toast.info("Gut! Es fehlt noch ein Element für den perfekten Prompt.");
      } else {
        toast.error("Versuche, mehr Kontext und Details hinzuzufügen.");
      }

      onEvaluated?.(exercise.id, userPrompt, score, result.feedback);
    } catch (e) {
      console.error("Evaluation error:", e);
      toast.error("Bewertung fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setIsEvaluating(false);
    }
  }, [exercise, preferredModel, onEvaluated]);

  const askCoach = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim()) {
      toast.error("Bitte gib zuerst einen Prompt-Entwurf ein!");
      return;
    }

    setIsCoaching(true);
    setShowCoach(true);
    setCoachSuggestion("");

    const systemMsg: Msg = {
      role: "system",
      content: `Du bist ein Experte für Prompt-Engineering und ein freundlicher Coach. Der Nutzer versucht, einen schlechten Prompt zu verbessern.

Kontext der Übung: ${exercise.context}
Schlechter Original-Prompt: "${exercise.badPrompt}"
Verbesserungshinweise: ${exercise.improvementHints.join(", ")}

Deine Aufgabe:
1. Analysiere den Prompt-Entwurf des Nutzers
2. Identifiziere 2-3 konkrete Schwachstellen (Ambiguitäten, fehlender Kontext, fehlende Constraints)
3. Stelle gezielte Rückfragen, die dem Nutzer helfen, den Prompt selbst zu verbessern
4. Schlage am Ende einen optimierten Prompt vor, der alle Schwachstellen behebt

Antworte auf Deutsch, freundlich und konstruktiv. Formatiere deine Antwort klar mit Überschriften.`
    };

    const userMsg: Msg = {
      role: "user",
      content: `Hier ist mein Prompt-Entwurf: "${userPrompt.trim()}"\n\nBitte analysiere ihn und hilf mir, ihn zu verbessern.`
    };

    let accumulated = "";
    await streamChat({
      messages: [systemMsg, userMsg],
      model: preferredModel ?? DEFAULT_MODEL,
      onDelta: (text) => {
        accumulated += text;
        setCoachSuggestion(accumulated);
      },
      onDone: () => {
        setIsCoaching(false);
      },
      onError: (error) => {
        setIsCoaching(false);
        toast.error(error);
      },
    });
  }, [exercise, preferredModel]);

  const reset = useCallback(() => {
    setEvaluation(null);
    setCoachSuggestion("");
    setShowCoach(false);
  }, []);

  return {
    evaluation,
    isEvaluating,
    coachSuggestion,
    isCoaching,
    showCoach,
    setShowCoach,
    evaluatePrompt,
    askCoach,
    reset,
  };
}

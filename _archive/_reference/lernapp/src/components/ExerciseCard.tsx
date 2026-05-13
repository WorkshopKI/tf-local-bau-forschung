import { useState, useMemo } from "react";
import { trackAction } from "@/lib/actionTracker";
import { Check, X, ChevronDown, ChevronUp, Copy, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useExerciseEvaluation } from "@/hooks/useExerciseEvaluation";
import type { Exercise } from "@/types";

interface ExerciseCardProps {
  exercise: Exercise;
  bestScore?: number | null;
  onEvaluated?: (exerciseId: number, prompt: string, score: number, feedback: string) => void;
}

const evaluationCriteria = [
  { key: "hasContext" as const, label: "Kontext", pass: "Gut beschrieben", fail: "Fehlt oder zu vage" },
  { key: "isSpecific" as const, label: "Spezifität", pass: "Ausreichend spezifisch", fail: "Zu allgemein" },
  { key: "hasConstraints" as const, label: "Rahmenbedingungen", pass: "Klar definiert", fail: "Nicht angegeben" },
];

export const ExerciseCard = ({ exercise, bestScore, onEvaluated }: ExerciseCardProps) => {
  const { profile } = useAuthContext();
  const { scope, isDepartment } = useOrgContext();

  const effectiveExercise = useMemo(() => {
    if (isDepartment && exercise.departmentVariants) {
      const variant = exercise.departmentVariants.find((v) => v.department === scope);
      if (variant) {
        return {
          ...exercise,
          badPrompt: variant.badPrompt,
          context: variant.context,
          improvementHints: variant.improvementHints,
          goodExample: variant.goodExample,
        };
      }
    }
    return exercise;
  }, [exercise, scope, isDepartment]);

  const {
    evaluation,
    isEvaluating,
    coachSuggestion,
    isCoaching,
    showCoach,
    setShowCoach,
    evaluatePrompt,
    askCoach,
    reset,
  } = useExerciseEvaluation({
    exercise: effectiveExercise,
    preferredModel: profile?.preferred_model,
    onEvaluated,
  });

  const [userPrompt, setUserPrompt] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [teamReviewNote, setTeamReviewNote] = useState("");

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert!");
  };

  const resetExercise = () => {
    setUserPrompt("");
    setShowSolution(false);
    setShowHints(false);
    reset();
  };

  const score = evaluation
    ? [evaluation.hasContext, evaluation.isSpecific, evaluation.hasConstraints].filter(Boolean).length
    : 0;

  return (
    <div className="bg-gradient-card rounded-xl p-4 shadow-sm border border-border relative" data-feedback-ref="onboarding.uebung" data-feedback-label="Übungskarte">
      {bestScore !== null && bestScore !== undefined && (
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold ${
          bestScore === 3 ? "bg-primary/20 text-primary" :
          bestScore === 2 ? "bg-accent/20 text-accent-foreground" :
          "bg-muted text-muted-foreground"
        }`}>
          Beste: {bestScore}/3 ⭐
        </div>
      )}

      <div className="mb-3">
        <div className="text-sm font-semibold text-muted-foreground mb-2">
          {effectiveExercise.context}
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <div className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
            <X className="w-4 h-4" />
            Schlechter Prompt
          </div>
          <p className="text-foreground italic">"{effectiveExercise.badPrompt}"</p>
        </div>
      </div>

      <div className="mb-3">
        <Textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Schreibe hier deinen verbesserten Prompt..."
          className="min-h-[68px] mb-2"
          disabled={isEvaluating}
        />

        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" onClick={() => { trackAction("uebung-abgegeben"); evaluatePrompt(userPrompt); }} className="gap-1.5" disabled={isEvaluating}>
            {isEvaluating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEvaluating ? "Wird bewertet..." : "Prompt bewerten"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowHints(!showHints)} className="gap-1.5">
            {showHints ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Hinweise
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowSolution(!showSolution)} className="gap-1.5">
            {showSolution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Musterlösung
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => askCoach(userPrompt)}
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            disabled={isCoaching || isEvaluating}
          >
            {isCoaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isCoaching ? "Coach..." : "KI-Coach"}
          </Button>
          {(evaluation || userPrompt) && (
            <Button size="sm" variant="ghost" onClick={resetExercise}>
              Zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {showHints && (
        <div className="mb-3 bg-accent/10 border border-accent/20 rounded-lg p-4">
          <div className="text-sm font-semibold text-accent-foreground mb-2">
            💡 Verbesserungshinweise:
          </div>
          <ul className="space-y-1">
            {effectiveExercise.improvementHints.map((hint, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-accent-foreground">•</span>
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {evaluation && (
        <div className="mb-3 bg-background/50 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">KI-Feedback:</div>
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              Score: {score}/3
            </div>
          </div>
          <div className="space-y-2 mb-4">
            {evaluationCriteria.map(({ key, label, pass, fail }) => (
              <div key={key} className="flex items-center gap-2">
                {evaluation[key] ? (
                  <Check className="w-5 h-5 text-primary" />
                ) : (
                  <X className="w-5 h-5 text-destructive" />
                )}
                <span className="text-sm">
                  {label}: {evaluation[key] ? pass : fail}
                </span>
              </div>
            ))}
          </div>
          {evaluation.feedback && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-foreground">
              {evaluation.feedback}
            </div>
          )}
        </div>
      )}

      {evaluation && (
        <div className="mb-3 border border-border/80 rounded-lg p-4 bg-muted/20">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Team-Review (optional)
          </div>
          <Textarea
            value={teamReviewNote}
            onChange={(e) => setTeamReviewNote(e.target.value)}
            placeholder="Notiere hier Team-Feedback oder Freigabehinweise für diesen Prompt..."
            className="min-h-[76px]"
          />
        </div>
      )}

      {showCoach && coachSuggestion && (
        <div className="mb-3 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              KI-Coach: Reverse Prompting
              {isCoaching && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCoach(false)}
              className="text-xs"
            >
              Ausblenden
            </Button>
          </div>
          <div className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {coachSuggestion}
          </div>
        </div>
      )}

      {showSolution && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              Musterlösung
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(effectiveExercise.goodExample)}
              className="gap-2"
            >
              <Copy className="w-4 h-4" />
              Kopieren
            </Button>
          </div>
          <p className="text-foreground italic">"{effectiveExercise.goodExample}"</p>
        </div>
      )}
    </div>
  );
};

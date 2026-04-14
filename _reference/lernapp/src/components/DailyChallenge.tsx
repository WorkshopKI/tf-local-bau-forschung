import { useState, useMemo } from "react";
import { trackAction } from "@/lib/actionTracker";
import { Flame, CheckCircle2, Sparkles, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { useAuthContext } from "@/contexts/AuthContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { hasApiKey } from "@/services/apiKeyService";
import { evaluatePromptDirect } from "@/services/evaluationService";
import { FlawExercise } from "@/components/FlawExercise";
import { flawChallenges } from "@/data/flawChallenges";

export const DailyChallengeCard = () => {
  const { challenge, isCompleted, markCompleted, streak, todayScore } = useDailyChallenge();
  const { isLoggedIn } = useAuthContext();
  const { scope, isDepartment } = useOrgContext();
  const [userInput, setUserInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null);

  // Select a flaw challenge based on date + department
  const flawChallenge = useMemo(() => {
    const dateNum = parseInt(new Date().toISOString().split("T")[0].replace(/-/g, ""), 10);
    let pool = flawChallenges;
    if (isDepartment) {
      const deptPool = flawChallenges.filter(
        (c) => c.department === scope || !c.department
      );
      if (deptPool.length > 0) pool = deptPool;
    }
    return pool[dateNum % pool.length];
  }, [scope, isDepartment]);

  const handleFlawComplete = (score: number) => {
    setResult({ score, feedback: `Du hast ${score}% der Fehler korrekt identifiziert.` });
    markCompleted(score);
    trackAction("challenge-abgeschlossen");
    toast.success(`Fehler-Check: ${score}%`);
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || !isLoggedIn) return;
    setIsEvaluating(true);
    try {
      let score: number;
      let feedback: string;

      if (hasApiKey()) {
        const directResult = await evaluatePromptDirect(
          userInput,
          challenge.badExample || challenge.prompt,
          challenge.category,
        );
        score = directResult.score ?? 0;
        feedback = directResult.feedback ?? "Bewertung abgeschlossen.";
      } else {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase.functions.invoke("evaluate-prompt", {
          body: {
            original: challenge.badExample || challenge.prompt,
            improved: userInput,
            context: challenge.category,
          },
        });
        if (error) throw error;
        score = data?.score ?? 0;
        feedback = data?.feedback ?? "Bewertung abgeschlossen.";
      }

      setResult({ score, feedback });
      markCompleted(score);
      trackAction("challenge-abgeschlossen");
      toast.success(`Tagesaufgabe: ${score}%`);
    } catch {
      toast.error("Bewertung fehlgeschlagen");
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <Card className="p-5 bg-card rounded-xl border border-border shadow-sm" data-feedback-ref="dashboard.challenge" data-feedback-label="Tagesaufgabe">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">Tagesaufgabe</h2>
        {streak > 0 && (
          <Badge className="bg-primary/10 text-primary gap-1">
            <Flame className="w-3 h-3" /> {streak} Tage
          </Badge>
        )}
      </div>

      {isCompleted && result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">Erledigt!</span>
          </div>
          <Progress value={todayScore || result.score} className="h-2" />
          <p className="text-xs text-muted-foreground">{result.feedback}</p>
          <p className="text-[10px] text-muted-foreground">Morgen gibt's eine neue Aufgabe.</p>
        </div>
      ) : isCompleted ? (
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm">Heute erledigt! Morgen gibt's eine neue Aufgabe.</span>
        </div>
      ) : challenge.type === "spot-the-flaw" ? (
        <div className="space-y-3">
          <Badge variant="outline" className="text-[10px] mb-2">
            {challenge.category} · ~{challenge.estimatedMinutes} Min
          </Badge>
          <FlawExercise challenge={flawChallenge} onComplete={handleFlawComplete} compact />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Badge variant="outline" className="text-[10px] mb-2">
              {challenge.category} · ~{challenge.estimatedMinutes} Min
            </Badge>
            <p className="text-sm text-muted-foreground">{challenge.prompt}</p>
          </div>

          {challenge.badExample && (
            <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs">
              ❌ {challenge.badExample}
            </div>
          )}

          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Deine Antwort..."
            className="text-sm min-h-[80px]"
          />

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!userInput.trim() || isEvaluating || !isLoggedIn}
            className="gap-1.5"
          >
            {isEvaluating ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> Prüfe...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Prüfen
              </>
            )}
          </Button>

          {!isLoggedIn && (
            <p className="text-[10px] text-muted-foreground">Anmeldung erforderlich für KI-Bewertung.</p>
          )}
        </div>
      )}
    </Card>
  );
};

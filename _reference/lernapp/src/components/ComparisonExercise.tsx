import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, Lightbulb, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ComparisonExercise as ComparisonExerciseType } from "@/data/comparisonExercises";
import { addConstraint } from "@/services/constraintService";

interface Props {
  exercise: ComparisonExerciseType;
  onComplete?: (correct: boolean) => void;
}

type Phase = "choose" | "reason" | "reveal";

export function ComparisonExercise({ exercise, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [selected, setSelected] = useState<"A" | "B" | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [showRuleOffer, setShowRuleOffer] = useState(false);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [rulesSaved, setRulesSaved] = useState(false);

  const isCorrect = selected === exercise.correctAnswer;

  const handleConfirmChoice = () => {
    if (!selected) return;
    setPhase("reason");
  };

  const handleReveal = () => {
    setPhase("reveal");
    onComplete?.(isCorrect);
  };

  const toggleRule = (category: string) => {
    setSelectedRules((prev) =>
      prev.includes(category)
        ? prev.filter((r) => r !== category)
        : [...prev, category]
    );
  };

  const handleSaveRules = () => {
    const diffs = exercise.differences.filter((d) =>
      selectedRules.includes(d.category)
    );
    for (const diff of diffs) {
      addConstraint({
        title: diff.category,
        rule: diff.detail,
        domain: exercise.domain,
        source: "manual",
      });
    }
    setRulesSaved(true);
    toast.success(`${diffs.length} Regel${diffs.length > 1 ? "n" : ""} gespeichert`);
  };

  const outputA = exercise.outputA;
  const outputB = exercise.outputB;

  return (
    <div className="space-y-5">
      {/* Task description */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-muted text-muted-foreground text-xs">
            {exercise.domain}
          </Badge>
          <span className="text-sm font-medium">{exercise.task}</span>
        </div>
        <p className="text-sm text-muted-foreground italic">
          Prompt: „{exercise.prompt}"
        </p>
        {phase === "choose" && (
          <p className="text-sm">
            Zwei KI-Outputs zum selben Prompt. Welcher ist besser — und warum?
          </p>
        )}
      </div>

      {/* Output cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[outputA, outputB].map((output) => {
          const label = output.label;
          const isSelected = selected === label;
          const showQuality = phase === "reveal";

          return (
            <Card
              key={label}
              className={cn(
                "p-4 transition-all cursor-pointer",
                phase === "choose" && "hover:shadow-md",
                isSelected && phase !== "reveal"
                  ? "border-2 border-foreground shadow-md"
                  : "border border-border",
                phase === "reveal" && output.quality === 100 &&
                  "border-2 border-emerald-400 dark:border-emerald-600",
                phase === "reveal" && output.quality === 70 &&
                  "border-2 border-amber-400 dark:border-amber-600"
              )}
              onClick={() => {
                if (phase === "choose") setSelected(label);
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  variant="outline"
                  className="text-xs font-mono"
                >
                  {label}
                </Badge>
                <span className="text-sm font-medium">Output {label}</span>
                {showQuality && output.quality === 100 && (
                  <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs ml-auto">
                    Professionell
                  </Badge>
                )}
                {showQuality && output.quality === 70 && (
                  <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-xs ml-auto">
                    Oberflächlich
                  </Badge>
                )}
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                {output.text}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Phase: choose */}
      {phase === "choose" && (
        <Button onClick={handleConfirmChoice} disabled={!selected}>
          Auswahl bestätigen
        </Button>
      )}

      {/* Phase: reason */}
      {phase === "reason" && (
        <Card className="p-5 space-y-3 border border-border">
          <h3 className="font-semibold text-sm">
            Warum ist Output {selected} besser?
          </h3>
          <p className="text-sm text-muted-foreground">
            Beschreibe die konkreten Unterschiede, die du erkennst.
          </p>
          <Textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="z.B. Output B nennt die Rechtsgrundlage, hat ein Aktenzeichen..."
            rows={3}
          />
          <Button
            onClick={handleReveal}
            disabled={reasonText.trim().length < 10}
          >
            Auflösung zeigen
          </Button>
        </Card>
      )}

      {/* Phase: reveal */}
      {phase === "reveal" && (
        <div className="space-y-4">
          {/* Result banner */}
          <div
            className={cn(
              "p-4 rounded-lg border flex items-start gap-3",
              isCorrect
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
            )}
          >
            {isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="font-medium text-sm">
                {isCorrect
                  ? "Richtig! Du hast den professionellen Output erkannt."
                  : `Nicht ganz — Output ${exercise.correctAnswer} war die bessere Antwort.`}
              </p>
              {!isCorrect && (
                <p className="text-sm text-muted-foreground mt-1">
                  Kein Problem — genau dafür ist diese Übung da. Schau dir die
                  Unterschiede unten an.
                </p>
              )}
            </div>
          </div>

          {/* Differences list */}
          <Card className="p-5 border border-border space-y-3">
            <h3 className="font-semibold text-sm">
              Konkrete Unterschiede
            </h3>
            <div className="space-y-2">
              {exercise.differences.map((diff, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <span className="font-medium">{diff.category}:</span>{" "}
                    <span className="text-muted-foreground">{diff.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Constraint nudge */}
          {!showRuleOffer && !rulesSaved && (
            <Card className="p-5 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">
                    Erkenntnis festhalten?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Du hast gerade wichtige Qualitätskriterien identifiziert.
                    Speichere sie als Regeln für deine zukünftigen Prompts.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setShowRuleOffer(true)}>
                  Ja, Regeln ableiten
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRulesSaved(true)}
                >
                  Nicht jetzt
                </Button>
              </div>
            </Card>
          )}

          {/* Rule selection */}
          {showRuleOffer && !rulesSaved && (
            <Card className="p-5 border border-border space-y-3">
              <h3 className="font-semibold text-sm">
                Regeln zum Speichern auswählen
              </h3>
              <div className="space-y-2">
                {exercise.differences.map((diff) => (
                  <label
                    key={diff.category}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedRules.includes(diff.category)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedRules.includes(diff.category)}
                      onCheckedChange={() => toggleRule(diff.category)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{diff.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {diff.detail}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleSaveRules}
                disabled={selectedRules.length === 0}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Ausgewählte speichern
              </Button>
            </Card>
          )}

          {rulesSaved && showRuleOffer && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Regeln gespeichert — du findest sie in deiner Constraint Library.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { useSyncContext } from "@/contexts/SyncContext";
import { useOrgContext } from "@/contexts/OrgContext";
import { useLernpfadProgress } from "@/hooks/useLernpfadProgress";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { lernpfadStufen, requiredModules } from "@/data/learningPath";
import { promptLibrary } from "@/data/prompts";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";
import { DailyChallengeCard } from "@/components/DailyChallenge";
import { ComparisonExercise } from "@/components/ComparisonExercise";
import { comparisonExercises } from "@/data/comparisonExercises";
import { loadConstraints } from "@/services/constraintService";
import { loadKIContext } from "@/services/kiContextService";
import { getActiveRuleCount } from "@/lib/contextBuilder";
import { LS_KEYS } from "@/lib/constants";
import { loadArrayFromStorage, saveToStorage } from "@/lib/storage";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { profile } = useAuthContext();
  const { scope, isDepartment, scopeLabel } = useOrgContext();
  const { completedLessons } = useSyncContext();
  const { isCompleted: dailyCompleted, streak: dailyStreak } = useDailyChallenge();

  const displayName = profile?.display_name;

  // Lernpfad
  const stufeProgress = useLernpfadProgress();
  const currentProgress = stufeProgress.find((s) => s.isCurrent) || stufeProgress[0];
  const currentStufeDef = lernpfadStufen[currentProgress.nr - 1];

  // Constraints & KI-Kontext
  const constraints = loadConstraints();
  const constraintCount = constraints.length;
  const kiContext = loadKIContext();
  const activeRuleCount = getActiveRuleCount();

  // Popular prompts
  const popularPrompts = useMemo(() => {
    let candidates = promptLibrary;
    if (isDepartment) {
      const deptPrompts = candidates.filter((p) => p.targetDepartment === scope);
      const officialPrompts = candidates.filter(
        (p) => p.official && p.targetDepartment !== scope
      );
      candidates = [...deptPrompts, ...officialPrompts];
    }
    if (candidates.length < 6) {
      const remaining = promptLibrary.filter((p) => !candidates.includes(p));
      candidates = [...candidates, ...remaining];
    }
    return candidates.slice(0, 6);
  }, [scope, isDepartment]);

  // Next step
  const nextStep = useMemo(() => {
    if (currentProgress.nr === 1) {
      const nextModule = requiredModules.find(
        (m) => !completedLessons.includes(m.id)
      );
      if (nextModule) {
        return {
          label: `Stufe 1 · ${nextModule.type === "theorie" ? "Theorie" : "Praxis"} · ${nextModule.duration}`,
          title: nextModule.title,
          action: () => navigate("/onboarding"),
          actionLabel: "Starten",
        };
      }
    }
    if (currentProgress.nr === 2) {
      return {
        label: "Stufe 2 · Bewerten",
        title: "Nutze die Prüfen-Funktion in der Werkstatt",
        action: () => navigate("/playground"),
        actionLabel: "Werkstatt öffnen",
      };
    }
    if (currentProgress.nr === 3) {
      return {
        label: "Stufe 3 · Unterscheiden",
        title: "Trainiere dein Qualitätsurteil",
        action: () => setCompDialogOpen(true),
        actionLabel: "Übung starten",
      };
    }
    if (currentProgress.nr === 4) {
      return {
        label: "Stufe 4 · Artikulieren",
        title: "Iteriere in der Werkstatt und speichere Qualitätsregeln",
        action: () => navigate("/playground"),
        actionLabel: "Werkstatt öffnen",
      };
    }
    if (currentProgress.nr === 5) {
      const hasProfile =
        kiContext.profile.abteilung || kiContext.profile.fachgebiet;
      if (!hasProfile) {
        return {
          label: "Stufe 5 · Systematisieren",
          title: "Richte deinen persönlichen KI-Kontext ein",
          action: () => navigate("/settings"),
          actionLabel: "Einstellungen öffnen",
        };
      }
      return {
        label: "Stufe 5 · Systematisieren",
        title: "Erstelle Arbeitsregeln für dein Fachgebiet",
        action: () => navigate("/settings"),
        actionLabel: "Regeln bearbeiten",
      };
    }
    return null;
  }, [currentProgress, completedLessons, kiContext]);

  // Erkenne den Unterschied
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const comparisonHistory = useMemo<string[]>(
    () => loadArrayFromStorage<string>(LS_KEYS.COMPARISON_HISTORY),
    []
  );
  const [compLocalHistory, setCompLocalHistory] =
    useState<string[]>(comparisonHistory);

  const nextCompExercise = useMemo(() => {
    const remaining = comparisonExercises.filter(
      (e) => !compLocalHistory.includes(e.id)
    );
    return remaining.length > 0 ? remaining[0] : null;
  }, [compLocalHistory]);

  const allCompCompleted = !nextCompExercise;

  const handleComparisonComplete = useCallback(
    (correct: boolean) => {
      if (!nextCompExercise) return;
      const updated = [...compLocalHistory, nextCompExercise.id];
      setCompLocalHistory(updated);
      saveToStorage(LS_KEYS.COMPARISON_HISTORY, updated);
    },
    [nextCompExercise, compLocalHistory]
  );

  const handleResetComparison = useCallback(() => {
    setCompLocalHistory([]);
    saveToStorage(LS_KEYS.COMPARISON_HISTORY, []);
  }, []);

  // Template expand/collapse
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const visiblePrompts = showAllTemplates ? popularPrompts : popularPrompts.slice(0, 5);

  // Daily challenge dialog
  const [dailyDialogOpen, setDailyDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* 1. Begrüßung */}
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">
            {getGreeting()}
            {displayName ? `, ${displayName}` : ""}
          </h1>
          {isDepartment && (
            <span className="text-sm text-muted-foreground">{scopeLabel}</span>
          )}
        </div>
      </div>

      {/* 2. Nächster Schritt Banner (volle Breite) */}
      {nextStep && (
        <div
          className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border-l-4"
          style={{ borderLeftColor: `var(--stufe-${currentProgress.nr})` }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
              Dein nächster Schritt · {nextStep.label}
            </p>
            <p className="text-sm font-semibold">{nextStep.title}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={nextStep.action}>
            {nextStep.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* 3. Zwei-Spalten Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Links (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Heute üben */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[11px] font-bold tracking-[2.5px] uppercase text-primary whitespace-nowrap">
                Heute üben
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="pl-1">
              <button
                onClick={() => setDailyDialogOpen(true)}
                className="w-full flex items-center gap-3.5 py-3.5 text-left transition-colors hover:text-primary border-b border-border"
              >
                <Flame className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[13.5px] font-[450] flex-1">Tagesaufgabe</span>
                {dailyStreak > 0 && (
                  <span className="text-[10px] text-muted-foreground">{dailyStreak} Tage</span>
                )}
                {dailyCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
              <button
                onClick={() => !allCompCompleted ? setCompDialogOpen(true) : handleResetComparison()}
                className="w-full flex items-center gap-3.5 py-3.5 text-left transition-colors hover:text-primary last:border-b-0"
              >
                <Target className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[13.5px] font-[450] flex-1">Erkenne den Unterschied</span>
                <span className="text-[10px] text-muted-foreground">
                  {compLocalHistory.length}/{comparisonExercises.length}
                </span>
                {allCompCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Beliebte Vorlagen */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[11px] font-bold tracking-[2.5px] uppercase text-primary whitespace-nowrap">
                Beliebte Vorlagen
              </h2>
              <div className="flex-1 h-px bg-border" />
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1 text-primary h-7 whitespace-nowrap"
                onClick={() => navigate("/library")}
              >
                Alle <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            <div className="pl-1">
              {visiblePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/playground?libraryTitle=${encodeURIComponent(prompt.title)}`)}
                  className={`w-full flex items-center gap-3.5 py-3.5 text-left transition-colors hover:text-primary${i < visiblePrompts.length - 1 ? " border-b border-border" : ""}`}
                >
                  <span className="text-[13.5px] font-[450] flex-1 truncate">{prompt.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {prompt.category}
                  </span>
                  <ConfidentialityBadge level={prompt.confidentiality || "open"} compact />
                </button>
              ))}
              {popularPrompts.length > 5 && (
                <button
                  onClick={() => setShowAllTemplates(!showAllTemplates)}
                  className="w-full pt-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {showAllTemplates ? "Weniger anzeigen" : `Alle ${popularPrompts.length} anzeigen`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rechts (1/3) */}
        <div className="flex flex-col gap-4">
          {/* Mini-Lernpfad — immer sichtbar */}
          <Card className="p-4 border border-border shadow-sm">
            <h2 className="text-xs font-semibold mb-3">Lernpfad</h2>
            <div className="space-y-2">
              {lernpfadStufen.map((stufe, i) => {
                const sp = stufeProgress[i];
                return (
                  <div key={stufe.nr} className="flex items-center gap-2.5">
                    {sp.isCurrent || sp.progress === 100 ? (
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `var(--stufe-${stufe.nr})`,
                        }}
                      />
                    ) : (
                      <div className="w-2 h-2 rounded-full shrink-0 bg-border" />
                    )}
                    <span
                      className={`text-xs flex-1 ${
                        sp.isCurrent
                          ? "font-semibold"
                          : sp.unlocked
                            ? ""
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {stufe.title}
                    </span>
                    {sp.progress > 0 && sp.progress < 100 && (
                      <span className="text-[10px] text-muted-foreground">
                        {sp.progress}%
                      </span>
                    )}
                    {sp.progress === 100 && (
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs gap-1 text-primary h-7"
              onClick={() => navigate("/onboarding")}
            >
              Zum Lernpfad <ArrowRight className="w-3 h-3" />
            </Button>
          </Card>

          {/* KI-Kontext — nur wenn eingerichtet oder Stufe >= 4 */}
          {(kiContext.profile.abteilung || currentProgress.nr >= 4) && (
            <Card className="p-4 border border-border shadow-sm">
              <h2 className="text-xs font-semibold mb-2">Mein KI-Kontext</h2>
              {kiContext.profile.abteilung ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {kiContext.profile.abteilung}
                  </p>
                  {activeRuleCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[11px] text-muted-foreground">
                        {activeRuleCount} Regeln aktiv
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Noch nicht eingerichtet.
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs gap-1 text-primary h-7"
                onClick={() => navigate("/settings")}
              >
                {kiContext.profile.abteilung ? "Bearbeiten" : "Einrichten"}{" "}
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Card>
          )}

          {/* Qualitätsregeln — nur wenn >= 1 existiert oder Stufe >= 3 */}
          {(constraintCount > 0 || currentProgress.nr >= 3) && (
            <Card className="p-4 border border-border shadow-sm">
              <h2 className="text-xs font-semibold mb-2">Qualitätsregeln</h2>
              {constraintCount > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {constraintCount} Regeln
                  </p>
                  {constraints.filter((c) => c.source === "rejection").length > 0 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      {constraints.filter((c) => c.source === "rejection").length}{" "}
                      aus Ablehnungen gelernt
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Noch keine Regeln erstellt.
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs gap-1 text-primary h-7"
                onClick={() => navigate("/library?section=constraints")}
              >
                {constraintCount > 0 ? "Ansehen" : "Erste Regel erstellen"}{" "}
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Dialoge */}
      <Dialog open={dailyDialogOpen} onOpenChange={setDailyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tagesaufgabe</DialogTitle>
            <DialogDescription>
              Löse die heutige Aufgabe und verbessere deine KI-Kompetenz.
            </DialogDescription>
          </DialogHeader>
          <DailyChallengeCard />
        </DialogContent>
      </Dialog>

      <Dialog open={compDialogOpen} onOpenChange={setCompDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Erkenne den Unterschied</DialogTitle>
            <DialogDescription>
              Vergleiche zwei KI-Outputs und finde den professionellen.
            </DialogDescription>
          </DialogHeader>
          {nextCompExercise && (
            <ComparisonExercise
              key={nextCompExercise.id}
              exercise={nextCompExercise}
              onComplete={handleComparisonComplete}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;

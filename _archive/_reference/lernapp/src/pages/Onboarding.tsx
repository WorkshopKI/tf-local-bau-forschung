import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Play,
  Lock,
  ChevronDown,
  PenLine,
  ShieldCheck,
  Eye,
  Lightbulb,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSyncContext } from "@/contexts/SyncContext";
import {
  requiredModules,
  bonusModules,
  learningModules,
  lernpfadStufen,
  type LernpfadStufe,
} from "@/data/learningPath";
import { useLernpfadProgress, type StufeProgress } from "@/hooks/useLernpfadProgress";
import { ACTAIntroduction } from "@/components/ACTAIntroduction";
import { RAKETEIntroduction } from "@/components/RAKETEIntroduction";
import { PracticeAreaCompact } from "@/components/PracticeAreaCompact";
import { AdvancedTechniquesModule } from "@/components/AdvancedTechniquesModule";
import { DataPrivacyIntro } from "@/components/DataPrivacyIntro";
import { WorkflowBuilderModule } from "@/components/WorkflowBuilderModule";

const componentMap: Record<string, React.ComponentType> = {
  ACTAIntroduction,
  RAKETEIntroduction,
  PracticeAreaCompact,
  AdvancedTechniquesModule,
  DataPrivacyIntro,
  WorkflowBuilderModule,
};

const typeBadgeColors: Record<string, string> = {
  theorie: "bg-muted text-muted-foreground",
  praxis: "bg-primary/10 text-primary",
  quiz: "bg-muted text-muted-foreground",
  pruefung: "bg-primary/10 text-primary",
};

const typeLabels: Record<string, string> = {
  theorie: "Theorie",
  praxis: "Praxis",
  quiz: "Quiz",
  pruefung: "Prüfung",
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  PenLine,
  ShieldCheck,
  Eye,
  Lightbulb,
  Layers,
};

const STUFE_STYLES: Record<string, {
  bg: string; text: string; border: string; ring: string; fill: string;
  badge: string; badgeActive: string;
}> = {
  blue: {
    bg: "bg-[var(--stufe-1)]",
    text: "text-[var(--stufe-1)]",
    border: "border-[var(--stufe-1)]",
    ring: "ring-[var(--stufe-1-ring)]",
    fill: "bg-[var(--stufe-1)]",
    badge: "bg-[var(--stufe-1-light)] text-[var(--stufe-1)]",
    badgeActive: "bg-[var(--stufe-1)] text-white",
  },
  violet: {
    bg: "bg-[var(--stufe-2)]",
    text: "text-[var(--stufe-2)]",
    border: "border-[var(--stufe-2)]",
    ring: "ring-[var(--stufe-2-ring)]",
    fill: "bg-[var(--stufe-2)]",
    badge: "bg-[var(--stufe-2-light)] text-[var(--stufe-2)]",
    badgeActive: "bg-[var(--stufe-2)] text-white",
  },
  amber: {
    bg: "bg-[var(--stufe-3)]",
    text: "text-[var(--stufe-3)]",
    border: "border-[var(--stufe-3)]",
    ring: "ring-[var(--stufe-3-ring)]",
    fill: "bg-[var(--stufe-3)]",
    badge: "bg-[var(--stufe-3-light)] text-[var(--stufe-3)]",
    badgeActive: "bg-[var(--stufe-3)] text-white",
  },
  emerald: {
    bg: "bg-[var(--stufe-4)]",
    text: "text-[var(--stufe-4)]",
    border: "border-[var(--stufe-4)]",
    ring: "ring-[var(--stufe-4-ring)]",
    fill: "bg-[var(--stufe-4)]",
    badge: "bg-[var(--stufe-4-light)] text-[var(--stufe-4)]",
    badgeActive: "bg-[var(--stufe-4)] text-white",
  },
  slate: {
    bg: "bg-[var(--stufe-5)]",
    text: "text-[var(--stufe-5)]",
    border: "border-[var(--stufe-5)]",
    ring: "ring-[var(--stufe-5-ring)]",
    fill: "bg-[var(--stufe-5)]",
    badge: "bg-[var(--stufe-5-light)] text-[var(--stufe-5)]",
    badgeActive: "bg-[var(--stufe-5)] text-white",
  },
};

const Onboarding = () => {
  const { completedLessons, markLessonComplete } = useSyncContext();
  const stufeProgress = useLernpfadProgress();
  const [expandedStufe, setExpandedStufe] = useState<number | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [challengeAnswers, setChallengeAnswers] = useState<Record<string, string>>({});
  const [bonusOpen, setBonusOpen] = useState(false);

  // Auto-expand aktive Stufe nur beim ersten Laden
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  useEffect(() => {
    if (!hasAutoExpanded && stufeProgress.length > 0) {
      const current = stufeProgress.find(s => s.isCurrent);
      if (current) {
        setExpandedStufe(current.nr);
      }
      setHasAutoExpanded(true);
    }
  }, [stufeProgress, hasAutoExpanded]);

  // Abwärtskompatibilität: Alte Modul-IDs auf neue mappen
  const moduleStatuses = useMemo(() => {
    const effectiveLessons = [...completedLessons];
    if (
      completedLessons.includes("grundlagen") ||
      completedLessons.includes("acta-methode") ||
      completedLessons.includes("acta-challenge")
    ) {
      if (!effectiveLessons.includes("acta-einfuehrung")) {
        effectiveLessons.push("acta-einfuehrung");
      }
    }
    if (completedLessons.includes("prompt-beispiele")) {
      if (!effectiveLessons.includes("prompting-stufen")) {
        effectiveLessons.push("prompting-stufen");
      }
    }
    if (completedLessons.includes("advanced")) {
      if (!effectiveLessons.includes("techniken-anwenden")) {
        effectiveLessons.push("techniken-anwenden");
      }
    }
    if (completedLessons.includes("zerlegung")) {
      if (!effectiveLessons.includes("workflows-bauen")) {
        effectiveLessons.push("workflows-bauen");
      }
    }

    const statuses: Record<string, "completed" | "available" | "locked"> = {};
    for (const mod of learningModules) {
      if (effectiveLessons.includes(mod.id)) {
        statuses[mod.id] = "completed";
      } else {
        const allPrereqsMet = mod.prerequisites.every((p) => effectiveLessons.includes(p));
        statuses[mod.id] = allPrereqsMet ? "available" : "locked";
      }
    }
    return statuses;
  }, [completedLessons]);

  const toggleStufe = (nr: number) => {
    setExpandedStufe(prev => prev === nr ? null : nr);
    setExpandedModule(null);
  };

  const toggleModule = (id: string) => {
    if (moduleStatuses[id] === "locked") return;
    setExpandedModule(prev => prev === id ? null : id);
  };

  const renderModule = (mod: typeof learningModules[number], showNumber: number) => {
    const status = moduleStatuses[mod.id];
    const isExpanded = expandedModule === mod.id;
    const Component = componentMap[mod.component];

    return (
      <div key={mod.id}>
        <div
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
            status === "locked"
              ? "opacity-40 cursor-default"
              : isExpanded
                ? "bg-muted/50"
                : "hover:bg-muted/30"
          }`}
          onClick={() => status !== "locked" && toggleModule(mod.id)}
        >
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
            status === "completed"
              ? "bg-primary/15 text-primary"
              : status === "available"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}>
            {status === "completed" ? <CheckCircle2 className="w-4 h-4" /> : showNumber}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{mod.title}</span>
          </div>
          <Badge className={`text-[10px] shrink-0 ${typeBadgeColors[mod.type] || ""}`}>
            {typeLabels[mod.type]}
          </Badge>
          <span className="text-[10px] text-muted-foreground shrink-0">{mod.duration}</span>
          {status === "completed" && (
            <span className="text-[10px] text-primary font-medium shrink-0">Erledigt</span>
          )}
          {status === "available" && !isExpanded && (
            <Play className="w-4 h-4 text-primary shrink-0" />
          )}
        </div>
        {isExpanded && Component && (
          <div className="ml-10 mt-2 mb-3">
            <Card className="border border-border">
              <div className="p-5">
                <Component />
                {status !== "completed" && (
                  <div className="mt-6 pt-4 border-t border-border space-y-4">
                    {mod.challenge ? (
                      <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium">{mod.challenge.question}</p>
                        <Textarea
                          value={challengeAnswers[mod.id] || ""}
                          onChange={(e) => setChallengeAnswers(prev => ({ ...prev, [mod.id]: e.target.value }))}
                          placeholder={mod.challenge.placeholder}
                          className="text-xs min-h-[72px] resize-none"
                          rows={3}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {(challengeAnswers[mod.id] || "").length < mod.challenge.minLength
                              ? `Noch mindestens ${mod.challenge.minLength - (challengeAnswers[mod.id] || "").length} Zeichen`
                              : "\u2713 Ausreichend"
                            }
                          </span>
                          <Button
                            onClick={(e) => { e.stopPropagation(); markLessonComplete(mod.id); }}
                            disabled={(challengeAnswers[mod.id] || "").length < mod.challenge.minLength}
                            className="gap-2" size="sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Modul abschließen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          onClick={(e) => { e.stopPropagation(); markLessonComplete(mod.id); }}
                          className="gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Modul abschließen
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {status === "completed" && (
                  <div className="mt-6 pt-4 border-t border-border">
                    <Button disabled variant="outline" className="gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Bereits abgeschlossen
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const renderStufeContent = (stufe: LernpfadStufe, sp: StufeProgress) => {
    if (!sp.unlocked) {
      return (
        <div className="flex items-center gap-2 py-3 px-4 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Schließe zuerst Stufe {stufe.nr - 1} ab.</span>
        </div>
      );
    }

    // Stufe 1: Module anzeigen
    if (stufe.nr === 1) {
      return (
        <div className="space-y-1">
          <div className="space-y-0.5">
            {requiredModules.map((mod, i) => renderModule(mod, i + 1))}
          </div>
          {bonusModules.length > 0 && (
            <Collapsible open={bonusOpen} onOpenChange={setBonusOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={`w-3 h-3 transition-transform ${bonusOpen ? "rotate-180" : ""}`} />
                <span>Bonus-Module ({bonusModules.length})</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-0.5">
                  {bonusModules.map((mod, i) => renderModule(mod, requiredModules.length + i + 1))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      );
    }

    // Stufe 2-5: Features + Fortschritt
    const styles = STUFE_STYLES[stufe.color] || STUFE_STYLES.slate;
    return (
      <div className="space-y-3 py-2 px-1">
        {stufe.features && stufe.features.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stufe.features.map(f => (
              <span
                key={f}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${styles.badge}`}
              >
                {f}
              </span>
            ))}
          </div>
        )}
        {sp.progress > 0 && sp.progress < 100 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${styles.fill}`} style={{ width: `${sp.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{sp.progress}%</span>
          </div>
        )}
      </div>
    );
  };

  const renderStatusBadge = (sp: StufeProgress, styles: typeof STUFE_STYLES.blue) => {
    if (sp.progress === 100) {
      return (
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          Abgeschlossen
        </span>
      );
    }
    if (sp.isCurrent && sp.unlocked) {
      return (
        <span className={`text-[10px] rounded-full px-2 py-0.5 ${styles.badgeActive}`}>
          Aktiv
        </span>
      );
    }
    if (sp.unlocked && sp.progress > 0) {
      return (
        <span className="text-[10px] rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          {sp.progress}%
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6" data-feedback-ref="onboarding.seite" data-feedback-label="Onboarding-Seite">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground mb-4">
          Fünf Stufen — von der ersten KI-Anfrage bis zum eigenen Qualitätssystem.
        </p>

        {/* Segmentierte Fortschrittsleiste */}
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {lernpfadStufen.map((stufe, i) => {
              const sp = stufeProgress[i];
              const styles = STUFE_STYLES[stufe.color] || STUFE_STYLES.slate;
              return (
                <div key={stufe.nr} className="flex-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${styles.fill}`}
                      style={{ width: `${sp.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1">
            {lernpfadStufen.map((stufe, i) => {
              const sp = stufeProgress[i];
              const styles = STUFE_STYLES[stufe.color] || STUFE_STYLES.slate;
              return (
                <div key={stufe.nr} className="flex-1">
                  <span className={`text-[10px] font-medium ${
                    sp.isCurrent ? styles.text : "text-muted-foreground"
                  }`}>
                    {stufe.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative" data-feedback-ref="onboarding.lernpfad" data-feedback-label="Lernpfad-Timeline">
        {lernpfadStufen.map((stufe, i) => {
          const sp = stufeProgress[i];
          const styles = STUFE_STYLES[stufe.color] || STUFE_STYLES.slate;
          const Icon = ICON_MAP[stufe.iconName] || PenLine;
          const isExpanded = expandedStufe === stufe.nr;
          const isLast = i === lernpfadStufen.length - 1;
          const isComplete = sp.progress === 100;
          const isActive = sp.isCurrent && sp.unlocked;
          const isLocked = !sp.unlocked;

          return (
            <div key={stufe.nr} className="flex gap-4">
              {/* Timeline Node + Line */}
              <div className="flex flex-col items-center shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isComplete
                      ? `${styles.bg} border-transparent text-white`
                      : isActive
                        ? `bg-background ${styles.border} ${styles.text} ring-4 ${styles.ring}`
                        : isLocked
                          ? "bg-muted border-muted-foreground/20 text-muted-foreground/30"
                          : `bg-background ${styles.border} ${styles.text}`
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-[24px] ${
                    isComplete ? `${styles.fill} opacity-40` : "bg-border"
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${isLast ? "pb-0" : ""}`}>
                {/* Header row */}
                <div
                  className={`flex items-start gap-2 cursor-pointer ${isLocked ? "cursor-default" : ""}`}
                  onClick={() => !isLocked && toggleStufe(stufe.nr)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isLocked ? "text-muted-foreground/40" : styles.text
                      }`}>
                        Stufe {stufe.nr}
                      </span>
                      {renderStatusBadge(sp, styles)}
                    </div>
                    <h3 className={`text-base mt-0.5 ${
                      isLocked ? "text-muted-foreground/70" : ""
                    }`}>
                      <span className="font-bold">{stufe.title}</span>
                      <span className={`font-normal ${isLocked ? "text-muted-foreground/50" : "text-muted-foreground"}`}> — {stufe.subtitle}</span>
                    </h3>
                  </div>
                  {!isLocked && (
                    <ChevronDown className={`w-4 h-4 mt-1 text-muted-foreground transition-transform shrink-0 ${
                      isExpanded ? "rotate-180" : ""
                    }`} />
                  )}
                </div>

                {/* Expandierter Inhalt */}
                {isExpanded && !isLocked && (
                  <Card className="mt-3 border border-border" data-feedback-ref={`onboarding.stufe-${stufe.nr}`} data-feedback-label={`Stufe ${stufe.nr}: ${stufe.title}`}>
                    <div className="p-4">
                      <p className="text-sm text-muted-foreground mb-4">{stufe.description}</p>
                      {renderStufeContent(stufe, sp)}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Onboarding;

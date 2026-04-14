import { useState, useMemo } from "react";
import { Copy, Sparkles, Star, Shield, Clock, Wrench, Building2, Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PromptItem } from "@/data/prompts";
import { ConfidentialityBadge } from "@/components/ConfidentialityBadge";
import { RISK_COLORS } from "@/lib/constants";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import { useMySkills } from "@/hooks/useMySkills";
import { extractVariables } from "@/lib/promptUtils";

interface PromptDetailProps {
  prompt: PromptItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStoredRating(title: string): number {
  const ratings = loadFromStorage<Record<string, number>>(LS_KEYS.PROMPT_RATINGS, {});
  return ratings[title] || 0;
}

function storeRating(title: string, rating: number) {
  const ratings = loadFromStorage<Record<string, number>>(LS_KEYS.PROMPT_RATINGS, {});
  ratings[title] = rating;
  saveToStorage(LS_KEYS.PROMPT_RATINGS, ratings);
}

export const PromptDetail = ({ prompt, open, onOpenChange }: PromptDetailProps) => {
  const navigate = useNavigate();
  const { saveSkill, createSkillFromPrompt } = useMySkills();
  const variables = useMemo(() => (prompt ? extractVariables(prompt.prompt) : []), [prompt]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  if (!prompt) return null;

  const currentRating = rating || getStoredRating(prompt.title);

  const handleSaveAsSkill = () => {
    if (!prompt) return;
    const skill = createSkillFromPrompt(prompt, variableValues);
    saveSkill(skill);
    toast.success("Als Skill gespeichert", {
      description: "Du findest ihn unter Meine Skills in der Library.",
    });
  };

  const handleRate = (value: number) => {
    setRating(value);
    storeRating(prompt.title, value);
    toast.success(`${value} Sterne vergeben`);
  };

  const getFilledPrompt = () => {
    let text = prompt.prompt;
    for (const [key, val] of Object.entries(variableValues)) {
      if (val) text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return text;
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(getFilledPrompt());
    toast.success("Prompt kopiert!");
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-feedback-ref="prompt-sammlung.detail" data-feedback-label="Prompt-Detail">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">{prompt.title}</DialogTitle>
            <ConfidentialityBadge level={prompt.confidentiality || "open"} reason={prompt.confidentialityReason} />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{prompt.category}</Badge>
            {prompt.level && <Badge variant="outline">{prompt.level}</Badge>}
            {prompt.department && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="w-3 h-3" /> {prompt.department}
              </Badge>
            )}
            {prompt.riskLevel && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLORS[prompt.riskLevel] || ""}`}>
                Risiko: {prompt.riskLevel}
              </span>
            )}
            {prompt.official ? (
              <Badge className="bg-primary/10 text-primary gap-1">
                <Shield className="w-3 h-3" /> Verifiziert
              </Badge>
            ) : (
              <Badge variant="secondary">Entwurf</Badge>
            )}
          </div>

          {/* Prompt Text */}
          <div className="bg-muted/40 rounded-lg p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {prompt.prompt}
          </div>

          {/* Variables */}
          {variables.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-2">Template-Variablen</p>
              <div className="space-y-2">
                {variables.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <Badge variant="outline" className="shrink-0">{`{{${v}}}`}</Badge>
                    <Input
                      placeholder={v}
                      value={variableValues[v] || ""}
                      onChange={(e) =>
                        setVariableValues((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blueprint details */}
          {prompt.type === "blueprint" && prompt.constraints && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2 text-xs">
                {prompt.estimatedAgentTime && (
                  <span className="inline-flex items-center gap-1 bg-accent/10 text-accent-foreground px-2 py-1 rounded">
                    <Clock className="w-3 h-3" /> {prompt.estimatedAgentTime}
                  </span>
                )}
                {prompt.requiredTools?.map((tool, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded">
                    <Wrench className="w-3 h-3" /> {tool}
                  </span>
                ))}
              </div>
              {prompt.constraints.musts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary mb-1">MUST</p>
                  <ul className="space-y-1">
                    {prompt.constraints.musts.map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground">+ {m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {prompt.constraints.mustNots.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1">MUST NOT</p>
                  <ul className="space-y-1">
                    {prompt.constraints.mustNots.map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground">- {m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {prompt.acceptanceCriteria && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-primary mb-1">Abnahmekriterien</p>
                  <p className="text-xs leading-relaxed">{prompt.acceptanceCriteria}</p>
                </div>
              )}
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Bewertung:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5"
              >
                <Star
                  className={`w-5 h-5 transition-colors ${
                    star <= (hoverRating || currentRating)
                      ? "fill-primary text-primary"
                      : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button onClick={copyPrompt} className="gap-2">
              <Copy className="w-4 h-4" /> Kopieren
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                navigate(`/playground?libraryTitle=${encodeURIComponent(prompt.title)}`);
                onOpenChange(false);
              }}
            >
              <Sparkles className="w-4 h-4" /> Im Labor verfeinern
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleSaveAsSkill}>
              <Bookmark className="w-4 h-4" /> Als Skill speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

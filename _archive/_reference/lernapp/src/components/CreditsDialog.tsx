import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getModelLabel } from "@/data/models";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coins, Key, ArrowRight, Bot, BarChart3, Zap } from "lucide-react";

export interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  requestsToday: number;
}

export const CreditsDialog = ({ open, onOpenChange }: CreditsDialogProps) => {
  const { user, profile } = useAuthContext();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<{
    provisioned_key_budget: number;
    custom_key_active: boolean;
    active_key_source: string;
  } | null>(null);
  const [maxBudget, setMaxBudget] = useState(5.0);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    const loadData = async () => {
      // Budget info
      const { data: keyData } = await supabase
        .from("user_api_keys")
        .select("provisioned_key_budget, custom_key_active, active_key_source")
        .eq("user_id", user.id)
        .maybeSingle();
      if (keyData) setBudget(keyData);

      // Max budget from course
      if (profile?.course_id) {
        const { data: course } = await supabase
          .from("courses")
          .select("default_key_budget")
          .eq("id", profile.course_id)
          .maybeSingle();
        if (course?.default_key_budget) setMaxBudget(Number(course.default_key_budget));
      }

      // Usage stats
      const { data: usageData } = await (supabase as any)
        .from("api_usage_log")
        .select("estimated_cost, total_tokens, created_at")
        .eq("user_id", user.id);

      if (usageData) {
        const today = new Date().toISOString().slice(0, 10);
        const stats: UsageStats = {
          totalRequests: usageData.length,
          totalTokens: usageData.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0),
          totalCost: usageData.reduce((sum, r) => sum + Number(r.estimated_cost ?? 0), 0),
          requestsToday: usageData.filter((r) => r.created_at?.startsWith(today)).length,
        };
        setUsage(stats);
      }

      setLoading(false);
    };

    loadData();
  }, [open, user, profile?.course_id]);

  const isCustom = budget?.active_key_source === "custom";
  const budgetValue = budget?.provisioned_key_budget ?? 0;
  const budgetPercent = Math.min((budgetValue / maxBudget) * 100, 100);
  const currentModel = profile?.preferred_model ?? "google/gemini-3-flash-preview";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            KI-Credits & Verbrauch
          </DialogTitle>
          <DialogDescription>
            Dein KI-Kontingent und bisheriger Verbrauch.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Wird geladen...</p>
        ) : budget ? (
          <div className="space-y-4">
            {/* Budget */}
            {!isCustom && (
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Verbleibendes Budget</span>
                  <span className="font-semibold">
                    ${budgetValue.toFixed(2)} / ${maxBudget.toFixed(2)}
                  </span>
                </div>
                <Progress value={budgetPercent} className="h-2" />
              </div>
            )}

            {/* Usage Stats */}
            {usage && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <BarChart3 className="h-3 w-3" />
                    Anfragen
                  </div>
                  <p className="text-lg font-semibold">{usage.totalRequests}</p>
                  <p className="text-xs text-muted-foreground">
                    {usage.requestsToday} heute
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Zap className="h-3 w-3" />
                    Tokens
                  </div>
                  <p className="text-lg font-semibold">
                    {usage.totalTokens > 1000
                      ? `${(usage.totalTokens / 1000).toFixed(1)}k`
                      : usage.totalTokens}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ~${usage.totalCost.toFixed(3)} Kosten
                  </p>
                </div>
              </div>
            )}

            {/* KI-Quelle */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Aktive KI-Quelle</p>
              <div className="flex items-center gap-2">
                {isCustom ? (
                  <Badge variant="default" className="gap-1.5">
                    <Key className="h-3 w-3" />
                    OpenRouter (eigener Key)
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1.5">
                    <Coins className="h-3 w-3" />
                    Workshop-Budget
                  </Badge>
                )}
              </div>
            </div>

            {/* Aktuelles Modell */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Aktives Modell</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Bot className="h-3 w-3" />
                  {getModelLabel(currentModel)}
                </Badge>
              </div>
            </div>

            {/* Link zur Settings-Seite */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                onOpenChange(false);
                navigate("/settings");
              }}
            >
              Alle Einstellungen
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Keine Budget-Daten verfügbar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

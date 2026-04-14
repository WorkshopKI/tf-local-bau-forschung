import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { loadAIRouting, saveAIRouting } from "@/data/models";
import { useAppMode } from "@/contexts/AppModeContext";
import { getEndpoint, setEndpoint } from "@/services/apiKeyService";
import type { AIRoutingConfig } from "@/types";

export function AIRoutingSettings() {
  const [aiRouting, setAiRouting] = useState<AIRoutingConfig>(() => loadAIRouting());
  const { isStandalone } = useAppMode();

  useEffect(() => {
    saveAIRouting(aiRouting);
  }, [aiRouting]);

  return (
    <div className="space-y-6">
      <Card className="card-section space-y-5">
        <h3 className="font-semibold text-base">KI-Endpunkte</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <span className="font-semibold text-sm">Interne KI</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Endpoint-URL</label>
              <Input
                placeholder="https://internal-llm.example.local/v1"
                value={aiRouting.internalEndpoint}
                onChange={(e) => setAiRouting((r) => ({ ...r, internalEndpoint: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Modell</label>
              <Input
                placeholder="z.B. llama-3.3-70b-instruct"
                value={aiRouting.internalModel}
                onChange={(e) => setAiRouting((r) => ({ ...r, internalModel: e.target.value }))}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Daten verlassen die Organisation nicht
            </div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">☁️</span>
              <span className="font-semibold text-sm">Externe Business-API</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Anbieter</label>
              <Input
                placeholder="z.B. Azure OpenAI, AWS Bedrock, Anthropic"
                value={aiRouting.externalProvider}
                onChange={(e) => setAiRouting((r) => ({ ...r, externalProvider: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Modell</label>
              <Input
                placeholder="z.B. gpt-4o, claude-opus-4"
                value={aiRouting.externalModel}
                onChange={(e) => setAiRouting((r) => ({ ...r, externalModel: e.target.value }))}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Leistungsstärker, aber Daten werden an Drittanbieter übermittelt
            </div>
          </div>
        </div>
      </Card>

      <Card className="card-section space-y-4">
        <h3 className="font-semibold text-base">Routing-Regeln</h3>
        {[
          {
            icon: "🔴",
            label: "Vertrauliche Prompts",
            field: "confidentialRouting" as const,
            options: [
              { value: "internal-only", label: "Nur interne KI (erzwungen)" },
              { value: "internal-with-approval", label: "Extern mit expliziter Freigabe" },
            ],
          },
          {
            icon: "🟡",
            label: "Interne Prompts",
            field: "internalRouting" as const,
            options: [
              { value: "prefer-internal", label: "Interne KI bevorzugt, extern erlaubt" },
              { value: "internal-only", label: "Nur interne KI" },
            ],
          },
          {
            icon: "🟢",
            label: "Offene Prompts",
            field: "openRouting" as const,
            options: [
              { value: "prefer-external", label: "Externe API bevorzugt" },
              { value: "prefer-internal", label: "Interne KI bevorzugt" },
            ],
          },
        ].map((rule) => (
          <div key={rule.field} className="p-3 rounded-lg bg-muted/30 space-y-2">
            <div className="text-sm font-medium">{rule.icon} {rule.label}</div>
            <div className="space-y-1 ml-6">
              {rule.options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="radio"
                    name={rule.field}
                    checked={aiRouting[rule.field] === opt.value}
                    onChange={() => setAiRouting((r) => ({ ...r, [rule.field]: opt.value }))}
                    className="accent-primary"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="border-t border-border pt-3 space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm">Warnung vor jeder externen API-Nutzung</span>
            <Switch
              checked={aiRouting.warnOnExternal}
              onCheckedChange={(v) => setAiRouting((r) => ({ ...r, warnOnExternal: v }))}
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Audit-Log für alle KI-Anfragen</span>
            <Switch
              checked={aiRouting.auditLog}
              onCheckedChange={(v) => setAiRouting((r) => ({ ...r, auditLog: v }))}
            />
          </label>
        </div>
      </Card>

      {isStandalone && (
        <Card className="card-section space-y-3">
          <h3 className="font-semibold text-base">API-Endpoint</h3>
          <p className="text-xs text-muted-foreground">
            Standard: OpenRouter. Für lokale Modelle (Ollama, LM Studio) die URL ändern.
          </p>
          <Input
            placeholder="https://openrouter.ai/api/v1/chat/completions"
            defaultValue={getEndpoint()}
            onBlur={(e) => setEndpoint(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            Muss OpenAI-kompatibles Format unterstützen (/v1/chat/completions)
          </p>
        </Card>
      )}
    </div>
  );
}

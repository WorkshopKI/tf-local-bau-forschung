import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { loadFeedbackConfig, saveFeedbackConfig } from "@/services/feedbackService";
import type { FeedbackConfig } from "@/types";
import { toast } from "sonner";

const MODEL_OPTIONS = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
];

export function FeedbackConfigPanel() {
  const [config, setConfig] = useState<FeedbackConfig>({
    llm_model: "anthropic/claude-sonnet-4.6",
    proactive_triggers: true,
    max_chatbot_turns: 6,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFeedbackConfig().then(setConfig);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveFeedbackConfig(config);
      toast.success("Einstellungen gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }, [config]);

  return (
    <div className="card-section max-w-lg space-y-6">
      <h2 className="text-lg font-semibold">Feedback-Einstellungen</h2>

      <div className="space-y-2">
        <Label>LLM-Modell für Feedback-Chatbot</Label>
        <Select
          value={config.llm_model}
          onValueChange={(v) => setConfig((c) => ({ ...c, llm_model: v }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Proaktive Trigger</Label>
          <p className="text-xs text-muted-foreground">Sprechblasen nach bestimmten Events anzeigen</p>
        </div>
        <Switch
          checked={config.proactive_triggers}
          onCheckedChange={(v) => setConfig((c) => ({ ...c, proactive_triggers: v }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Max. Chatbot-Nachrichten: {config.max_chatbot_turns}</Label>
        <Slider
          value={[config.max_chatbot_turns]}
          onValueChange={([v]) => setConfig((c) => ({ ...c, max_chatbot_turns: v }))}
          min={2}
          max={12}
          step={1}
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Speichern..." : "Speichern"}
      </Button>
    </div>
  );
}

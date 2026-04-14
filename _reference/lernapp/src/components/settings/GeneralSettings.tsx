import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS } from "@/lib/constants";
import type { PlatformSettings } from "@/types";

const defaultPlatform: PlatformSettings = {
  orgName: "Meine Organisation",
  language: "de",
  requireReview: true,
  autoQualityScoring: true,
  mandatoryOnboarding: true,
};

export function GeneralSettings() {
  const [platform, setPlatform] = useState<PlatformSettings>(() => loadFromStorage(LS_KEYS.PLATFORM_SETTINGS, defaultPlatform));

  useEffect(() => {
    saveToStorage(LS_KEYS.PLATFORM_SETTINGS, platform);
  }, [platform]);

  return (
    <div className="space-y-6">
      <Card className="card-section space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          ⚙️ Plattform
        </h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Organisation, Sprache und Workflow-Regeln
        </p>

        <div>
          <label className="text-sm font-medium block mb-1">Organisationsname</label>
          <Input
            value={platform.orgName}
            onChange={(e) => setPlatform((p) => ({ ...p, orgName: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Standard-Sprache</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={platform.language}
            onChange={(e) => setPlatform((p) => ({ ...p, language: e.target.value }))}
          >
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
          </select>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-center justify-between">
            <span className="text-sm">Prompt-Review für neue Prompts erforderlich</span>
            <Switch
              checked={platform.requireReview}
              onCheckedChange={(v) => setPlatform((p) => ({ ...p, requireReview: v }))}
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Automatisches Quality-Scoring</span>
            <Switch
              checked={platform.autoQualityScoring}
              onCheckedChange={(v) => setPlatform((p) => ({ ...p, autoQualityScoring: v }))}
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm">Onboarding für neue Mitglieder verpflichtend</span>
            <Switch
              checked={platform.mandatoryOnboarding}
              onCheckedChange={(v) => setPlatform((p) => ({ ...p, mandatoryOnboarding: v }))}
            />
          </label>
        </div>
      </Card>
    </div>
  );
}

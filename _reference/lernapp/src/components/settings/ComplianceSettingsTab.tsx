import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { LS_KEYS, ALERT_COLORS } from "@/lib/constants";
import type { ComplianceSettings } from "@/types";

const defaultCompliance: ComplianceSettings = {
  detectSensitiveData: false,
  reviewHighRisk: false,
  auditLog: false,
  approvedModelsOnly: false,
};

export function ComplianceSettingsTab() {
  const [compliance, setCompliance] = useState<ComplianceSettings>(() => loadFromStorage(LS_KEYS.COMPLIANCE_SETTINGS, defaultCompliance));

  useEffect(() => {
    saveToStorage(LS_KEYS.COMPLIANCE_SETTINGS, compliance);
  }, [compliance]);

  return (
    <div className="space-y-6">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        🛡️ Sicherheit & Compliance
      </h3>
      <Alert variant="destructive" className={ALERT_COLORS.warning}>
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertDescription>
          Definieren Sie Regeln für die Prompt-Erstellung in Ihrer Organisation.
        </AlertDescription>
      </Alert>

      <Card className="card-section space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm">Sensible Daten in Prompts automatisch erkennen</span>
          <Switch
            checked={compliance.detectSensitiveData}
            onCheckedChange={(v) => setCompliance((c) => ({ ...c, detectSensitiveData: v }))}
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">Review-Pflicht für Prompts mit Risiko „hoch"</span>
          <Switch
            checked={compliance.reviewHighRisk}
            onCheckedChange={(v) => setCompliance((c) => ({ ...c, reviewHighRisk: v }))}
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">Audit-Log aktivieren</span>
          <Switch
            checked={compliance.auditLog}
            onCheckedChange={(v) => setCompliance((c) => ({ ...c, auditLog: v }))}
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">Nur freigegebene LLM-Modelle erlauben</span>
          <Switch
            checked={compliance.approvedModelsOnly}
            onCheckedChange={(v) => setCompliance((c) => ({ ...c, approvedModelsOnly: v }))}
          />
        </label>
      </Card>
    </div>
  );
}

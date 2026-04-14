import { useState } from "react";
import { AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ALERT_COLORS } from "@/lib/constants";
import { RedactionExercise } from "@/components/RedactionExercise";
import { redactionDrills } from "@/data/redactionDrills";
import { useOrgContext } from "@/contexts/OrgContext";

export const DataPrivacyIntro = () => {
  const { scope, isDepartment } = useOrgContext();
  const [drillIndex, setDrillIndex] = useState(0);

  // Wähle Drills passend zur Abteilung
  const relevantDrills = isDepartment
    ? redactionDrills.filter((d) => d.department === scope || !d.department).slice(0, 3)
    : redactionDrills.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Teil 1: Warum Datenschutz bei KI wichtig ist */}
      <div>
        <h3 className="text-lg font-bold mb-4">Datenschutz & sichere KI-Nutzung</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Jeder Prompt den du an eine KI sendest, kann sensible Daten enthalten — Namen, Aktenzeichen,
          Gesundheitsdaten, interne Informationen. Je nachdem welche KI du nutzt, verlassen diese Daten
          möglicherweise die Organisation.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-muted text-muted-foreground text-[10px]">Offen</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Keine sensiblen Daten im Prompt. Externe KI darf genutzt werden.
              Beispiel: Allgemeine Recherche, öffentliche Informationen aufbereiten.
            </p>
          </Card>
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-muted text-muted-foreground text-[10px] gap-1">
                <Lock className="w-3 h-3" /> Intern
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Interne Informationen, aber keine personenbezogenen Daten.
              Interne KI bevorzugt. Beispiel: Interne Prozesse strukturieren, Richtlinien entwerfen.
            </p>
          </Card>
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-foreground/10 text-foreground text-[10px] gap-1">
                <ShieldAlert className="w-3 h-3" /> Vertraulich
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Personenbezogene Daten, Verträge, Bescheide. NUR interne KI.
              Beispiel: Arbeitszeugnisse, Bescheide mit Aktenzeichen, Vertragsentwürfe.
            </p>
          </Card>
        </div>

        <Card className={`p-4 rounded-lg ${ALERT_COLORS.danger}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Die goldene Regel</p>
              <p className="text-xs mt-1">
                Im Zweifel: Anonymisiere. Ersetze echte Namen durch [NAME], Aktenzeichen durch [AZ],
                Adressen durch [ADRESSE]. Die KI braucht die echten Daten fast nie um dir zu helfen.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Teil 2: Redaction-Drills */}
      <div>
        <h3 className="text-lg font-bold mb-4">Übung: Sensible Daten erkennen</h3>
        <p className="text-sm text-muted-foreground mb-4">
          In den folgenden Prompts verstecken sich sensible Daten. Finde sie alle.
        </p>

        {relevantDrills[drillIndex] && (
          <RedactionExercise
            key={relevantDrills[drillIndex].id}
            drill={relevantDrills[drillIndex]}
            onComplete={() => {
              if (drillIndex < relevantDrills.length - 1) {
                setTimeout(() => setDrillIndex((i) => i + 1), 2000);
              }
            }}
          />
        )}

        {relevantDrills.length > 1 && (
          <p className="text-xs text-muted-foreground mt-3">
            Übung {Math.min(drillIndex + 1, relevantDrills.length)} von {relevantDrills.length}
          </p>
        )}
      </div>
    </div>
  );
};

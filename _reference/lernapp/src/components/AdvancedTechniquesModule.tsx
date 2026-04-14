import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Shield, Target, Brain, Zap, Users, Sparkles, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { AdvancedPromptingSection } from "@/components/AdvancedPromptingSection";

const TECHNIQUE_CARDS = [
  {
    icon: Shield,
    title: "Selbstprüfung einbauen",
    description: "Die KI überprüft ihre eigene Antwort auf Fehler und Schwachstellen. Im Experte-Modus ist das das RAKETE-Feld \"Teste\".",
    werkstattHint: "Öffne die Werkstatt im Experte-Modus → Das Feld \"Teste\" (🧪) ist direkt im RAKETE-Baukasten sichtbar.",
    isRakete: true,
  },
  {
    icon: Brain,
    title: "Denkweise vorgeben (Chain-of-Thought)",
    description: "Bestimme wie die KI denken soll: Schritt-für-Schritt, Vor-/Nachteile abwägen, oder mehrere Perspektiven einnehmen.",
    werkstattHint: "Öffne die Werkstatt im Experte-Modus → Unter 'Erweiterte Optionen' klicke '+ Denkweise festlegen'.",
  },
  {
    icon: Target,
    title: "Beispiele mitgeben (Few-Shot)",
    description: "Zeige der KI 1-3 Beispiele, damit sie das gewünschte Muster erkennt und bessere Ergebnisse liefert.",
    werkstattHint: "Öffne die Werkstatt im Experte-Modus → Unter 'Erweiterte Optionen' klicke '+ Beispiele (Few-Shot)'.",
  },
  {
    icon: Zap,
    title: "Negativ-Constraints setzen",
    description: "Sage der KI explizit was sie NICHT tun soll. Im Experte-Modus ist das das RAKETE-Feld \"Einschränkungen\".",
    werkstattHint: "Öffne die Werkstatt im Experte-Modus → Das Feld \"Einschränkungen\" (🚫) ist direkt im RAKETE-Baukasten sichtbar.",
    isRakete: true,
  },
  {
    icon: Users,
    title: "KI den Prompt schreiben lassen (Reverse Prompting)",
    description: "Die KI entwirft zuerst den idealen Prompt für deine Aufgabe und führt ihn dann selbst aus.",
    werkstattHint: "Öffne die Werkstatt im Experte-Modus → Unter 'Erweiterte Optionen' klicke '+ Reverse Prompting'.",
  },
];

export const AdvancedTechniquesModule = () => {
  const navigate = useNavigate();
  const [showReference, setShowReference] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold mb-2">Fortgeschrittene Techniken anwenden</h3>
        <p className="text-sm text-muted-foreground">
          Du kennst ACTA und RAKETE. Jetzt lernst du 5 Erweiterungen kennen, die deine Prompts noch weiter verbessern.
          Zwei davon — Selbstprüfung und Negativ-Constraints — sind bereits als RAKETE-Felder (Teste und Einschränkungen)
          in den Baukasten integriert. Die anderen drei findest du als aufklappbare Erweiterungen in der Werkstatt.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {TECHNIQUE_CARDS.map((tech) => {
          const Icon = tech.icon;
          return (
            <Card key={tech.title} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold">{tech.title}</h4>
                    {tech.isRakete && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                        RAKETE-Feld
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tech.description}</p>
                </div>
              </div>
              <div className="bg-muted/30 rounded-md p-2.5">
                <p className="text-[11px] text-muted-foreground leading-relaxed">{tech.werkstattHint}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs gap-1.5"
                onClick={() => navigate("/playground")}
              >
                <Sparkles className="w-3 h-3" />
                In der Werkstatt ausprobieren
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Vollständige Referenz aufklappbar */}
      <Collapsible open={showReference} onOpenChange={setShowReference}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground">
            <ChevronDown className={`w-3 h-3 transition-transform ${showReference ? "rotate-180" : ""}`} />
            Vollständige Referenz: Alle Techniken im Detail
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <AdvancedPromptingSection />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

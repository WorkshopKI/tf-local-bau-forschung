import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Scissors, Bookmark, Sparkles } from "lucide-react";
import { DecompositionAssistant } from "@/components/DecompositionAssistant";

export const WorkflowBuilderModule = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Einleitung */}
      <div>
        <h3 className="text-lg font-bold mb-2">Eigene Workflows bauen</h3>
        <p className="text-sm text-muted-foreground">
          Lerne zwei Schlüsselfähigkeiten: Große Aufgaben in promptbare Teilschritte zerlegen,
          und aus erprobten Prompts wiederverwendbare Skills für deinen Arbeitsalltag erstellen.
        </p>
      </div>

      {/* Teil 1: Aufgaben-Zerlegung */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Scissors className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Teil 1: Aufgaben-Zerlegung</h4>
            <p className="text-xs text-muted-foreground">Komplexe Projekte in handhabbare Teilaufgaben zerlegen</p>
          </div>
        </div>
        <DecompositionAssistant />
      </div>

      {/* Teil 2: Eigene Skills erstellen */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Bookmark className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Teil 2: Eigene Skills erstellen</h4>
            <p className="text-xs text-muted-foreground">Mache aus guten Prompts wiederverwendbare Vorlagen</p>
          </div>
        </div>
        <Card className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ein <strong>Skill</strong> ist ein Prompt, den du für deinen Arbeitsalltag gespeichert und angepasst hast.
            Du findest deine Skills unter „Meine Skills" in der Prompt Sammlung.
          </p>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="font-semibold text-xs mb-1 text-primary">Schritt 1</div>
              <p className="text-xs text-muted-foreground">
                Öffne einen Prompt aus der Sammlung und klicke „Als Skill speichern"
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="font-semibold text-xs mb-1 text-primary">Schritt 2</div>
              <p className="text-xs text-muted-foreground">
                Passe den Skill an — ergänze Notizen, Variablen und dein bevorzugtes Modell
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="font-semibold text-xs mb-1 text-primary">Schritt 3</div>
              <p className="text-xs text-muted-foreground">
                Teste den Skill in der Werkstatt und iteriere bis das Ergebnis stimmt
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => navigate("/library")}
            >
              <Bookmark className="w-3 h-3" />
              Prompt Sammlung öffnen
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => navigate("/playground")}
            >
              <Sparkles className="w-3 h-3" />
              Prompt Werkstatt öffnen
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

import { useState, useMemo } from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOrgContext } from "@/contexts/OrgContext";

interface ChallengeContent {
  badPrompt: string;
  solution: string;
}

const challenges: Record<string, ChallengeContent> = {
  default: {
    badPrompt: "Was soll ich kochen?",
    solution: "\"Du bist ein Ernährungsberater (A). Ich bin Vegetarier und habe Tomaten, Pasta und Zwiebeln zu Hause (C). Schlage ein Abendessen für 2 Personen vor (T). Format: Zutatenliste + Schritte, max. 30 Minuten Zubereitungszeit (A).\"",
  },
  legal: {
    badPrompt: "Prüf mal den Vertrag.",
    solution: "\"Du bist ein erfahrener Verwaltungsjurist (A). Wir haben einen IT-Rahmenvertrag (Volumen 200.000 €) mit einem externen Dienstleister erhalten (C). Prüfe die Klauseln zu Haftung, Datenschutz (AVV nach Art. 28 DSGVO) und Kündigungsfristen auf Risiken (T). Format: Tabelle mit Klausel → Risiko → Empfehlung, max. 2 Seiten. [JURIST:IN PRÜFEN] (A).\"",
  },
  oeffentlichkeitsarbeit: {
    badPrompt: "Schreib eine Pressemitteilung.",
    solution: "\"Du bist Pressesprecher:in einer Kommunalverwaltung (A). Der Stadtrat hat gestern ein Klimaschutzkonzept mit 10 Mio. € Budget beschlossen (C). Erstelle eine Pressemitteilung für lokale Medien mit Zitat der Bürgermeisterin (T). Format: Lead + Details + Zitat + Hintergrund + Kontakt, max. 300 Wörter, keine Fachsprache. [PRESSESTELLE FREIGABE] (A).\"",
  },
  hr: {
    badPrompt: "Schreib eine Stellenanzeige.",
    solution: "\"Du bist HR-Manager:in im öffentlichen Dienst (A). Wir suchen eine:n Sachbearbeiter:in Haushalt (EG 9b TVöD) für die Kämmerei, ab sofort (C). Erstelle eine AGG-konforme Stellenausschreibung mit Aufgaben, Muss-/Kann-Anforderungen und Schwerbehinderten-Hinweis (T). Format: 5 Aufgaben, getrennte Anforderungsblöcke, Benefits, Bewerbungsfrist. Max. 1 Seite. [HR-LEITUNG PRÜFEN] (A).\"",
  },
  it: {
    badPrompt: "Da ist ein Fehler im System.",
    solution: "\"Du bist IT-Support-Spezialist:in (A). Das Fachverfahren für Baugenehmigungen zeigt seit 8:00 Uhr Timeout-Fehler beim Speichern, betroffen sind 15 Sachbearbeiter:innen (C). Erstelle ein strukturiertes Störungsticket mit Reproduktionsschritten und Workaround (T). Format: System, Fehlerbeschreibung, erwartetes Verhalten, Betroffene, Reproduktion, Priorität, Workaround (A).\"",
  },
  bauverfahren: {
    badPrompt: "Prüf den Bauantrag.",
    solution: "\"Du bist Sachbearbeiter:in im Bauordnungsamt (A). Ein Bauantrag für die Nutzungsänderung Büro→Wohnung (12 WE) im Innenbereich nach § 34 BauGB wurde eingereicht, Brandschutznachweis fehlt (C). Erstelle eine Vollständigkeitsprüfung nach BauO NRW mit Nachforderungsschreiben (T). Format: Checkliste (Unterlage → vorhanden/fehlend), Nachforderung mit Frist (4 Wochen) und Rechtsfolge (A).\"",
  },
};

export const ACTAQuickChallenge = () => {
  const [userInput, setUserInput] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const { scope, isDepartment } = useOrgContext();

  const challenge = useMemo(() => {
    if (isDepartment && challenges[scope]) {
      return challenges[scope];
    }
    return challenges.default;
  }, [scope, isDepartment]);

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mt-8">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Probier's direkt aus!</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Dieser Prompt ist vage: <span className="font-medium text-foreground">"{challenge.badPrompt}"</span>
        <br />Verbessere ihn mit der ACTA-Methode:
      </p>
      <Textarea
        value={userInput}
        onChange={(e) => setUserInput(e.target.value)}
        placeholder="Dein verbesserter Prompt..."
        className="mb-3"
        rows={3}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowSolution(!showSolution)}>
          {showSolution ? "Lösung verbergen" : "Beispiel-Lösung"}
        </Button>
        {userInput.trim() && (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `/playground?prompt=${encodeURIComponent(userInput)}`;
            }}
          >
            In Prompt Werkstatt testen
          </Button>
        )}
      </div>
      {showSolution && (
        <div className="mt-4 bg-card rounded-lg p-4 border border-border text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Beispiel mit ACTA:</p>
          <p className="italic">{challenge.solution}</p>
        </div>
      )}
    </div>
  );
};

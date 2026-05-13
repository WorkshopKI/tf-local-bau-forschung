import { ACTASection } from "@/components/ACTASection";
import { ACTAQuickChallenge } from "@/components/ACTAQuickChallenge";

export const ACTAIntroduction = () => {
  return (
    <div className="space-y-6">
      {/* Teil 1: Warum gute Prompts wichtig sind */}
      <div>
        <h3 className="text-base font-bold mb-2">Warum gute Prompts wichtig sind</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Der Unterschied zwischen einer mittelmäßigen und einer exzellenten KI-Antwort
          liegt fast immer am Prompt — der Anweisung die du der KI gibst. Vergleiche:
        </p>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <div className="text-xs font-semibold text-destructive mb-1">Vager Prompt</div>
            <p className="text-xs font-mono text-muted-foreground italic">
              "Was soll ich kochen?"
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Die KI rät herum. Generische Antwort, mehrere Rückfragen nötig.
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="text-xs font-semibold text-primary mb-1">Strukturierter Prompt</div>
            <p className="text-xs font-mono text-muted-foreground italic">
              "Vegetarisches Abendessen für 4 Personen mit Tomaten, Pasta und Zwiebeln.
              Keine Milchprodukte. Max. 30 Minuten Zubereitung. Format: Zutatenliste + Schritt-für-Schritt."
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Perfektes Ergebnis beim ersten Versuch. Keine Rückfragen.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Der strukturierte Prompt enthält vier Elemente: eine <strong>Rolle</strong> (implizit: Koch),
          <strong> Kontext</strong> (verfügbare Zutaten, Einschränkungen),
          eine <strong>Aufgabe</strong> (Rezept erstellen) und ein gewünschtes <strong>Ausgabeformat</strong>.
          Genau das ist die <strong>ACTA-Methode</strong> — und die lernst du jetzt.
        </p>
      </div>

      {/* Teil 2: Die ACTA-Methode */}
      <ACTASection />

      {/* Teil 3: Quick Challenge */}
      <ACTAQuickChallenge />

      {/* Teil 4: RAKETE-Vorschau */}
      <div className="bg-muted/30 border border-border rounded-xl p-5 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🚀</span>
          <h4 className="font-semibold text-sm">Wie geht es weiter?</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Im nächsten Modul lernst du die <strong>RAKETE-Methode</strong> kennen —
          eine Erweiterung von ACTA um zwei Felder, die deine Prompts noch präziser machen:
          <strong>Teste</strong> (Selbstprüfung) und <strong>Einschränkungen</strong> (was die KI NICHT tun soll).
        </p>
      </div>
    </div>
  );
};

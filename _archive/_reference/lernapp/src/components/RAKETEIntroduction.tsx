import { RAKETESection } from "@/components/RAKETESection";
import { RAKETEQuickChallenge } from "@/components/RAKETEQuickChallenge";

export const RAKETEIntroduction = () => {
  return (
    <div className="space-y-6">
      {/* Teil 1: Warum RAKETE? Der Unterschied zu ACTA */}
      <div>
        <h3 className="text-base font-bold mb-2">Warum RAKETE?</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Du kennst die ACTA-Methode — vier Felder für gute Prompts. RAKETE erweitert
          das um zwei entscheidende Qualitäts-Felder: <strong>Teste</strong> und{" "}
          <strong>Einschränkungen</strong>. Damit sagst du der KI nicht nur was sie tun soll,
          sondern auch was sie <em>prüfen</em> und was sie <em>vermeiden</em> soll.
        </p>
        {/* Vorher/Nachher Vergleich */}
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-muted-foreground">ACTA — 4 Felder</span>
            </div>
            <p className="text-sm font-mono text-muted-foreground italic">
              "Erstelle eine Pressemitteilung über das Bürgerservice-Portal.
              Max. 300 Wörter, Lead + Details + Zitat."
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              → KI liefert brauchbares Ergebnis, aber mit Fachsprache und ohne Selbstprüfung.
            </p>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-primary">RAKETE — 6 Felder</span>
            </div>
            <p className="text-sm font-mono text-muted-foreground italic">
              "... + Prüfe ob alle W-Fragen im Lead beantwortet sind.
              Keine Verwaltungsfachsprache, kein Konjunktiv."
            </p>
            <p className="text-xs text-primary mt-3">
              → Bürgernah, vollständig, selbstgeprüft — beim ersten Versuch.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Die ersten vier Buchstaben von RAKETE sind dieselben Felder wie ACTA — nur umbenannt:
          <strong> R</strong>olle, <strong>A</strong>ufgabe, <strong>K</strong>ontext, <strong>E</strong>rgebnis.
          Neu dazu kommen <strong>T</strong>este und <strong>E</strong>inschränkungen.
        </p>
      </div>

      {/* Teil 2: Die RAKETE-Methode im Detail */}
      <RAKETESection />

      {/* Teil 3: Challenge */}
      <RAKETEQuickChallenge />
    </div>
  );
};

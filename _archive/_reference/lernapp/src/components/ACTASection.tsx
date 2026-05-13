import { useState, useMemo } from "react";
import { User, FileText, Target, Layout, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrgContext } from "@/contexts/OrgContext";
import { actaExamples } from "@/data/actaExamples";

const actaCards = [
  {
    letter: "A",
    title: "Act / Rolle",
    icon: User,
    description: "Als wer oder was soll die KI antworten?",
    quote: "Nimm die Rolle eines erfahrenen Marketing-Experten ein...",
  },
  {
    letter: "C",
    title: "Context / Hintergrund",
    icon: FileText,
    description: "Welche Hintergrundinfos sind wichtig?",
    quote: "Projektinfos, Rahmenbedingungen, Beispiele (Few-Shot)...",
  },
  {
    letter: "T",
    title: "Task / Aufgabe",
    icon: Target,
    description: "Welche Aufgabe soll erledigt werden?",
    quote: "Erstelle einen LinkedIn-Post für unser neues Produkt...",
  },
  {
    letter: "A",
    title: "Ausgabe / Format",
    icon: Layout,
    description: "Welche Formatierung ist gewünscht?",
    quote: "Max. 150 Wörter, 3-5 Bulletpoints, Call-to-Action",
  },
];

export const ACTASection = () => {
  const [showExample, setShowExample] = useState(false);
  const { scope, isDepartment } = useOrgContext();

  const example = useMemo(() => {
    if (isDepartment && actaExamples[scope]) {
      return actaExamples[scope];
    }
    return actaExamples.default;
  }, [scope, isDepartment]);

  return (
    <section className="mb-6">
      <div className="text-center mb-5">
        <h2 className="text-lg font-bold tracking-tight mb-1">
          Die ACTA-Methode
        </h2>
        <p className="text-sm text-muted-foreground">
          Ein strukturiertes Framework für perfekte Prompts
        </p>
      </div>

      {/* Compact 4-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {actaCards.map((card, i) => (
          <div
            key={i}
            className="bg-card/80 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-primary/10 p-1.5 rounded-md">
                <card.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-base font-bold text-primary">{card.letter}</span>
            </div>
            <h3 className="text-sm font-semibold mb-1">{card.title}</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {card.description}
            </p>
            <div className="bg-muted/50 rounded-md px-2.5 py-1.5">
              <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                {card.quote}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Toggle for full example */}
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowExample(!showExample)}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          {showExample ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Beispiel einklappen
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Vollständiges ACTA-Beispiel anzeigen
            </>
          )}
        </Button>
      </div>

      {/* Collapsible practice example */}
      {showExample && (
        <div className="bg-gradient-card rounded-xl p-5 border border-border mt-3">
          <h3 className="text-sm font-bold mb-3 text-center">
            ACTA in der Praxis – Vollständiges Beispiel
          </h3>

          <div className="bg-background/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Act (Rolle)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.act}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Context (Hintergrund)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.context}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Task (Aufgabe)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.task}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Ausgabe (Format)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.output}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

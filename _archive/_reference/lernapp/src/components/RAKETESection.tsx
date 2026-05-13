import { useState, useMemo } from "react";
import { User, Target, FileText, Layout, Shield, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrgContext } from "@/contexts/OrgContext";
import { actaExamples } from "@/data/actaExamples";

const raketeCards = [
  {
    letter: "R",
    title: "Rolle",
    sublabel: "= Act",
    icon: User,
    description: "Als wer oder was soll die KI antworten?",
    quote: "Du bist ein erfahrener Verwaltungsjurist mit Schwerpunkt Vergaberecht...",
    isNew: false,
  },
  {
    letter: "A",
    title: "Aufgabe",
    sublabel: "= Task",
    icon: Target,
    description: "Welche Aufgabe soll erledigt werden?",
    quote: "Erstelle eine Vollständigkeitsprüfung des Bauantrags nach BauO NRW...",
    isNew: false,
  },
  {
    letter: "K",
    title: "Kontext",
    sublabel: "= Context",
    icon: FileText,
    description: "Welche Hintergrundinfos sind wichtig?",
    quote: "Bauantrag für Nutzungsänderung Büro→Wohnung, Innenbereich § 34 BauGB...",
    isNew: false,
  },
  {
    letter: "E",
    title: "Ergebnis",
    sublabel: "= Ausgabe",
    icon: Layout,
    description: "Welches Format und welche Struktur?",
    quote: "Checkliste mit Unterlage → Rechtsgrundlage → Status, max. 2 Seiten...",
    isNew: false,
  },
  {
    letter: "T",
    title: "Teste",
    sublabel: "Selbstprüfung",
    icon: Shield,
    description: "Worauf soll die KI ihre Antwort überprüfen?",
    quote: "Prüfe ob jede Unterlage eine Rechtsgrundlage hat. Prüfe die Rechtsfolgenbelehrung...",
    isNew: true,
  },
  {
    letter: "E",
    title: "Einschränkungen",
    sublabel: "Was NICHT",
    icon: Ban,
    description: "Was soll die KI explizit NICHT tun?",
    quote: "Keine materielle Prüfung. Keine Rechtsberatung. Kein informeller Ton...",
    isNew: true,
  },
];

export const RAKETESection = () => {
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
          Die RAKETE-Methode
        </h2>
        <p className="text-sm text-muted-foreground">
          ACTA erweitert — 6 Felder für exzellente Prompts
        </p>
      </div>

      {/* 6-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {raketeCards.map((card, i) => (
          <div
            key={i}
            className="bg-card/80 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-primary/10 p-1.5 rounded-md">
                <card.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-base font-bold text-primary">{card.letter}</span>
              {card.isNew && (
                <Badge className="text-[10px] bg-primary/10 text-primary">Neu in RAKETE</Badge>
              )}
            </div>
            <h3 className="text-sm font-semibold mb-0.5">{card.title}</h3>
            <p className="text-xs text-muted-foreground mb-1">{card.sublabel}</p>
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
              Vollständiges RAKETE-Beispiel anzeigen
            </>
          )}
        </Button>
      </div>

      {/* Collapsible practice example */}
      {showExample && (
        <div className="bg-gradient-card rounded-xl p-5 border border-border mt-3">
          <h3 className="text-sm font-bold mb-3 text-center">
            RAKETE in der Praxis – Vollständiges Beispiel
          </h3>

          <div className="bg-background/50 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Rolle (R)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.act}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Aufgabe (A)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.task}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Kontext (K)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.context}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wide">Ergebnis (E)</p>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.output}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Teste (T)</p>
                <Badge className="text-[10px] bg-primary/10 text-primary">Neu</Badge>
              </div>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.verificationNote || "—"}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Einschränkungen (E)</p>
                <Badge className="text-[10px] bg-primary/10 text-primary">Neu</Badge>
              </div>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <p className="text-xs text-foreground/80 font-mono leading-relaxed">
                  {example.negatives || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

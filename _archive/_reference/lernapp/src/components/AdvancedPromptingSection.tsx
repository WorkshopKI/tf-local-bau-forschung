import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Target, Brain, Zap, Users, Lightbulb, ChevronDown, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const techniques = [
  {
    id: "self-correction",
    icon: Shield,
    title: "Selbstkorrektur-Systeme",
    shortTitle: "Selbstkorrektur",
    methods: [
      {
        name: "Chain of Verification",
        description: "Füge Verifizierungsschleifen direkt in den Prompt ein, um die KI zu zwingen, ihre eigenen Antworten zu überprüfen.",
        example: "Analysiere diesen Vertrag und liste deine drei wichtigsten Erkenntnisse auf. Identifiziere dann drei Wege, wie deine Analyse unvollständig sein könnte. Überarbeite deine Erkenntnisse basierend auf dieser Überprüfung.",
        use: "Nutze dies für wichtige Analysen, bei denen Genauigkeit entscheidend ist."
      },
      {
        name: "Adversarial Prompting",
        description: "Fordere die KI aggressiv auf, Probleme und Schwachstellen in ihrer eigenen Ausgabe zu finden.",
        example: "Greife dein vorheriges Design an. Identifiziere fünf spezifische Wege, wie es kompromittiert werden könnte. Bewerte für jede Schwachstelle die Wahrscheinlichkeit und den Impact.",
        use: "Verwende dies bei sicherheitskritischen oder hochsensiblen Aufgaben."
      }
    ]
  },
  {
    id: "edge-case",
    icon: Target,
    title: "Strategisches Edge-Case Learning",
    shortTitle: "Edge-Cases",
    methods: [
      {
        name: "Few-Shot Prompting",
        description: "Zeige der KI Beispiele von häufigen Fehlerfällen und Grenzfällen, damit sie lernt, subtile Unterschiede zu erkennen.",
        example: "Beispiel 1: Offensichtliche SQL-Injection mit direkter String-Konkatenation. Beispiel 2: Parameterisierte Query, die sicher aussieht, aber eine Second-Order-Injection enthält. Analysiere nun diese Query...",
        use: "Ideal für komplexe Kategorisierungsaufgaben oder wenn viele Grenzfälle existieren."
      }
    ]
  },
  {
    id: "meta-prompting",
    icon: Brain,
    title: "Meta-Prompting",
    shortTitle: "Meta-Prompting",
    methods: [
      {
        name: "Reverse Prompting",
        description: "Lass die KI den optimalen Prompt für eine Aufgabe selbst entwerfen und dann ausführen.",
        example: "Du bist ein Experte für Prompt-Design. Entwirf den effektivsten Prompt zur Analyse von Quartalsberichten für Frühwarnsignale finanzieller Probleme. Berücksichtige wichtige Details, das beste Output-Format und essenzielle Denkschritte. Führe dann diesen Prompt auf diesen Bericht aus.",
        use: "Nutze dies für komplexe Analyseaufgaben, bei denen du unsicher bist, wie der beste Prompt aussieht."
      },
      {
        name: "Recursive Prompt Optimization",
        description: "Die KI optimiert ihren eigenen Prompt über mehrere Iterationen hinweg.",
        example: "Du bist ein rekursiver Prompt-Optimierer. Mein aktueller Prompt ist: [PROMPT]. Version 1: Füge fehlende Constraints hinzu. Version 2: Löse Mehrdeutigkeiten. Version 3: Erhöhe die Denktiefe.",
        use: "Verwende dies, wenn du einen Prompt systematisch verbessern möchtest."
      }
    ]
  },
  {
    id: "reasoning",
    icon: Zap,
    title: "Reasoning Scaffolds",
    shortTitle: "Reasoning",
    methods: [
      {
        name: "Deliberate Over-Instruction",
        description: "Kämpfe gegen die Tendenz der KI zur Zusammenfassung an, indem du explizit Ausführlichkeit forderst.",
        example: "Fasse NICHT zusammen. Erweitere jeden einzelnen Punkt mit Implementierungsdetails, Edge Cases, Fehlermodi und historischem Kontext. Deine Antwort soll mindestens 1000 Wörter umfassen.",
        use: "Nutze dies für tiefgehende Analysen, wo jedes Detail zählt."
      },
      {
        name: "Competitive Reasoning",
        description: "Erstelle mehrere konkurrierende Analysen derselben Situation, um verschiedene Perspektiven zu explorieren.",
        example: "Analysiere diese Situation aus drei konkurrierenden Perspektiven: 1) Optimistisches Best-Case-Szenario, 2) Pessimistisches Worst-Case-Szenario, 3) Realistisches wahrscheinlichstes Szenario. Vergleiche dann die Annahmen jeder Perspektive.",
        use: "Ideal für strategische Entscheidungen mit hoher Unsicherheit."
      }
    ]
  },
  {
    id: "human-simulation",
    icon: Users,
    title: "Human Simulation Patterns",
    shortTitle: "Human Sim.",
    methods: [
      {
        name: "Multi-Persona Debate",
        description: "Lass die KI verschiedene Rollen mit unterschiedlichen Prioritäten einnehmen und untereinander debattieren.",
        example: "Simuliere eine Debatte zwischen drei Experten: Ein CFO priorisiert Kosten, ein CTO priorisiert technische Exzellenz, ein CEO priorisiert Geschwindigkeit. Sie müssen für ihre Präferenz argumentieren und die Positionen der anderen kritisieren. Synthetisiere dann eine Empfehlung.",
        use: "Nutze dies für komplexe Entscheidungen mit mehreren konkurrierenden Zielen."
      },
      {
        name: "Temperature Simulation",
        description: "Simuliere verschiedene 'Temperaturen' durch unterschiedliche Personas - von unsicher/ausführlich bis sicher/präzise.",
        example: "Analysiere dieses Problem zuerst aus Sicht eines unsicheren Junior-Analysten, der alles übererklärt. Dann aus Sicht eines selbstbewussten Experten, der präzise und direkt ist. Synthetisiere beide Perspektiven und zeige, wo Unsicherheit gerechtfertigt ist.",
        use: "Verwende dies, um verschiedene Vertrauensstufen in der Analyse zu explorieren."
      }
    ]
  }
];

const principles = [
  { num: 1, title: "Strukturiere den Denkprozess", text: "Frage nicht nach \"Vorsicht\", sondern baue Verifizierung als verpflichtenden Schritt ein." },
  { num: 2, title: "Nutze Meta-Wissen der KI", text: "Die KI wurde auf Prompt-Engineering trainiert — nutze dieses Wissen!" },
  { num: 3, title: "Kämpfe gegen Kompression", text: "Modelle sind trainiert, prägnant zu sein — fordere explizit Ausführlichkeit, wenn du sie brauchst." },
  { num: 4, title: "Simuliere menschliche Prozesse", text: "Debatten, verschiedene Perspektiven und Unsicherheitsstufen führen zu besseren Ergebnissen." }
];

const MethodDetail = ({ method }: { method: typeof techniques[0]["methods"][0] }) => {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <h4 className="text-base font-bold text-foreground">{method.name}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{method.description}</p>

      <div className="bg-muted/50 rounded-lg p-4">
        <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
          Beispiel-Prompt
        </div>
        <p className="text-xs text-foreground/80 font-mono leading-relaxed">
          {method.example}
        </p>
      </div>

      <div className="flex items-start gap-2 text-sm">
        <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-muted-foreground">
          <span className="font-semibold text-foreground">Wann verwenden?</span>{" "}
          {method.use}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5 mt-2"
        onClick={() => navigate(`/playground?prompt=${encodeURIComponent(method.example)}`)}
      >
        <Sparkles className="w-3 h-3" />
        In der Werkstatt testen
      </Button>
    </div>
  );
};

export const AdvancedPromptingSection = () => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(techniques[0].id);
  const activeTechnique = techniques.find(t => t.id === activeId)!;

  return (
    <section id="advanced" className="mb-0">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
          Fortgeschrittene Techniken
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Fortgeschrittene Methoden und mentale Modelle aus dem professionellen Prompt-Engineering
        </p>
      </div>

      {/* Desktop: Master-Detail Split */}
      <div className="hidden md:flex gap-6 mb-8">
        {/* Left: Category Navigation */}
        <nav className="w-56 shrink-0 space-y-1.5">
          {techniques.map((technique) => {
            const Icon = technique.icon;
            const isActive = technique.id === activeId;
            return (
              <button
                key={technique.id}
                onClick={() => setActiveId(technique.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200",
                  isActive
                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                    : "hover:bg-muted/60 border border-transparent"
                )}
              >
                <div className={cn(
                  "p-2 rounded-lg shrink-0 transition-colors",
                  isActive ? "bg-primary/15" : "bg-muted/50"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <div className={cn(
                    "text-sm font-semibold truncate",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {technique.shortTitle}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {technique.methods.length} {technique.methods.length === 1 ? "Methode" : "Methoden"}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Right: Detail Panel */}
        <Card className="flex-1 p-8 bg-card border-border shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-muted p-2.5 rounded-lg">
              <activeTechnique.icon className="w-5 h-5 text-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold">{activeTechnique.title}</h3>
          </div>

          <div className="space-y-1">
            {activeTechnique.methods.map((method, idx) => (
              <Accordion key={`${activeTechnique.id}-${idx}`} type="single" collapsible>
                <AccordionItem value={`method-${idx}`} className="border-none">
                  <AccordionTrigger className="py-2.5 hover:no-underline">
                    <span className="text-sm font-semibold text-left">{method.name}</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {method.description}
                    </p>
                    <div className="bg-muted/50 rounded-md p-3">
                      <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                        Beispiel
                      </div>
                      <p className="text-xs font-mono text-foreground/80 leading-relaxed">
                        {method.example}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-semibold">Wann verwenden?</span> {method.use}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 mt-2"
                      onClick={() => navigate(`/playground?prompt=${encodeURIComponent(method.example)}`)}
                    >
                      <Sparkles className="w-3 h-3" />
                      In der Werkstatt testen
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </div>
        </Card>
      </div>

      {/* Mobile: Accordion Fallback */}
      <div className="md:hidden mb-8">
        <Accordion type="single" collapsible className="space-y-2">
          {techniques.map((technique) => {
            const Icon = technique.icon;
            return (
              <AccordionItem
                key={technique.id}
                value={technique.id}
                className="bg-card rounded-xl shadow-sm px-4 overflow-hidden"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded-lg">
                      <Icon className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold">{technique.shortTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {technique.methods.length} {technique.methods.length === 1 ? "Methode" : "Methoden"}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <div className="space-y-6">
                    {technique.methods.map((method, idx) => (
                      <div key={idx}>
                        {idx > 0 && <hr className="border-border mb-6" />}
                        <MethodDetail method={method} />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Wichtige Prinzipien — Banner */}
      <Card className="p-6 md:p-8 bg-gradient-card shadow-sm border-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-muted p-2.5 rounded-lg">
            <Lightbulb className="w-5 h-5 text-foreground/70" />
          </div>
          <h3 className="text-lg font-bold">Wichtige Prinzipien</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {principles.map((p) => (
            <div key={p.num} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                {p.num}
              </span>
              <div>
                <div className="text-sm font-semibold">{p.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
};

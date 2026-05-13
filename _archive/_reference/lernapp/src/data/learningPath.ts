export interface LearningModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  type: "theorie" | "praxis" | "quiz" | "pruefung";
  component: string;
  prerequisites: string[];
  isBonus?: boolean;
  challenge?: {
    question: string;
    placeholder: string;
    minLength: number;
  };
}

// Pflicht-Module: Der Kern-Onboarding-Pfad (~40 Min)
export const requiredModules: LearningModule[] = [
  {
    id: "acta-einfuehrung",
    title: "Einführung & ACTA-Methode",
    description: "Warum Struktur wichtig ist und wie die ACTA-Methode funktioniert",
    duration: "15 Min",
    type: "theorie",
    component: "ACTAIntroduction",
    prerequisites: [],
  },
  {
    id: "erste-uebungen",
    title: "Üben: Dein erster guter Prompt",
    description: "Verbessere schwache Prompts und bekomme KI-Feedback",
    duration: "15 Min",
    type: "praxis",
    component: "PracticeAreaCompact",
    prerequisites: ["acta-einfuehrung"],
  },
  {
    id: "rakete-einfuehrung",
    title: "Die RAKETE-Methode",
    description: "Von ACTA zu RAKETE — 2 zusätzliche Felder für exzellente Prompts",
    duration: "10 Min",
    type: "theorie",
    component: "RAKETEIntroduction",
    prerequisites: ["erste-uebungen"],
  },
];

// Bonus-Module: Vertiefung, unabhängig voneinander
export const bonusModules: LearningModule[] = [
  {
    id: "techniken-anwenden",
    title: "Fortgeschrittene Techniken anwenden",
    description: "Chain-of-Thought, Few-Shot und Verification direkt in der Werkstatt ausprobieren",
    duration: "20 Min",
    type: "praxis",
    component: "AdvancedTechniquesModule",
    prerequisites: ["erste-uebungen"],
    isBonus: true,
    challenge: {
      question: "Reflexion: Für welche deiner Arbeitsaufgaben würdest du eine der gelernten Techniken einsetzen? Beschreibe kurz, welche Technik und warum.",
      placeholder: "z.B. Für die Erstellung von Stellungnahmen würde ich die Selbstprüfung nutzen, weil...",
      minLength: 30,
    },
  },
  {
    id: "datenschutz",
    title: "Datenschutz & Compliance",
    description: "Sensible Daten erkennen und Vertraulichkeitsstufen verstehen",
    duration: "10 Min",
    type: "praxis",
    component: "DataPrivacyIntro",
    prerequisites: ["erste-uebungen"],
    isBonus: true,
    challenge: {
      question: "Reflexion: Welche sensiblen Daten könnten in deinen typischen Arbeits-Prompts vorkommen? Wie würdest du sie anonymisieren?",
      placeholder: "z.B. In meinen Prompts zu Bürgeranfragen kommen Namen und Aktenzeichen vor. Ich würde...",
      minLength: 30,
    },
  },
  {
    id: "workflows-bauen",
    title: "Eigene Workflows bauen",
    description: "Komplexe Aufgaben zerlegen und eigene Prompt-Skills erstellen",
    duration: "15 Min",
    type: "praxis",
    component: "WorkflowBuilderModule",
    prerequisites: ["erste-uebungen"],
    isBonus: true,
    challenge: {
      question: "Reflexion: Welches wiederkehrende Projekt oder welche Aufgabe aus deinem Arbeitsalltag möchtest du als erstes mit KI-Unterstützung in Teilschritte zerlegen?",
      placeholder: "z.B. Die vierteljährliche Berichterstellung, bei der ich immer zuerst Daten sammle, dann...",
      minLength: 30,
    },
  },
];

// Alle Module zusammen (für Fortschrittsberechnung)
export const learningModules: LearningModule[] = [...requiredModules, ...bonusModules];

// ── NEU: Lernpfad-Stufen ──

export interface LernpfadStufe {
  nr: number;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  iconName: string;
  modules?: LearningModule[];
  bonusModules?: LearningModule[];
  features?: string[];
}

export const lernpfadStufen: LernpfadStufe[] = [
  {
    nr: 1,
    title: "Formulieren",
    subtitle: "Klare Anweisungen geben",
    description: "Du lernst, KI-Prompts strukturiert und präzise zu formulieren — mit der ACTA-Methode, der RAKETE-Formel und Beispielen aus der Prompt-Sammlung.",
    color: "blue",
    iconName: "PenLine",
    modules: undefined,
    bonusModules: undefined,
  },
  {
    nr: 2,
    title: "Bewerten",
    subtitle: "Outputs kritisch prüfen",
    description: "Du lernst, KI-Outputs systematisch zu bewerten — nicht nur ‚klingt gut', sondern anhand konkreter Kriterien wie Genauigkeit, Vollständigkeit und Fachlichkeit.",
    color: "violet",
    iconName: "ShieldCheck",
    features: ["Prüfen-Funktion in der Werkstatt", "Spot the Flaw Übungen", "Tagesaufgaben"],
  },
  {
    nr: 3,
    title: "Unterscheiden",
    subtitle: "70% von 100% trennen",
    description: "Du trainierst das Gespür für den Unterschied zwischen ‚sieht professionell aus' und ‚ist professionell'. Das ist die Kernkompetenz, die KI nicht für dich übernehmen kann.",
    color: "amber",
    iconName: "Eye",
    features: ["Erkenne den Unterschied"],
  },
  {
    nr: 4,
    title: "Artikulieren",
    subtitle: "Schwächen benennen können",
    description: "Du lernst, präzise zu beschreiben warum ein Output nicht gut genug ist — so dass andere (und die KI) aus deiner Erkenntnis lernen können.",
    color: "emerald",
    iconName: "Lightbulb",
    features: ["Qualitätsregel-Workflow in der Werkstatt"],
  },
  {
    nr: 5,
    title: "Systematisieren",
    subtitle: "Wissen dauerhaft kodieren",
    description: "Du baust dir einen persönlichen Qualitätsstandard auf — Arbeitsregeln und Qualitätsregeln, die bei jeder KI-Anfrage automatisch angewendet werden.",
    color: "slate",
    iconName: "Layers",
    features: ["Mein KI-Kontext", "Qualitätsregeln"],
  },
];

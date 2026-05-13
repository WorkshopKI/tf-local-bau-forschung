export interface TechniqueTemplate {
  id: string;
  category: string;
  categoryIcon: string;
  name: string;
  description: string;
  promptTemplate: string;
  useCase: string;
}

export const TECHNIQUE_TEMPLATES: TechniqueTemplate[] = [
  {
    id: "chain-of-verification",
    category: "Selbstkorrektur",
    categoryIcon: "Shield",
    name: "Chain of Verification",
    description: "Die KI überprüft ihre eigenen Antworten in einer Verifizierungsschleife.",
    promptTemplate: `{AUFGABE}

Führe folgende Schritte aus:
1. Beantworte die Aufgabe mit deiner besten Analyse.
2. Liste 3 Wege auf, wie deine Analyse unvollständig oder fehlerhaft sein könnte.
3. Überarbeite deine ursprüngliche Antwort basierend auf dieser Selbstüberprüfung.`,
    useCase: "Wichtige Analysen, bei denen Genauigkeit entscheidend ist.",
  },
  {
    id: "adversarial-prompting",
    category: "Selbstkorrektur",
    categoryIcon: "Shield",
    name: "Adversarial Prompting",
    description: "Fordere die KI auf, Schwachstellen in ihrer eigenen Ausgabe zu finden.",
    promptTemplate: `{AUFGABE}

Dann greife deine eigene Antwort an:
- Identifiziere 5 spezifische Schwachstellen oder Fehler.
- Bewerte für jede: Wahrscheinlichkeit (hoch/mittel/niedrig) und Impact.
- Erstelle eine verbesserte Version, die diese Schwachstellen adressiert.`,
    useCase: "Sicherheitskritische oder hochsensible Aufgaben.",
  },
  {
    id: "few-shot",
    category: "Edge-Case Learning",
    categoryIcon: "Target",
    name: "Few-Shot Prompting",
    description: "Zeige Beispiele von Fehlerfällen und Grenzfällen, um subtile Unterschiede zu erkennen.",
    promptTemplate: `Hier sind Beispiele zur Orientierung:

Beispiel 1 (korrekt): {BEISPIEL_1}
Beispiel 2 (Grenzfall): {BEISPIEL_2}
Beispiel 3 (häufiger Fehler): {BEISPIEL_3}

Analysiere nun folgenden Fall nach dem gleichen Muster:
{AUFGABE}`,
    useCase: "Komplexe Kategorisierungsaufgaben oder wenn viele Grenzfälle existieren.",
  },
  {
    id: "reverse-prompting",
    category: "Meta-Prompting",
    categoryIcon: "Brain",
    name: "Reverse Prompting",
    description: "Die KI entwirft den optimalen Prompt und führt ihn dann selbst aus.",
    promptTemplate: `Du bist ein Experte für Prompt-Design.

Schritt 1: Entwirf den effektivsten Prompt für folgende Aufgabe: {AUFGABE}
Berücksichtige: wichtige Details, bestes Output-Format, essenzielle Denkschritte.

Schritt 2: Führe den von dir entworfenen Prompt aus und liefere das Ergebnis.`,
    useCase: "Komplexe Analyseaufgaben, bei denen die beste Prompt-Struktur unklar ist.",
  },
  {
    id: "recursive-optimization",
    category: "Meta-Prompting",
    categoryIcon: "Brain",
    name: "Recursive Prompt Optimization",
    description: "Die KI optimiert den Prompt über mehrere Iterationen.",
    promptTemplate: `Du bist ein rekursiver Prompt-Optimierer. Mein aktueller Prompt ist:

"{AUFGABE}"

Optimiere in 3 Versionen:
Version 1: Füge fehlende Constraints und Rahmenbedingungen hinzu.
Version 2: Löse alle Mehrdeutigkeiten auf.
Version 3: Erhöhe die Denktiefe und füge Reflexionsschritte ein.

Zeige jede Version und führe dann Version 3 aus.`,
    useCase: "Systematische Verbesserung eines Prompts.",
  },
  {
    id: "deliberate-over-instruction",
    category: "Reasoning Scaffolds",
    categoryIcon: "Zap",
    name: "Deliberate Over-Instruction",
    description: "Fordere explizit Ausführlichkeit, um gegen die Tendenz zur Zusammenfassung anzukämpfen.",
    promptTemplate: `{AUFGABE}

WICHTIG: Fasse NICHT zusammen. Erweitere jeden einzelnen Punkt mit:
- Implementierungsdetails
- Edge Cases und Ausnahmen
- Mögliche Fehlermodi
- Konkreten Beispielen

Deine Antwort soll mindestens 1000 Wörter umfassen. Tiefe vor Breite.`,
    useCase: "Tiefgehende Analysen, wo jedes Detail zählt.",
  },
  {
    id: "competitive-reasoning",
    category: "Reasoning Scaffolds",
    categoryIcon: "Zap",
    name: "Competitive Reasoning",
    description: "Mehrere konkurrierende Perspektiven derselben Situation.",
    promptTemplate: `{AUFGABE}

Analysiere aus drei konkurrierenden Perspektiven:

🟢 Optimistisches Best-Case-Szenario:
- Annahmen, Chancen, positive Entwicklungen

🔴 Pessimistisches Worst-Case-Szenario:
- Risiken, Probleme, negative Entwicklungen

🟡 Realistisches Wahrscheinlichstes-Szenario:
- Begründete Einschätzung mit Wahrscheinlichkeiten

Vergleiche dann die Annahmen jeder Perspektive und synthetisiere eine finale Empfehlung.`,
    useCase: "Strategische Entscheidungen mit hoher Unsicherheit.",
  },
  {
    id: "multi-persona-debate",
    category: "Human Simulation",
    categoryIcon: "Users",
    name: "Multi-Persona Debate",
    description: "Verschiedene Rollen debattieren und kritisieren sich gegenseitig.",
    promptTemplate: `{AUFGABE}

Simuliere eine Debatte zwischen drei Experten:

👤 Experte A (Kosten-fokussiert): Priorisiert Wirtschaftlichkeit und ROI.
👤 Experte B (Qualitäts-fokussiert): Priorisiert technische Exzellenz und Nachhaltigkeit.
👤 Experte C (Geschwindigkeits-fokussiert): Priorisiert schnelle Umsetzung und Time-to-Market.

Jeder Experte argumentiert für seine Position und kritisiert die anderen.
Synthetisiere am Ende eine ausgewogene Empfehlung.`,
    useCase: "Komplexe Entscheidungen mit konkurrierenden Zielen.",
  },
  {
    id: "temperature-simulation",
    category: "Human Simulation",
    categoryIcon: "Users",
    name: "Temperature Simulation",
    description: "Simuliere verschiedene Vertrauensstufen in der Analyse.",
    promptTemplate: `{AUFGABE}

Analysiere aus zwei Perspektiven:

🔍 Unsicherer Junior-Analyst:
Übererkläre alles, stelle Fragen, zeige Unsicherheiten. "Ich bin mir nicht sicher, aber..."

💎 Selbstbewusster Senior-Experte:
Sei präzise, direkt, selbstsicher. Klare Aussagen ohne Hedging.

Synthetisiere beide Perspektiven und zeige, wo Unsicherheit tatsächlich gerechtfertigt ist.`,
    useCase: "Verschiedene Vertrauensstufen und Unsicherheiten explorieren.",
  },
];

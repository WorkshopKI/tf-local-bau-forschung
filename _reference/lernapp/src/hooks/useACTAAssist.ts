import { useState, useCallback } from "react";
import { toast } from "sonner";
import { complete } from "@/services/completionService";
import type { ACTAFields } from "@/components/playground/ACTATemplates";
import { EMPTY_EXTENSIONS } from "@/components/playground/ACTATemplates";

export interface UseACTAAssistReturn {
  suggest: (description: string, model?: string, mode?: "einsteiger" | "experte") => Promise<ACTAFields | null>;
  improve: (fields: ACTAFields, model?: string, mode?: "einsteiger" | "experte") => Promise<ACTAFields | null>;
  fillVariables: (variableNames: string[], fields: ACTAFields, model?: string) => Promise<Record<string, string> | null>;
  suggestVariableOptions: (variableNames: string[], fields: ACTAFields, model?: string) => Promise<Record<string, string[]> | null>;
  isLoading: boolean;
}

const SUGGEST_SYSTEM_ACTA = `Du bist ein Prompt-Engineering-Experte. Der Benutzer beschreibt kurz, was er braucht. Du zerlegst das in die ACTA-Struktur.

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks, kein Preamble):
{
  "act": "Rolle der KI (z.B. 'ein erfahrener Pressesprecher')",
  "context": "Hintergrund, relevante Informationen, Rahmenbedingungen",
  "task": "Konkrete Aufgabe, was die KI tun soll",
  "ausgabe": "Gewünschtes Format, Länge, Struktur, Sprache",
  "extensions": {
    "examples": [],
    "rules": "",
    "reasoning": "",
    "verification": false,
    "verificationNote": "",
    "reversePrompt": false,
    "negatives": ""
  }
}

Regeln:
- act: Immer eine spezifische Expertenrolle, nicht generisch
- context: Alle relevanten Rahmenbedingungen aus der Beschreibung ableiten
- task: Klare, eindeutige Handlungsanweisung
- ausgabe: Konkretes Format mit Längenangabe
- extensions.reasoning: "step-by-step" wenn die Aufgabe komplex ist, sonst ""
- extensions.verification: true wenn Genauigkeit kritisch ist
- extensions.rules: Nur wenn spezifische Regeln nötig sind (DSGVO, Barrierefreiheit etc.)
- extensions.negatives: Nur wenn typische KI-Fehler vermieden werden müssen
- Alle Texte auf Deutsch`;

const SUGGEST_SYSTEM_RAKETE = `Du bist ein Prompt-Engineering-Experte. Der Benutzer beschreibt kurz, was er braucht. Du zerlegst das in die RAKETE-Struktur (6 Felder: Rolle, Kontext, Aufgabe, Ergebnis, Teste, Einschränkungen).
Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks, kein Preamble):
{
  "act": "Spezifische Expertenrolle",
  "context": "Hintergrund, Zielgruppe, Rahmenbedingungen",
  "task": "Konkrete Aufgabe, was die KI tun soll",
  "ausgabe": "Gewünschtes Format, Länge, Struktur, Sprache",
  "extensions": {
    "examples": [],
    "rules": "",
    "reasoning": "",
    "verification": true,
    "verificationNote": "Konkreter Prüfauftrag: Worauf soll die KI ihre eigene Antwort prüfen?",
    "reversePrompt": false,
    "negatives": "Was die KI NICHT tun soll"
  }
}
Regeln:
- act: Immer eine spezifische Expertenrolle, nicht generisch
- context: Alle relevanten Rahmenbedingungen aus der Beschreibung ableiten
- task: Klare, eindeutige Handlungsanweisung
- ausgabe: Konkretes Format mit Längenangabe
- verification: true wenn Genauigkeit, Vollständigkeit oder Compliance wichtig ist
- verificationNote: Konkreten, aufgabenspezifischen Prüfauftrag formulieren (z.B. "Prüfe auf fachliche Korrektheit und vollständige Abdeckung aller Anforderungen")
- negatives: IMMER befüllen — mindestens 2 Einschränkungen die typische KI-Schwächen adressieren (z.B. "Keine Floskeln. Nicht spekulieren.")
- reasoning: "step-by-step" wenn die Aufgabe komplex ist, sonst ""
- Alle Texte auf Deutsch`;

const IMPROVE_SYSTEM_ACTA = `Du bist ein Prompt-Engineering-Experte. Verbessere den ACTA-Prompt des Benutzers.

Du erhältst die aktuellen ACTA-Felder als JSON. Antworte NUR mit einem verbesserten JSON-Objekt (kein Markdown, keine Backticks, kein Preamble) im selben Format:
{
  "act": "...",
  "context": "...",
  "task": "...",
  "ausgabe": "...",
  "extensions": {
    "examples": [],
    "rules": "...",
    "reasoning": "...",
    "verification": false,
    "verificationNote": "...",
    "reversePrompt": false,
    "negatives": "..."
  }
}

Verbesserungsprinzipien:
- act: Rolle spezifischer machen, relevante Expertise ergänzen
- context: Fehlende Rahmenbedingungen und Zielgruppe ergänzen
- task: Mehrdeutigkeiten auflösen, Aufgabe konkreter formulieren
- ausgabe: Fehlende Format-Angaben (Länge, Struktur, Sprache) ergänzen
- extensions.examples: 1-2 Beispiele ergänzen wenn Few-Shot die Qualität verbessern würde
- extensions.reasoning: Denkstrategie empfehlen wenn die Aufgabe komplex ist
- extensions.verification: Empfehlen wenn Genauigkeit wichtig ist
- extensions.negatives: Typische KI-Fehler als Negativ-Constraints ergänzen
- NICHT den Inhalt komplett umschreiben — verbessern und ergänzen
- Alle Texte auf Deutsch`;

const IMPROVE_SYSTEM_RAKETE = `Du bist ein Prompt-Engineering-Experte. Verbessere den RAKETE-Prompt des Benutzers.
Du erhältst die aktuellen RAKETE-Felder als JSON. Antworte NUR mit einem verbesserten JSON-Objekt.
RAKETE-spezifische Verbesserungsprinzipien:
- act → Rolle: Expertise spezifischer machen
- context → Kontext: Fehlende Rahmenbedingungen und Zielgruppe ergänzen
- task → Aufgabe: Mehrdeutigkeiten auflösen
- ausgabe → Ergebnis: Format-Angaben konkretisieren
- extensions.verificationNote → Teste: Konkreten Prüfauftrag ergänzen wenn leer oder zu vage
- extensions.negatives → Einschränkungen: Typische KI-Fehler als Negativ-Constraints ergänzen wenn leer oder zu wenig
- NICHT den Inhalt komplett umschreiben — verbessern und ergänzen
- Alle Texte auf Deutsch`;

const SUGGEST_OPTIONS_SYSTEM = `Du bist ein Prompt-Engineering-Assistent. Der Benutzer hat eine Vorlage mit Platzhaltern. Generiere für jeden Platzhalter 4-5 realistische, verschiedene Beispielwerte.
Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
Jeder Key ist ein Platzhalter-Name, jeder Value ein Array mit 4-5 verschiedenen Beispielwerten.
Beispiel:
Eingabe: Platzhalter: Vertragstyp, Partei A
Kontext: Vertragsjurist, Zivil- und Verwaltungsrecht
Antwort: {"Vertragstyp": ["Dienstleistungsvertrag", "Werkvertrag", "Rahmenvertrag", "IT-Servicevertrag", "Lizenzvertrag"], "Partei A": ["Stadt Musterstadt", "Landkreis Beispiel", "Stadtverwaltung Freiburg", "Bezirksamt Berlin-Mitte"]}
Regeln:
- Werte müssen realistisch, konkret und verschieden sein
- Werte sollen zum fachlichen Kontext der Vorlage passen
- Alle Werte auf Deutsch
- Pro Platzhalter 4-5 verschiedene Optionen`;

const FILL_VARIABLES_SYSTEM = `Du bist ein Prompt-Engineering-Assistent. Der Benutzer hat eine Vorlage mit Platzhaltern. Fülle die Platzhalter mit realistischen, konkreten Beispielwerten aus.
Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks, kein Preamble).
Jeder Key ist ein Platzhalter-Name, jeder Value ein realistischer Beispielwert auf Deutsch.
Beispiel:
Eingabe: Platzhalter: Anlass/Beschluss, Redner:in/Funktion
Kontext: Pressemitteilung einer kommunalen Verwaltung
Antwort: {"Anlass/Beschluss": "Eröffnung des neuen digitalen Bürgerservice-Portals am 15. März 2026", "Redner:in/Funktion": "Oberbürgermeisterin Dr. Maria Schmidt"}
Regeln:
- Werte müssen realistisch und konkret sein (keine generischen Platzhalter wie "Name" oder "Datum")
- Werte sollen zum Kontext der Vorlage passen
- Alle Werte auf Deutsch`;

function parseACTAResponse(text: string): ACTAFields | null {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      act: parsed.act || "",
      context: parsed.context || "",
      task: parsed.task || "",
      ausgabe: parsed.ausgabe || "",
      extensions: {
        examples: Array.isArray(parsed.extensions?.examples) ? parsed.extensions.examples : [],
        rules: parsed.extensions?.rules || "",
        reasoning: parsed.extensions?.reasoning || "",
        verification: !!parsed.extensions?.verification,
        verificationNote: parsed.extensions?.verificationNote || "",
        reversePrompt: !!parsed.extensions?.reversePrompt,
        negatives: parsed.extensions?.negatives || "",
      },
    };
  } catch {
    return null;
  }
}

function handleError(e: unknown) {
  const msg = e instanceof Error ? e.message : "Fehler";
  if (msg === "BUDGET_EXHAUSTED") toast.error("KI-Budget aufgebraucht.");
  else if (msg === "RATE_LIMITED") toast.error("Zu viele Anfragen. Bitte warte kurz.");
  else if (msg === "NOT_AUTHENTICATED") toast.error("Bitte melde dich an.");
  else toast.error(`Fehler: ${msg}`);
}

export function useACTAAssist(): UseACTAAssistReturn {
  const [isLoading, setIsLoading] = useState(false);

  const suggest = useCallback(async (description: string, model?: string, mode?: "einsteiger" | "experte"): Promise<ACTAFields | null> => {
    if (!description.trim()) return null;
    setIsLoading(true);
    const systemPrompt = mode === "experte" ? SUGGEST_SYSTEM_RAKETE : SUGGEST_SYSTEM_ACTA;
    const frameworkName = mode === "experte" ? "RAKETE" : "ACTA";
    try {
      const text = await complete({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mein Ziel: ${description}` },
        ],
        model,
        temperature: 0.4,
      });
      const result = parseACTAResponse(text);
      if (!result) {
        toast.error("KI-Antwort konnte nicht verarbeitet werden.");
        return null;
      }
      toast.success(`${frameworkName}-Felder vorgeschlagen!`);
      return result;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const improve = useCallback(async (fields: ACTAFields, model?: string, mode?: "einsteiger" | "experte"): Promise<ACTAFields | null> => {
    setIsLoading(true);
    const systemPrompt = mode === "experte" ? IMPROVE_SYSTEM_RAKETE : IMPROVE_SYSTEM_ACTA;
    try {
      const text = await complete({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Aktueller Prompt:\n${JSON.stringify({
            act: fields.act, context: fields.context, task: fields.task, ausgabe: fields.ausgabe,
            extensions: fields.extensions ?? EMPTY_EXTENSIONS,
          }, null, 2)}\n\nVerbessere diesen Prompt.` },
        ],
        model,
        temperature: 0.4,
      });
      const result = parseACTAResponse(text);
      if (!result) {
        toast.error("KI-Antwort konnte nicht verarbeitet werden.");
        return null;
      }
      toast.success("Prompt verbessert!");
      return result;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fillVariables = useCallback(async (
    variableNames: string[],
    fields: ACTAFields,
    model?: string,
  ): Promise<Record<string, string> | null> => {
    if (variableNames.length === 0) return null;
    setIsLoading(true);
    try {
      const contextHint = [fields.act, fields.task].filter(Boolean).join(". ");
      const text = await complete({
        messages: [
          { role: "system", content: FILL_VARIABLES_SYSTEM },
          { role: "user", content: `Platzhalter: ${variableNames.join(", ")}\nKontext: ${contextHint || "Allgemein"}` },
        ],
        model,
        temperature: 0.6,
      });
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const result: Record<string, string> = {};
      for (const name of variableNames) {
        if (parsed[name]) result[name] = parsed[name];
      }
      if (Object.keys(result).length === 0) {
        toast.error("KI konnte keine Beispielwerte generieren.");
        return null;
      }
      toast.success(`${Object.keys(result).length} Beispielwert${Object.keys(result).length > 1 ? "e" : ""} eingesetzt!`);
      return result;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const suggestVariableOptions = useCallback(async (
    variableNames: string[],
    fields: ACTAFields,
    model?: string,
  ): Promise<Record<string, string[]> | null> => {
    if (variableNames.length === 0) return null;
    setIsLoading(true);
    try {
      const contextHint = [fields.act, fields.context, fields.task].filter(Boolean).join(". ");
      const text = await complete({
        messages: [
          { role: "system", content: SUGGEST_OPTIONS_SYSTEM },
          { role: "user", content: `Platzhalter: ${variableNames.join(", ")}\nKontext: ${contextHint || "Allgemein"}` },
        ],
        model,
        temperature: 0.7,
      });
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const result: Record<string, string[]> = {};
      for (const name of variableNames) {
        if (Array.isArray(parsed[name]) && parsed[name].length > 0) {
          result[name] = parsed[name];
        }
      }
      return Object.keys(result).length > 0 ? result : null;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { suggest, improve, fillVariables, suggestVariableOptions, isLoading };
}

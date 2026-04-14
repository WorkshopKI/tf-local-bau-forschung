import { promptLibrary } from "@/data/prompts";
import type { PromptItem } from "@/types";
import { splitPromptToACTA } from "@/lib/promptUtils";

export interface ACTAExtensions {
  /** Few-Shot Beispiele — jeder String ein Beispiel */
  examples: string[];
  /** Explizite Regeln, Verbote, Einschränkungen */
  rules: string;
  /** Reasoning-Strategie: "" | "step-by-step" | "pros-cons" | "perspectives" | "tree-of-thought" */
  reasoning: string;
  /** Selbstprüfung aktiviert? */
  verification: boolean;
  /** Optionale Prüfanweisung für die KI */
  verificationNote: string;
  /** Reverse Prompting: KI entwirft zuerst den optimalen Prompt */
  reversePrompt: boolean;
  /** Negativ-Constraints: Was die KI NICHT tun soll */
  negatives: string;
}

export const EMPTY_EXTENSIONS: ACTAExtensions = {
  examples: [],
  rules: "",
  reasoning: "",
  verification: false,
  verificationNote: "",
  reversePrompt: false,
  negatives: "",
};

export interface ACTAFields {
  act: string;
  context: string;
  task: string;
  ausgabe: string;
  extensions?: ACTAExtensions;
}

export interface ACTATemplate {
  label: string;
  fields: ACTAFields;
}

export interface ACTATemplateGroup {
  label: string;
  templates: ACTATemplate[];
}

export const ACTA_TEMPLATES: ACTATemplate[] = [
  {
    label: "Marketing: LinkedIn-Post",
    fields: {
      act: "ein erfahrener Social-Media-Manager mit Fokus auf LinkedIn",
      context:
        "Unser Unternehmen ist ein B2B-SaaS-Startup für Projektmanagement. Wir haben gerade ein neues Feature für die automatisierte Zeiterfassung gelauncht. Zielgruppe sind Teamleiter und Projektmanager in mittelständischen Unternehmen.",
      task: "Erstelle einen LinkedIn-Post, der das neue Feature vorstellt und die Vorteile für Teamleiter hervorhebt.",
      ausgabe:
        "Der Post soll max. 150 Wörter haben, mit 3-5 Bulletpoints für die Key-Benefits und einem Call-to-Action am Ende.",
    },
  },
  {
    label: "Bewerbung: Anschreiben",
    fields: {
      act: "ein erfahrener Karriereberater mit Expertise in Bewerbungsschreiben",
      context:
        "Ich bin Softwareentwickler mit 5 Jahren Erfahrung in Python und JavaScript. Ich bewerbe mich bei einem mittelständischen Unternehmen für die Position 'Senior Full-Stack Developer'. Das Unternehmen legt Wert auf Teamarbeit und agile Methoden.",
      task: "Verfasse ein überzeugendes Anschreiben, das meine technischen Fähigkeiten und Soft Skills hervorhebt.",
      ausgabe:
        "Maximal eine DIN-A4-Seite, formeller Ton, mit konkreten Beispielen aus meiner Berufserfahrung. Struktur: Einleitung, Hauptteil (2 Absätze), Schluss.",
    },
  },
  {
    label: "Bildung: Unterrichtsplanung",
    fields: {
      act: "ein erfahrener Gymnasiallehrer für Biologie mit Schwerpunkt auf aktivierender Didaktik",
      context:
        "Klasse 10, Gymnasium, Thema Genetik. Die Schüler haben Grundkenntnisse in Zellbiologie. Es steht ein Smartboard und ein Biologielabor zur Verfügung. Die Stunde dauert 45 Minuten.",
      task: "Erstelle einen detaillierten Unterrichtsentwurf zum Thema 'DNA-Replikation' mit interaktiven Elementen.",
      ausgabe:
        "Tabellarischer Verlaufsplan mit Spalten: Phase, Zeit, Inhalt, Methode, Material. Plus eine kurze Reflexion zu möglichen Schwierigkeiten.",
    },
  },
  {
    label: "Forschung: Literaturrecherche",
    fields: {
      act: "ein wissenschaftlicher Recherche-Assistent mit Expertise in systematischen Reviews",
      context:
        "Ich arbeite an einer Masterarbeit im Bereich Wirtschaftsinformatik zum Thema 'KI-gestützte Entscheidungsunterstützung in Unternehmen'. Ich suche aktuelle Literatur (ab 2021) aus den Bereichen Management Science, Information Systems und KI.",
      task: "Erstelle eine strukturierte Literaturübersicht mit den wichtigsten Forschungsrichtungen und identifiziere Forschungslücken.",
      ausgabe:
        "Tabelle mit Spalten: Autor/Jahr, Titel, Methode, Ergebnis, Relevanz. Dazu eine narrative Zusammenfassung (500 Wörter) der Haupttrends und 3 identifizierte Forschungslücken.",
    },
  },
  {
    label: "Alltag: Reiseplanung",
    fields: {
      act: "ein erfahrener Reiseberater mit Spezialisierung auf Europa",
      context:
        "Wir sind ein Paar (beide 30), reisen gerne aktiv und kulturinteressiert. Budget ca. 2.500€ für 10 Tage inklusive Flug und Unterkunft. Wir haben im September Urlaub und fliegen ab München.",
      task: "Plane eine 10-tägige Reise nach Portugal mit einem Mix aus Städten, Natur und Küste.",
      ausgabe:
        "Tag-für-Tag-Reiseplan mit: Ort, Aktivitäten, geschätzte Kosten, Transportmittel. Plus eine Packliste und 3 Restaurant-Tipps pro Stadt.",
    },
  },
];

function promptToTemplate(p: PromptItem): ACTATemplate {
  if (p.actaFields) {
    return {
      label: p.title,
      fields: {
        act: p.actaFields.act || "",
        context: p.actaFields.context || "",
        task: p.actaFields.task || "",
        ausgabe: p.actaFields.ausgabe || "",
        extensions: p.actaFields.extensions ? { ...p.actaFields.extensions } : undefined,
      },
    };
  }
  return {
    label: p.title,
    fields: splitPromptToACTA(p.prompt, p.title),
  };
}

/**
 * Erstellt gruppierte ACTA-Vorlagen aus der Library.
 * Priorisiert: Abteilungs-Prompts → Organisation → Top-Beispiele
 */
export function getLibraryTemplates(departmentScope?: string): ACTATemplateGroup[] {
  const groups: ACTATemplateGroup[] = [];

  // 1. Abteilungs-spezifische Prompts (wenn Scope gesetzt)
  if (departmentScope && departmentScope !== "privat" && departmentScope !== "organisation") {
    const deptPrompts = promptLibrary.filter(p => p.targetDepartment === departmentScope);
    if (deptPrompts.length > 0) {
      groups.push({
        label: "Meine Abteilung",
        templates: deptPrompts.slice(0, 8).map(promptToTemplate),
      });
    }
  }

  // 2. Organisations-Prompts (ohne die schon in Abt. gezeigten)
  const orgPrompts = promptLibrary.filter(
    p => p.level === "organisation" && p.targetDepartment !== departmentScope
  );
  if (orgPrompts.length > 0) {
    groups.push({
      label: "Organisation",
      templates: orgPrompts.slice(0, 6).map(promptToTemplate),
    });
  }

  // 3. Generische Beispiele (Fallback)
  groups.push({
    label: "Beispiele",
    templates: ACTA_TEMPLATES,
  });

  return groups;
}

import type { SavedSkill } from "@/types";

const confidentialityLabels: Record<string, string> = {
  open: "🟢 Offen — Externe API erlaubt",
  internal: "🟡 Intern — Interne KI empfohlen",
  confidential: "🔴 Vertraulich — Nur interne KI",
};

export function skillToMarkdown(skill: SavedSkill): string {
  const lines: string[] = [];

  lines.push(`# ${skill.title}`);
  lines.push("");
  lines.push(`**Kategorie:** ${skill.category}`);
  if (skill.targetDepartment) {
    lines.push(`**Abteilung:** ${skill.targetDepartment}`);
  }
  if (skill.confidentiality) {
    lines.push(`**Vertraulichkeit:** ${confidentialityLabels[skill.confidentiality] || skill.confidentiality}`);
  }
  if (skill.targetModel) {
    lines.push(`**Optimiert für:** ${skill.targetModel}`);
  }
  lines.push(`**Erstellt:** ${new Date(skill.createdAt).toLocaleDateString("de-DE")}`);
  lines.push(`**Zuletzt bearbeitet:** ${new Date(skill.updatedAt).toLocaleDateString("de-DE")}`);
  lines.push("");

  // Variablen
  const vars = Object.entries(skill.variables).filter(([, v]) => v.trim());
  if (vars.length > 0) {
    lines.push("## Variablen");
    lines.push("");
    for (const [key, value] of vars) {
      lines.push(`- **${key}:** ${value}`);
    }
    lines.push("");
  }

  // Prompt
  lines.push("## Prompt");
  lines.push("");
  lines.push("```");
  let filledPrompt = skill.prompt;
  for (const [key, value] of Object.entries(skill.variables)) {
    if (value.trim()) {
      filledPrompt = filledPrompt.split(`{{${key}}}`).join(value);
    }
  }
  lines.push(filledPrompt);
  lines.push("```");
  lines.push("");

  // Notizen
  if (skill.notes.trim()) {
    lines.push("## Notizen");
    lines.push("");
    lines.push(skill.notes);
    lines.push("");
  }

  // Quelle
  if (skill.sourceTitle !== skill.title) {
    lines.push("---");
    lines.push(`*Basiert auf: ${skill.sourceTitle} (KI-Werkstatt)*`);
  } else {
    lines.push("---");
    lines.push(`*Erstellt mit KI-Werkstatt*`);
  }

  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══ Agent Skills Format ═══

export function toSkillName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äÄ]/g, "ae").replace(/[öÖ]/g, "oe").replace(/[üÜ]/g, "ue").replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 64);
}

function extractVariableNames(prompt: string): string[] {
  const matches = prompt.match(/\{\{(.+?)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))];
}

const confidentialityDescriptions: Record<string, string> = {
  open: "Keine vertraulichen Daten. Externe KI erlaubt.",
  internal: "Interne Informationen. Interne KI bevorzugt.",
  confidential: "Vertrauliche/personenbezogene Daten. NUR interne KI.",
};

const departmentLabels: Record<string, string> = {
  legal: "Abteilung Legal",
  oeffentlichkeitsarbeit: "Abteilung Öffentlichkeitsarbeit",
  hr: "Abteilung HR",
  it: "Abteilung IT",
  bauverfahren: "Fachabteilung Bauverfahren",
};

export function skillToAgentSkillMd(skill: SavedSkill): string {
  const name = toSkillName(skill.title);
  const variables = extractVariableNames(skill.prompt);
  const lines: string[] = [];

  // YAML Frontmatter
  lines.push("---");
  lines.push(`name: ${name}`);

  const descParts: string[] = [];
  descParts.push(`${skill.title}.`);
  if (skill.category) descParts.push(`Kategorie: ${skill.category}.`);
  if (skill.targetDepartment) descParts.push(`Für ${departmentLabels[skill.targetDepartment] || skill.targetDepartment}.`);
  descParts.push(`Verwende diesen Skill wenn der User nach Unterstützung bei ${skill.category} fragt.`);
  lines.push(`description: ${descParts.join(" ").slice(0, 1024)}`);

  lines.push("metadata:");
  lines.push("  author: ki-praxis");
  lines.push(`  version: "1.0"`);
  if (skill.category) lines.push(`  category: "${skill.category}"`);
  if (skill.targetDepartment) lines.push(`  department: "${skill.targetDepartment}"`);
  if (skill.confidentiality) lines.push(`  confidentiality: "${skill.confidentiality}"`);
  if (skill.targetModel) lines.push(`  target-model: "${skill.targetModel}"`);
  lines.push("---");
  lines.push("");

  // Body
  lines.push(`# ${skill.title}`);
  lines.push("");

  lines.push("## Wann diesen Skill nutzen");
  lines.push("");
  lines.push(`- Der User fragt nach Unterstützung bei: ${skill.category}`);
  if (skill.targetDepartment) {
    lines.push(`- Der User arbeitet in: ${departmentLabels[skill.targetDepartment] || skill.targetDepartment}`);
  }
  lines.push("");

  // Vertraulichkeit
  if (skill.confidentiality) {
    lines.push("## Vertraulichkeit");
    lines.push("");
    const confLevel = skill.confidentiality === "confidential" ? "🔴 VERTRAULICH"
      : skill.confidentiality === "internal" ? "🟡 INTERN" : "🟢 OFFEN";
    lines.push(`**Stufe:** ${confLevel}`);
    lines.push("");
    lines.push(confidentialityDescriptions[skill.confidentiality] || "");
    if (skill.confidentiality === "confidential") {
      lines.push("");
      lines.push("**WICHTIG:** Dieser Skill darf NUR mit der internen KI verwendet werden. Keine Daten an externe APIs senden.");
    }
    lines.push("");
  }

  // Vorgehen
  lines.push("## Vorgehen");
  lines.push("");
  if (variables.length > 0) {
    lines.push("1. Kläre mit dem User die folgenden Informationen:");
    for (const v of variables) {
      lines.push(`   - **${v}**`);
    }
    lines.push("2. Verwende das Prompt-Template aus `references/TEMPLATE.md`");
    lines.push("3. Fülle alle Platzhalter mit den Angaben des Users");
    lines.push("4. Prüfe das Ergebnis auf Qualität und Compliance");
  } else {
    lines.push("1. Verwende das Prompt-Template aus `references/TEMPLATE.md`");
    lines.push("2. Passe es an den konkreten Bedarf des Users an");
    lines.push("3. Prüfe das Ergebnis auf Qualität und Compliance");
  }
  lines.push("");

  // Qualitätskriterien
  const qualityCriteria: string[] = [];
  if (skill.prompt.includes("Sprachniveau B1") || skill.prompt.includes("barrierefrei")) {
    qualityCriteria.push("Barrierefreie Sprache (Sprachniveau B1)");
  }
  if (skill.prompt.includes("gendersensibel")) {
    qualityCriteria.push("Gendersensible Formulierungen");
  }
  if (skill.prompt.match(/max\.?\s*\d+\s*Wörter/i)) {
    const match = skill.prompt.match(/max\.?\s*(\d+)\s*Wörter/i);
    if (match) qualityCriteria.push(`Maximale Länge: ${match[1]} Wörter`);
  }
  if (skill.prompt.includes("[JURIST:IN PRÜFEN]")) {
    qualityCriteria.push("Muss mit [JURIST:IN PRÜFEN] markiert sein");
  }
  if (skill.prompt.includes("[LEITUNG PRÜFEN]")) {
    qualityCriteria.push("Muss mit [LEITUNG PRÜFEN] markiert sein — Freigabe vor Veröffentlichung");
  }
  if (skill.prompt.includes("[ZEICHNUNGSBEFUGT PRÜFEN]")) {
    qualityCriteria.push("Muss mit [ZEICHNUNGSBEFUGT PRÜFEN] markiert sein");
  }
  if (skill.prompt.includes("KEINE echten Namen") || skill.prompt.includes("KEINE ECHTEN NAMEN")) {
    qualityCriteria.push("KEINE echten Personennamen verwenden — nur Platzhalter");
  }
  if (qualityCriteria.length > 0) {
    lines.push("## Qualitätskriterien");
    lines.push("");
    for (const c of qualityCriteria) {
      lines.push(`- ${c}`);
    }
    lines.push("");
  }

  // Notizen
  if (skill.notes.trim()) {
    lines.push("## Hinweise");
    lines.push("");
    lines.push(skill.notes);
    lines.push("");
  }

  // Ziel-Modell
  if (skill.targetModel) {
    lines.push("## Modell-Hinweis");
    lines.push("");
    lines.push(`Dieser Skill wurde für **${skill.targetModel}** optimiert und getestet.`);
    lines.push("Bei Verwendung mit anderen Modellen kann eine Anpassung nötig sein.");
    lines.push("");
  }

  return lines.join("\n");
}

export function skillToTemplate(skill: SavedSkill): string {
  const lines: string[] = [];
  lines.push(`# Prompt-Template: ${skill.title}`);
  lines.push("");

  const variables = extractVariableNames(skill.prompt);
  if (variables.length > 0) {
    lines.push("## Variablen");
    lines.push("");
    for (const v of variables) {
      const value = skill.variables[v];
      lines.push(`- \`{{${v}}}\`${value ? ` — Beispiel: ${value}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Template");
  lines.push("");
  lines.push("```");
  lines.push(skill.prompt);
  lines.push("```");
  lines.push("");

  const filledVars = Object.entries(skill.variables).filter(([, v]) => v.trim());
  if (filledVars.length > 0) {
    lines.push("## Beispiel (ausgefüllt)");
    lines.push("");
    lines.push("```");
    let filled = skill.prompt;
    for (const [key, value] of filledVars) {
      filled = filled.split(`{{${key}}}`).join(value);
    }
    lines.push(filled);
    lines.push("```");
  }

  return lines.join("\n");
}

export async function downloadAgentSkillZip(skill: SavedSkill) {
  const JSZip = (await import("jszip")).default;
  const name = toSkillName(skill.title);
  const skillMd = skillToAgentSkillMd(skill);
  const templateMd = skillToTemplate(skill);

  const zip = new JSZip();
  const folder = zip.folder(name)!;
  folder.file("SKILL.md", skillMd);
  const refs = folder.folder("references")!;
  refs.file("TEMPLATE.md", templateMd);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

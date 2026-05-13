import { loadKIContext } from "@/services/kiContextService";
import { getActiveConstraints } from "@/services/constraintService";

/**
 * Generiert den System-Prompt-Prefix aus persönlichem KI-Kontext + aktiven Qualitätsregeln.
 * Wird vor den System-Prompt im Prompt-Labor gehängt.
 * Gibt leeren String zurück wenn kein Kontext konfiguriert ist.
 */
export function buildContextPrefix(): string {
  const ctx = loadKIContext();
  const constraints = getActiveConstraints();
  const p = ctx.profile;
  const hasProfile = p.abteilung || p.fachgebiet || p.aufgaben || p.stil;
  const activeRules = ctx.workRules.filter(r => r.active);
  const hasRules = activeRules.length > 0;
  const hasConstraints = constraints.length > 0;

  if (!hasProfile && !hasRules && !hasConstraints) return "";

  const lines: string[] = [];

  if (hasProfile) {
    lines.push("# Kontext des Nutzers");
    if (p.abteilung) lines.push(`Abteilung: ${p.abteilung}`);
    if (p.fachgebiet) lines.push(`Fachgebiet: ${p.fachgebiet}`);
    if (p.aufgaben) lines.push(`Typische Aufgaben: ${p.aufgaben}`);
    if (p.stil) lines.push(`Bevorzugter Stil: ${p.stil}`);
    lines.push("");
  }

  if (hasRules) {
    lines.push("# Arbeitsregeln");
    activeRules.forEach(r => lines.push(`- ${r.text}`));
    lines.push("");
  }

  if (hasConstraints) {
    lines.push("# Qualitätsregeln");
    constraints.forEach(c => {
      lines.push(`- ${c.title}: ${c.rule}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Gibt die Anzahl aktiver Regeln zurück (Arbeitsregeln + Constraints).
 * Für Badge-Anzeige im Chat-Input.
 */
export function getActiveRuleCount(): number {
  const ctx = loadKIContext();
  const constraints = getActiveConstraints();
  return ctx.workRules.filter(r => r.active).length + constraints.length;
}

/**
 * RAKETE Phase 2 — KI-Batch-Migration: actaFields für alle Prompts generieren
 *
 * Liest src/data/prompts.ts ein, generiert fehlende actaFields per LLM,
 * und schreibt das Ergebnis nach src/data/prompts.generated.ts.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... npx tsx scripts/migrate-prompts-to-rakete.ts
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY nicht gesetzt. Abbruch.");
  process.exit(1);
}

const MODEL = "google/gemini-2.5-flash";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_PARALLEL = 3;
const BATCH_PAUSE_MS = 500;
const RETRY_DELAY_MS = 2000;

const __filename_resolved = fileURLToPath(import.meta.url);
const __dirname_resolved = dirname(__filename_resolved);
const ROOT = resolve(__dirname_resolved, "..");
const PROMPTS_PATH = resolve(ROOT, "src/data/prompts.ts");
const OUTPUT_PATH = resolve(ROOT, "src/data/prompts.generated.ts");
const ERROR_LOG = resolve(ROOT, "scripts/errors.log");

// ---------------------------------------------------------------------------
// Types (mirror from src/types/index.ts)
// ---------------------------------------------------------------------------

interface ActaExtensions {
  examples: string[];
  rules: string;
  reasoning: string;
  verification: boolean;
  verificationNote: string;
  reversePrompt: boolean;
  negatives: string;
}

interface ActaFields {
  act?: string;
  context?: string;
  task?: string;
  ausgabe?: string;
  extensions?: ActaExtensions;
}

interface PromptItem {
  category: string;
  title: string;
  prompt: string;
  needsWeb?: boolean;
  level?: string;
  type?: string;
  constraints?: unknown;
  acceptanceCriteria?: string;
  estimatedAgentTime?: string;
  requiredTools?: string[];
  department?: string;
  riskLevel?: string;
  official?: boolean;
  confidentiality?: string;
  confidentialityReason?: string;
  targetDepartment?: string;
  actaFields?: ActaFields;
}

// ---------------------------------------------------------------------------
// LLM Call
// ---------------------------------------------------------------------------

async function callLLM(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const resp = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://prompting-studio.app",
      "X-Title": "RAKETE Migration Script",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body}`);
  }

  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJSON<T>(raw: string): T {
  // Strip markdown fences
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return JSON.parse(cleaned) as T;
}

async function callLLMWithRetry(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  try {
    return await callLLM(systemPrompt, userMessage);
  } catch (e) {
    console.warn(`  ⚠️ Retry nach Fehler: ${(e as Error).message}`);
    await sleep(RETRY_DELAY_MS);
    return await callLLM(systemPrompt, userMessage);
  }
}

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_GENERATE = `Du bist ein Prompt-Engineering-Experte für die deutsche Verwaltung. Zerlege den folgenden Prompt in die RAKETE-Struktur.
Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{
  "act": "Spezifische Expertenrolle (z.B. 'ein erfahrener Web-Redakteur einer öffentlichen Organisation')",
  "context": "Hintergrund, Zielgruppe, Rahmenbedingungen. Übernimm {{Variablen}} aus dem Original wenn vorhanden.",
  "task": "Konkrete Aufgabe. Übernimm {{Variablen}} aus dem Original wenn vorhanden.",
  "ausgabe": "Format, Länge, Struktur, Sprachniveau",
  "extensions": {
    "examples": [],
    "rules": "",
    "reasoning": "",
    "verification": true/false,
    "verificationNote": "Konkreter Prüfauftrag: Worauf soll die KI ihre eigene Antwort überprüfen? z.B. Vollständigkeit, fachliche Korrektheit, Barrierefreiheit...",
    "reversePrompt": false,
    "negatives": "Was die KI NICHT tun soll. z.B. 'Keine Floskeln. Nicht spekulieren. Keine Aufzählungen ohne Erklärung.'"
  }
}
Regeln:
- act: Immer eine spezifische Expertenrolle ableiten, auch bei einfachen Alltags-Prompts
- context: Alle im Original enthaltenen Rahmenbedingungen extrahieren. {{Platzhalter}} beibehalten!
- task: Die Kernaufgabe als klare Anweisung formulieren
- ausgabe: Konkrete Formatvorgaben ableiten — wenn im Original keine stehen, sinnvolle Defaults setzen (z.B. "Strukturierte Antwort, max. 200 Wörter")
- verification: true wenn fachliche Korrektheit wichtig ist (Recht, Medizin, Finanzen, Compliance), false bei kreativen/alltäglichen Aufgaben
- verificationNote: NUR befüllen wenn verification=true. Dann konkreten Prüfauftrag formulieren.
- negatives: IMMER befüllen. Mindestens 2 Einschränkungen die typische KI-Schwächen adressieren.
- reasoning: "step-by-step" wenn die Aufgabe komplex ist, "" wenn einfach
- Alle Texte auf Deutsch`;

const SYSTEM_PROMPT_VERIFICATION = `Du bist ein Prompt-Engineering-Experte. Entscheide für den folgenden Prompt ob eine Selbstprüfung (verification) sinnvoll ist und formuliere ggf. eine verificationNote.
Antworte NUR mit JSON:
{
  "verification": true/false,
  "verificationNote": "Konkreter Prüfauftrag oder leer"
}
Regeln:
- verification: true wenn fachliche Korrektheit, Vollständigkeit oder Compliance wichtig ist
- verificationNote: Konkret und aufgabenspezifisch, z.B. "Prüfe auf AGG-Konformität und vollständige Aufgabenbeschreibung"
- Bei einfachen/kreativen Aufgaben: verification: false, verificationNote: ""`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function logError(title: string, error: string): void {
  const line = `[${new Date().toISOString()}] ${title}: ${error}\n`;
  appendFileSync(ERROR_LOG, line);
}

/** Run tasks with max concurrency */
async function promisePool<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  pauseMs: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
      if (pauseMs > 0) await sleep(pauseMs);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Parse prompts.ts as raw source (to preserve formatting)
// ---------------------------------------------------------------------------

function loadPromptsFromSource(): PromptItem[] {
  // We need to evaluate the TS file. Since we can't import path-aliased files
  // directly, we'll use a regex-based approach to extract the array.
  const source = readFileSync(PROMPTS_PATH, "utf-8");

  // Find the array start: look for "= [" after the declaration
  const marker = "export const promptLibrary: PromptItem[] = [";
  const startIdx = source.indexOf(marker);
  if (startIdx === -1) {
    throw new Error("Could not find promptLibrary in prompts.ts");
  }

  // The actual array "[" is at the end of the marker string
  const arrayStart = startIdx + marker.length - 1;

  // Use a bracket counter to find the matching ], handling strings and comments
  let depth = 0;
  let arrayEnd = -1;
  let inString = false;
  let stringChar = "";

  for (let i = arrayStart; i < source.length; i++) {
    const c = source[i];

    // Handle escape sequences in strings
    if (inString && c === "\\") {
      i++; // skip next char
      continue;
    }

    // Handle string boundaries
    if ((c === '"' || c === "'" || c === "`") && !inString) {
      inString = true;
      stringChar = c;
      continue;
    }
    if (inString && c === stringChar) {
      inString = false;
      continue;
    }

    // Handle line comments
    if (!inString && c === "/" && source[i + 1] === "/") {
      const nl = source.indexOf("\n", i);
      if (nl === -1) break;
      i = nl;
      continue;
    }

    // Handle block comments
    if (!inString && c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    if (!inString) {
      if (c === "[") depth++;
      if (c === "]") {
        depth--;
        if (depth === 0) {
          arrayEnd = i;
          break;
        }
      }
    }
  }

  if (arrayEnd === -1) {
    throw new Error("Could not find end of promptLibrary array");
  }

  let arrayContent = source.substring(arrayStart, arrayEnd + 1);

  // Strip TypeScript-specific syntax so it can be evaluated as plain JS
  arrayContent = arrayContent.replace(/\s+as\s+const\b/g, "");

  // Evaluate the array (valid JS with trailing commas support)
  const fn = new Function(`return ${arrayContent}`);
  const prompts = fn() as PromptItem[];
  return prompts;
}

// ---------------------------------------------------------------------------
// Generate actaFields for a prompt without them
// ---------------------------------------------------------------------------

async function generateActaFields(
  p: PromptItem,
  idx: number,
  total: number,
): Promise<ActaFields | null> {
  const userMsg = `Titel: ${p.title}\nKategorie: ${p.category}\nLevel: ${p.level ?? "alltag"}\nOriginal-Prompt: ${p.prompt}`;

  try {
    const raw = await callLLMWithRetry(SYSTEM_PROMPT_GENERATE, userMsg);
    const parsed = parseJSON<{
      act: string;
      context: string;
      task: string;
      ausgabe: string;
      extensions: {
        examples?: string[];
        rules?: string;
        reasoning?: string;
        verification?: boolean;
        verificationNote?: string;
        reversePrompt?: boolean;
        negatives?: string;
      };
    }>(raw);

    // Validate required fields
    if (!parsed.act || !parsed.task) {
      throw new Error("Missing act or task in response");
    }

    const fields: ActaFields = {
      act: parsed.act,
      context: parsed.context || "",
      task: parsed.task,
      ausgabe: parsed.ausgabe || "",
      extensions: {
        examples: parsed.extensions?.examples ?? [],
        rules: parsed.extensions?.rules ?? "",
        reasoning: parsed.extensions?.reasoning ?? "",
        verification: parsed.extensions?.verification ?? false,
        verificationNote: parsed.extensions?.verificationNote ?? "",
        reversePrompt: parsed.extensions?.reversePrompt ?? false,
        negatives: parsed.extensions?.negatives ?? "",
      },
    };

    const pad = String(total).length;
    console.log(
      `[${String(idx + 1).padStart(pad)}/${total}] ✅ ${p.title} — actaFields generiert`,
    );
    return fields;
  } catch (e) {
    const pad = String(total).length;
    console.error(
      `[${String(idx + 1).padStart(pad)}/${total}] ❌ ${p.title} — Fehler: ${(e as Error).message}`,
    );
    logError(p.title, (e as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Upgrade verification for prompts with actaFields but verification: false
// ---------------------------------------------------------------------------

async function upgradeVerification(
  p: PromptItem,
  idx: number,
  total: number,
): Promise<{ verification: boolean; verificationNote: string } | null> {
  const userMsg = JSON.stringify(p.actaFields, null, 2);

  try {
    const raw = await callLLMWithRetry(SYSTEM_PROMPT_VERIFICATION, userMsg);
    const parsed = parseJSON<{
      verification: boolean;
      verificationNote: string;
    }>(raw);

    const pad = String(total).length;
    if (parsed.verification) {
      console.log(
        `[${String(idx + 1).padStart(pad)}/${total}] ✅ ${p.title} — verification: true`,
      );
    } else {
      console.log(
        `[${String(idx + 1).padStart(pad)}/${total}] ⬜ ${p.title} — verification: false (beibehalten)`,
      );
    }

    return {
      verification: parsed.verification,
      verificationNote: parsed.verificationNote || "",
    };
  } catch (e) {
    const pad = String(total).length;
    console.error(
      `[${String(idx + 1).padStart(pad)}/${total}] ❌ ${p.title} — Fehler: ${(e as Error).message}`,
    );
    logError(p.title, (e as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Serialize a single PromptItem to TypeScript source
// ---------------------------------------------------------------------------

function serializePromptItem(p: PromptItem, indent: number = 2): string {
  const i = " ".repeat(indent);
  const i2 = " ".repeat(indent + 2);
  const i3 = " ".repeat(indent + 4);
  const i4 = " ".repeat(indent + 6);

  const lines: string[] = [];
  lines.push(`${i}{`);
  lines.push(`${i2}category: ${JSON.stringify(p.category)},`);
  lines.push(`${i2}title: ${JSON.stringify(p.title)},`);
  lines.push(`${i2}prompt: ${JSON.stringify(p.prompt)},`);

  if (p.needsWeb !== undefined) lines.push(`${i2}needsWeb: ${p.needsWeb},`);
  if (p.level) lines.push(`${i2}level: ${JSON.stringify(p.level)},`);
  if (p.type) lines.push(`${i2}type: ${JSON.stringify(p.type)},`);

  if (p.constraints) {
    lines.push(`${i2}constraints: ${JSON.stringify(p.constraints)},`);
  }
  if (p.acceptanceCriteria) {
    lines.push(`${i2}acceptanceCriteria: ${JSON.stringify(p.acceptanceCriteria)},`);
  }
  if (p.estimatedAgentTime) {
    lines.push(`${i2}estimatedAgentTime: ${JSON.stringify(p.estimatedAgentTime)},`);
  }
  if (p.requiredTools && p.requiredTools.length > 0) {
    lines.push(`${i2}requiredTools: ${JSON.stringify(p.requiredTools)},`);
  }
  if (p.department) lines.push(`${i2}department: ${JSON.stringify(p.department)},`);
  if (p.targetDepartment) {
    lines.push(`${i2}targetDepartment: ${JSON.stringify(p.targetDepartment)},`);
  }
  if (p.riskLevel) lines.push(`${i2}riskLevel: ${JSON.stringify(p.riskLevel)},`);
  if (p.official !== undefined) lines.push(`${i2}official: ${p.official},`);
  if (p.confidentiality) {
    lines.push(`${i2}confidentiality: ${JSON.stringify(p.confidentiality)},`);
  }
  if (p.confidentialityReason) {
    lines.push(`${i2}confidentialityReason: ${JSON.stringify(p.confidentialityReason)},`);
  }

  if (p.actaFields) {
    const af = p.actaFields;
    lines.push(`${i2}actaFields: {`);
    if (af.act) lines.push(`${i3}act: ${JSON.stringify(af.act)},`);
    if (af.context) lines.push(`${i3}context: ${JSON.stringify(af.context)},`);
    if (af.task) lines.push(`${i3}task: ${JSON.stringify(af.task)},`);
    if (af.ausgabe) lines.push(`${i3}ausgabe: ${JSON.stringify(af.ausgabe)},`);

    if (af.extensions) {
      const ext = af.extensions;
      lines.push(`${i3}extensions: {`);
      lines.push(`${i4}examples: ${JSON.stringify(ext.examples)},`);
      lines.push(`${i4}rules: ${JSON.stringify(ext.rules)},`);
      lines.push(`${i4}reasoning: ${JSON.stringify(ext.reasoning)},`);
      lines.push(`${i4}verification: ${ext.verification},`);
      lines.push(`${i4}verificationNote: ${JSON.stringify(ext.verificationNote)},`);
      lines.push(`${i4}reversePrompt: ${ext.reversePrompt},`);
      lines.push(`${i4}negatives: ${JSON.stringify(ext.negatives)},`);
      lines.push(`${i3}},`);
    }

    lines.push(`${i2}},`);
  }

  lines.push(`${i}},`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Generate full output file
// ---------------------------------------------------------------------------

function generateOutputFile(prompts: PromptItem[]): string {
  const header = `import type { PromptItem, PromptConstraints } from "@/types";

export type { PromptItem, PromptConstraints } from "@/types";

export const promptLibrary: PromptItem[] = [`;

  const body = prompts.map((p) => serializePromptItem(p)).join("\n");

  return `${header}\n${body}\n];\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🚀 RAKETE Migration — actaFields generieren\n");

  // Clear error log
  if (existsSync(ERROR_LOG)) {
    writeFileSync(ERROR_LOG, "");
  }

  // 1. Load prompts
  console.log("📖 Lade Prompts aus src/data/prompts.ts...");
  const prompts = loadPromptsFromSource();
  console.log(`   ${prompts.length} Prompts geladen.\n`);

  // 2. Identify prompts needing actaFields
  const needsActaFields: { prompt: PromptItem; originalIndex: number }[] = [];
  const needsVerification: { prompt: PromptItem; originalIndex: number }[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    if (!p.actaFields) {
      needsActaFields.push({ prompt: p, originalIndex: i });
    } else if (
      p.actaFields.extensions &&
      p.actaFields.extensions.verification === false &&
      !p.actaFields.extensions.verificationNote
    ) {
      needsVerification.push({ prompt: p, originalIndex: i });
    }
  }

  console.log(`📝 ${needsActaFields.length} Prompts ohne actaFields`);
  console.log(`🔍 ${needsVerification.length} Prompts mit verification: false\n`);

  // 3. Generate actaFields
  if (needsActaFields.length > 0) {
    console.log("--- actaFields generieren ---");
    const tasks = needsActaFields.map(
      ({ prompt: p }, idx) =>
        () =>
          generateActaFields(p, idx, needsActaFields.length),
    );

    const results = await promisePool(tasks, MAX_PARALLEL, BATCH_PAUSE_MS);

    // Apply results
    for (let i = 0; i < results.length; i++) {
      if (results[i]) {
        prompts[needsActaFields[i].originalIndex].actaFields = results[i]!;
      }
    }

    console.log("");
  }

  // 4. Upgrade verification
  if (needsVerification.length > 0) {
    console.log("--- Verification-Upgrade ---");
    const tasks = needsVerification.map(
      ({ prompt: p }, idx) =>
        () =>
          upgradeVerification(p, idx, needsVerification.length),
    );

    const results = await promisePool(tasks, MAX_PARALLEL, BATCH_PAUSE_MS);

    // Apply results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && prompts[needsVerification[i].originalIndex].actaFields?.extensions) {
        const ext = prompts[needsVerification[i].originalIndex].actaFields!.extensions!;
        ext.verification = result.verification;
        ext.verificationNote = result.verificationNote;
      }
    }

    console.log("");
  }

  // 5. Write output
  console.log("💾 Schreibe src/data/prompts.generated.ts...");
  const output = generateOutputFile(prompts);
  writeFileSync(OUTPUT_PATH, output, "utf-8");

  // 6. Summary
  const withActa = prompts.filter((p) => p.actaFields).length;
  const withVerification = prompts.filter(
    (p) => p.actaFields?.extensions?.verification,
  ).length;

  console.log(
    `\n✅ Ergebnis: src/data/prompts.generated.ts geschrieben (${prompts.length} Prompts, ${withActa} mit actaFields, ${withVerification} mit verification)`,
  );

  if (existsSync(ERROR_LOG)) {
    const errors = readFileSync(ERROR_LOG, "utf-8").trim();
    if (errors) {
      console.log(`\n⚠️ Fehler bei einigen Prompts — siehe scripts/errors.log`);
    }
  }
}

main().catch((e) => {
  console.error("💥 Fataler Fehler:", e);
  process.exit(1);
});

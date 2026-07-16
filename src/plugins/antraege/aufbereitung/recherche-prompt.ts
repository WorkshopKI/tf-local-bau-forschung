/**
 * Deep-Research-Prompt-Baustein der Antrag-Aufbereitung (Paket 5, Phase 1, nur dev).
 * EIN interner Lauf erzeugt aus dem Korpus einen anonymen Deep-Research-Auftrag, den der
 * Prüfer per Zwischenablage in externe Dienste (ChatGPT/Claude/Mistral) trägt.
 *
 * Läuft ZUERST (vor den übrigen Bausteinen), damit die externe Recherche (5–10 Min)
 * parallel zur internen Aufbereitung starten kann. Bevorzugt den agentischen Qwen-Tab
 * (`ziel:'agentisch'`, Standard-Fallback im Rahmen). DSGVO: Constraints im Skill-Prompt
 * (Schicht 1) + deterministischer Leak-Check nach dem Parse (Schicht 2) — ein Treffer
 * degradiert den Baustein (Prompt wird dann nicht zum Kopieren angeboten, nur einsehbar).
 * Reine Funktionen (Node-testbar); Cache-/Transport-Rahmen in `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import {
  getOrComputeBaustein, recherchePromptCacheKey, vbHashFuer, type BausteinResult,
} from './bausteine';
import { extractLastJsonObject } from './steckbrief';
import { drSchemaBlockBeschreibung, RECHERCHE_SCHEMA_VERSION } from './recherche-schema';
import { findeLeaks, type BekannteStammwerte } from './recherche-leak';

/** Der erzeugte DR-Auftrag (der gecachte Baustein-Datensatz). */
export interface RecherchePromptDaten {
  schemaVersion: number;
  /** Der vollständige Deep-Research-Auftragstext (zum Kopieren in externe Dienste). */
  prompt: string;
}

/** Ab dieser Länge gilt der erzeugte Prompt als brauchbar (sonst degradiert). */
export const RECHERCHE_PROMPT_MIN_LEN = 300;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildRecherchePromptPrompt(vbMarkdown: string): string {
  return `Du erzeugst aus der folgenden Vorhabensbeschreibung (VB) EINEN deutschen Deep-Research-Auftrag für ein externes Recherche-Modell. Der Auftrag beschreibt AUSSCHLIESSLICH das Themengebiet des Vorhabens (Technologiefeld, Problemklasse, angestrebte Leistungsklasse) — in neutraler, analytischer Sprache.

## Vorhabensbeschreibung (Quelle — bleibt intern)
${vbMarkdown}

## Harte Anonymisierungs-Regeln (Pflicht)
Der erzeugte Auftrag enthält NIEMALS: Antragsteller-/Firmennamen, Förderkennzeichen oder Aktenzeichen, Personennamen, konkrete Ortsangaben aus den Stammdaten, oder wörtliche VB-Passagen. KEIN Behördenkontext — die Wörter „Förderantrag", „Prüfer", „Gutachten", „ZIM", „Fördermittel" kommen NICHT vor. Formuliere als neutralen Analysten-Auftrag.

## Aufbau des Auftrags (zwei Teile)
1. **Stand der Technik** zum Themengebiet: etablierte Verfahren/Technologien, aktuelle Forschung, Kennwerte/Leistungsklassen, Lücken.
2. **Markt & Wettbewerb**: Marktgröße/-wachstum, relevante Anbieter/Wettbewerber, vergleichbare Produkte/Lösungen, Trends.

Der Auftrag fordert das externe Modell auf, seinen Report zu BELEGEN (Quellen mit URL) und am Ende ZUSÄTZLICH genau einen JSON-Codeblock dieser Form anzufügen:
${drSchemaBlockBeschreibung()}

## Ausgabe
Antworte AUSSCHLIESSLICH mit genau EINEM JSON-Codeblock in genau dieser Form — kein Fließtext davor oder danach:
\`\`\`json
{ "schemaVersion": ${RECHERCHE_SCHEMA_VERSION}, "prompt": "<der vollständige Deep-Research-Auftragstext, mehrzeilig>" }
\`\`\``;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

/** Liest `{ schemaVersion, prompt }` aus dem letzten JSON-Objekt. `null` bei kaputt/leer. */
export function parseRecherchePrompt(raw: string): RecherchePromptDaten | null {
  const obj = extractLastJsonObject(raw);
  if (!obj) return null;
  const prompt = typeof obj.prompt === 'string' ? obj.prompt.trim() : '';
  if (!prompt) return null;
  const schemaVersion = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : RECHERCHE_SCHEMA_VERSION;
  return { schemaVersion, prompt };
}

// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen + Leak-Check)
// ---------------------------------------------------------------------------

export async function computeRecherchePromptBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  vbMarkdown: string,
  bekannteWerte: BekannteStammwerte,
  opts?: { force?: boolean },
): Promise<BausteinResult<RecherchePromptDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  // Leak-Treffer aus dem `verdaechtig`-Guard heben (der Guard läuft auf dem FINALEN
  // Ergebnis; so wird ein Prompt mit identifizierender Angabe NIE gecacht).
  let leakTreffer: string[] = [];
  const res = await getOrComputeBaustein<RecherchePromptDaten>(
    idb, transport, skill,
    recherchePromptCacheKey(antragKey, vbHash), vbHash,
    () => buildRecherchePromptPrompt(vbMarkdown),
    (raw) => parseRecherchePrompt(raw),
    {
      ...opts,
      ziel: 'agentisch',
      verdaechtig: {
        pruefe: (d) => {
          if (d.prompt.trim().length < RECHERCHE_PROMPT_MIN_LEN) return true;
          leakTreffer = findeLeaks(d.prompt, bekannteWerte);
          return leakTreffer.length > 0;
        },
        grund: 'Recherche-Prompt zu kurz oder unbrauchbar',
      },
    },
  );
  // Leak → spezifische Begründung (Schicht 2). Der Prompt bleibt über `rohtext`
  // einsehbar (mit Warnung im Tab), wird aber nicht zum Kopieren angeboten.
  if (res.status === 'degradiert' && leakTreffer.length > 0) {
    return {
      ...res,
      begruendung: `Identifizierende Angabe im Recherche-Prompt: ${[...new Set(leakTreffer)].join(', ')}`,
    };
  }
  return res;
}

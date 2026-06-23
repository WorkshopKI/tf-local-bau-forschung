/**
 * DSGVO-Transport-Policy — zentrale, fail-safe Klassifizierung + Ableitung.
 *
 * Zweck: die harte Regel „Dokumentinhalte nie an externe APIs" wird **im Code
 * erzwungen** statt nur per Build-Flag. Dokument-tragende Läufe (Generierung
 * **und** QS, Batch, Metadata) dürfen nur auf einem internen Transport landen.
 *
 * Ehrliche Einordnung: ändert das **Prod-Verhalten nicht** — OpenRouter ist in
 * Prod-Builds via `isOpenRouterEnabled()` bereits aus. Wert = **Defense-in-Depth**:
 * eine zweite Verteidigungslinie unterhalb des Build-Flags, mit Convention-Test
 * gegen Regression (`no-raw-active-transport`). Schaltet später einen In-App-Judge
 * über reale Daten (intern-only) frei.
 *
 * Leitplanken: fail-safe Default `intern`; **Ableitung schlägt Flag** (referenziert
 * ein Skill-Template einen Inhalts-Slot, ist es intern-pflichtig — egal was ein
 * expliziter Flag sagt); **erzwingen statt dokumentieren**.
 *
 * Hinweis: Der Dev-Eval-Harness (`src/core/services/skill-eval/`) ist von dieser
 * Policy ausgenommen — er hat eine eigene Fiktiv-Daten-Policy.
 */

export type TransportKlasse = 'intern' | 'extern';

/**
 * Klassifiziert einen Provider anhand von Typ + Endpoint. `openrouter` ist immer
 * extern; zusätzlich greift eine Endpoint-Heuristik (alter Storage-Eintrag mit
 * `type !== 'openrouter'`, dessen Endpoint trotzdem auf OpenRouter zeigt). Alles
 * andere (streamlit, lokales llama.cpp, internes Modell) gilt als intern.
 */
export function classifyProvider(cfg: { type: string; endpoint?: string }): TransportKlasse {
  const extern = cfg.type === 'openrouter'
    || (typeof cfg.endpoint === 'string' && cfg.endpoint.includes('openrouter'));
  return extern ? 'extern' : 'intern';
}

/**
 * Welche Transport-Klassen ein Lauf nutzen darf: dokument-tragend → nur intern;
 * inhaltsfrei → intern oder extern.
 */
export function erlaubteTransportKlassen(p: { enthaeltDokumentInhalte: boolean }): TransportKlasse[] {
  return p.enthaeltDokumentInhalte ? ['intern'] : ['intern', 'extern'];
}

/**
 * Slots, deren Befüllung Dokument-/Antragsinhalte ins Prompt trägt. Referenziert
 * ein Skill-Template einen davon, ist der Lauf inhalts-tragend (intern-pflichtig).
 * `zielText` (LLM-QS) + `vorherigeAbschnitte` (Vorkontext) + `vbRelevant`
 * (Relevanz-Map-Auszug) zählen mit — sonst gälte ein nur-`{{vbRelevant}}`-Skill
 * fälschlich als inhaltsfrei und dürfte extern laufen (DSGVO-Leck).
 * `tvKontext` + `verbundKontext` (NF: TV-/Verbund-VB-Analyse) zählen ebenfalls mit;
 * `nfBausteine` (kuratierter Katalog) ist kein Dokumentinhalt, wird aber fail-safe
 * mitgezählt, da NF-Läufe ohnehin intern-pflichtig sind (Pitfall #30).
 * `entwurf` (Lektor-Zweitpass) trägt den VB-abgeleiteten Entwurfstext → ein Skill
 * mit content-tragendem `lektorPromptTemplate` ist intern-pflichtig.
 */
const INHALTS_SLOTS = [
  'vbMarkdown', 'stammdaten', 'zielText', 'vorherigeAbschnitte', 'vbRelevant',
  'tvKontext', 'verbundKontext', 'nfBausteine', 'entwurf',
];

/**
 * Referenziert das Template einen Inhalts-Slot? Basis der Ableitung — ist sie
 * `true`, ist der Skill intern-pflichtig und ein expliziter Flag wirkungslos
 * (die Ableitung schlägt den Flag). Die UI nutzt das, um den Override als inert
 * zu kennzeichnen, wenn ein Slot das Verdikt erzwingt.
 */
export function templateReferenziertInhaltsSlot(promptTemplate: string): boolean {
  return INHALTS_SLOTS.some(s => promptTemplate.includes('{{' + s + '}}'));
}

/**
 * Ist ein Skill dokument-tragend? **Ableitung schlägt Flag**: referenziert das
 * `promptTemplate` ODER das `lektorPromptTemplate` einen Inhalts-Slot, ist die
 * Antwort `true` — unabhängig vom expliziten `enthaeltDokumentInhalte`. Nur ohne
 * Inhalts-Slot greift der Flag; fehlt er, gilt der fail-safe Default `true` (lieber
 * unnötig intern als versehentlich extern). Der Lektor-Pass wird mitgeprüft, damit
 * ein Skill mit content-freiem `promptTemplate`, aber content-tragendem
 * `lektorPromptTemplate` (`{{entwurf}}`) NICHT als extern-erlaubt durchrutscht.
 */
export function skillEnthaeltDokumentInhalte(
  skill: { promptTemplate: string; lektorPromptTemplate?: string; enthaeltDokumentInhalte?: boolean },
): boolean {
  if (templateReferenziertInhaltsSlot(skill.promptTemplate)) return true;  // Ableitung schlägt Flag
  if (skill.lektorPromptTemplate && templateReferenziertInhaltsSlot(skill.lektorPromptTemplate)) return true;
  return skill.enthaeltDokumentInhalte ?? true;                            // fail-safe Default
}

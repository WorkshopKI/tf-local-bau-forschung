/**
 * „Abnahme-Kriterien aus der Prompt-Vorlage ableiten" — ein einmaliger interner
 * LLM-Lauf, der aus dem `promptTemplate` eines Skills VORSCHLÄGE für prüfbare
 * Kriterien liest (`SkillRecord.qsKriterien`).
 *
 * Bewusst REGISTRY-FREI: kein Seed-Skill, kein Registry-Write. Das hier ist ein
 * Editor-Hilfsmittel, kein kuratierter Arbeitsschritt — ein Seed-Skill dafür
 * wäre prod-wirksames Inventar für eine reine Eingabehilfe (und bräche die
 * Zähl-Assertion der Seed-Kohärenz).
 *
 * Harte Invarianten (Muster: `core/services/feedback/feedbackImprove.ts`):
 *  1. NUR interne KI. Prompt-Vorlagen sind dokumentnah zu behandeln — kein
 *     OpenRouter, egal welcher Transport gerade aktiv ist.
 *  2. Immer der gpt-oss, nie der agentische: enger, einschüssiger
 *     Listen-Auftrag ohne Mehrwert durch Agentik.
 *  3. Frischer Chat VOR dem Submit (Pitfall #36) — der Streamlit-Chat ist stateful.
 *  4. Wirft NIE. Misserfolg ⇒ `null`; der Kurator tippt dann von Hand.
 *  5. Liefert nur VORSCHLÄGE. Übernommen und gespeichert wird ausschließlich
 *     durch den Menschen über den normalen Verwaltungs-Pfad (neue Skill-Version).
 *
 * `StreamlitBridgeTransport.submitMessage` ignoriert den System-Prompt-Parameter
 * — er wird deshalb in die Message inlined und bleibt zusätzlich als 2. Argument
 * (DirectLLM nutzt ihn als System-Rolle).
 */
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import { starteFrischenChat } from '@/core/services/ai/chat-reset';

/** Interner Logik-Name des Bridge-Transports (Capability-/Domain-Gate). */
const INTERNE_KI = 'Streamlit';

/** Ziel-Tab für die Ableitung — siehe Invariante 2. */
const ABLEITUNG_ZIEL: KiRolle = 'standard';

/** Obergrenze der übernommenen Vorschläge (der Editor bleibt überschaubar). */
export const MAX_VORSCHLAEGE = 8;

/** Obergrenze eines einzelnen Kriteriums (ein Satz, keine Absätze). */
const MAX_KRITERIUM_LAENGE = 160;

const SYSTEM_PROMPT =
  'Du unterstützt die Kuration von KI-Arbeitsschritten für Förderantrags-Gutachten. '
  + 'Aus einer Prompt-Vorlage leitest du prüfbare Abnahme-Kriterien ab — Sätze, an denen '
  + 'ein Mensch später erkennen kann, ob ein erzeugter Abschnitt taugt. Antworte '
  + 'ausschließlich auf Deutsch und ausschließlich im vorgegebenen Format.';

/**
 * Baut den Ableitungs-Auftrag. Rein — damit der Prompt ohne Transport getestet
 * werden kann und Änderungen daran sichtbar im Diff stehen.
 */
export function buildAbleitungsPrompt(skillName: string, promptTemplate: string): string {
  return [
    `Arbeitsschritt: „${skillName}"`,
    '',
    'Prompt-Vorlage:',
    '---',
    promptTemplate.trim(),
    '---',
    '',
    'Aufgabe: Leite aus dieser Vorlage die Abnahme-Kriterien ab, an denen sich das Ergebnis '
    + 'prüfen lässt. Ein Kriterium ist EIN kurzer, nachprüfbarer Satz über den erzeugten Text '
    + `(z.B. „Aussagen durch den Antrag belegt" oder „Risiken auf den Lösungsweg bezogen, `
    + 'nicht allgemein").',
    '',
    'Regeln:',
    `- Höchstens ${MAX_VORSCHLAEGE} Kriterien, je einer pro Zeile, beginnend mit „- ".`,
    '- Keine Zeichen-, Wort- oder Satzzahlen — Umfang prüft ein separates System.',
    '- Keine Überschrift, keine Nummerierung, keine Begründung, kein Fließtext davor oder danach.',
    '- Nur Kriterien, die aus dieser Vorlage folgen; erfinde keine fremden Anforderungen.',
  ].join('\n');
}

/**
 * Liest die Kriterien-Zeilen aus der Modell-Antwort. Tolerant: akzeptiert
 * `-`/`*`/`•`-Aufzählungen und nackte Zeilen, wirft Nummerierungen weg, kappt
 * Länge und Anzahl, dedupliziert. Rein + testbar.
 */
export function parseKriterienVorschlaege(raw: string): string[] {
  const zeilen = (raw ?? '').split('\n');
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const zeile of zeilen) {
    // Überschriften sind keine Kriterien — die Zeile ganz überspringen, statt nur
    // die Rauten zu strippen (sonst landete „## Kriterien" als Vorschlag im Panel).
    if (/^\s*#/.test(zeile)) continue;
    const k = zeile
      .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')   // Aufzählungs-/Nummerierungs-Marker
      .replace(/\s+/g, ' ')
      .trim();
    // Zu kurz = kein Satz; zu lang = Fließtext statt Kriterium.
    if (k.length < 8 || k.length > MAX_KRITERIUM_LAENGE) continue;
    const key = k.toLowerCase();
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(k);
    if (out.length >= MAX_VORSCHLAEGE) break;
  }
  return out;
}

/**
 * Fährt die Ableitung. `null`, wenn kein interner Transport aktiv/erreichbar ist
 * oder nichts Verwertbares zurückkam — der Aufrufer meldet das als Hinweis, nicht
 * als Fehler. Wirft nie (Invariante 4).
 */
export async function leiteQsKriterienAb(
  transport: AITransport,
  skillName: string,
  promptTemplate: string,
): Promise<string[] | null> {
  if (transport.name !== INTERNE_KI) return null;
  if (!promptTemplate.trim()) return null;
  try {
    if (!(await transport.ping({ openIfNeeded: false }))) return null;
    const prompt = buildAbleitungsPrompt(skillName, promptTemplate);
    await starteFrischenChat(transport, ABLEITUNG_ZIEL);
    const raw = await transport.submitMessage(
      `${SYSTEM_PROMPT}\n\n${prompt}`,
      SYSTEM_PROMPT,
      { ziel: ABLEITUNG_ZIEL },
    );
    const vorschlaege = parseKriterienVorschlaege(raw);
    return vorschlaege.length > 0 ? vorschlaege : null;
  } catch (err) {
    console.warn('[qs-kriterien] Ableitung fehlgeschlagen:', err);
    return null;
  }
}

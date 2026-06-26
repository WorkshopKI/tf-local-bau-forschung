/**
 * Finalisierung — DETERMINISTISCHE Wiedereinsetzung der Originaldaten.
 *
 * Kein LLM für die De-Anonymisierung: reines Find-Replace `platzhalter → original`
 * über die Mapping-Tabelle. Verlässlich, kein Halluzinationsrisiko.
 *
 * Optionaler interner Polish läuft VOR der Wiedereinsetzung auf der anonymen
 * Antwort — so kann das Glätten die echten Werte nicht verändern (Anti-Pattern:
 * Polish NIE nach der Wiedereinsetzung). Default: aus.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { runSkill, type SkillRecord } from '@/core/services/skills';
import { safeResetChat } from '@/core/services/ai/chat-reset';
import type { KindedSegment } from '../highlight';
import type { Mapping } from '../types';

const PLATZHALTER_RE = /\[[A-Z][A-Z0-9_]*_\d+\]/g;

export interface PlatzhalterPruefung {
  /** Im Mapping deklariert, aber in der Antwort nicht (mehr) vorhanden. */
  fehlend: string[];
  /** In der Antwort vorhanden, aber im Mapping unbekannt → bleibt stehen. */
  unbekannt: string[];
}

export function pruefePlatzhalter(antwortAnon: string, mapping: Mapping[]): PlatzhalterPruefung {
  const bekannt = new Set(mapping.map(m => m.platzhalter));
  const fehlend = [...new Set(mapping.filter(m => !antwortAnon.includes(m.platzhalter)).map(m => m.platzhalter))];
  const gefunden = new Set(antwortAnon.match(PLATZHALTER_RE) ?? []);
  const unbekannt = [...gefunden].filter(p => !bekannt.has(p));
  return { fehlend, unbekannt };
}

/** Deterministische Wiedereinsetzung: jeder Platzhalter → sein Original. */
export function wiedereinsetzen(antwortAnon: string, mapping: Mapping[]): string {
  // Längere Platzhalter zuerst (defensiv; [PERSON_1] ist ohnehin kein Teilstring
  // von [PERSON_10] dank schließender Klammer).
  const sorted = [...mapping].sort((a, b) => b.platzhalter.length - a.platzhalter.length);
  let out = antwortAnon;
  for (const m of sorted) out = out.split(m.platzhalter).join(m.original);
  return out;
}

/**
 * Wie `wiedereinsetzen`, aber segmentiert für die Anzeige: jeder eingesetzte
 * Originalwert wird als `kind:'placeholder'` markiert (blau hervorhebbar). Der
 * Klartext (`.map(s => s.text).join('')`) ist identisch zu `wiedereinsetzen`.
 * Unbekannte Platzhalter (kein Mapping-Eintrag) bleiben unmarkiert stehen.
 */
export function wiedereinsetzenSegmente(antwortAnon: string, mapping: Mapping[]): KindedSegment[] {
  const repl = new Map<string, string>();
  for (const m of mapping) if (!repl.has(m.platzhalter)) repl.set(m.platzhalter, m.original);
  const segs: KindedSegment[] = [];
  let last = 0;
  for (const match of antwortAnon.matchAll(PLATZHALTER_RE)) {
    const idx = match.index;
    if (idx === undefined) continue;
    if (idx > last) segs.push({ text: antwortAnon.slice(last, idx), kind: null });
    const orig = repl.get(match[0]);
    segs.push(orig !== undefined ? { text: orig, kind: 'placeholder' } : { text: match[0], kind: null });
    last = idx + match[0].length;
  }
  if (last < antwortAnon.length) segs.push({ text: antwortAnon.slice(last), kind: null });
  return segs;
}

/**
 * Transienter (NICHT geseedeter) Polish-Skill. `{{zielText}}` erzwingt über die
 * Transport-Policy einen internen Transport. Template-basiert (für die unkritische
 * Glättung der bereits anonymen Antwort bewusst kein Registry-Skill).
 */
const POLISH_SKILL: SkillRecord = {
  id: 'anfrage-antwort-polish',
  name: 'Anfrage-Antwort glätten',
  beschreibung: 'Glättet die anonyme Antwort sprachlich, ohne Platzhalter zu verändern (intern).',
  version: 1,
  promptTemplate: [
    'Glätte die folgende (anonymisierte) Antwort sprachlich und formal, ohne Inhalte zu erfinden.',
    'Lasse ALLE Platzhalter im Format [TYP_N] unverändert stehen (nicht entfernen, nicht umbenennen).',
    'Gib AUSSCHLIESSLICH den geglätteten Text zurück:',
    '',
    '{{zielText}}',
  ].join('\n'),
  systemPrompt: 'Du bist ein Lektor. Verbessere Stil und Lesbarkeit, erfinde keine Inhalte, '
    + 'und lasse alle [TYP_N]-Platzhalter exakt unverändert.',
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['zielText'],
  geaendert_am: '2026-06-25T00:00:00.000Z',
  enthaeltDokumentInhalte: true,
};

/** Optionaler interner Polish der ANONYMEN Antwort (vor der Wiedereinsetzung). */
export async function polishAntwort(bridge: AIBridge, antwortAnon: string): Promise<string> {
  const transport = bridge.getTransportForSkillRun(POLISH_SKILL);
  const ok = await transport.ping();
  if (!ok) throw new Error('Interne KI nicht erreichbar — Glätten nicht möglich.');
  await safeResetChat(transport); // frischer Kontext vor dem Polish-Lauf
  const result = await runSkill(transport, POLISH_SKILL, [], {
    stammdaten: '',
    vbMarkdown: '',
    zielText: antwortAnon,
    // Interne KI denkt immer → <think>…</think> inline; thinkingBudget !== 'none'
    // aktiviert NUR die extractThinking-Bereinigung in runSkill (kein Streaming-
    // Trigger ohne Delta-Consumer → robuster non-streaming-Pfad). Siehe anonymisierung.ts.
    thinkingBudget: 'medium',
  });
  return result.parsed.finalerText.trim() || antwortAnon;
}

/**
 * Erzeugt die finale, mail-fertige Antwort: (optional intern geglättet →)
 * deterministisch wiedereingesetzt. `polish: undefined` = kein LLM (reiner
 * deterministischer Pfad, Default).
 */
export async function finalisiere(
  antwortAnon: string,
  mapping: Mapping[],
  polish?: (anon: string) => Promise<string>,
): Promise<string> {
  const anon = polish ? await polish(antwortAnon) : antwortAnon;
  return wiedereinsetzen(anon, mapping);
}

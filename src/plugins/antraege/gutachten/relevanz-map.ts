/**
 * Relevanz-Map — kuratierter VB-Kontext statt Volltext (Testballon).
 *
 * Statt 30–60 Seiten Vorhabensbeschreibung (VB) in JEDEN Gutachten-Skill zu
 * kippen, wählt EIN interner LLM-Lauf antragsweit für jeden Gutachten-Abschnitt
 * die relevanten VB-Sektionen aus — **wortgetreu, per Heading verankert**
 * (Auswählen, NICHT Zusammenfassen). Das System rekonstruiert daraus den
 * Originaltext per Span; der Folge-Skill bekommt nur den fokussierten Teilkontext.
 *
 * Leitprinzipien (verbindlich):
 *  - **Auswählen statt zusammenfassen** — Map liefert Heading-IDs; der Volltext
 *    kommt per Span aus `vbMarkdown`. Niemals Paraphrase.
 *  - **Antragsweit, einmal, gecacht** — eine Map pro Antrag (alle Abschnitte in
 *    einem Lauf), Cache im IDB-`kv`-Store per VB-Hash (kein neuer Object-Store,
 *    Pitfall #29). Neuberechnung nur bei VB-Änderung.
 *  - **Recall vor Precision** — großzügig auswählen; Fehlerpfade degradieren
 *    still zu Volltext (nie scheitern).
 *  - **Tolerantes Parsing** — gpt-oss/llama.cpp honoriert Sampler/Grammar nicht
 *    zuverlässig → freie Heading-ID-Extraktion, kein erzwungenes JSON.
 *
 * Reine, transport-agnostische Helfer (so auch vom Node-Eval-Harness nutzbar);
 * der LLM-Lauf bekommt den Transport injiziert — das DSGVO-Gate
 * (`bridge.getTransportForSkillRun`, Pitfall #30) liegt beim Caller.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, ConversationMessage } from '@/core/services/ai/transports/streamlit';
import { hashText } from './runner';

/** Eine VB-Sektion: stabile ID + Überschrift + Zeichen-Span in `vbMarkdown`. */
export interface VbHeading {
  /** `h-intro` (Vorspann vor dem ersten Heading) oder `h0`, `h1`, … (Dokumentreihenfolge). */
  id: string;
  heading: string;
  /** Span `[start … end)` in `vbMarkdown` — Heading-Zeilenanfang bis zum nächsten Heading / EOF. */
  start: number;
  end: number;
}

/** Ein Gutachten-Teil, für den ausgewählt wird (Workflow-Schritt: id + Label). */
export interface RelevanzAbschnitt {
  id: string;
  label: string;
}

/** Map: Gutachten-Abschnitt-ID → relevante VB-Heading-IDs (Dokumentreihenfolge egal, wird beim Assemble sortiert). */
export type RelevanzMap = Record<string, string[]>;

/** Ergebnis von `getOrComputeRelevanzMap`: die geparsten Headings + die (ggf. leere) Map. */
export interface RelevanzMapResult {
  headings: VbHeading[];
  map: RelevanzMap;
}

/**
 * Schwelle, ab der sich der Relevanz-Lauf lohnt. Unter ~24k Zeichen (≈ 8 Seiten)
 * passt die VB bequem ins Kontextfenster und konkurriert kaum mit dem Prompt →
 * Volltext genügt, der teure Map-Lauf bleibt aus. Bewusst konservativ
 * (Recall > Precision); per Eval nachschärfbar.
 */
export const RELEVANZ_MAP_MIN_CHARS = 24_000;

const RELEVANZ_MAP_MAX_TOKENS = 1024;

/** True, wenn die VB groß genug ist, dass sich der Relevanz-Lauf lohnt. */
export function vbBrauchtRelevanzMap(md: string, schwelle = RELEVANZ_MAP_MIN_CHARS): boolean {
  return md.length > schwelle;
}

/** kv-Cache-Key: pro Antrag + VB-Hash (Neuberechnung nur bei VB-Änderung). */
export function relevanzMapCacheKey(antragKey: string, vbHash: string): string {
  return `relevanz-map:${antragKey}:${vbHash}`;
}

/**
 * Zerlegt das VB-Markdown an H2/H3-Überschriften in nummerierte Sektionen mit
 * Zeichen-Spans (Muster wie `contextual-chunker.ts`). Vorspann vor dem ersten
 * Heading wird als `h-intro` geführt (sonst wäre Antragstext „unsichtbar"). Ohne
 * jedes Heading: das ganze Dokument als eine `h-intro`-Sektion.
 */
export function parseVbHeadings(md: string): VbHeading[] {
  const re = /^#{2,3}\s+(.+)$/gm;
  const marks: { heading: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    marks.push({ heading: m[1]!.trim(), start: m.index });
  }
  if (marks.length === 0) {
    return md.trim() ? [{ id: 'h-intro', heading: '(Einleitung)', start: 0, end: md.length }] : [];
  }
  const out: VbHeading[] = [];
  const firstStart = marks[0]!.start;
  if (md.slice(0, firstStart).trim()) {
    out.push({ id: 'h-intro', heading: '(Einleitung)', start: 0, end: firstStart });
  }
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i]!.start;
    const end = i + 1 < marks.length ? marks[i + 1]!.start : md.length;
    out.push({ id: `h${i}`, heading: marks[i]!.heading, start, end });
  }
  return out;
}

/**
 * Baut den Relevanz-Prompt: nummerierte Heading-Liste + die Gutachten-Teile +
 * die VOLLE VB. Fordert je Teil die relevanten Heading-IDs (markierter Freitext,
 * KEIN erzwungenes JSON) und schärft „großzügig auswählen, nicht zusammenfassen".
 */
export function buildRelevanzPrompt(
  headings: VbHeading[],
  vbMarkdown: string,
  abschnitte: RelevanzAbschnitt[],
): string {
  const headingList = headings.map(h => `[${h.id}] ${h.heading}`).join('\n');
  const abschnittList = abschnitte.map(a => `- ${a.id}: ${a.label}`).join('\n');
  return `Du ordnest die Abschnitte einer Vorhabensbeschreibung (VB) den Teilen eines ZIM-Gutachtens zu.

## VB-Abschnitte (nummeriert)
${headingList}

## Gutachten-Teile, für die ausgewählt werden soll
${abschnittList}

## Vollständige Vorhabensbeschreibung
${vbMarkdown}

## Aufgabe
Wähle für JEDEN Gutachten-Teil die VB-Abschnitte (Heading-IDs) aus, die für ihn inhaltlich relevant sind.
- Wähle **großzügig** — lieber einen Abschnitt zu viel als einen tragenden Abschnitt zu verpassen.
- **Fasse NICHTS zusammen** und gib KEINEN Fließtext aus — ausschließlich die Heading-IDs.
- Nutze nur die oben vergebenen IDs (\`h0\`, \`h1\`, … bzw. \`h-intro\`).

## Ausgabeformat (genau eine Zeile je Gutachten-Teil)
<teil-id>: h0, h3, h7
(Beispiel — beziehe dich auf die echten IDs oben.)`;
}

/**
 * Tolerantes Parsing der LLM-Antwort → Map (Gutachten-Teil-ID → Heading-IDs).
 * Robust gegen Müll: je Zeile wird die Teil-ID (letztes Token vor dem Doppelpunkt,
 * Markdown-Deko entfernt) und die bekannten Heading-IDs nach dem Doppelpunkt
 * extrahiert; Unbekanntes/Doppeltes verworfen, leeres Ergebnis erlaubt. KEIN Throw.
 */
export function parseRelevanzMap(raw: string, headingIds: string[]): RelevanzMap {
  const known = new Set(headingIds);
  const out: RelevanzMap = {};
  for (const line of raw.split('\n')) {
    const ci = line.indexOf(':');
    if (ci < 0) continue;
    const tokens = line.slice(0, ci).replace(/[*_`#>\-]/g, ' ').trim().split(/\s+/).filter(Boolean);
    const key = tokens.length ? tokens[tokens.length - 1]! : '';
    if (!key) continue;
    const ids = (line.slice(ci + 1).match(/h-intro|h\d+/g) ?? []).filter(id => known.has(id));
    if (ids.length === 0) continue;
    const merged = new Set([...(out[key] ?? []), ...ids]);
    out[key] = [...merged];
  }
  return out;
}

/** Kürzt einen Text am letzten Absatzumbruch vor dem Cap (analog `context-provider.ts`). */
function cutAtParagraph(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const slice = text.slice(0, cap);
  const lastBreak = slice.lastIndexOf('\n\n');
  const cut = lastBreak > cap * 0.5 ? slice.slice(0, lastBreak) : slice;
  return `${cut.trimEnd()}\n\n…`;
}

/**
 * Setzt den wortgetreuen `{{vbRelevant}}`-Block für einen Abschnitt zusammen: die
 * getaggten VB-Sektionen per Span aus `vbMarkdown`, in **Dokumentreihenfolge**,
 * bis `budgetChars` erschöpft ist. Gibt `''` zurück, wenn die Map den Abschnitt
 * nicht kennt (→ der Caller fällt auf Volltext zurück).
 */
export function assembleVbRelevant(
  map: RelevanzMap,
  headings: VbHeading[],
  vbMarkdown: string,
  abschnittId: string,
  budgetChars: number,
): string {
  const idSet = new Set(map[abschnittId] ?? []);
  if (idSet.size === 0) return '';
  // `headings` ist bereits in Dokumentreihenfolge → Auswahl bleibt geordnet.
  const parts: string[] = [];
  let used = 0;
  for (const h of headings) {
    if (!idSet.has(h.id)) continue;
    const section = vbMarkdown.slice(h.start, h.end).trim();
    if (!section) continue;
    if (used + section.length > budgetChars) {
      const remaining = budgetChars - used;
      if (remaining > 500) parts.push(cutAtParagraph(section, remaining));
      break;
    }
    parts.push(section);
    used += section.length + 2;
  }
  return parts.join('\n\n');
}

/**
 * Fährt den Relevanz-Lauf über den (injizierten, internen) Transport und gibt die
 * rohe Antwort zurück (Parsing macht der Caller). Bevorzugt `submitConversation`
 * (DirectLLM), fällt auf `submitMessage` zurück (Streamlit-Bridge, single-turn).
 */
export async function runRelevanzMap(
  transport: AITransport,
  relevanzSkill: SkillRecord,
  headings: VbHeading[],
  vbMarkdown: string,
  abschnitte: RelevanzAbschnitt[],
): Promise<string> {
  const prompt = buildRelevanzPrompt(headings, vbMarkdown, abschnitte);
  const system = relevanzSkill.systemPrompt ?? '';
  const maxTokens = relevanzSkill.maxTokens ?? RELEVANZ_MAP_MAX_TOKENS;
  if (typeof transport.submitConversation === 'function') {
    const messages: ConversationMessage[] = [
      ...(system ? [{ role: 'system', content: system } as ConversationMessage] : []),
      { role: 'user', content: prompt },
    ];
    return transport.submitConversation(messages, { maxTokens });
  }
  return transport.submitMessage(system ? `${system}\n\n${prompt}` : prompt, system || undefined);
}

/**
 * Berechnet die Relevanz-Map frisch (OHNE Cache) über den injizierten Transport.
 * Jeder Fehlerpfad (Lauf/Parse) → leere Map (kein Throw). Für den Node-Eval-Harness
 * (kein IDB) und als Kern von `getOrComputeRelevanzMap`.
 */
export async function computeRelevanzMap(
  transport: AITransport,
  relevanzSkill: SkillRecord,
  vbMarkdown: string,
  abschnitte: RelevanzAbschnitt[],
): Promise<RelevanzMapResult> {
  const headings = parseVbHeadings(vbMarkdown);
  try {
    const raw = await runRelevanzMap(transport, relevanzSkill, headings, vbMarkdown, abschnitte);
    return { headings, map: parseRelevanzMap(raw, headings.map(h => h.id)) };
  } catch {
    return { headings, map: {} };
  }
}

/**
 * Liefert die (gecachte oder frisch berechnete) Relevanz-Map für einen Antrag.
 * Cache-Hit nur bei passendem VB-Hash; bei Miss EIN interner LLM-Lauf, Ergebnis
 * im `kv`-Store abgelegt (nur nicht-leere Maps — eine leere Map ist meist ein
 * Parse-/Lauf-Fehler und soll beim nächsten Mal neu versucht werden). Alle
 * Fehlerpfade degradieren still zu einer leeren Map (Volltext-Fallback beim Caller).
 */
export async function getOrComputeRelevanzMap(
  idb: IDBStore,
  transport: AITransport,
  relevanzSkill: SkillRecord,
  antragKey: string,
  vbMarkdown: string,
  abschnitte: RelevanzAbschnitt[],
): Promise<RelevanzMapResult> {
  const vbHash = hashText(vbMarkdown);
  const cacheKey = relevanzMapCacheKey(antragKey, vbHash);
  try {
    const cached = await idb.get<{ vbHash: string; map: RelevanzMap }>(cacheKey);
    if (cached && cached.vbHash === vbHash && cached.map) return { headings: parseVbHeadings(vbMarkdown), map: cached.map };
  } catch {
    // Cache-Lesefehler ignorieren → frisch berechnen.
  }
  const result = await computeRelevanzMap(transport, relevanzSkill, vbMarkdown, abschnitte);
  if (Object.keys(result.map).length > 0) {
    try { await idb.set(cacheKey, { vbHash, map: result.map }); } catch { /* Cache-Schreibfehler nicht eskalieren */ }
  }
  return result;
}

/**
 * LLM-Batch-Klassifizierung — Workflow-Revision 1.17.
 *
 * Neue Antraege haben oft nur VB-/TV-Titel (keine Deskriptoren, keine
 * Antragsteller-Zusammenfassung). Stage-1-Regel matcht dann nichts, Stage-2-
 * Embedding ist statistisch — bei Grenzfaellen und generischen Titeln versteht
 * ein LLM den Kontext besser.
 *
 * Dieser Service buendelt 10–15 Antraege pro Request an den **aktiv
 * konfigurierten AIBridge-Transport** (DirectLLM oder Streamlit), parst die
 * JSON-Antwort und liefert pro Antrag {primaer, aspekte[], begruendung}.
 *
 * Hierarchie (Workflow-Revision 1.17):
 *  Prio 1: LLM-Klassifizierung (wenn vorhanden)        → Confidence high
 *  Prio 2: Embedding-Centroid (Stage 2 in Engine)      → Confidence nach Score
 *  Prio 3: Manuelle Zuordnung durch PL                  → ueberschreibt alles
 *
 * Bei Konflikt LLM ↔ Embedding (verschiedene Primaere): Confidence wird auf
 * 'medium' herabgestuft + Begruendung enthaelt Plausibilitaets-Warnung.
 *
 * Fallback "Copy/Paste via Streamlit": exportiert `buildPromptForClipboard()`
 * und `parseClipboardResponse()`, die die UI an den Kopier-Helfer `kopiereText`
 * bzw. einen Textarea-Paste-Dialog koppelt.
 */
import type { AIBridge } from '@/core/services/ai/bridge';
import { parseJsonArrayTolerant, stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';
import { safeResetChat } from '@/core/services/ai/chat-reset';
import type { UeberKategorie } from '../../types';

// ─── Public Types ────────────────────────────────────────────────────────

/**
 * Eingabe-Eintrag fuer den LLM-Prompt — EIN Eintrag pro VERBUND (nicht pro TV).
 * Klassifizierung erfolgt fachlich pro Verbund; alle TVs eines Verbundes
 * teilen dasselbe Ergebnis.
 *
 * Vor v2.11 hiess der Typ `LLMAntrag` und hatte ein Item pro TV — das
 * fuehrte zu redundanter LLM-Last (4 TVs eines Verbundes = 4 fast identische
 * Inputs) und zu leerem `vbTitel`, weil der Verbund-Titel auf dem Antrag-
 * Objekt nicht existiert (Verbund-Felder liegen im separaten IDB-Store).
 */
export interface LLMVerbund {
  /** Verbund-ID (= `verbund_id` bei echten Verbuenden, sonst das Aktenzeichen
   *  des einzigen TVs als Pseudo-ID — analog zu `verbundKeyOf()`). */
  id: string;
  /** Verbund-Titel (gemeinsamer Titel aus dem `verbuende`-Store). Kann leer
   *  sein, wenn `verbund_titel` nicht gepflegt ist. */
  verbundTitel: string;
  /** TV-Titel aller TVs dieses Verbundes (FKZ-sortiert). Bei Solo: 1 Eintrag.
   *  Wird im Prompt als Array gerendert, damit der LLM den thematischen
   *  Kontext aller TVs sieht. */
  tvTitels: string[];
  /** Optional: AST-Name (Lead-TV) — zur Kontextualisierung. */
  antragsteller?: string;
}

export interface LLMKlassifizierungInput {
  verbuende: LLMVerbund[];
  kategorien: UeberKategorie[];
  bridge: AIBridge;
  /** Default 12. Kleinere Batches: stabiler, mehr Roundtrips. */
  batchSize?: number;
  /** Max. Versuche PRO Batch bei Parse-Fehler (Default 3). Timeout/Abort werden
   *  NIE retryt. Frischer Versuch = frischer Chat + neuer `tf-request`. */
  versuche?: number;
  /** Pause zwischen Batch-Versuchen in ms (Default 700; Tests: 0). */
  pauseMs?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface LLMKlassifizierungEintrag {
  primaer: string;
  aspekte: string[];
  begruendung: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface LLMKlassifizierungResult {
  /** Map `verbund_id → Klassifizierungs-Eintrag`. Der Caller iteriert dann
   *  ueber die TVs jedes Verbundes und schreibt den Eintrag auf alle TV-
   *  Klassifizierungs-Records. */
  byVerbundId: Map<string, LLMKlassifizierungEintrag>;
  errors: Array<{ batchIndex: number; message: string }>;
}

// ─── Prompt-Konstruktion ──────────────────────────────────────────────────

const SYSTEM_PROMPT_DE = (
  'Du bist ein Experte fuer Foerderprogramm-Klassifizierung. ' +
  'Du bekommst Verbuende (Forschungs-Verbuende mit einem oder mehreren ' +
  'Teilvorhaben/TVs). Klassifiziere pro VERBUND — alle TVs eines Verbundes ' +
  'gehoeren zum selben Thema und teilen die Klassifizierung. ' +
  'Antworte AUSSCHLIESSLICH mit einem JSON-Array. ' +
  'Kein Markdown, keine Erklaerung davor oder danach, kein Denkprozess.'
);

/**
 * Baut den User-Prompt aus Kategorien + Verbund-Liste. Konsistent fuer
 * Bridge-Mode und Clipboard-Fallback.
 *
 * Schema (ab v2.11): EIN Eintrag pro Verbund mit `verbundTitel` + `tvTitels[]`.
 * Vorher: ein Eintrag pro TV mit immer leerem `vbTitel`-Feld.
 */
export function buildPromptText(verbuende: LLMVerbund[], kategorien: UeberKategorie[]): string {
  const katBlock = kategorien.map(k => `- ${k.id}: ${k.name}`).join('\n');
  const verbuendeJson = JSON.stringify(
    verbuende.map(v => ({
      id: v.id,
      verbundTitel: v.verbundTitel,
      tvTitels: v.tvTitels,
      ...(v.antragsteller ? { antragsteller: v.antragsteller } : {}),
    })),
    null,
    2,
  );
  return [
    'Ordne jeden Verbund einer Primaerkategorie zu und identifiziere optionale',
    'Aspekte (Querschnittstechnologien die als Werkzeug oder Methode genutzt',
    'werden, NICHT das Kernthema sind).',
    '',
    'Ein Verbund kann mehrere TVs (Teilvorhaben) haben — sie sind thematisch',
    'verwandt und teilen die Klassifizierung. Nutze `verbundTitel` als Haupt-',
    'kontext und `tvTitels[]` fuer den thematischen Reichtum.',
    '',
    'Kategorien:',
    katBlock,
    '',
    // Abgrenzung primaer/aspekte OHNE konkrete Kategorie-IDs: die frueheren Zeilen
    // interpolierten `kategorien[0].id`, behielten aber die feste Begruendung
    // „Materialentwicklung ist Ingenieurtechnik" — steht Ingenieurtechnik nicht an
    // Position 0, widerlegte das Beispiel sich selbst, direkt ueber der Liste, aus der
    // das Modell waehlen soll.
    'Abgrenzung primaer/aspekte am Beispiel: Ein Verbund entwickelt neuartige Polymerblends',
    'und nutzt dafuer eine adaptive Prozessregelung.',
    '→ primaer = die Kategorie, die die Materialentwicklung abdeckt (das Kernthema).',
    '→ aspekte = die Kategorie der Prozessregelung (nur Werkzeug, nicht das Thema).',
    'Beide IDs stammen aus der Kategorienliste oben.',
    '',
    'Antworte NUR als JSON-Array dieser Form (id = Verbund-ID, KEINE Erklaerung davor oder danach):',
    '[{"id":"<verbund-id>","primaer":"<kategorie-id>","aspekte":["<kategorie-id>"],"begruendung":"<kurzer Satz>"}]',
    '(Formatbeispiel — setze die echten Verbund-IDs aus der Liste unten ein, nie diese Platzhalter.)',
    '',
    'Verbuende:',
    verbuendeJson,
  ].join('\n');
}

/** JSON-Schema fuer DirectLLM-`response_format`. Enum-Werte = Kategorie-IDs. */
export function buildResponseFormat(kategorien: UeberKategorie[]): Record<string, unknown> {
  const ids = kategorien.map(k => k.id);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'antrag_klassifizierung',
      strict: true,
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'primaer', 'aspekte', 'begruendung'],
          properties: {
            id: { type: 'string' },
            primaer: { type: 'string', enum: ids },
            aspekte: { type: 'array', items: { type: 'string', enum: ids } },
            begruendung: { type: 'string', maxLength: 240 },
          },
        },
      },
    },
  };
}

// ─── JSON-Parsing (robust) ────────────────────────────────────────────────

interface RawLLMItem {
  id?: unknown;
  primaer?: unknown;
  /** Pruefen wir auch unter Umlautschluessel (manche Modelle setzen
   *  "primär" trotz Schema). */
  ['primär']?: unknown;
  aspekte?: unknown;
  begruendung?: unknown;
  ['begründung']?: unknown;
}

/**
 * Parser-Funktion: nimmt die LLM-Antwort als String und liefert ein Array
 * von Objekten. Robust gegen:
 *  - Markdown-Wrapping (```json ... ```)
 *  - Leading/Trailing-Whitespace + Erklaerungs-Text
 *  - Umlaut-Schluessel ("primär" statt "primaer")
 *  - Abgeschnittenes JSON (Output-Token-Limit): vollstaendige Objekte werden
 *    gerettet, das angeschnittene letzte Objekt verworfen.
 *
 * Wirft nur, wenn KEIN vollstaendiges Objekt gerettet werden kann.
 */
export function parseLLMResponse(raw: string): Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> {
  const stripped = stripMarkdownWrapper(raw).trim();
  // Snippet der erhaltenen Antwort für die Fehlermeldung — macht typische Ursachen
  // sofort sichtbar (z. B. wenn die Bridge statt des JSON die AitisiGPT-Begrüßung
  // „Informationen sprechen…" zurückliefert = Baseline-/Begrüßungs-Grab).
  const antwortSnippet = raw.trim().slice(0, 160).replace(/\s+/g, ' ');
  const snippetSuffix = antwortSnippet ? ` (Antwort-Anfang: „${antwortSnippet}…")` : '';
  // Erste eckige Klammer suchen — verhindert dass Erklaerungs-Text davor
  // den Parser blockiert.
  const start = stripped.indexOf('[');
  if (start < 0) {
    throw new Error(`Keine JSON-Array-Klammer im LLM-Output gefunden.${snippetSuffix}`);
  }
  const parsed = parseJsonArrayTolerant(stripped.slice(start));
  if (parsed.length === 0) {
    throw new Error(`Keine vollstaendigen JSON-Objekte im LLM-Output gefunden — evtl. komplett abgeschnitten.${snippetSuffix}`);
  }

  const out: Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> = [];
  for (const item of parsed as RawLLMItem[]) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id : '';
    const primaerRaw = item.primaer ?? item['primär'];
    const primaer = typeof primaerRaw === 'string' ? primaerRaw : '';
    const aspekte = Array.isArray(item.aspekte)
      ? item.aspekte.filter((a): a is string => typeof a === 'string')
      : [];
    const begRaw = item.begruendung ?? item['begründung'];
    const begruendung = typeof begRaw === 'string' ? begRaw : '';
    if (!id || !primaer) continue;
    out.push({ id, primaer, aspekte, begruendung });
  }
  return out;
}

// ─── Bridge-Mode (DirectLLM / Streamlit) ─────────────────────────────────

const RETRY_PAUSE_MS = 700;
const warte = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Klassifiziert eine Liste von Verbuenden via AIBridge. Chunked in `batchSize`-
 * Paketen, mit Fehler-Tolerant (ein fehlgeschlagener Batch unterbricht nicht
 * den ganzen Lauf).
 *
 * Output: `byVerbundId` — Caller iteriert ueber die TVs jedes Verbundes und
 * schreibt das Ergebnis auf alle TV-Klassifizierungs-Records.
 */
export async function klassifiziereBatch(input: LLMKlassifizierungInput): Promise<LLMKlassifizierungResult> {
  const { verbuende, kategorien, bridge, onProgress, signal } = input;
  const batchSize = Math.max(1, input.batchSize ?? 12);
  const maxVersuche = Math.max(1, input.versuche ?? 3);
  const pauseMs = input.pauseMs ?? RETRY_PAUSE_MS;
  const out: LLMKlassifizierungResult = {
    byVerbundId: new Map(),
    errors: [],
  };
  // Gegatete Wahl (v4.12): der Prompt traegt `verbundTitel`, `tvTitels` und
  // `antragsteller` — genau die Klasse, die `INHALTS_SLOTS` als `stammdaten`
  // fuehrt und die die DSGVO-Policy intern haelt. Vorher zog dieser Lauf den
  // Transport roh und konnte den ganzen Bestand an einen externen Provider
  // geben (Pitfall #30). Die Taste „Prompt kopieren" bleibt davon unberuehrt:
  // sie ist eine bewusste Nutzerhandlung, kein automatischer Lauf.
  const transport = bridge.getTransportForDatenLauf('Die Auslastungs-Klassifizierung');

  // Ping-Guard VOR dem Lauf: bei getrennter KI wuerde `submitMessage` sonst per
  // `ensureConnection()` einen frischen Tab OHNE Bookmarklet oeffnen → nie ein
  // `tf-response` → 200-s-Endlos-Spinner. Sofortiger, klarer Fehler statt Hang
  // (spiegelt runAnonymisierung). Der Button-`useAsyncAction` malt ihn in die UI.
  //
  // PASSIV (`openIfNeeded: false`, v4.18.0): der Ping tat mit seiner Vorgabe
  // genau das, wogegen er schuetzen soll — `ping()` ruft selbst
  // `ensureConnection()`. Der Guard meldete den Fehler also korrekt UND liess
  // den nutzlosen Tab stehen. Das Verbinden bietet der Aufrufer an
  // (`kiVerbindungGeprueft` in LLMKlassifizierungButtons).
  const erreichbar = await transport.ping({ openIfNeeded: false });
  if (!erreichbar) {
    throw new Error('Interne KI nicht erreichbar — Klassifizierung derzeit nicht möglich.');
  }

  const responseFormat = buildResponseFormat(kategorien);
  const validKategorieIds = new Set(kategorien.map(k => k.id));
  let done = 0;
  const total = verbuende.length;

  for (let i = 0; i < verbuende.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = verbuende.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const prompt = buildPromptText(batch, kategorien);

    // Bounded Retry pro Batch: `submitMessage` AUSSERHALB, `parseLLMResponse`
    // INNERHALB des inneren try — nur Parse-Fehler (Bridge finalisiert unter Last
    // gelegentlich mit einer kurzen Teil-Antwort) werden retryt. Timeout/Abort
    // NICHT (sonst 3× 200 s) → als Batch-Fehler tolerieren bzw. Abort durchreichen.
    let letzterFehler: unknown;
    let erfolg = false;
    for (let versuch = 0; versuch < maxVersuche && !erfolg; versuch++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      // Frischer Kontext je Versuch — sonst greift das Bookmarklet zuerst die
      // Antwort des vorherigen Batches (lastAssistant()-Staleness). Best-effort.
      await safeResetChat(transport);

      let responseText: string;
      try {
        responseText = await transport.submitMessage(prompt, SYSTEM_PROMPT_DE, {
          responseFormat,
          signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
        letzterFehler = err; // Transport-Fehler (Timeout) — NICHT retryen.
        break;
      }

      try {
        const parsed = parseLLMResponse(responseText);
        for (const item of parsed) {
          if (!validKategorieIds.has(item.primaer)) {
            out.errors.push({
              batchIndex,
              message: `Verbund ${item.id}: unbekannte Primaer-Kategorie "${item.primaer}" — uebersprungen.`,
            });
            continue;
          }
          const aspekte = item.aspekte.filter(a => validKategorieIds.has(a));
          out.byVerbundId.set(item.id, {
            primaer: item.primaer,
            aspekte,
            begruendung: item.begruendung,
            // Confidence: LLM-Ergebnis ist per Default 'high'; bei nachfolgender
            // Plausibilitaets-Pruefung gegen Embedding kann der Caller downgraden.
            confidence: 'high',
          });
        }
        erfolg = true;
      } catch (err) {
        letzterFehler = err; // Parse-Fehler → frischer Versuch.
        if (versuch < maxVersuche - 1) await warte(pauseMs);
      }
    }

    if (!erfolg && letzterFehler !== undefined) {
      out.errors.push({
        batchIndex,
        message: letzterFehler instanceof Error ? letzterFehler.message : String(letzterFehler),
      });
    }

    done = Math.min(total, i + batchSize);
    onProgress?.(done, total);
  }

  return out;
}

// ─── Copy/Paste-Fallback (Clipboard) ─────────────────────────────────────

/**
 * Baut den Prompt-Text fuer den Clipboard-Workflow: User kopiert das in eine
 * Streamlit-/Chat-UI, kopiert die JSON-Antwort zurueck.
 */
export function buildPromptForClipboard(verbuende: LLMVerbund[], kategorien: UeberKategorie[]): string {
  // Identisch zum bridge-Prompt — aber der User braucht das System-Prompt
  // explizit am Anfang (Streamlit/ChatGPT haben oft keinen separaten Slot).
  return SYSTEM_PROMPT_DE + '\n\n' + buildPromptText(verbuende, kategorien);
}

/**
 * Parst die manuell zurueckgeworfene LLM-Antwort. Identisch zu
 * `parseLLMResponse`, aber als separater Export fuer den UI-Layer.
 */
export function parseClipboardResponse(raw: string): Array<{ id: string; primaer: string; aspekte: string[]; begruendung: string }> {
  return parseLLMResponse(raw);
}

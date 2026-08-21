/**
 * Deep-Research-Baustein der Antrag-Aufbereitung (Paket 5, Phase 1, nur dev). EIN
 * interner Lauf zieht aus dem Korpus **Stichworte** (`recherche-stichworte.ts`); den
 * Auftragstext baut daraus die feste Vorlage (`recherche-auftrag.ts`). Der Prüfer trägt
 * ihn per Zwischenablage in externe Dienste (ChatGPT/Claude/Mistral).
 *
 * Läuft ZUERST (vor den übrigen Bausteinen), damit die externe Recherche (5–10 Min)
 * parallel zur internen Aufbereitung starten kann. Das Ziel-Modell kommt wie bei allen
 * Bausteinen vom Aufrufer (`bestimmeLaufZiel`, `lauf-ziel.ts` → gpt-oss-120b).
 *
 * Bis v2.300 formulierte das Modell den ganzen Auftrag selbst — und schrieb dabei die
 * Antworten des Antrags hinein (identifizierte Lücken, Marktzahlen, Wettbewerber,
 * Zielkennwerte). Der externe Dienst bestätigte damit den Antrag, statt unabhängig zu
 * recherchieren, und substanzieller Antragsinhalt verließ mit dem Kopieren den
 * geschützten Bereich. Seither liefert das Modell nur noch Nominalphrasen.
 *
 * DSGVO-Schichten: (1) die **Vorlage im Code** — das Modell formuliert den Auftrag nicht
 * mehr selbst; (1b) der deterministische **Sanitizer** verwirft Zahlwerte und
 * identifizierende Angaben aus den Stichworten; (2) der **Leak-Check** auf dem fertigen
 * Auftrag (auch auf jeder von Hand gesetzten Fassung); (3) die **Pflicht-Review** im UI.
 *
 * Reine Funktionen (Node-testbar); Cache-/Transport-Rahmen in `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport } from '@/core/services/ai/transports/streamlit';
import type { KiRolle } from '@/core/services/ai/modell-katalog';
import { getOrComputeBaustein, vbHashFuer, type BausteinResult } from './bausteine';
import { auftragsRahmen, baueDeepResearchAuftrag } from './recherche-auftrag';
import {
  FELD_GRENZEN, parseStichworte, stichworteBrauchbar, STICHWORTE_SCHEMA_VERSION,
  type RechercheStichworte,
} from './recherche-stichworte';
import { findeLeaks, type BekannteStammwerte } from './recherche-leak';

/** Der gecachte Baustein-Datensatz. */
export interface RecherchePromptDaten {
  schemaVersion: number;
  /** Die Stichworte, aus denen die feste Vorlage den Auftrag baut — die Quelle. */
  stichworte: RechercheStichworte;
  /**
   * Der zusammengebaute Auftragstext (zum Kopieren in externe Dienste). Wird MIT
   * gespeichert statt bei jeder Anzeige neu gebaut, weil eine von Hand gesetzte Fassung
   * (`bearbeitet`) sich nicht aus Stichworten ableiten lässt — beide Wege teilen sich so
   * dasselbe Feld und denselben Leak-Check.
   */
  prompt: string;
  /** Wie viele Roh-Einträge der Sanitizer verworfen hat (ehrlicher UI-Hinweis). */
  entfernt?: number;
  /**
   * Gesetzt, sobald der Prüfer den Auftrag von Hand bearbeitet hat (additiv — alte
   * Caches bleiben ladbar). `kiOriginal` trägt die ERSTE KI-Fassung, damit
   * „Zurück zum KI-Text" ohne neuen Lauf geht; mehrfaches Bearbeiten überschreibt
   * sie nicht.
   */
  bearbeitet?: { am: string; kiOriginal: string };
}

/**
 * kv-Cache-Key des Bausteins — trägt die Stichwort-Schema-Version, weil sich mit ihr die
 * Shape des gecachten Datensatzes ändert (Alt-Einträge trugen nur den Auftragstext).
 * Das Lösch-Präfix in `loescheBausteinCaches` (`…:recherche-prompt:`) trifft beide Stände.
 * Lebt hier statt in `bausteine.ts`: die Version käme dort nur über einen Modul-Zyklus an.
 */
export const recherchePromptCacheKey = (antragKey: string, vbHash: string): string =>
  `aufbereitung:${antragKey}:recherche-prompt:v${STICHWORTE_SCHEMA_VERSION}:${vbHash}`;

/**
 * Zusätzliche, HASH-FREIE Ablage der von Hand geprüften Auftrags-Fassung.
 *
 * Der normale Cache ist auf den Korpus-Hash gekeyt — richtig für ein
 * LLM-Ergebnis, falsch für eine Fassung, die der Prüfer selbst abgenommen hat:
 * sie war nach dem nächsten Dokument-Upload über keinen Lesepfad mehr
 * erreichbar (v4.124). Bewusst ohne Präfix-Kollision mit dem Lösch-Präfix
 * `…:recherche-prompt:` — „KI-Bausteine neu berechnen" räumt sie mit ab, und
 * das ist die ausdrückliche Absicht des Knopfes.
 */
export const recherchePromptBearbeitetKey = (antragKey: string): string =>
  `aufbereitung:${antragKey}:recherche-prompt:bearbeitet:v${STICHWORTE_SCHEMA_VERSION}`;

/** Liest die hash-freie, von Hand geprüfte Fassung; `null` = keine da. Wirft nie. */
export async function leseBearbeitetenRecherchePrompt(
  idb: IDBStore, antragKey: string,
): Promise<RecherchePromptDaten | null> {
  try {
    const roh = await idb.get(recherchePromptBearbeitetKey(antragKey));
    const d = (roh as { daten?: RecherchePromptDaten } | null)?.daten ?? null;
    return d && typeof d.prompt === 'string' ? d : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Normalisierung
// ---------------------------------------------------------------------------

/**
 * Macht literale Escape-Sequenzen im Auftragstext wieder zu echten Zeichen.
 *
 * Modelle escapen den Backslash in JSON-Strings regelmäßig doppelt (`\\n`) — nach
 * `JSON.parse` bleiben dann die zwei Zeichen `\` + `n` im Text stehen, und der Auftrag
 * steht als eine Wand ohne Absätze und Listen da. Seit der Auftragstext aus der Vorlage
 * kommt, trifft das nur noch von Hand eingefügte Fassungen — dort aber weiterhin.
 *
 * Idempotent: ein bereits normalisierter Text enthält keine solchen Sequenzen mehr
 * und bleibt unverändert. Rein/Node-testbar.
 */
export function normalisiereAuftragstext(text: string): string {
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

// ---------------------------------------------------------------------------
// Prompt (interner Lauf — fordert NUR Stichworte an)
// ---------------------------------------------------------------------------

export function buildStichwortePrompt(vbMarkdown: string): string {
  const g = FELD_GRENZEN;
  return `Lies die folgende Vorhabensbeschreibung (VB) und gib das THEMENGEBIET als Stichworte zurück — kurze Nominalphrasen, keine Sätze.

## Vorhabensbeschreibung (Quelle — bleibt intern)
${vbMarkdown}

## Felder
- "themenfeld": das Technologiefeld, höchstens ${g.themenfeld.woerter} Wörter (Pflichtangabe).
- "anwendungsdomaene": Branche oder Einsatzkontext, höchstens ${g.anwendungsdomaene.woerter} Wörter.
- "technologien": bis zu ${g.technologien.anzahl} Verfahren/Technologien des Gebiets, je höchstens ${g.technologien.woerter} Wörter.
- "leistungsdimensionen": bis zu ${g.leistungsdimensionen.anzahl} Größen, an denen man Lösungen in diesem Feld misst — OHNE Wert (z. B. „Latenz", „Skalierbarkeit der Agentenzahl"), je höchstens ${g.leistungsdimensionen.woerter} Wörter.
- "marktsegmente": bis zu ${g.marktsegmente.anzahl} Markt-/Branchensegmente, je höchstens ${g.marktsegmente.woerter} Wörter.
- "suchbegriffeEn": bis zu ${g.suchbegriffeEn.anzahl} englische Fachbegriffe für die Literatursuche, je höchstens ${g.suchbegriffeEn.woerter} Wörter.

## Harte Regeln
Es geht ausschließlich darum, WORUM es fachlich geht — nicht darum, was das Vorhaben erreichen will oder was heute fehlt.
- KEINE Zahlen: keine Zielwerte, Marktgrößen, Prozente, Geldbeträge, Zeiträume, Stückzahlen — auch nicht in Klammern.
- KEINE Namen: kein Antragsteller/Unternehmen, kein Förderkennzeichen, kein Aktenzeichen, keine Personennamen, keine Ortsangaben, kein Projektakronym und kein Projekttitel.
- KEINE Sätze, keine Bewertung, keine Zusammenfassung, keine Lücken- oder Defizit-Aussagen.
- Gibt die VB zu einem Feld nichts her, liefere einen leeren String bzw. eine leere Liste. Nichts erfinden.

## Ausgabe
Antworte AUSSCHLIESSLICH mit genau EINEM JSON-Codeblock in dieser Form — kein Fließtext davor oder danach, kompakt geschrieben (kein Pretty-Print):
\`\`\`json
{"schemaVersion": ${STICHWORTE_SCHEMA_VERSION}, "themenfeld": "", "anwendungsdomaene": "", "technologien": [], "leistungsdimensionen": [], "marktsegmente": [], "suchbegriffeEn": []}
\`\`\``;
}

// ---------------------------------------------------------------------------
// Parser (tolerant, kein Throw)
// ---------------------------------------------------------------------------

/**
 * Liest + bereinigt die Stichworte und baut den Auftrag daraus.
 * `null` bei kaputt/leer → der Baustein degradiert (Rohtext bleibt einsehbar).
 */
export function parseRecherchePrompt(
  raw: string, bekannteWerte: BekannteStammwerte = {},
): RecherchePromptDaten | null {
  const erg = parseStichworte(raw, bekannteWerte);
  if (!erg) return null;
  return {
    schemaVersion: STICHWORTE_SCHEMA_VERSION,
    stichworte: erg.stichworte,
    prompt: baueDeepResearchAuftrag(erg.stichworte),
    ...(erg.entfernt ? { entfernt: erg.entfernt } : {}),
  };
}

/**
 * Prüft einen VON HAND bearbeiteten Auftragstext gegen dieselben Stammwerte wie der
 * KI-erzeugte (dünne Hülle um `findeLeaks` — eine Quelle für die Leak-Regel). Leere
 * Trefferliste = zum Kopieren freigegeben.
 */
export function pruefeBearbeitetenPrompt(
  text: string, bekannteWerte: BekannteStammwerte,
): { leaks: string[] } {
  return { leaks: [...new Set(findeLeaks(text, bekannteWerte, auftragsRahmen()))] };
}



// ---------------------------------------------------------------------------
// Compute (Cache-Rahmen + Leak-Backstop)
// ---------------------------------------------------------------------------

export async function computeRecherchePromptBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  vbMarkdown: string,
  bekannteWerte: BekannteStammwerte,
  opts?: { force?: boolean; ziel?: KiRolle },
): Promise<BausteinResult<RecherchePromptDaten>> {
  const vbHash = vbHashFuer(vbMarkdown);
  // Leak-Treffer aus dem `verdaechtig`-Guard heben (der Guard läuft auf dem FINALEN
  // Ergebnis; so wird ein Auftrag mit identifizierender Angabe NIE gecacht).
  let leakTreffer: string[] = [];
  const res = await getOrComputeBaustein<RecherchePromptDaten>(
    idb, transport, skill,
    recherchePromptCacheKey(antragKey, vbHash), vbHash,
    () => buildStichwortePrompt(vbMarkdown),
    (raw) => parseRecherchePrompt(raw, bekannteWerte),
    {
      ...opts,
      verdaechtig: {
        pruefe: (d) => {
          if (!stichworteBrauchbar(d.stichworte)) return true;
          // Backstop: der Sanitizer hat leakende Stichworte schon entfernt — hier zählt
          // der ZUSAMMENGEBAUTE Text (Schicht 2 bleibt unabhängig von Schicht 1b).
          leakTreffer = pruefeBearbeitetenPrompt(d.prompt, bekannteWerte).leaks;
          return leakTreffer.length > 0;
        },
        grund: 'Zu wenige verwertbare Stichworte für einen Recherche-Auftrag',
      },
    },
  );
  // Leak → spezifische Begründung (Schicht 2). Der Rohtext bleibt einsehbar (mit
  // Warnung im Tab), der Auftrag wird aber nicht zum Kopieren angeboten.
  if (res.status === 'degradiert' && leakTreffer.length > 0) {
    return {
      ...res,
      begruendung: `Identifizierende Angabe im Recherche-Auftrag: ${leakTreffer.join(', ')}`,
    };
  }
  return res;
}

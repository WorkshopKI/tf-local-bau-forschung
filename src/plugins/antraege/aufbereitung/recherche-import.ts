/**
 * Import der externen Deep-Research-Ergebnisse (Paket 5, Phase 2). Der DR liefert Report-
 * Text, PDF, Word oder Markdown — KEIN verlässliches JSON. Toleranter Pfad:
 *  1. Sauberer JSON-Block im Text (bestehender Salvage) → direkt strukturiert (`herkunft:'json'`).
 *  2. Sonst EIN interner Strukturierungs-Lauf (`{{externText}}`, intern-pflichtig) → `'text'`.
 *  3. Misslingt auch der → Rohtext-Übernahme (`aussagen:[]`, `rohtext` gesetzt).
 *
 * DSGVO: der Import-Lauf trägt NUR den externen Text (kein VB-Inhalt), bleibt aber intern-
 * pflichtig. Der externe Text wird NIE in den VB-Korpus aufgenommen (eigene Klasse).
 * Reine/tolerante Funktionen; Cache-/Transport-Rahmen in `bausteine.ts`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { SkillRecord } from '@/core/services/skills';
import type { AITransport, BridgeZiel } from '@/core/services/ai/transports/streamlit';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import { getOrComputeBaustein, rechercheImportCacheKey, type BausteinResult } from './bausteine';
import {
  drSchemaBlockBeschreibung, parseExterneRecherche, RECHERCHE_SCHEMA_VERSION, type ExterneRechercheKern,
} from './recherche-schema';

// ---------------------------------------------------------------------------
// Datei-Annahme (Drag & Drop + Datei-Dialog)
// ---------------------------------------------------------------------------

/**
 * Endungen, die der Import liest — `DocConverter` deckt sie alle ab (PDF/DOCX
 * eigener Zweig, `md`/`txt` als Klartext). ChatGPT Deep Research lädt inzwischen
 * auch Markdown herunter, deshalb steht `.md` gleichberechtigt daneben.
 */
export const IMPORT_DATEI_ENDUNGEN = ['.pdf', '.docx', '.md', '.txt'] as const;

/** Wert für `<input accept>` / `FileDropZone` — dieselbe Quelle wie die Prüfung unten. */
export const IMPORT_ACCEPT = IMPORT_DATEI_ENDUNGEN.join(',');

/**
 * Teilt eine abgelegte Datei-Liste in lesbare und abgelehnte Dateien. Nötig, weil
 * `accept` NUR den Datei-Dialog filtert: gezogene Dateien kommen ungeprüft an, und
 * eine ZIP landete sonst über den Klartext-Zweig als Binärmüll im Import.
 */
export function teileImportDateien<T extends { name: string }>(
  dateien: readonly T[],
): { akzeptiert: T[]; abgelehnt: string[] } {
  const akzeptiert: T[] = [];
  const abgelehnt: string[] = [];
  for (const d of dateien) {
    const name = d.name.toLowerCase();
    if (IMPORT_DATEI_ENDUNGEN.some(e => name.endsWith(e))) akzeptiert.push(d);
    else abgelehnt.push(d.name);
  }
  return { akzeptiert, abgelehnt };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildRechercheImportPrompt(externText: string): string {
  return `Strukturiere den folgenden EXTERNEN Recherche-Text in das geforderte JSON-Schema. Wähle die belegten Aussagen + Quellen AUS und ordne jede Aussage einer Kategorie zu — erfinde nichts, ergänze kein Weltwissen. Sind keine belegten Aussagen enthalten, gib ein leeres \`aussagen\`-Array zurück.

## Externer Recherche-Text
${externText}

## Ausgabe
Antworte AUSSCHLIESSLICH mit genau EINEM JSON-Codeblock in dieser Form (kompakt, ein Eintrag pro Zeile, keine Einrückung). Findest du keine Quellen, gib auch die Quellen-Liste leer zurück:
${drSchemaBlockBeschreibung()}`;
}

// ---------------------------------------------------------------------------
// Parser (reuse der geteilten Schema-Konstante)
// ---------------------------------------------------------------------------

export function parseRechercheImport(raw: string): ExterneRechercheKern | null {
  return parseExterneRecherche(raw);
}

// ---------------------------------------------------------------------------
// Compute (Cache über den Hash des externen Textes — nicht vbHash)
// ---------------------------------------------------------------------------

export async function computeRechercheImportBaustein(
  idb: IDBStore,
  transport: AITransport,
  skill: SkillRecord,
  antragKey: string,
  externText: string,
  opts?: { force?: boolean; ziel?: BridgeZiel; ueberStandardCap?: boolean },
): Promise<BausteinResult<ExterneRechercheKern>> {
  const externHash = hashText(externText);
  return getOrComputeBaustein<ExterneRechercheKern>(
    idb, transport, skill,
    rechercheImportCacheKey(antragKey, externHash), externHash,
    () => buildRechercheImportPrompt(externText),
    (raw) => parseRechercheImport(raw),
    { ...opts }, // KEIN verdaechtig-Guard: 0 Aussagen ist legitim (Muster Verwertung).
  );
}

// ---------------------------------------------------------------------------
// Orchestrierung (Direkt-JSON → interner Lauf → Rohtext)
// ---------------------------------------------------------------------------

export interface ImportErgebnis {
  kern: ExterneRechercheKern;
  /** Inhalts-Herkunft: sauberer JSON-Block direkt vs. (LLM-strukturierter/roher) Text. */
  herkunftInhalt: 'json' | 'text';
  /** true, wenn weder JSON noch interne Strukturierung griff (Rohtext übernommen). */
  unstrukturiert: boolean;
}

const LEERER_KERN = (): ExterneRechercheKern => ({ schemaVersion: RECHERCHE_SCHEMA_VERSION, quellen: [], aussagen: [] });

/**
 * Verarbeitet einen externen Text tolerant zum Struktur-Kern. `transport`/`skill`/`idb`
 * optional — fehlen sie (oder wirft der interne Lauf), wird der Rohtext übernommen.
 */
export async function strukturiereImport(
  rohText: string,
  deps?: {
    idb: IDBStore; transport: AITransport; skill: SkillRecord; antragKey: string;
    force?: boolean;
    /** Ziel-KI des Strukturierungs-Laufs — wie alle Aufbereitungs-Läufe die Standard-KI
     *  (`bestimmeLaufZiel`); ohne Angabe gilt die globale Variante. */
    ziel?: BridgeZiel;
  },
): Promise<ImportErgebnis> {
  // 1. Direkter JSON-Block im Text?
  const direkt = parseExterneRecherche(rohText);
  if (direkt) return { kern: direkt, herkunftInhalt: 'json', unstrukturiert: false };

  // 2. Interner Strukturierungs-Lauf.
  if (deps) {
    const res = await computeRechercheImportBaustein(
      deps.idb, deps.transport, deps.skill, deps.antragKey, rohText, { force: deps.force, ziel: deps.ziel },
    );
    if (res.status === 'ok' && res.daten) {
      return { kern: res.daten, herkunftInhalt: 'text', unstrukturiert: false };
    }
  }

  // 3. Rohtext-Übernahme (ehrlich unstrukturiert) — der Rohtext selbst hängt der Aufrufer
  //    an die ExterneRecherche (nicht Teil des Struktur-Kerns).
  return { kern: LEERER_KERN(), herkunftInhalt: 'text', unstrukturiert: true };
}

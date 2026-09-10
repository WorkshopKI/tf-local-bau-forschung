/**
 * Das Spalten-Inventar aller Programm-Schemas: welche Spalten sind gemappt, wie
 * heißen sie im Klartext, welchen Typ haben sie.
 *
 * Zwei Konsumenten teilen es sich — der Bedingungs-Editor der Meilensteine
 * („welche Spalte erfüllt diesen Meilenstein?") und die Spalten-Entdeckung des
 * Status-Katalogs („welche Statusspalte kennt der Katalog noch nicht?"). Deshalb
 * wohnt es hier bei den CSV-Diensten und nicht in einem der beiden Module.
 *
 * Zwei Regeln bestimmen die angebotene `feldId`:
 *
 * - Spalte ist auf ein **kanonisches** Feld gemappt ⇒ der kanonische Key
 *   (`antragsdatum`, `status`, …). Der ist über alle Programme hinweg stabil.
 * - Sonst ⇒ der rohe **CSV-Spalten-CODE** (`D_QS`, `D_ALS`, …). Er wird zur
 *   Auswertungszeit über das Schema aufgelöst und bleibt damit auch dann
 *   richtig, wenn die Kuration das Mapping später umstellt.
 *
 * Rein: keine IO. Die Schemas reicht der Aufrufer herein.
 */
import { normCode } from './status-datum-gruppen';
import type { CsvSchema } from './types';

/** Welche Operatoren zu einem Feld passen. */
export type SpaltenTyp = 'datum' | 'wert';

/** Eine rohe CSV-Spalte mit ihrer Beschriftung aus der Label-XLS. */
export interface RohSpalte {
  code: string;
  label: string;
}

/** Ein Treffer im Inventar: die Spalte und das Programm, dessen Schema sie mappt. */
interface Treffer {
  spalte: RohSpalte;
  programmId: string;
}

interface Sammlung {
  /** Kanonischer oder Custom-Key → die Spalten, die in ihn schreiben. */
  jeFeld: Map<string, Treffer[]>;
  /** Roher Spalten-Code (`normCode`-Form) → die Spalte selbst. */
  jeCode: Map<string, Treffer[]>;
  programme: Set<string>;
}

/**
 * EIN Durchgang über alle Mappings, aus dem beide Fragen beantwortet werden:
 * „woraus entsteht dieses Feld?" (`rohSpaltenJeFeld`) und „welche Quellspalten
 * stehen hinter dieser feldId, gleich in welcher Schreibweise?"
 * (`baueQuellSpaltenIndex`). Zwei eigene Schleifen liefen bei der ersten
 * Mapping-Feinheit auseinander — genau das ist dem Tooltip der Fördertabelle
 * bis v4.121 passiert.
 */
function sammle(schemas: readonly CsvSchema[]): Sammlung {
  const jeFeld = new Map<string, Treffer[]>();
  const jeCode = new Map<string, Treffer[]>();
  const programme = new Set<string>();
  const merke = (m: Map<string, Treffer[]>, key: string, t: Treffer): void => {
    const liste = m.get(key) ?? [];
    if (liste.some(x => x.spalte.code === t.spalte.code && x.programmId === t.programmId)) return;
    liste.push(t);
    m.set(key, liste);
  };
  for (const schema of schemas) {
    programme.add(schema.programm_id);
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const t: Treffer = {
        spalte: { code: spalte, label: entry.label?.trim() || '' },
        programmId: schema.programm_id,
      };
      const feld = entry.canonical?.trim() || entry.custom?.trim();
      if (feld) merke(jeFeld, feld, t);
      merke(jeCode, normCode(spalte), t);
    }
  }
  return { jeFeld, jeCode, programme };
}

/** Die Spalten eines Treffer-Satzes, je Code einmal — der erste Treffer gewinnt. */
function eindeutig(treffer: readonly Treffer[]): RohSpalte[] {
  const out: RohSpalte[] = [];
  for (const t of treffer) if (!out.some(s => s.code === t.spalte.code)) out.push(t.spalte);
  return out;
}

/**
 * Welche rohen CSV-Spalten hinter einem PROJIZIERTEN Feld stehen — über alle
 * übergebenen Schemas, dedupliziert.
 *
 * Der Weg ist bewusst rückwärts: die Alias-Tabelle in `constants.ts` sagt nur,
 * was der Wizard *vorschlagen* würde. Was ein Programm tatsächlich gemappt hat,
 * steht allein im Schema — und danach richtet sich, was in der Zelle landet.
 *
 * **Kanonisch UND custom.** Ein `custom`-Mapping schreibt genauso in ein Feld
 * des Antrags-Records wie ein kanonisches — `ORT_AST` heisst im Schema
 * `custom: 'ort_ast'`, und die Zelle liest `ort_ast`. Bis v4.121 sah diese
 * Auflösung nur `canonical`; der Herkunfts-Tooltip behauptete darum über einer
 * zu 100 % gefüllten Spalte „keine Spalte gemappt — die Zelle bleibt leer".
 * Gefragt ist, WORAUS das Feld entsteht, nicht auf welchem Weg es gemappt wurde.
 *
 * **Eine Auflösung für zwei Fragen**: den Herkunfts-Tooltip einer eingebauten
 * Spalte und die Feld-Auswahl beim Anlegen einer eigenen. Zwei Fassungen liefen
 * bei der ersten Mapping-Feinheit auseinander, und dann behauptete der Tooltip
 * etwas anderes als die Auswahlliste.
 */
export function rohSpaltenJeFeld(
  schemas: readonly CsvSchema[],
): Map<string, RohSpalte[]> {
  const { jeFeld } = sammle(schemas);
  return new Map([...jeFeld].map(([feld, treffer]) => [feld, eindeutig(treffer)]));
}

/** Was hinter einer `feldId` steht. */
export interface QuellSpaltenAuskunft {
  /** Die rohen CSV-Spalten, aus denen das Feld liest — je Code einmal. */
  spalten: RohSpalte[];
  /**
   * Programme, deren Schemas das Feld NICHT mappen: dort bleibt es leer, und
   * eine Bedingung darauf trifft nie. Leer, wenn alle es mappen — oder wenn es
   * gar keine Quellspalte gibt; dann ist `spalten` leer, und DAS ist die Aussage.
   */
  fehltIn: string[];
}

export interface QuellSpaltenIndex {
  quellSpaltenVon: (feldId: string) => QuellSpaltenAuskunft;
  /** Anzeigename einer `feldId` aus dem Schema-Label (einzeilig); sonst die `feldId`. */
  labelVon: (feldId: string) => string;
  /** Alle Programme, deren Schemas der Index kennt (sortiert). */
  programme: readonly string[];
}

/**
 * Der Nachschlage-Index für die **Quellspalten** (CONTEXT.md) — eine `feldId`
 * in jeder der drei Schreibweisen, die im Repo vorkommen:
 *
 * - kanonischer Key (`antragsdatum`, `status`) → alle Spalten, die ihn speisen,
 * - Custom-Key (`alle_an_trage_da`) → ebenso,
 * - roher Spalten-Code (`D_XTE`, `T_XPC+`, auch als `d_xte`) → die Spalte selbst.
 *
 * Kanonisch/Custom hat Vorrang vor dem Code: eine Katalog-Fassung nennt ein
 * Feld mal so, mal so (`status` neben `D_AAE`), und dieselbe Frage — „woraus
 * liest das?" — muss für beide dieselbe Art Antwort geben. Das ist die dritte
 * Konvention neben `rohSpaltenJeFeld` (canonical|custom) und `csvSpaltenJeFeld`
 * (canonical + Rohname); ein Index für alle drei statt einer vierten Kopie.
 *
 * Rein; der Aufrufer baut ihn einmal je Schema-Satz.
 */
export function baueQuellSpaltenIndex(schemas: readonly CsvSchema[]): QuellSpaltenIndex {
  const { jeFeld, jeCode, programme } = sammle(schemas);
  const alle = [...programme].sort((a, b) => a.localeCompare(b, 'de'));
  const trefferVon = (feldId: string): Treffer[] =>
    jeFeld.get(feldId) ?? jeCode.get(normCode(feldId)) ?? [];
  return {
    programme: alle,
    quellSpaltenVon: feldId => {
      const treffer = trefferVon(feldId);
      if (treffer.length === 0) return { spalten: [], fehltIn: [] };
      const mit = new Set(treffer.map(t => t.programmId));
      return { spalten: eindeutig(treffer), fehltIn: alle.filter(p => !mit.has(p)) };
    },
    labelVon: feldId => {
      const label = eindeutig(trefferVon(feldId)).find(s => s.label)?.label;
      return label ? einzeiligesLabel(label) : feldId;
    },
  };
}

/**
 * Die Beschriftung einer Spalte in EINER Zeile.
 *
 * Die Label-XLS trägt echte Zeilenumbrüche in ihren Überschriften — im
 * Entwicklungs-Bestand heißt `antragsdatum` wörtlich `"Antrags\r\neingang"`.
 * Im Fließtext einer Zusammenfassung, in einem `title`-Tooltip und in einer
 * Auswahlzeile zerreißt das die Zeile; der Umbruch ist eine Eigenheit der
 * Tabellenkopf-Zelle, keine Aussage über das Feld.
 *
 * Bewusst erst beim ANZEIGEN und nicht beim Einlesen: die Beschriftung wird
 * anderswo zeichengenau gegen das Schema gehalten, und eine still geglättete
 * Fassung liefe dort auseinander.
 */
export function einzeiligesLabel(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export interface SpaltenEintrag {
  /** So referenziert eine Bedingung oder ein Katalog-Feld die Spalte. */
  feldId: string;
  label: string;
  typ: SpaltenTyp;
  /** Rohe CSV-Spalte oder kanonisches Feld — steuert nur die Anzeige-Gruppierung. */
  quelle: 'kanonisch' | 'csv';
  /** In wie vielen SCHEMAS (CSV-Quellen) die Spalte gemappt ist. */
  schemaAnzahl: number;
  /**
   * In wie vielen PROGRAMMEN die Spalte gemappt ist — der eigentliche
   * Deckungshinweis. Ein Programm kann mehrere CSV-Quellen führen; `schemaAnzahl`
   * las sich deshalb als Programm-Deckung, ohne eine zu sein (v4.124).
   * Optional, damit synthetische Einträge (Tests, Todo-Feldvorrat) ohne sie
   * auskommen — dort steht der Hinweis ohnehin nicht.
   */
  programmAnzahl?: number;
  /**
   * Bei `quelle: 'kanonisch'`: die rohen CSV-Codes, die auf dieses Feld gemappt
   * sind (dedupliziert über alle Schemas). Ein kanonischer Key wie
   * `antragsdatum` sagt nämlich nicht, WORAUS er entsteht — und genau danach
   * fragt, wer eine Spalte auswählt. Bei `quelle: 'csv'` leer: dort IST die
   * `feldId` schon der Code.
   */
  quellCodes: string[];
  /**
   * Die Quellspalten samt Beschriftung — bei `quelle: 'kanonisch'` die Spalten
   * hinter `quellCodes`, bei `quelle: 'csv'` die Spalte selbst. Optional, weil
   * synthetische Einträge (Tests, Todo-Feldvorrat) ohne Schema entstehen.
   */
  quellSpalten?: RohSpalte[];
}

/**
 * Baut den Spalten-Vorrat aus allen übergebenen Schemas. Ignorierte Spalten
 * fallen weg; dieselbe Spalte aus mehreren Programmen wird zu einem Eintrag
 * verschmolzen (Zähler `schemaAnzahl`).
 *
 * Sortierung: kanonische Felder zuerst (sie sind die verlässlichen), danach die
 * rohen Codes alphabetisch — sonst hängt die Reihenfolge an der Schema-Reihenfolge
 * und die Liste springt bei jedem Import.
 */
export function baueSpaltenKatalog(schemas: readonly CsvSchema[]): SpaltenEintrag[] {
  const perFeld = new Map<string, SpaltenEintrag>();
  // Je Feld die Programme, die es mappen — daraus `programmAnzahl`.
  const programmeJeFeld = new Map<string, Set<string>>();
  // Herkunft aus derselben Auflösung, die auch der Tooltip benutzt.
  const rohJeKanonisch = rohSpaltenJeFeld(schemas);

  for (const schema of schemas) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const kanonisch = entry.canonical?.trim();
      const feldId = kanonisch || spalte;
      const progs = programmeJeFeld.get(feldId) ?? new Set<string>();
      progs.add(schema.programm_id);
      programmeJeFeld.set(feldId, progs);
      const bestehend = perFeld.get(feldId);
      if (bestehend) {
        bestehend.schemaAnzahl++;
        continue;
      }
      // Über ALLE Schemas, nicht nur über das gerade betrachtete: zwei
      // Programme dürfen dasselbe kanonische Feld aus verschiedenen Spalten
      // speisen, und dann gehören beide Codes in die Herkunft.
      const quellSpalten = kanonisch
        ? (rohJeKanonisch.get(kanonisch) ?? [])
        : [{ code: spalte, label: entry.label?.trim() || '' }];
      perFeld.set(feldId, {
        feldId,
        label: entry.label?.trim() || (kanonisch ? kanonisch : spalte),
        typ: entry.type === 'date' ? 'datum' : 'wert',
        quelle: kanonisch ? 'kanonisch' : 'csv',
        schemaAnzahl: 1,
        programmAnzahl: 1,
        quellCodes: kanonisch ? quellSpalten.map(r => r.code) : [],
        quellSpalten,
      });
    }
  }

  for (const e of perFeld.values()) e.programmAnzahl = programmeJeFeld.get(e.feldId)?.size ?? 1;

  return [...perFeld.values()].sort((a, b) => {
    if (a.quelle !== b.quelle) return a.quelle === 'kanonisch' ? -1 : 1;
    return a.feldId.localeCompare(b.feldId, 'de');
  });
}

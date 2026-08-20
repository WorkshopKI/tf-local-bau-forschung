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
import type { CsvSchema } from './types';

/** Welche Operatoren zu einem Feld passen. */
export type SpaltenTyp = 'datum' | 'wert';

/** Eine rohe CSV-Spalte mit ihrer Beschriftung aus der Label-XLS. */
export interface RohSpalte {
  code: string;
  label: string;
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
  const out = new Map<string, RohSpalte[]>();
  for (const schema of schemas) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const feld = entry.canonical?.trim() || entry.custom?.trim();
      if (!feld) continue;
      const liste = out.get(feld) ?? [];
      if (liste.some(f => f.code === spalte)) continue;
      liste.push({ code: spalte, label: entry.label?.trim() || '' });
      out.set(feld, liste);
    }
  }
  return out;
}

export interface SpaltenEintrag {
  /** So referenziert eine Bedingung oder ein Katalog-Feld die Spalte. */
  feldId: string;
  label: string;
  typ: SpaltenTyp;
  /** Rohe CSV-Spalte oder kanonisches Feld — steuert nur die Anzeige-Gruppierung. */
  quelle: 'kanonisch' | 'csv';
  /** In wie vielen Schemas die Spalte gemappt ist (Hinweis auf Programm-Deckung). */
  schemaAnzahl: number;
  /**
   * Bei `quelle: 'kanonisch'`: die rohen CSV-Codes, die auf dieses Feld gemappt
   * sind (dedupliziert über alle Schemas). Ein kanonischer Key wie
   * `antragsdatum` sagt nämlich nicht, WORAUS er entsteht — und genau danach
   * fragt, wer eine Spalte auswählt. Bei `quelle: 'csv'` leer: dort IST die
   * `feldId` schon der Code.
   */
  quellCodes: string[];
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
  // Herkunft aus derselben Auflösung, die auch der Tooltip benutzt.
  const rohJeKanonisch = rohSpaltenJeFeld(schemas);

  for (const schema of schemas) {
    for (const [spalte, entry] of Object.entries(schema.column_mapping ?? {})) {
      if (!entry || entry.ignore) continue;
      const kanonisch = entry.canonical?.trim();
      const feldId = kanonisch || spalte;
      const bestehend = perFeld.get(feldId);
      if (bestehend) {
        bestehend.schemaAnzahl++;
        continue;
      }
      perFeld.set(feldId, {
        feldId,
        label: entry.label?.trim() || (kanonisch ? kanonisch : spalte),
        typ: entry.type === 'date' ? 'datum' : 'wert',
        quelle: kanonisch ? 'kanonisch' : 'csv',
        schemaAnzahl: 1,
        // Über ALLE Schemas, nicht nur über das gerade betrachtete: zwei
        // Programme dürfen dasselbe kanonische Feld aus verschiedenen Spalten
        // speisen, und dann gehören beide Codes in die Herkunft.
        quellCodes: kanonisch ? (rohJeKanonisch.get(kanonisch) ?? []).map(r => r.code) : [],
      });
    }
  }

  return [...perFeld.values()].sort((a, b) => {
    if (a.quelle !== b.quelle) return a.quelle === 'kanonisch' ? -1 : 1;
    return a.feldId.localeCompare(b.feldId, 'de');
  });
}

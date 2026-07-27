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

export interface SpaltenEintrag {
  /** So referenziert eine Bedingung oder ein Katalog-Feld die Spalte. */
  feldId: string;
  label: string;
  typ: SpaltenTyp;
  /** Rohe CSV-Spalte oder kanonisches Feld — steuert nur die Anzeige-Gruppierung. */
  quelle: 'kanonisch' | 'csv';
  /** In wie vielen Schemas die Spalte gemappt ist (Hinweis auf Programm-Deckung). */
  schemaAnzahl: number;
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
      });
    }
  }

  return [...perFeld.values()].sort((a, b) => {
    if (a.quelle !== b.quelle) return a.quelle === 'kanonisch' ? -1 : 1;
    return a.feldId.localeCompare(b.feldId, 'de');
  });
}

/**
 * Korpus aus der Vorhabensbeschreibung und ihren Zusatzdokumenten.
 *
 * In der Praxis ist die VB fast nie eine Datei: Hauptdokument plus Marktkonzept,
 * Verwertung und Wirkung liegen meist als eigene PDFs bei. Für die inhaltliche
 * Prüfung sind sie EIN Text — ob eine Aussage im Hauptdokument oder im
 * Marktkonzept steht, darf das Ergebnis nicht verändern.
 *
 * Das Zusammenführen selbst kommt **wörtlich** aus der Antrag-Aufbereitung
 * (`baueKorpus`): Hauptdokument als Präfix, jedes Zusatzdokument per `---` und
 * `## [Quelle: <name>]` angehängt. Damit bleiben die Sektions-IDs des
 * Hauptdokuments stabil, und die Gliederung zeigt die Dokumentgrenze als eigene
 * Überschrift. Ein zweites Korpus-Format hier wäre stille Drift.
 *
 * Auch die Cap-Messung (`misseKorpus`) kommt von dort — die Lücke, die sie
 * schliesst, betrifft beide Module gleichermassen.
 */
import { baueKorpus, misseKorpus, type KorpusDok, type KorpusMass } from '@/plugins/antraege/aufbereitung/quellen';

export interface MapKorpus extends KorpusMass {
  /** Hauptdokument, gefolgt von den quellenmarkierten Zusatzdokumenten. */
  markdown: string;
}

/**
 * Führt Haupt- und Zusatzdokumente zusammen und meldet, ob das Ergebnis das
 * Kontextfenster sprengt. Rein.
 *
 * Ohne Zusatzdokumente ist `markdown` byte-identisch zum Hauptdokument — ein
 * bereits berechneter Baustein bleibt damit gültig (der Cache keyt auf dem Hash
 * des Korpus).
 */
export function baueMapKorpus(
  haupt: KorpusDok, zusatz: readonly KorpusDok[], cap: number,
): MapKorpus {
  const markdown = baueKorpus(haupt, [...zusatz]);
  return { markdown, ...misseKorpus(markdown, cap) };
}

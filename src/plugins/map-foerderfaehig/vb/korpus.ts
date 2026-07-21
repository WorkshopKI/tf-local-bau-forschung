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
 * Der Cap-Check ist der Grund, warum diese Datei überhaupt existiert: Die
 * Baustein-Schiene (`runBaustein`) kürzt NICHT und warnt NICHT — sie umgeht
 * `runSkill` und damit `capVbMarkdown`. Die Upload-Warnung prüft jede Datei
 * einzeln, nie ihre Summe. Bei vier Dokumenten ist das Kontextfenster real
 * erreichbar, und ein stillschweigend abgeschnittener Korpus wäre in einer
 * Förderprüfung der schlechtestmögliche Fehler: das Modell urteilt dann über
 * einen Text, dessen Ende es nie gesehen hat.
 */
import { baueKorpus, type KorpusDok } from '@/plugins/antraege/aufbereitung/quellen';

export interface MapKorpus {
  /** Hauptdokument, gefolgt von den quellenmarkierten Zusatzdokumenten. */
  markdown: string;
  zeichen: number;
  /** Zeichen-Obergrenze des internen Modells (aus dem erkannten Kontextfenster). */
  cap: number;
  /** true = der Korpus passt nicht vollständig ins Kontextfenster. */
  ueberCap: boolean;
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
  return {
    markdown,
    zeichen: markdown.length,
    cap,
    ueberCap: markdown.length > cap,
  };
}

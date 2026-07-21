/**
 * Korpus-Primitive der Antrags-Domäne: mehrere Dokumente zu EINEM Text zusammenführen
 * und diesen gegen das Kontextfenster messen. Rein (node-testbar, kein React, kein IDB).
 *
 * Liegt bewusst auf Plugin-Wurzel-Ebene statt in `aufbereitung/`: die Aufbereitung ist
 * dev-gegated, die Konsumenten sind es nicht (Gutachten läuft in prod/kurator/pl/as).
 * `aufbereitung/quellen.ts` re-exportiert von hier, damit bestehende Importeure
 * unverändert bleiben.
 */

/** Ein Dokument im Korpus (Name für die Quellenmarkierung + Volltext). */
export interface KorpusDok {
  name: string;
  markdown: string;
}

/** Umfang eines Korpus gegen das Kontextfenster des Modells. */
export interface KorpusMass {
  zeichen: number;
  /** Zeichen-Obergrenze aus dem erkannten Kontextfenster (`getVbCharCap`). */
  cap: number;
  /** true = der Korpus passt nicht vollständig ins Kontextfenster. */
  ueberCap: boolean;
}

/**
 * Reine Zusammenführung: Hauptdokument (Präfix — dadurch bleiben alle seine
 * Sektions-Offsets/-IDs identisch) + je Zusatzdokument ein quellenmarkierter, per
 * `---` getrennter Abschnitt. Ohne Zusatzdokumente byte-identisch zum Haupt-Markdown.
 *
 * Die Präfix-Eigenschaft ist die Grundlage zweier Caches: die Gutachten-Relevanz-Map
 * keyt auf `hashText(...)` und rechnet Heading-Spans in genau diesen String, und die
 * Aufbereitungs-Bausteine keyen auf den Korpus-Hash. Leerer `narrative` ⇒ gleicher
 * String ⇒ gleicher Hash ⇒ bestehende Caches bleiben gültig.
 */
export function baueKorpus(vb: KorpusDok, narrative: KorpusDok[]): string {
  if (narrative.length === 0) return vb.markdown;
  let out = vb.markdown;
  for (const d of narrative) out += `\n\n---\n\n## [Quelle: ${d.name}]\n\n${d.markdown}`;
  return out;
}

/**
 * Misst den Korpus gegen die Zeichen-Obergrenze. Rein.
 *
 * Der Grund für diese Funktion ist eine echte Lücke: die Baustein-Schiene
 * (`runBaustein`) baut ihre Messages selbst und umgeht damit `runSkill` — also
 * auch `capVbMarkdown`. Sie kürzt nicht und warnt nicht. Die Upload-Warnung in
 * `DokumentAufnahme` prüft jede Datei EINZELN, nie ihre Summe. VB und
 * Marketingkonzept passieren also beide unauffällig, während ihr Korpus das
 * Kontextfenster sprengt — das Modell urteilt dann über einen Text, dessen Ende
 * es nie gesehen hat, ohne dass irgendwo ein Hinweis erscheint.
 *
 * Bewusst nur MESSEN, nicht kürzen: eine stille Kürzung wäre in einer
 * Förderprüfung der schlechtere Fehler, und sie würde bestehende Ergebnisse
 * verändern. Die Entscheidung, was mit einem zu grossen Korpus geschieht, gehört
 * dem Prüfer.
 */
export function misseKorpus(markdown: string, cap: number): KorpusMass {
  return { zeichen: markdown.length, cap, ueberCap: markdown.length > cap };
}

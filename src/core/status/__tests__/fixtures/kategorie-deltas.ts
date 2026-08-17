/**
 * **Die Kategorie-Deltas der Fassaden-Umstellung (v2.383)** — abschließend.
 *
 * Bis dahin hielt `status-canonical.ts` eine handgeschriebene Tabelle
 * „Rohtext → Kategorie" neben dem Code-Katalog. Sie kannte nur 21 der 30
 * amtlichen Status-Codes unter ihrem amtlichen Namen; seit die Fassade aus
 * Code + ZAH-Phase gespeist wird, trifft jede gepflegte Schreibweise.
 *
 * Fünf Werte stehen deshalb heute anders da als unter der Handtabelle. Die
 * Liste ist **im Test abschließend** (`kategorie-ableitung.test.ts`), damit ein
 * sechstes Delta auffliegt: wer die Ableitung ändert und hier nichts ergänzt,
 * verschiebt stillschweigend, wo Anträge in den Arbeitslisten stehen.
 *
 * `neu` ist immer der **heutige** Stand, nicht der von v2.383: bei Code 72 hat
 * ihn v4.87 ein zweites Mal bewegt. Der Vergleichspunkt `alt` bleibt die
 * Handtabelle — was diese Liste misst, ist der Abstand zu ihr.
 *
 * `alt` ist, was die Handtabelle lieferte — inklusive ihres VN/ZB-Pattern-
 * Fallbacks. Die Zählungen stammen aus dem Bestand vom 02.08.2026 (14 221
 * Anträge / 7 534 Verbünde, Katalog-Fassung 7) und sind ein **Protokoll**: sie
 * belegen, wie viele Vorgänge der Wechsel im Ist betraf, und werden vom Test
 * nicht nachgerechnet.
 */
import type { StatusCategory } from '../../typen';

export interface KategorieDelta {
  statusRoh: string;
  code: number;
  alt: StatusCategory;
  neu: StatusCategory;
  /** Vorkommen im Bestand: Teilvorhaben / Verbünde. */
  anzahl: { tv: number; vb: number };
  erklaerung: string;
}

export const KATEGORIE_DELTAS: readonly KategorieDelta[] = [
  // Ein sechstes Delta stand hier bis v2.410: „NL eingegangen" (36) wanderte
  // mit der Fassaden-Umstellung von `offen` nach `nachforderung`, weil die
  // Regel „Phase Vollständigkeit, Codes 35–37" alle drei bündelte. Mit v2.411
  // ist die Bündelung zurückgenommen (die Arbeitsliste heißt seit A3 „Wartet
  // auf Antragsteller" und beschreibt damit die Zuständigkeit, nicht die
  // Vorgangsart) — 36 steht wieder auf `offen`, ist also kein Delta mehr.
  {
    statusRoh: 'Stellungnahme zur Rücknahmeempfehlung', code: 72,
    alt: 'sonstige', neu: 'in_pruefung',
    anzahl: { tv: 15, vb: 1 },
    erklaerung:
      'Die Handtabelle führte nur die ABGEKÜRZTE Schreibweise („…Rücknahmeempf."); '
      + 'der Export schreibt sie aus. 16 Vorgänge fielen deshalb auf `sonstige` und '
      + 'tauchten in keiner Arbeitsliste auf — der einzige der sechs Deltas, der '
      + 'schon vorher ein Fehler war. Die Fassaden-Umstellung setzte ihn auf '
      + '`entscheidung`; mit v4.87 steht er auf `in_pruefung`, weil eine '
      + 'eingegangene Stellungnahme bearbeitet wird und die Entscheidung erst '
      + 'danach ansteht (so kuratiert in Katalog-Fassung 23, jetzt am Code).',
  },
  {
    statusRoh: 'unvollständig', code: 33, alt: 'sonstige', neu: 'offen',
    anzahl: { tv: 6, vb: 2 },
    erklaerung:
      'Handtabellen-Fehler, Korrektur beabsichtigt: Code 33 liegt in der Phase '
      + 'Vollständigkeit und ist offene Arbeit. Unter `sonstige` war er in keiner '
      + 'Arbeitsliste sichtbar. NICHT mitkorrigiert wird 29 Irrläufer — der bleibt '
      + 'Marker ohne Phase, und diese Asymmetrie ist gewollt.',
  },
  {
    statusRoh: 'Skizze eingegangen', code: 11, alt: 'sonstige', neu: 'offen',
    anzahl: { tv: 0, vb: 0 },
    erklaerung: 'Stand gar nicht in der Handtabelle. Kommt im Bestand nicht vor.',
  },
  {
    statusRoh: 'Ablehnung versandt', code: 70, alt: 'sonstige', neu: 'entscheidung',
    anzahl: { tv: 0, vb: 0 },
    erklaerung:
      'Die Handtabelle kannte nur die Kurzform „Ablehnung", die der Export heute '
      + 'liefert. Schriebe er den amtlichen Text, fiele er auf `sonstige` — die '
      + 'Lücke war da, nur unsichtbar.',
  },
  {
    statusRoh: 'Rücknahmeempfehlung versandt', code: 71, alt: 'sonstige', neu: 'entscheidung',
    anzahl: { tv: 0, vb: 0 },
    erklaerung: 'Wie 70: die Tabelle kannte nur „Rücknahmeempfehlung".',
  },
];

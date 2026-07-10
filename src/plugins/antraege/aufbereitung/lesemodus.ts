/**
 * Lesemodus der Antrag-Aufbereitung: schneidet die Vorhabensbeschreibung entlang der
 * Gliederungs-Offsets in lesbare, verankerte Abschnitte. So kann eine Fundstelle
 * (`sektionId`) aus jedem anderen Tab („Im Antrag öffnen") gezielt angesprungen werden.
 * Reine Funktion (Node-testbar); das Rendering macht `LesemodusTab` über den geteilten
 * `MarkdownRenderer`.
 */
import type { VbSektion } from './gliederung';

/** Ein lesbarer VB-Abschnitt (Roh-Markdown + Anker-Metadaten). */
export interface LeseAbschnitt {
  id: string;
  nummer?: string;
  titel: string;
  ebene: 1 | 2 | 3;
  /** Roh-Markdown des Abschnitts (aus dem VB entlang der Gliederungs-Offsets geschnitten). */
  text: string;
}

/**
 * Schneidet die VB entlang der Gliederungs-Offsets in Abschnitte. `s-toc`
 * (Inhaltsverzeichnis) wird ausgelassen; Abschnitte in Dokumentreihenfolge (nach
 * `start`). Ein leerer/kaputter Span ergibt einen Abschnitt mit leerem `text` (die
 * Überschrift bleibt als Anker/Navigation erhalten). Der Slice enthält die
 * Überschriftszeile selbst (Offset = Zeilenanfang) → der Renderer zeigt sie.
 */
export function sliceLesemodus(vbMarkdown: string, gliederung: VbSektion[]): LeseAbschnitt[] {
  return gliederung
    .filter(s => s.id !== 's-toc')
    .slice()
    .sort((a, b) => a.start - b.start)
    .map(s => {
      const von = Math.max(0, Math.min(s.start, vbMarkdown.length));
      const bis = s.end > von ? Math.min(s.end, vbMarkdown.length) : vbMarkdown.length;
      return {
        id: s.id,
        ...(s.nummer ? { nummer: s.nummer } : {}),
        titel: s.titel,
        ebene: s.ebene,
        text: vbMarkdown.slice(von, bis).trim(),
      };
    });
}

/**
 * Was das Suchfeld im **Frage-Modus der Förderantrags-Liste** vorschlägt —
 * der Katalog. Die Mechanik (Abschnitte, Lücken, Tastatur) ist geteilt und
 * steht in [@/components/frage-vorschlaege](src/components/frage-vorschlaege/abschnitte.ts);
 * hier steht nur, was auf DIESER Seite fragbar ist.
 *
 * **Vorgeschlagen wird nur, was die App auch ausführen kann.** Jede Frage hier
 * spricht ausschließlich Achsen an, die der [Antragsplan](./antragsplan.ts)
 * kennt — Status, Variante, Jahr, Projektart, PreCheck, Bearbeiter, Stillstand,
 * Thema. Eine Beispielfrage nach dem Ort wäre eine Einladung in die Zeile
 * „nicht berücksichtigt".
 *
 * Rein — kein React, kein Speicher, keine Uhr.
 */
import { IRRLAEUFER_PHASE, VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import {
  baueFrageAbschnitte as baueAbschnitte, luecke,
  type FrageAbschnitt, type FrageKatalog,
} from '@/components/frage-vorschlaege';

export {
  ersteLuecke, flacheListe, hatLuecke, LUECKE_AUF, LUECKE_ZU,
  type FrageAbschnitt, type FrageVorschlag, type FrageVorschlagArt,
} from '@/components/frage-vorschlaege';

/**
 * Die Fördervarianten als Aufzählung — aus `VB_PHASE_LABELS`, nicht
 * abgeschrieben. Dieselbe Einzelquelle, aus der auch der Prompt seine erlaubten
 * Werte nimmt: eine Hilfe, die andere Werte nennt als die Maschine akzeptiert,
 * ist schlimmer als keine.
 *
 * Ohne den Irrläufer, und zwar über seine benannte Konstante statt über eine
 * eigene Liste: er ist keine Fördervariante, nach der man fragt, sondern ein
 * falsch adressierter Antrag. Der Plan nähme ihn an — vorschlagen muss man ihn
 * deswegen nicht.
 */
function variantenHinweis(): string {
  const namen = Object.entries(VB_PHASE_LABELS)
    .filter(([n]) => Number(n) !== IRRLAEUFER_PHASE)
    .map(([, label]) => label);
  return `Variante: ${namen.join(' · ')}`;
}

/**
 * Der Katalog dieser Seite.
 *
 * Die drei Beispiele treffen je eine andere Achsen-Kombination, damit die Liste
 * einen Vorrat zeigt und nicht dreimal dasselbe. Sie sind absichtlich
 * ausformuliert und nicht knapp: Nutzer schreiben in ganzen Sätzen, und ein
 * Beispiel, das wie eine Filterzeile aussieht, erzieht zu Stichworten — dafür
 * gibt es den anderen Modus.
 *
 * Jede Lücke einer Vorlage NENNT, was hineingehört — sie trägt keinen
 * Beispielwert, den man erst als Lücke erkennen müsste.
 */
export const ANTRAGS_FRAGE_KATALOG: FrageKatalog = {
  praefix: 'antraege',
  beispiele: [
    {
      text: 'alle Einzelprojekte aus den Jahren 2025 und 2026, die noch keinen PreCheck haben',
      erklaerung: 'Projektart · Jahr · PreCheck',
    },
    {
      text: 'alle Anträge, die noch in Bearbeitung sind und seit mehr als 2 Monaten kein neues Kürzel bekommen haben',
      erklaerung: 'Status · Stillstand',
    },
    {
      text: 'alle Netzwerkanträge der Phase 2, die abgeschlossen sind',
      erklaerung: 'Variante · Status',
    },
  ],
  vorlagen: [
    {
      text: `alle ${luecke('Variante')}-Anträge aus dem Jahr ${luecke('Jahr')}, die noch keinen PreCheck haben`,
      hinweis: variantenHinweis(),
    },
    {
      text: `alle Anträge von Bearbeiter ${luecke('Kürzel')}, bei denen seit mehr als ${luecke('Anzahl')} Monaten nichts passiert ist`,
      hinweis: 'Kürzel wie THÜ · Anzahl in Monaten',
    },
    {
      text: `alle Anträge zum Thema ${luecke('Stichwort')}, die noch in Bearbeitung sind`,
      hinweis: 'Stichwort aus Titel, Kurzbeschreibung oder aufgenommenen Dokumenten',
    },
  ],
};

/** Die Abschnitte dieser Seite — der geteilte Bau mit dem Katalog von oben. */
export function baueFrageAbschnitte(
  text: string,
  verlauf: readonly string[],
): FrageAbschnitt[] {
  return baueAbschnitte(text, verlauf, ANTRAGS_FRAGE_KATALOG);
}

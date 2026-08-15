/**
 * Der Feld-Vorrat des **To-do-Regel-Editors** — und damit die Antwort auf die
 * Frage, welche Spalte eine Kaskaden-Bedingung überhaupt nennen darf.
 *
 * Bis v2.386 bot der Editor die **CSV-Schema-Spalten** an (`baueSpaltenKatalog`),
 * geprüft wurde beim Share-Import aber gegen die **Katalog-Felder**. Zwei
 * Vokabulare, ein Editor: eine dort gebaute Regel konnte beim Import scheitern
 * („verweist auf unbekanntes Feld") oder — schlimmer — stillschweigend nie
 * zutreffen, weil `baueTodoKontext` den Schlüssel gar nicht kennt.
 *
 * Deshalb speist sich der Vorrat jetzt aus der **Fassung selbst**: jedes Feld
 * plus seine Begleit-Textspalte (`T_XPC+` zu `D_XPC+` — anderer Wert, gleiches
 * Feld). Derselbe Satz, den `referenzierbareFelder` prüft.
 *
 * Rein: keine IO, kein React.
 */
import type { SpaltenEintrag } from '@/core/services/csv/spalten-inventar';
import type { StatusFeldEintrag } from '@/core/status';

/** Katalog-Feldtypen jenseits von Datum werden im Editor als „Wert" bedient. */
function spaltenTyp(f: StatusFeldEintrag): SpaltenEintrag['typ'] {
  return f.typ === 'datum' ? 'datum' : 'wert';
}

/**
 * Baut den Auswahl-Vorrat aus den Feldern einer Fassung.
 *
 * Sortierung wie im Spalten-Inventar: kanonische Felder (die ohne `code`) zuerst,
 * danach die Code-Spalten alphabetisch — sonst springt die Liste mit jeder
 * Katalog-Änderung.
 */
export function baueTodoFeldVorrat(felder: readonly StatusFeldEintrag[]): SpaltenEintrag[] {
  const out = new Map<string, SpaltenEintrag>();
  for (const f of felder) {
    if (!f.aktiv) continue;
    if (!out.has(f.feldId)) {
      out.set(f.feldId, {
        feldId: f.feldId,
        label: f.label || f.feldId,
        typ: spaltenTyp(f),
        quelle: f.code === undefined ? 'kanonisch' : 'csv',
        schemaAnzahl: 1,
        // Der Katalog-Vorrat kennt keine CSV-Herkunft: seine Felder kommen aus
        // der Katalog-Fassung, nicht aus einem Schema-Mapping.
        quellCodes: [],
      });
    }
    // Die Textspalte ist ein eigener Wert, kein Datum — die Mappe fragt sie mit
    // „gefüllt" ab (R20/R21).
    if (f.textSpalte && !out.has(f.textSpalte)) {
      out.set(f.textSpalte, {
        feldId: f.textSpalte,
        label: `${f.label || f.feldId} · Vermerk`,
        typ: 'wert',
        quelle: 'csv',
        schemaAnzahl: 1,
        quellCodes: [],
      });
    }
  }
  return [...out.values()].sort((a, b) => {
    if (a.quelle !== b.quelle) return a.quelle === 'kanonisch' ? -1 : 1;
    return a.feldId.localeCompare(b.feldId, 'de');
  });
}

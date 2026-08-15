/**
 * Woraus entsteht welche Spalte der Fördertabelle — der Text hinter dem
 * Spaltenkopf und dem ⓘ im Spalten-Picker.
 *
 * **Zwei Schichten, und die zweite ist die wichtige.** Der *Satz* ist von Hand
 * geschrieben und sagt, was die Spalte bedeutet. Die *Felder* kommen, wo immer
 * es geht, aus den geladenen Programm-Schemas — nicht aus einer Liste hier.
 * Genau das ist der Punkt: welche Kürzel in „PreCheck Status" zusammenlaufen,
 * entscheidet das Mapping der Kuration, und ein hier abgeschriebener Satz wäre
 * ab der nächsten Mapping-Änderung still falsch. Was die App ohnehin auflöst,
 * darf sie auch zeigen.
 *
 * Wo eine Spalte nicht aus einer CSV-Spalte kommt, sondern gerechnet wird
 * (Frist), stehen die Codes fest — dann aber als das, was der Rechenweg
 * tatsächlich liest, mit Quelle im Kommentar.
 *
 * Rein: keine IO, keine Hooks. Die Schemas reicht der Aufrufer herein
 * (`useSpaltenHilfe`).
 */
import type { SortableColumn, SpaltenHilfe } from '@/components/data-table/types';
import type { CsvSchema } from '@/core/services/csv/types';
import { ANTRAG_SLA_DAYS, VN_SLA_MONTHS } from '@/core/services/csv/frist';
import { CANONICAL_FIELD_KEYS } from '@/core/services/csv/constants';
import { rohSpaltenJeKanonisch } from '@/core/services/csv/spalten-inventar';
import {
  resolveStatusDatumGruppen,
  type ResolvedKategorieSpalten,
  type StatusDatumFeld,
} from '@/core/services/csv/status-datum-gruppen';
import { KATEGORIE_COLUMN_PREFIX } from './tableColumns';

/**
 * Ein Satz je Spalte — was zeigt sie, in der Sprache der Bearbeitung.
 *
 * Vollständigkeit ist Pflicht und wird von einem Convention-Guard gehalten:
 * eine neue Spalte ohne Eintrag fällt im Gate auf, nicht erst im Betrieb.
 */
const SAETZE: Record<string, string> = {
  aktenzeichen:
    'Förderkennzeichen des Teilvorhabens. In einer Verbund-Zeile steht stattdessen die Spanne über alle Teilvorhaben und dahinter ihre Anzahl.',
  tib_kuerz: 'Kürzel der zuständigen Person in der Rolle FB während der Antragsphase.',
  bib_kuerz: 'Kürzel der zuständigen Person in der Rolle AB während der Antragsphase.',
  ztp_kuerz: 'Kürzel der zuständigen Person in der Rolle FB während der Begleitphase.',
  pfm_kuerz: 'Kürzel der zuständigen Person in der Rolle AB während der Begleitphase.',
  akronym: 'Kurzname des Vorhabens.',
  antragsteller: 'Einrichtung oder Unternehmen, das den Antrag gestellt hat.',
  status_naechster_schritt:
    'Der amtliche Status aus dem Fachsystem und daneben die Handlung, die als Nächstes ansteht. Die App leitet den Status nicht ab — sie zeigt ihn, wie er importiert wurde.',
  status: 'Der amtliche Status des Teilvorhabens aus dem Fachsystem, ohne den nächsten Schritt.',
  fb_status: 'Der zuletzt gesetzte Bearbeitungsstand aus der FB-Spur.',
  precheck_status: 'Der zuletzt gesetzte Stand der Vorprüfung (pre-check).',
  frist:
    'Verbleibende Zeit der Bearbeitungsfrist. Kein importiertes Datum, sondern gerechnet — und nur dort, wo die Uhr in dieser Phase überhaupt läuft.',
  titel: 'Vollständiger Titel des Teilvorhabens.',
  verbund_titel: 'Titel des Verbundes — für alle Teilvorhaben darin derselbe.',
  vb_phase: 'Art des Vorhabens (FuE, DS, DL, NW), abgeleitet aus der Fördervariante.',
  bewilligung_datum: 'Datum der Bewilligung.',
  erstentscheidung:
    'Datum der vorläufigen Erstentscheidung — der Entscheidung, gegen die noch Widerspruch möglich ist.',
  antragsdatum: 'Datum, an dem der Antrag eingegangen ist.',
  ort_ast: 'Sitz des Antragstellers.',
  foerdersumme: 'Die aktuelle Zuwendung als Förderbetrag.',
  laufzeitbeginn: 'Beginn der Vorhabenlaufzeit.',
  laufzeitende: 'Ende der Vorhabenlaufzeit.',
  branche: 'Branche des Antragstellers.',
  foerdergeber: 'Stelle, die die Förderung ausreicht.',
};

/** Wie der angezeigte Wert gewählt wird — nur wo er gewählt und nicht übernommen wird. */
const REGELN: Record<string, string> = {
  status_naechster_schritt:
    'Sortiert nach dem Rang des Status, bei Gleichstand nach der Handlung.',
  // Die beiden Fristlängen kommen aus den Konstanten, nicht als Ziffer in den
  // Satz: eine abgeschriebene Zahl im Tooltip lügt beim nächsten Wechsel.
  frist:
    `Gerechnet ab dem wirksamen Eingang — dem späteren der beiden Eingangsdaten — plus ${ANTRAG_SLA_DAYS} Tage. `
    + `Bei Verwendungsnachweisen stattdessen ab dessen Eingang plus ${VN_SLA_MONTHS} Monate. `
    + 'In Phasen ohne laufende Frist steht „angehalten", ohne Grundlage bleibt die Zelle leer.',
};

/**
 * Die Regel der Datums-Status-Spalten: FB, PreCheck und jeder kuratierte Ordner
 * teilen sie sich (eine Factory, ein Rechenweg).
 */
const REGEL_JUENGSTES =
  'Von allen unten genannten Feldern gewinnt das jüngste gesetzte Datum; bei gleichem Datum entscheidet die Reihenfolge der Felder. Angezeigt wird die Beschriftung, im Tooltip der Zelle das Datum.';

/**
 * Feste Feldangaben für Spalten, die nicht aus einer gemappten CSV-Spalte
 * kommen. Nur hier, weil der Rechenweg diese Codes wirklich liest:
 * `frist-ergebnis.ts` (`FristBasisFeld`, `FRIST_GRUND.ohneVnEingang`).
 */
const FESTE_FELDER: Record<string, { code: string; label: string }[]> = {
  frist: [
    { code: 'D_AAE', label: 'Antragseingang' },
    { code: 'D_XTE', label: 'alle Anträge da' },
    { code: 'D_VBE', label: 'Eingang Verwendungsnachweis' },
  ],
};

// `rohSpaltenJeKanonisch` wohnt seit v4.57.1 im Spalten-Inventar
// (`csv/spalten-inventar.ts`): der Feld-Vorrat des Anlege-Dialogs braucht
// dieselbe Auflösung, um die Herkunft eines kanonischen Feldes anzuzeigen.
// Zwei Fassungen liefen bei der ersten Mapping-Feinheit auseinander — dann
// behauptete der Tooltip etwas anderes als die Auswahlliste.

/** Spalten-Keys, die auf ein kanonisches Feld zeigen — nur für sie ist ein
 *  fehlendes Mapping eine Aussage und kein Normalfall. */
const KANONISCHE_KEYS: ReadonlySet<string> = new Set<string>(CANONICAL_FIELD_KEYS);

/** Feldliste einer Datums-Status-Gruppe in die Hilfe-Form bringen. */
function alsHilfeFelder(felder: readonly StatusDatumFeld[]): { code: string; label: string }[] {
  return felder.map(f => ({ code: f.code, label: f.label }));
}

/** Text für einen Ordner, dessen Felder dieses Programm nicht mappt. */
const OHNE_MAPPING = 'In diesem Programm ist dafür keine Spalte gemappt — die Zelle bleibt leer.';

export interface HilfeQuellen {
  /** Schemas des aktiven Programms. Leer = nur die Sätze, keine Feldlisten. */
  schemas: readonly CsvSchema[];
  /** Ordner-Spalten MIT aufgelösten Feldern (nur die, die hier Daten tragen). */
  kategorieSpalten?: readonly ResolvedKategorieSpalten[];
  /**
   * ALLE Ordner des Katalogs, die eine Spalte stellen — dieselbe Liste, die der
   * Picker anbietet.
   *
   * Sie ist absichtlich länger als `kategorieSpalten`: der Picker zeigt jeden
   * Ordner des Katalogs, aufgelöst wird nur, was dieses Programm auch mappt
   * (siehe `kategorienMitDatumsfeldern` gegen `loeseKategorieSpalten`). Genau
   * die Differenz sind die Spalten, die garantiert leer bleiben — und ohne
   * diese Liste wären ausgerechnet sie die einzigen ohne Erklärung.
   */
  katalogOrdner?: readonly { kategorieId: string; label: string }[];
}

/**
 * Baut die Herkunftsangabe je Spalten-Key.
 *
 * Ohne Schemas entsteht trotzdem eine brauchbare Karte: jede Spalte behält
 * ihren Satz, nur die Feldlisten fehlen. Das ist der Zustand vor dem ersten
 * Import — und dort wäre eine erfundene Feldliste schlechter als keine.
 */
export function baueSpaltenHilfe(
  { schemas, kategorieSpalten = [], katalogOrdner = [] }: HilfeQuellen,
): Map<string, SpaltenHilfe> {
  const roh = rohSpaltenJeKanonisch(schemas);
  const karte = new Map<string, SpaltenHilfe>();

  for (const [key, satz] of Object.entries(SAETZE)) {
    const felder = FESTE_FELDER[key] ?? roh.get(key);
    const leer = !felder || felder.length === 0;
    karte.set(key, {
      satz,
      ...(leer ? null : { felder }),
      ...(REGELN[key] ? { regel: REGELN[key] } : null),
      // Eine Spalte, die auf ein kanonisches Feld zeigt, das dieses Programm
      // NICHT mappt, bleibt garantiert leer. Ohne diesen Satz sähe man nur die
      // leere Zelle und suchte den Fehler bei den Daten statt beim Mapping.
      // Nur mit geladenem Schema: ohne Import wäre die Aussage bloß verfrüht.
      ...(leer && schemas.length > 0 && KANONISCHE_KEYS.has(key)
        ? { hinweis: 'In diesem Programm ist dafür keine Spalte gemappt — die Zelle bleibt leer.' }
        : null),
    });
  }

  // Die beiden Datums-Status-Gruppen: Felder aus dem Schema, Regel geteilt.
  const gruppen = resolveStatusDatumGruppen(schemas);
  for (const g of gruppen) {
    const key = g.labelKey === 'fb_status_label' ? 'fb_status' : 'precheck_status';
    const satz = SAETZE[key];
    if (satz === undefined) continue;
    karte.set(key, {
      satz,
      regel: REGEL_JUENGSTES,
      ...(g.felder.length > 0 ? { felder: alsHilfeFelder(g.felder) } : null),
    });
  }

  // Die kuratierten Ordner-Spalten stehen nicht in `SAETZE` — welche es gibt,
  // entscheidet der Katalog. Ihr Satz entsteht deshalb aus dem Ordnernamen.
  //
  // Erst der ganze Katalog (jeder Ordner bekommt einen Satz, die ohne Mapping
  // dazu den Hinweis), dann die aufgelösten obendrauf — so trägt jede Spalte
  // des Pickers eine Erklärung, und die mit Daten die genauere.
  const satzFuer = (label: string): string =>
    `Der zuletzt gesetzte Eintrag aus dem Ordner „${label}" des Statuskatalogs.`;

  for (const k of katalogOrdner) {
    karte.set(`${KATEGORIE_COLUMN_PREFIX}${k.kategorieId}`, {
      satz: satzFuer(k.label),
      ...(schemas.length > 0 ? { hinweis: OHNE_MAPPING } : null),
    });
  }
  for (const k of kategorieSpalten) {
    karte.set(`${KATEGORIE_COLUMN_PREFIX}${k.kategorieId}`, {
      satz: satzFuer(k.label),
      regel: REGEL_JUENGSTES,
      ...(k.felder.length > 0 ? { felder: alsHilfeFelder(k.felder) } : null),
    });
  }

  return karte;
}

/**
 * Hängt die Herkunft an die Spalten. Neue Objekte nur dort, wo es eine gibt —
 * eine Spalte ohne Eintrag bleibt identisch, damit die Referenz-Vergleiche der
 * Memoisierung weiter greifen.
 */
export function mitSpaltenHilfe<T>(
  spalten: readonly SortableColumn<T>[],
  karte: ReadonlyMap<string, SpaltenHilfe>,
): SortableColumn<T>[] {
  return spalten.map(c => {
    const hilfe = karte.get(c.key);
    return hilfe ? { ...c, hilfe } : c;
  });
}

/** Die Keys mit hinterlegtem Satz — der Guard prüft dagegen die Registry. */
export const SPALTEN_MIT_SATZ: readonly string[] = Object.keys(SAETZE);

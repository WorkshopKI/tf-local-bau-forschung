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
import { baueQuellSpaltenIndex, rohSpaltenJeFeld } from '@/core/services/csv/spalten-inventar';
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
  antrag:
    'Kurzname und Förderkennzeichen des Vorhabens in einer Spalte, sortiert nach dem Kurznamen. In einer Verbund-Zeile steht die Spanne über alle Teilvorhaben und dahinter ihre Anzahl. Beide Felder gibt es weiterhin auch als eigene Spalten.',
  aktenzeichen:
    'Förderkennzeichen des Teilvorhabens. In einer Verbund-Zeile steht stattdessen die Spanne über alle Teilvorhaben und dahinter ihre Anzahl.',
  tib_kuerz: 'Kürzel der zuständigen Person in der Rolle FB während der Antragsphase.',
  bib_kuerz: 'Kürzel der zuständigen Person in der Rolle AB während der Antragsphase.',
  ztp_kuerz: 'Kürzel der zuständigen Person in der Rolle FB während der Begleitphase.',
  pfm_kuerz: 'Kürzel der zuständigen Person in der Rolle AB während der Begleitphase.',
  zustaendig:
    'Beide Kürzel der Antragsphase in einer Spalte: FB und AB. Die Begleitphase steht bewusst nicht darin — sie hat ihre eigenen beiden Spalten.',
  akronym: 'Kurzname des Vorhabens.',
  antragsteller: 'Einrichtung oder Unternehmen, das den Antrag gestellt hat.',
  status_naechster_schritt:
    'Der amtliche Status aus dem Fachsystem und daneben die Handlung, die als Nächstes ansteht. Die App leitet den Status nicht ab — sie zeigt ihn, wie er importiert wurde.',
  status: 'Der amtliche Status des Teilvorhabens aus dem Fachsystem, ohne den nächsten Schritt.',
  fb_status: 'Der zuletzt gesetzte Bearbeitungsstand aus der FB-Spur.',
  precheck_status: 'Der zuletzt gesetzte Stand der Vorprüfung (pre-check).',
  fb_precheck:
    'FB-Spur und Vorprüfung nebeneinander in einer Spalte — dieselben zwei Werte wie in den Einzelspalten. Der Punkt markiert nur die Vorprüfung: für sie gibt es die Einteilung positiv, negativ und offen, für die FB-Spur nicht.',
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
  //
  // „dem späteren der beiden Eingangsdaten" ist seit v4.126 wieder wahr: die
  // Projektion führt `D_XTE` (`alle_antraege_da`), und die Zelle reicht es an
  // `berechneFrist` durch. Der Satz stand bis v4.121 schon einmal hier — damals
  // ohne Deckung, weil das Feld leer war. Jetzt deckt ihn der Rechenweg.
  frist:
    'Gerechnet ab dem wirksamen Eingang — dem späteren aus Antragseingang und '
    + `„alle Anträge da" — plus ${ANTRAG_SLA_DAYS} Tage. `
    + `Bei Verwendungsnachweisen stattdessen ab dessen Eingang plus ${VN_SLA_MONTHS} Monate. `
    + 'In Phasen ohne laufende Frist steht „angehalten", ohne Grundlage bleibt die Zelle leer. '
    + 'In einer Verbund-Zeile steht die dringendste Frist über alle Teilvorhaben. '
    // Übrig bleibt als Unterschied zum Ausklapp nur noch das Haltedatum — die
    // Eingangs-Achse ist mit v4.126 auf beiden Seiten dieselbe.
    + 'Der aufgeklappte Bereich derselben Zeile kennt zusätzlich ein Haltedatum '
    + 'und kann deshalb bei angehaltenen Vorgängen mehr sagen.',
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
  // Die drei, die die Zelle wirklich liest. `D_XTE` war von v4.121 bis v4.124
  // hier draußen, weil die schlanke Projektion es nicht führte — eine Feldliste,
  // die mehr nennt als der Rechenweg anfasst, schickt die Suche nach dem Grund
  // in die Irre. Seit v4.126 führt sie es, also steht es wieder drin.
  frist: [
    { code: 'D_AAE', label: 'Antragseingang' },
    { code: 'D_XTE', label: 'alle Anträge da' },
    { code: 'D_VBE', label: 'Eingang Verwendungsnachweis' },
  ],
};

// `rohSpaltenJeFeld` wohnt seit v4.57.1 im Spalten-Inventar
// (`csv/spalten-inventar.ts`): der Feld-Vorrat des Anlege-Dialogs braucht
// dieselbe Auflösung, um die Herkunft eines Feldes anzuzeigen. Zwei Fassungen
// liefen bei der ersten Mapping-Feinheit auseinander — dann behauptete der
// Tooltip etwas anderes als die Auswahlliste.

/**
 * Spalten, deren Zelle GENAU EIN projiziertes Feld gleichen Namens liest — nur
 * für sie ist ein fehlendes Mapping eine Aussage und kein Normalfall.
 *
 * Bewusst eine eigene Liste und NICHT `CANONICAL_FIELD_KEYS`: „Branche" und
 * „Fördergeber" sind projizierte Felder ohne kanonischen Eintrag und blieben
 * damit die einzigen garantiert leeren Spalten ohne jede Erklärung (v4.121).
 * Umgekehrt trägt `verbund_titel` zwar einen kanonischen Eintrag, wird in der
 * Tabelle aber aus `verbundById` nachgereicht — dort wäre der Hinweis falsch.
 *
 * Ein Guard hält die Aufteilung vollständig: jeder Key aus `SAETZE` steht in
 * genau einer der beiden Mengen.
 */
const FELD_SPALTEN: ReadonlySet<string> = new Set<string>([
  'aktenzeichen', 'akronym', 'antragsteller', 'status', 'titel',
  'tib_kuerz', 'bib_kuerz', 'ztp_kuerz', 'pfm_kuerz',
  'bewilligung_datum', 'erstentscheidung', 'antragsdatum',
  'ort_ast', 'foerdersumme', 'laufzeitbeginn', 'laufzeitende',
  'branche', 'foerdergeber',
]);

/** Spalten, die rechnen, verdichten oder aus einer zweiten Quelle nachladen —
 *  ein fehlendes Mapping sagt über sie nichts. */
const ABGELEITETE_SPALTEN: ReadonlySet<string> = new Set<string>([
  'antrag', 'zustaendig', 'status_naechster_schritt', 'fb_precheck',
  'fb_status', 'precheck_status', 'frist', 'vb_phase', 'verbund_titel',
]);

/** Für den Guard: die Aufteilung als Paar. */
export const SPALTEN_HERKUNFT_MENGEN = {
  feld: FELD_SPALTEN,
  abgeleitet: ABGELEITETE_SPALTEN,
} as const;

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
  const roh = rohSpaltenJeFeld(schemas);
  const karte = new Map<string, SpaltenHilfe>();
  // Die festen Codes stehen fest, weil der Rechenweg genau sie liest — ihre
  // Beschriftung aber kommt aus dem Schema, wo es sie führt. Die Hand-Labels
  // bleiben nur der Rückfall vor dem ersten Import.
  const index = baueQuellSpaltenIndex(schemas);
  const mitSchemaLabel = (f: { code: string; label: string }): { code: string; label: string } => {
    const label = index.labelVon(f.code);
    return label === f.code ? f : { code: f.code, label };
  };

  for (const [key, satz] of Object.entries(SAETZE)) {
    const felder = FESTE_FELDER[key]?.map(mitSchemaLabel) ?? roh.get(key);
    const leer = !felder || felder.length === 0;
    karte.set(key, {
      satz,
      ...(leer ? null : { felder }),
      ...(REGELN[key] ? { regel: REGELN[key] } : null),
      // Eine Spalte, die genau ein Feld liest, das dieses Programm NICHT mappt,
      // bleibt garantiert leer. Ohne diesen Satz sähe man nur die leere Zelle
      // und suchte den Fehler bei den Daten statt beim Mapping.
      // Nur mit geladenem Schema: ohne Import wäre die Aussage bloß verfrüht.
      ...(leer && schemas.length > 0 && FELD_SPALTEN.has(key)
        ? { hinweis: OHNE_MAPPING }
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

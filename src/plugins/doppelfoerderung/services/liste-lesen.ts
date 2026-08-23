/**
 * Die gemeldete Frühkoordinierungs-Liste einlesen: XLSX → {@link MeldungsZeile}[].
 *
 * **Gelesen wird nach Überschrift, nicht nach Position.** Die Anforderung nennt
 * die Spalten mit Buchstaben (F = Thema, P = Aufgabenbeschreibung, U =
 * Bundesmittel), und an der Beispieldatei stimmen sie auch — aber eine Zuarbeit
 * aus einem fremden Haus ändert zwischen zwei Fassungen ihre Spaltenreihenfolge,
 * und ein Import auf festen Indizes liest dann klaglos die falsche Spalte. Das
 * ist der schlimmste Fehlermodus, weil er wie ein Erfolg aussieht. Deshalb läuft
 * die Kopfsuche über [xlsx-tabelle.ts](src/core/status/import/xlsx-tabelle.ts),
 * die bei fehlendem Kopf sagt, was sie stattdessen gefunden hat.
 *
 * **Der Betrag darf nicht raten.** `leseMappe` liefert FORMATIERTE Strings; in
 * der Beispieldatei steht dort `1850000` und `899650.65`, in einer anderen
 * Fassung kann `1.850.000,00 €` stehen. Ein Punkt ist mal Tausender-, mal
 * Dezimaltrenner. {@link parseGeldbetrag} entscheidet das an der Form der Zahl
 * und gibt `null` zurück, wo keine Entscheidung möglich ist — eine Zeile ohne
 * lesbaren Betrag wird sichtbar ausgewiesen, statt still unter die Schwelle zu
 * fallen.
 */
import {
  istLeseFehler, leseXlsxTabelle, spalte, zelle,
  type XlsxLeseFehler, type XlsxTabelle,
} from '@/core/status/import/xlsx-tabelle';
import type { MeldungsListe, MeldungsZeile } from '../types';

/** Bevorzugtes Blatt der Zuarbeit; passt der Name nicht, wird die ganze Mappe durchsucht. */
export const BLATT_NAME = 'Ergebnisliste';

/**
 * Die Vorbelegung der Betragsschwelle in Euro.
 *
 * Steht hier als Vorbelegung eines Eingabefeldes, nicht als Konstante im
 * Rechenweg: die Anforderung nennt 300.000 €, aber welcher Betrag eine
 * Doppelförderung interessant macht, entscheidet der Fachbereich je Liste.
 */
export const SCHWELLE_VORGABE = 300_000;

/**
 * Die drei Pflichtspalten — ohne sie ist die Datei keine Meldungsliste.
 *
 * Der erste Alias jeder Gruppe steht in der Fehlermeldung, wenn nichts passt.
 * „Zuwendung" steht als Alias neben „Bundesmittel", weil die Anforderung die
 * Spalte so nennt und eine spätere Fassung ihr diesen Namen geben könnte.
 */
const PFLICHT_ALIASE: readonly (readonly string[])[] = [
  ['Thema'],
  ['Aufgabenbeschreibung'],
  ['Bundesmittel', 'Zuwendung', 'Zuwendungen', 'Fördersumme', 'Foerdersumme'],
];

const ALIAS_FKZ = ['FKZ', 'Förderkennzeichen', 'Foerderkennzeichen'];
const ALIAS_BETRAG = PFLICHT_ALIASE[2] ?? [];
const ALIAS_ZE = ['Zuwendungsempfänger/Auftragnehmer', 'Zuwendungsempfänger', 'Zuwendungsempfaenger'];
const ALIAS_VON = ['Laufzeit von'];
const ALIAS_BIS = ['Laufzeit bis'];

/**
 * Eine Betragszelle in eine Zahl übersetzen; `null`, wenn sie keine trägt.
 *
 * Die Reihenfolge der Regeln ist die Entscheidung:
 *  1. deutsche Schreibweise (`1.850.000,00`) — Punkt gruppiert, Komma trennt;
 *  2. englische Schreibweise (`1,850,000.00`) — umgekehrt;
 *  3. nur ein Komma (`899650,65`) — Dezimaltrenner;
 *  4. nur ein Punkt: Tausendertrenner NUR bei genau drei Nachkommastellen
 *     (`1.850` → 1850), sonst Dezimaltrenner (`899650.65`);
 *  5. reine Ziffern.
 *
 * Alles andere ist `null`. Ein „ungefähr richtig geratener" Betrag wäre hier
 * schlimmer als gar keiner: er entscheidet stillschweigend, ob eine Meldung
 * geprüft wird.
 */
export function parseGeldbetrag(roh: string): number | null {
  // Währungszeichen, Leerzeichen (auch geschützte) und Tausender-Apostrophe raus.
  const s = roh.normalize('NFC').replace(/[\s '€]/g, '').replace(/EUR$/i, '');
  if (s.length === 0) return null;
  const vorzeichen = s.startsWith('-') ? -1 : 1;
  const z = s.replace(/^[+-]/, '');
  if (z.length === 0) return null;

  let normal: string | null = null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(z)) {
    normal = z.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(z)) {
    normal = z.replace(/,/g, '');
  } else if (/^\d+,\d+$/.test(z)) {
    normal = z.replace(',', '.');
  } else if (/^\d+\.\d+$/.test(z)) {
    // `1.850` ist ein gruppierter Tausender, `899650.65` ein Dezimalwert. Die
    // Nachkommastellen entscheiden — bei genau dreien gibt es keine andere
    // sinnvolle Lesart, weil deutsche Beträge zwei Nachkommastellen führen.
    const nach = z.split('.')[1] ?? '';
    normal = nach.length === 3 ? z.replace('.', '') : z;
  } else if (/^\d+$/.test(z)) {
    normal = z;
  }
  if (normal === null) return null;
  const wert = Number(normal);
  return Number.isFinite(wert) ? vorzeichen * wert : null;
}

/** „01.01.2027 – 31.12.2030"; leer, wenn beide Zellen leer sind. */
function laufzeitText(von: string, bis: string): string {
  if (von && bis) return `${von} – ${bis}`;
  return von || bis;
}

/** Die Rohzeilen einer gefundenen Tabelle in Meldungszeilen übersetzen. */
function baueZeilen(t: XlsxTabelle): MeldungsZeile[] {
  const iFkz = spalte(t.kopf, ALIAS_FKZ);
  const iThema = spalte(t.kopf, ['Thema']);
  const iAufgabe = spalte(t.kopf, ['Aufgabenbeschreibung']);
  const iBetrag = spalte(t.kopf, ALIAS_BETRAG);
  const iZe = spalte(t.kopf, ALIAS_ZE);
  const iVon = spalte(t.kopf, ALIAS_VON);
  const iBis = spalte(t.kopf, ALIAS_BIS);

  return t.zeilen.map((z, i) => {
    const betragRoh = zelle(z, iBetrag);
    return {
      // `zeilen` steht direkt unter dem Kopf, und Leerzeilen hat `findeKopf`
      // bereits ausgesiebt — die Nummer ist damit eine Näherung an das, was im
      // Excel danebensteht, und sie ist als Zuordnungshilfe gemeint.
      zeilenNr: t.kopfZeileNr + 1 + i,
      fkz: zelle(z, iFkz),
      thema: zelle(z, iThema),
      aufgabenbeschreibung: zelle(z, iAufgabe),
      betrag: parseGeldbetrag(betragRoh),
      betragRoh,
      zuwendungsempfaenger: zelle(z, iZe),
      laufzeit: laufzeitText(zelle(z, iVon), zelle(z, iBis)),
    };
  });
}

/**
 * Die Datei lesen. Fehler kommen als `{ fehler }` zurück, nicht als Wurf —
 * derselbe Vertrag wie bei den übrigen Zuarbeits-Importen.
 */
export async function leseMeldungsListe(
  datei: File,
): Promise<MeldungsListe | XlsxLeseFehler> {
  const t = await leseXlsxTabelle(datei, PFLICHT_ALIASE, { blattName: BLATT_NAME });
  if (istLeseFehler(t)) return t;
  return { blatt: t.blatt, zeilen: baueZeilen(t) };
}

/** Wie sich die gelesenen Zeilen auf die drei Gruppen der Vorschau verteilen. */
export interface ZeilenAufteilung {
  /** Betrag lesbar und ≥ Schwelle — diese Zeilen werden geprüft. */
  zuPruefen: readonly MeldungsZeile[];
  /** Betrag lesbar, aber unter der Schwelle. */
  unterSchwelle: readonly MeldungsZeile[];
  /** Betrag nicht lesbar — sichtbar, nicht verschwiegen. */
  ohneBetrag: readonly MeldungsZeile[];
}

/**
 * Die Zeilen an der Schwelle aufteilen. Rein — die UI entscheidet, was sie mit
 * den drei Gruppen macht (`ohneBetrag` ist zuschaltbar).
 *
 * Zeilen ohne Thema UND ohne Aufgabenbeschreibung fallen ganz heraus: aus ihnen
 * liesse sich kein Schlagwort bilden, und ein KI-Lauf über eine leere Zeile
 * kostete nur Wartezeit.
 */
export function teileZeilen(
  zeilen: readonly MeldungsZeile[],
  schwelle: number,
): ZeilenAufteilung {
  const zuPruefen: MeldungsZeile[] = [];
  const unterSchwelle: MeldungsZeile[] = [];
  const ohneBetrag: MeldungsZeile[] = [];
  for (const z of zeilen) {
    if (z.thema.length === 0 && z.aufgabenbeschreibung.length === 0) continue;
    if (z.betrag === null) ohneBetrag.push(z);
    else if (z.betrag >= schwelle) zuPruefen.push(z);
    else unterSchwelle.push(z);
  }
  return { zuPruefen, unterSchwelle, ohneBetrag };
}

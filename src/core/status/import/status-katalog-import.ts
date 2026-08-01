/**
 * Import des Status-Katalogs (Code ↔ Text) aus der Legacy-Parametertabelle.
 *
 * Ergebnis ist eine Liste von {@link StatusCodeEintrag} plus ein Diff gegen den
 * aktuellen Stand. Übernommen wird nichts automatisch — der Kurator sieht erst
 * die Vorschau.
 *
 * **Varianten bleiben erhalten.** Die Zuarbeit führt je Code eine Schreibweise;
 * die im Export beobachteten Abweichungen („Stellungnahme zur Rücknahmeempf.")
 * sind unsere Pflege. Ein Import, der sie wegwürfe, ließe genau die Statuswerte
 * wieder ohne Code dastehen, für die jemand die Variante eingetragen hat.
 */
import type { StatusCodeEintrag } from '../status-codes';
import { normKey } from '../normalisierung';
import { berechneDiff, type Diff } from './diff';
import { istLeseFehler, leseXlsxTabelle, spalte, zelle } from './xlsx-tabelle';

const ALIAS_CODE = ['Code', 'Status', 'Statuscode', 'Status-Code', 'Nr', 'Nummer', 'Schlüssel'];
const ALIAS_TEXT = ['Text', 'Bezeichnung', 'Statustext', 'Status-Text', 'Beschreibung', 'Label'];
const ALIAS_VARIANTEN = ['Varianten', 'Variante', 'Alias', 'Aliase', 'Schreibweisen'];

export interface StatusKatalogImportErgebnis {
  /** Gelesene Einträge in Dateireihenfolge (leer bei `fehler`). */
  eintraege: StatusCodeEintrag[];
  diff: Diff<StatusCodeEintrag> | null;
  /** Abbruch-Grund. Gesetzt ⇒ nichts wurde gelesen. */
  fehler?: string;
  /** Nicht-blockierende Auffälligkeiten (übersprungene Zeilen, Dubletten). */
  warnungen: string[];
}

function fehlerErgebnis(fehler: string): StatusKatalogImportErgebnis {
  return { eintraege: [], diff: null, fehler, warnungen: [] };
}

/**
 * Liest die XLSX und stellt sie dem aktuellen Katalog gegenüber.
 *
 * Zeilen ohne lesbaren Code oder ohne Text werden übersprungen **und gemeldet**
 * — eine stille Lücke im Katalog wäre später nicht mehr aufzuklären.
 */
export async function importiereStatusKatalog(
  datei: File, bestand: readonly StatusCodeEintrag[],
): Promise<StatusKatalogImportErgebnis> {
  const tabelle = await leseXlsxTabelle(datei, [ALIAS_CODE, ALIAS_TEXT]);
  if (istLeseFehler(tabelle)) return fehlerErgebnis(tabelle.fehler);

  const iCode = spalte(tabelle.kopf, ALIAS_CODE);
  const iText = spalte(tabelle.kopf, ALIAS_TEXT);
  const iVarianten = spalte(tabelle.kopf, ALIAS_VARIANTEN);

  const warnungen: string[] = [];
  const eintraege: StatusCodeEintrag[] = [];
  const gesehen = new Map<number, StatusCodeEintrag>();
  const bestandNachCode = new Map(bestand.map(e => [e.code, e]));

  tabelle.zeilen.forEach((zeile, i) => {
    const zeilenNr = tabelle.kopfZeileNr + 1 + i;
    const codeRoh = zelle(zeile, iCode);
    const text = zelle(zeile, iText);
    const code = Number(codeRoh);
    if (!codeRoh || !Number.isInteger(code)) {
      warnungen.push(`Zeile ${zeilenNr}: kein lesbarer Code („${codeRoh}") — übersprungen.`);
      return;
    }
    if (!text) {
      warnungen.push(`Zeile ${zeilenNr}: Code ${code} ohne Bezeichnung — übersprungen.`);
      return;
    }
    const schonDa = gesehen.get(code);
    if (schonDa) {
      warnungen.push(`Zeile ${zeilenNr}: Code ${code} steht mehrfach in der Datei — erster Eintrag „${schonDa.text}" gilt.`);
      return;
    }

    // Varianten: aus der Datei (falls die Spalte existiert) UND die bereits
    // gepflegten des Bestands — additiv, damit Kuration einen Re-Import überlebt.
    const ausDatei = zelle(zeile, iVarianten)
      .split(/[;|]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const bisher = bestandNachCode.get(code)?.varianten ?? [];
    const varianten: string[] = [];
    const bekannt = new Set([normKey(text)]);
    for (const v of [...bisher, ...ausDatei]) {
      const k = normKey(v);
      if (!k || bekannt.has(k)) continue;
      bekannt.add(k);
      varianten.push(v);
    }

    const eintrag: StatusCodeEintrag = { code, text, varianten };
    gesehen.set(code, eintrag);
    eintraege.push(eintrag);
  });

  if (eintraege.length === 0) {
    return fehlerErgebnis('Keine gültige Zeile gefunden (kein lesbarer Code mit Bezeichnung).');
  }

  const diff = berechneDiff(
    bestand, eintraege,
    e => String(e.code),
    e => ({ text: e.text, varianten: [...e.varianten].sort() }),
  );
  return { eintraege, diff, warnungen };
}

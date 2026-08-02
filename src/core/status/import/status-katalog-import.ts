/**
 * Import der Legacy-Parametertabelle (Blatt „Erklärung Parameter").
 *
 * Das Blatt führt **drei Arten von Zeilen** in einer Liste:
 *
 * | Art | Erkennungsmerkmal | wofür |
 * |---|---|---|
 * | Statuscode | ganze Zahl 11…99 | Code ↔ Text (`StatusCodeEintrag`) |
 * | Bearbeiter | kurzes Buchstaben-Token (`BIB`, `TIB`) | Abgleich gegen `MAIL_ROLLE` |
 * | Textbaustein | Kennung mit `!.`-Präfix | Legende der Mail-Trigger |
 *
 * Führt die Datei eine Kategorie-Spalte, entscheidet die; sonst der Inhalt. Was
 * sich keiner Art zuordnen lässt, wird **gemeldet, nicht verworfen** — eine
 * stille Lücke im Katalog wäre später nicht mehr aufzuklären.
 *
 * **Die Bearbeiter-Zeilen werden geprüft, nicht gespeichert.** Die Zuordnung
 * Kürzel → Rolle steht genau einmal im Code (`MAIL_ROLLE` in `rollen.ts`); ein
 * zweites, importiertes Rollen-Modell danebenzustellen wäre die Sorte
 * Doppel-Wahrheit, gegen die Pitfall #43 geschrieben ist. Kennt die Zuarbeit ein
 * Token, das der Code nicht führt, ist das eine Warnung im Diff.
 *
 * **Varianten bleiben erhalten.** Die Zuarbeit führt je Code eine Schreibweise;
 * die im Export beobachteten Abweichungen („Stellungnahme zur Rücknahmeempf.")
 * sind unsere Pflege. Ein Import, der sie wegwürfe, ließe genau die Statuswerte
 * wieder ohne Code dastehen, für die jemand die Variante eingetragen hat.
 */
import type { StatusCodeEintrag } from '../status-codes';
import type { TextbausteinEintrag } from '../typen';
import { normKey } from '../normalisierung';
import { MAIL_ROLLE } from '../rollen';
import { berechneDiff, type Diff } from './diff';
import { istLeseFehler, leseXlsxTabelle, spalte, zelle } from './xlsx-tabelle';

/** Blatt der Zuarbeit; fehlt es, wird über alle Blätter nach dem Kopf gesucht. */
export const PARAMETER_BLATT = 'Erklärung Parameter';

const ALIAS_CODE = ['Code', 'Status', 'Statuscode', 'Status-Code', 'Nr', 'Nummer', 'Schlüssel', 'Parameter'];
const ALIAS_TEXT = ['Text', 'Bezeichnung', 'Statustext', 'Status-Text', 'Beschreibung', 'Label', 'Bedeutung'];
const ALIAS_VARIANTEN = ['Varianten', 'Variante', 'Alias', 'Aliase', 'Schreibweisen'];
const ALIAS_KATEGORIE = ['Kategorie', 'Art', 'Typ', 'Gruppe', 'Bereich'];

/** Welche Zeilenart die Kategorie-Spalte benennt; `null` = unbekannter Wert. */
type Zeilenart = 'status' | 'bearbeiter' | 'textbaustein';

const KATEGORIE_ART: Readonly<Record<string, Zeilenart>> = {
  status: 'status',
  statuscode: 'status',
  status_tv: 'status',
  bearbeiter: 'bearbeiter',
  rolle: 'bearbeiter',
  textbaustein: 'textbaustein',
  baustein: 'textbaustein',
  mail: 'textbaustein',
};

/** Kurzes Buchstaben-Token wie `BIB` — kein Code, keine Bausteinkennung. */
const BEARBEITER_RE = /^[A-Za-zÄÖÜäöüß]{2,5}$/;

/**
 * Zeilenart bestimmen: Kategorie-Spalte schlägt Inhalt. Ohne beides `null` —
 * dann landet die Zeile in den Warnungen statt in irgendeinem Topf.
 */
export function bestimmeZeilenart(kategorie: string, schluessel: string): Zeilenart | null {
  const ausSpalte = KATEGORIE_ART[normKey(kategorie)];
  if (ausSpalte) return ausSpalte;
  const s = schluessel.trim();
  if (s.startsWith('!.')) return 'textbaustein';
  if (Number.isInteger(Number(s)) && s !== '') return 'status';
  if (BEARBEITER_RE.test(s)) return 'bearbeiter';
  return null;
}

export interface StatusKatalogImportErgebnis {
  /** Gelesene Statuscodes in Dateireihenfolge (leer bei `fehler`). */
  eintraege: StatusCodeEintrag[];
  diff: Diff<StatusCodeEintrag> | null;
  /** Legende der Mail-Textbausteine, falls das Blatt welche führt. */
  textbausteine: TextbausteinEintrag[];
  /** Bearbeiter-Token der Zuarbeit, die `MAIL_ROLLE` nicht kennt. */
  unbekannteBearbeiter: string[];
  /** Abbruch-Grund. Gesetzt ⇒ nichts wurde gelesen. */
  fehler?: string;
  /** Nicht-blockierende Auffälligkeiten (übersprungene Zeilen, Dubletten). */
  warnungen: string[];
}

function fehlerErgebnis(fehler: string): StatusKatalogImportErgebnis {
  return { eintraege: [], diff: null, textbausteine: [], unbekannteBearbeiter: [], fehler, warnungen: [] };
}

/**
 * Liest die XLSX und stellt sie dem aktuellen Katalog gegenüber.
 *
 * Zeilen ohne lesbaren Schlüssel oder ohne Text werden übersprungen **und
 * gemeldet**.
 */
export async function importiereStatusKatalog(
  datei: File, bestand: readonly StatusCodeEintrag[],
): Promise<StatusKatalogImportErgebnis> {
  const tabelle = await leseXlsxTabelle(datei, [ALIAS_CODE, ALIAS_TEXT], { blattName: PARAMETER_BLATT });
  if (istLeseFehler(tabelle)) return fehlerErgebnis(tabelle.fehler);

  const iCode = spalte(tabelle.kopf, ALIAS_CODE);
  const iText = spalte(tabelle.kopf, ALIAS_TEXT);
  const iVarianten = spalte(tabelle.kopf, ALIAS_VARIANTEN);
  const iKategorie = spalte(tabelle.kopf, ALIAS_KATEGORIE);

  const warnungen: string[] = [];
  const eintraege: StatusCodeEintrag[] = [];
  const textbausteine: TextbausteinEintrag[] = [];
  const unbekannteBearbeiter: string[] = [];
  const gesehen = new Map<number, StatusCodeEintrag>();
  const bausteinGesehen = new Set<string>();
  const bestandNachCode = new Map(bestand.map(e => [e.code, e]));
  let ohneArt = 0;

  tabelle.zeilen.forEach((zeile, i) => {
    const zeilenNr = tabelle.kopfZeileNr + 1 + i;
    const codeRoh = zelle(zeile, iCode);
    const text = zelle(zeile, iText);
    if (!codeRoh) {
      warnungen.push(`Zeile ${zeilenNr}: ohne Schlüssel — übersprungen.`);
      return;
    }

    const art = bestimmeZeilenart(zelle(zeile, iKategorie), codeRoh);
    if (art === null) {
      ohneArt += 1;
      return;
    }

    if (art === 'bearbeiter') {
      // Nur Abgleich: die Rollen stehen im Code, nicht in dieser Datei.
      if (!MAIL_ROLLE[normKey(codeRoh)] && !unbekannteBearbeiter.includes(codeRoh)) {
        unbekannteBearbeiter.push(codeRoh);
      }
      return;
    }

    if (art === 'textbaustein') {
      if (!text) {
        warnungen.push(`Zeile ${zeilenNr}: Textbaustein ${codeRoh} ohne Klartext — übersprungen.`);
        return;
      }
      if (bausteinGesehen.has(normKey(codeRoh))) {
        warnungen.push(`Zeile ${zeilenNr}: Textbaustein ${codeRoh} steht mehrfach — erster Eintrag gilt.`);
        return;
      }
      bausteinGesehen.add(normKey(codeRoh));
      textbausteine.push({ kennung: codeRoh, text });
      return;
    }

    const code = Number(codeRoh);
    if (!Number.isInteger(code)) {
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

  if (ohneArt > 0) {
    warnungen.push(
      `${ohneArt} Zeilen ließen sich keiner Art zuordnen (weder Statuscode noch Bearbeiter `
      + 'noch Textbaustein) und wurden übergangen.',
    );
  }

  if (eintraege.length === 0) {
    return fehlerErgebnis(
      `Blatt „${tabelle.blatt}": keine gültige Statuscode-Zeile gefunden `
      + '(kein lesbarer Code mit Bezeichnung).',
    );
  }

  const diff = berechneDiff(
    bestand, eintraege,
    e => String(e.code),
    e => ({ text: e.text, varianten: [...e.varianten].sort() }),
  );
  return { eintraege, diff, textbausteine, unbekannteBearbeiter, warnungen };
}

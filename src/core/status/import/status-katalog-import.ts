/**
 * Import der Legacy-Parametertabelle: aus dem Blatt „Erklärung Parameter" wird
 * der **Code ↔ Text**-Katalog.
 *
 * Das Blatt selbst liest `parameter-blatt.ts` (zwei Formate, ein Parser); hier
 * steht nur noch, was mit den vier Zeilenarten geschieht:
 *
 * | Art | wofür |
 * |---|---|
 * | `status` | Code ↔ Text — das Einzige, was in den Katalog wandert |
 * | `bearbeiter` | Abgleich gegen `MAIL_ROLLE` |
 * | `textbaustein` | Legende der Mail-Trigger |
 * | `zuordnung` | Bezugsdatei-Nummern gegen `ebeneVonNummer` |
 *
 * **Übersprungen heißt nicht verschwiegen.** Was nicht Statuscode wird, steht
 * als Zahl in der `ZeilenBilanz` und damit in der Vorschau. Eine stille Lücke im
 * Katalog wäre später nicht mehr aufzuklären — und eine Zeile, die klanglos
 * verschwindet, sieht genauso aus wie eine, die es gar nicht gab.
 *
 * **Bearbeiter und Zuordnung werden GEPRÜFT, nicht gespeichert.** Beide
 * Zuordnungen stehen genau einmal im Code (`MAIL_ROLLE` in `rollen.ts`,
 * `ebeneVonNummer` in `trigger-parser.ts`); ein zweites, importiertes Modell
 * danebenzustellen wäre die Sorte Doppel-Wahrheit, gegen die Pitfall #43
 * geschrieben ist. Was die Zuarbeit anders sieht als der Code, ist ein Hinweis
 * in der Vorschau.
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
import { ebeneVonNummer } from '../trigger-satz';
import { berechneDiff, type Diff } from './diff';
import { istLeseFehler } from './xlsx-tabelle';
import { leseParameterBlatt, type BlattFormat } from './parameter-blatt';

/**
 * Wie sich das Blatt aufteilte. Die Summe ist die Zahl der gelesenen Zeilen —
 * `status` zählt die als Statuscode ERKANNTEN, nicht die übernommenen; wo beide
 * auseinanderfallen (kein lesbarer Code, keine Bezeichnung, Dublette), sagt es
 * eine Warnung.
 */
export interface ZeilenBilanz {
  status: number;
  bearbeiter: number;
  textbaustein: number;
  zuordnung: number;
  unklar: number;
}

/** Eine Bezugsdatei-Zeile der Zuarbeit neben unserer erschlossenen Lesart. */
export interface EbenenHinweis {
  wert: string;
  text: string;
  unsereLesart: 'VB' | 'TV' | null;
}

export interface StatusKatalogImportErgebnis {
  /** Gelesene Statuscodes in Dateireihenfolge (leer bei `fehler`). */
  eintraege: StatusCodeEintrag[];
  diff: Diff<StatusCodeEintrag> | null;
  /** Legende der Mail-Textbausteine, falls das Blatt welche führt. */
  textbausteine: TextbausteinEintrag[];
  /** Bearbeiter-Token der Zuarbeit, die `MAIL_ROLLE` nicht kennt. */
  unbekannteBearbeiter: string[];
  /** Bezugsdatei-Nummern (210/211) mit dem Erklärungstext der Datei. */
  ebenenHinweise: EbenenHinweis[];
  /** Aus welchem Blatt, in welchem Format gelesen wurde. */
  blatt: string;
  format: BlattFormat;
  bilanz: ZeilenBilanz;
  /** Abbruch-Grund. Gesetzt ⇒ nichts wurde gelesen. */
  fehler?: string;
  /** Nicht-blockierende Auffälligkeiten (übersprungene Zeilen, Dubletten). */
  warnungen: string[];
}

function leereBilanz(): ZeilenBilanz {
  return { status: 0, bearbeiter: 0, textbaustein: 0, zuordnung: 0, unklar: 0 };
}

function fehlerErgebnis(fehler: string): StatusKatalogImportErgebnis {
  return {
    eintraege: [], diff: null, textbausteine: [], unbekannteBearbeiter: [], ebenenHinweise: [],
    blatt: '', format: 'kopf', bilanz: leereBilanz(), fehler, warnungen: [],
  };
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
  const blatt = await leseParameterBlatt(datei);
  if (istLeseFehler(blatt)) return fehlerErgebnis(blatt.fehler);

  const warnungen: string[] = [];
  const eintraege: StatusCodeEintrag[] = [];
  const textbausteine: TextbausteinEintrag[] = [];
  const unbekannteBearbeiter: string[] = [];
  const ebenenHinweise: EbenenHinweis[] = [];
  const bilanz = leereBilanz();
  const gesehen = new Map<number, StatusCodeEintrag>();
  const bausteinGesehen = new Set<string>();
  const ebeneGesehen = new Set<string>();
  const bestandNachCode = new Map(bestand.map(e => [e.code, e]));

  for (const zeile of blatt.zeilen) {
    const { nr, wert, text } = zeile;
    if (!wert) {
      bilanz.unklar += 1;
      warnungen.push(`Zeile ${nr}: ohne Schlüssel — übersprungen.`);
      continue;
    }
    if (zeile.art === null) {
      bilanz.unklar += 1;
      continue;
    }

    if (zeile.art === 'bearbeiter') {
      bilanz.bearbeiter += 1;
      // Nur Abgleich: die Rollen stehen im Code, nicht in dieser Datei.
      if (!MAIL_ROLLE[normKey(wert)] && !unbekannteBearbeiter.includes(wert)) {
        unbekannteBearbeiter.push(wert);
      }
      continue;
    }

    if (zeile.art === 'zuordnung') {
      bilanz.zuordnung += 1;
      // Ebenfalls nur Abgleich — aber sichtbar: diese Zeilen sind der Beleg für
      // eine Zuordnung, die der Trigger-Parser bisher erschlossen hat.
      if (!ebeneGesehen.has(normKey(wert))) {
        ebeneGesehen.add(normKey(wert));
        ebenenHinweise.push({ wert, text, unsereLesart: ebeneVonNummer(wert) });
      }
      continue;
    }

    if (zeile.art === 'textbaustein') {
      bilanz.textbaustein += 1;
      if (!text) {
        warnungen.push(`Zeile ${nr}: Textbaustein ${wert} ohne Klartext — übersprungen.`);
        continue;
      }
      if (bausteinGesehen.has(normKey(wert))) {
        warnungen.push(`Zeile ${nr}: Textbaustein ${wert} steht mehrfach — erster Eintrag gilt.`);
        continue;
      }
      bausteinGesehen.add(normKey(wert));
      textbausteine.push({ kennung: wert, text });
      continue;
    }

    bilanz.status += 1;
    const code = Number(wert);
    if (!Number.isInteger(code)) {
      warnungen.push(`Zeile ${nr}: kein lesbarer Code („${wert}") — übersprungen.`);
      continue;
    }
    if (!text) {
      warnungen.push(`Zeile ${nr}: Code ${code} ohne Bezeichnung — übersprungen.`);
      continue;
    }
    const schonDa = gesehen.get(code);
    if (schonDa) {
      warnungen.push(`Zeile ${nr}: Code ${code} steht mehrfach in der Datei — erster Eintrag „${schonDa.text}" gilt.`);
      continue;
    }

    // Varianten: aus der Datei (falls die Spalte existiert) UND die bereits
    // gepflegten des Bestands — additiv, damit Kuration einen Re-Import überlebt.
    const ausDatei = zeile.varianten
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

    // Die Zuarbeit führt keine Kurzform — sie ist unsere Beschriftung. Der
    // Import darf sie deshalb nicht wegnehmen; ein wirklich neuer Code kommt
    // leer durch und steht damit in der Kurzlabel-Pflegeliste.
    const kurz = bestandNachCode.get(code)?.kurz ?? '';
    const eintrag: StatusCodeEintrag = { code, text, kurz, varianten };
    gesehen.set(code, eintrag);
    eintraege.push(eintrag);
  }

  if (bilanz.unklar > 0) {
    warnungen.push(
      `${bilanz.unklar} Zeilen ließen sich keiner Art zuordnen (weder Statuscode noch Bearbeiter `
      + 'noch Textbaustein noch Zuordnung) und wurden übergangen.',
    );
  }

  if (eintraege.length === 0) {
    return fehlerErgebnis(
      `Blatt „${blatt.blatt}": keine gültige Statuscode-Zeile gefunden `
      + '(kein lesbarer Code mit Bezeichnung).',
    );
  }

  const diff = berechneDiff(
    bestand, eintraege,
    e => String(e.code),
    e => ({ text: e.text, varianten: [...e.varianten].sort() }),
  );
  return {
    eintraege, diff, textbausteine, unbekannteBearbeiter, ebenenHinweise,
    blatt: blatt.blatt, format: blatt.format, bilanz, warnungen,
  };
}

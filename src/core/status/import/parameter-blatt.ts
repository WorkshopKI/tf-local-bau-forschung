/**
 * Das Blatt „Erklärung Parameter" der Legacy-Zuarbeit — in **zwei Formaten**,
 * mit **einem** Parser.
 *
 * Die echte Datei ist eine **Legende ohne Kopfzeile**: Spalte A der Wert (Zahl
 * oder Kürzel), Spalte B die Erklärung, Spalte C die Kategorie („Status",
 * „Bearbeiter" oder leer). Zeile 1 („Inhalt Parameter" · „Erklärung") ist
 * Beschriftung, keine Überschrift im Sinne der Alias-Suche — bis v2.380 brach
 * der Import genau daran ab, und der Statuscode-Katalog kam nie aus der
 * amtlichen Quelle.
 *
 * Daneben bleibt die **Kopfzeilen-Variante** (`Code` / `Text`) gültig, falls je
 * eine reine Code-Tabelle exportiert wird. Beide Wege enden in derselben
 * `ParameterZeile`; der Katalog-Import sieht das Blatt nie roh.
 *
 * **Im Legenden-Format entscheidet die Kategorie-Spalte, nicht der Inhalt.**
 * Das Blatt führt neben den Statuscodes 11…99 auch die Bezugsdatei-Nummern
 * 210/211. Würde eine ganze Zahl weiterhin „Statuscode" bedeuten, stünden sie
 * als Codes im Katalog — dieselbe stille Fehlerklasse wie der Trigger-Import
 * ohne Programm-Dimension, eine Ebene tiefer.
 *
 * **Der Spaltenschnitt wird gesucht, nicht gesetzt.** Erkennungsmerkmal ist die
 * Kategorie-Spalte; Wert und Text ergeben sich links davon. Findet sich keine,
 * gilt das Format als nicht erkannt und der Kopfzeilen-Weg greift — nie ein halb
 * geratenes Blatt.
 *
 * IO nur über `leseMappe`; die Klassifizierung ist rein.
 */
import { normKey } from '../normalisierung';
import {
  blattReihenfolge, findeKopfInMappe, istLeseFehler, kopfKey, leseMappe, spalte, zelle,
  type RohBlatt, type XlsxLeseFehler,
} from './xlsx-tabelle';

/** Blatt der Zuarbeit; fehlt es, wird über alle Blätter gesucht. */
export const PARAMETER_BLATT = 'Erklärung Parameter';

const ALIAS_CODE = ['Code', 'Status', 'Statuscode', 'Status-Code', 'Nr', 'Nummer', 'Schlüssel', 'Parameter'];
const ALIAS_TEXT = ['Text', 'Bezeichnung', 'Statustext', 'Status-Text', 'Beschreibung', 'Label', 'Bedeutung'];
const ALIAS_VARIANTEN = ['Varianten', 'Variante', 'Alias', 'Aliase', 'Schreibweisen'];
const ALIAS_KATEGORIE = ['Kategorie', 'Art', 'Typ', 'Gruppe', 'Bereich'];

/**
 * Was für eine Zeile das ist. `zuordnung` sind die Bezugsdatei-Nummern
 * (210/211) — keine Statuscodes, aber auch kein Müll: sie belegen, was der
 * Trigger-Parser bisher nur erschlossen hat.
 */
export type Zeilenart = 'status' | 'bearbeiter' | 'textbaustein' | 'zuordnung';

/** Das erkannte Format des Blattes. */
export type BlattFormat = 'legende' | 'kopf';

export interface ParameterZeile {
  /** 1-basierte Zeilennummer im Blatt — für Meldungen. */
  nr: number;
  /** Spalte A: Code, Bearbeiter-Kürzel oder Bausteinkennung. */
  wert: string;
  /** Spalte B: die Erklärung. */
  text: string;
  /** Nur in der Kopfzeilen-Variante belegt; im Legenden-Format ''. */
  varianten: string;
  /** `null` = keiner Art zuzuordnen (wird gemeldet, nicht verworfen). */
  art: Zeilenart | null;
}

export interface ParameterBlatt {
  blatt: string;
  format: BlattFormat;
  zeilen: ParameterZeile[];
}

const KATEGORIE_ART: Readonly<Record<string, Zeilenart>> = {
  status: 'status',
  statuscode: 'status',
  status_tv: 'status',
  bearbeiter: 'bearbeiter',
  rolle: 'bearbeiter',
  textbaustein: 'textbaustein',
  baustein: 'textbaustein',
  mail: 'textbaustein',
  zuordnung: 'zuordnung',
  bezugsdatei: 'zuordnung',
};

/** Kurzes Buchstaben-Token wie `BIB` — kein Code, keine Bausteinkennung. */
const BEARBEITER_RE = /^[A-Za-zÄÖÜäöüß]{2,5}$/;

/**
 * Zeilenart bestimmen: die Kategorie-Spalte schlägt immer den Inhalt.
 *
 * Der Unterschied zwischen den Formaten steckt in genau einer Zeile: eine ganze
 * Zahl OHNE Kategorie ist in der Kopfzeilen-Variante ein Statuscode (dort gibt
 * es nichts anderes), in der Legende dagegen eine Bezugsdatei-Nummer — die
 * Statuscodes tragen dort ihr „Status" in Spalte C.
 */
export function bestimmeZeilenart(
  kategorie: string, wert: string, format: BlattFormat = 'kopf',
): Zeilenart | null {
  const ausSpalte = KATEGORIE_ART[normKey(kategorie)];
  if (ausSpalte) return ausSpalte;
  const s = wert.trim();
  if (!s) return null;
  if (s.startsWith('!.')) return 'textbaustein';
  if (Number.isInteger(Number(s))) return format === 'legende' ? 'zuordnung' : 'status';
  if (BEARBEITER_RE.test(s)) return 'bearbeiter';
  return null;
}

// --- Legenden-Format ---------------------------------------------------------

/** Wie weit rechts die Kategorie-Spalte gesucht wird. */
const MAX_KATEGORIE_SPALTE = 6;
/** So viele erkannte Kategorie-Werte müssen zusammenkommen. */
const MIN_KATEGORIE_TREFFER = 3;

/** Beschriftungen, die eine Legende über die Wert-Spalte schreiben kann. */
const BESCHRIFTUNG = new Set([
  'inhaltparameter', 'inhalt', 'parameter', 'wert', 'code', 'schlüssel',
]);

interface Schnitt {
  iWert: number;
  iText: number;
  iKategorie: number;
}

/** Erste Spalte links der Grenze, die in mindestens der Hälfte der Zeilen steht. */
function ersteGefuellte(zeilen: readonly string[][], grenze: number): number {
  for (let c = 0; c < grenze; c++) {
    const gefuellt = zeilen.filter(z => (z[c] ?? '').length > 0).length;
    if (gefuellt * 2 >= zeilen.length) return c;
  }
  return -1;
}

/**
 * Den Spaltenschnitt einer Legende bestimmen: die Kategorie-Spalte ist die mit
 * den meisten bekannten Kategorie-Werten. `null`, wenn keine überzeugt — dann
 * ist es keine Legende, und der Aufrufer geht den Kopfzeilen-Weg.
 *
 * Zwei Hürden, damit eine beliebige Textspalte nicht durchrutscht: mindestens
 * eine `status`-Zeile (nur die werden gelesen — ohne sie wäre das Blatt für
 * diesen Import ohnehin leer) und mindestens so viele bekannte wie unbekannte
 * Werte („überwiegend").
 */
function findeSchnitt(zeilen: readonly string[][]): Schnitt | null {
  let beste = -1;
  let besteTreffer = 0;
  // Ab 2, damit links davon Platz für Wert UND Text ist.
  for (let c = 2; c < MAX_KATEGORIE_SPALTE; c++) {
    let treffer = 0;
    let fremd = 0;
    let hatStatus = false;
    for (const z of zeilen) {
      const v = z[c] ?? '';
      if (!v) continue;
      const art = KATEGORIE_ART[normKey(v)];
      if (!art) { fremd += 1; continue; }
      treffer += 1;
      if (art === 'status') hatStatus = true;
    }
    if (hatStatus && treffer >= MIN_KATEGORIE_TREFFER && treffer >= fremd && treffer > besteTreffer) {
      beste = c;
      besteTreffer = treffer;
    }
  }
  if (beste < 0) return null;

  const iWert = ersteGefuellte(zeilen, beste);
  const iText = beste - 1;
  if (iWert < 0 || iText <= iWert) return null;
  return { iWert, iText, iKategorie: beste };
}

/** Eine Beschriftungszeile („Inhalt Parameter | Erklärung") ohne Kategorie. */
function istBeschriftung(zeile: readonly string[], s: Schnitt): boolean {
  return BESCHRIFTUNG.has(kopfKey(zeile[s.iWert])) && !(zeile[s.iKategorie] ?? '');
}

function alsLegende(blatt: RohBlatt): ParameterBlatt | null {
  // Leerzeilen raus, aber die echte Zeilennummer bleibt an der Zeile hängen.
  const kandidaten = blatt.zeilen
    .map((z, i) => ({ nr: i + 1, z }))
    .filter(e => e.z.some(c => c.length > 0));
  const schnitt = findeSchnitt(kandidaten.map(e => e.z));
  if (!schnitt) return null;

  const rest = kandidaten[0] && istBeschriftung(kandidaten[0].z, schnitt)
    ? kandidaten.slice(1)
    : kandidaten;

  return {
    blatt: blatt.name,
    format: 'legende',
    zeilen: rest.map(e => {
      const wert = e.z[schnitt.iWert] ?? '';
      return {
        nr: e.nr,
        wert,
        text: e.z[schnitt.iText] ?? '',
        varianten: '',
        art: bestimmeZeilenart(e.z[schnitt.iKategorie] ?? '', wert, 'legende'),
      };
    }),
  };
}

// --- Einstieg ----------------------------------------------------------------

/**
 * Liest das Parameter-Blatt in klassifizierte Zeilen. Legenden-Format zuerst
 * (benanntes Blatt vorn), sonst die Kopfzeilen-Variante, sonst der Fehler mit
 * Blattnamen und gefundenen Überschriften.
 */
export async function leseParameterBlatt(datei: File): Promise<ParameterBlatt | XlsxLeseFehler> {
  const mappe = await leseMappe(datei);
  if (istLeseFehler(mappe)) return mappe;

  const nachName = new Map(mappe.map(b => [b.name, b]));
  for (const name of blattReihenfolge(mappe.map(b => b.name), PARAMETER_BLATT)) {
    const blatt = nachName.get(name);
    const legende = blatt ? alsLegende(blatt) : null;
    if (legende) return legende;
  }

  const tabelle = findeKopfInMappe(mappe, [ALIAS_CODE, ALIAS_TEXT], { blattName: PARAMETER_BLATT });
  if (istLeseFehler(tabelle)) return tabelle;

  const iCode = spalte(tabelle.kopf, ALIAS_CODE);
  const iText = spalte(tabelle.kopf, ALIAS_TEXT);
  const iVarianten = spalte(tabelle.kopf, ALIAS_VARIANTEN);
  const iKategorie = spalte(tabelle.kopf, ALIAS_KATEGORIE);
  return {
    blatt: tabelle.blatt,
    format: 'kopf',
    zeilen: tabelle.zeilen.map((z, i) => {
      const wert = zelle(z, iCode);
      return {
        nr: tabelle.kopfZeileNr + 1 + i,
        wert,
        text: zelle(z, iText),
        varianten: zelle(z, iVarianten),
        art: bestimmeZeilenart(zelle(z, iKategorie), wert, 'kopf'),
      };
    }),
  };
}

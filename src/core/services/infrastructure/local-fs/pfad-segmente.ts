/**
 * Pfad-Zerlegung und -Prüfung für die Variante „local" (Stufe 1 des Guards).
 *
 * **ZERO-IMPORT — bewusst.** Dieses Modul läuft in DREI Kontexten: im Browser
 * (Client-Adapter), im Node-Handler (`scripts/local-fs/`) und damit indirekt in
 * `vite.config.ts`. Der esbuild-Config-Loader kennt den `@`-Alias nicht, deshalb
 * hier weder `@/…` noch `node:*` importieren.
 *
 * Der Guard ist dreistufig: (1) diese reine Segment-Prüfung, (2) die
 * Wurzel-Auflösung in `scripts/local-fs/pfad-guard.ts`, (3) ein
 * `realpath`-Recheck gegen Symlinks/Junctions. Stufe 1 ist die einzige, die
 * beide Seiten teilen — der Client schickt nur Pfade, die hier durchkamen, und
 * der Server prüft trotzdem erneut (der Client ist keine Sicherheitsgrenze).
 */

/**
 * Windows-Gerätenamen. Ein `getFileHandle('NUL')` öffnet sonst das Null-Device:
 * `atomicWrite` meldete Erfolg, ohne je etwas geschrieben zu haben. Gilt auch
 * mit Endung (`NUL.txt`), weil Windows den Stamm auswertet.
 */
const WINDOWS_GERAETENAMEN = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

/** Obergrenze der ASCII-Steuerzeichen (alles darunter ist in Dateinamen verboten). */
const ERSTES_DRUCKBARES_ZEICHEN = 0x20;

/**
 * Steuerzeichen (inkl. NUL) und ':' in einem Segment?
 *
 * Der Doppelpunkt ist auf NTFS der Alternate-Data-Stream-Trenner
 * (`datei.txt:versteckt`) und Teil der Laufwerksangabe. Bewusst als
 * Code-Point-Prüfung statt als Regex: ein Zeichenklassen-Range wie `[ -:]`
 * umfasst versehentlich Ziffern, Punkt und Bindestrich, und `\u`-Escapes in
 * einem Regex-Literal sind beim Editieren fehleranfällig.
 */
function hatVerboteneZeichen(teil: string): boolean {
  for (const zeichen of teil) {
    if (zeichen === ':') return true;
    const code = zeichen.codePointAt(0);
    if (code !== undefined && code < ERSTES_DRUCKBARES_ZEICHEN) return true;
  }
  return false;
}

/** Grund, warum ein Pfad abgelehnt wurde — für aussagekräftige Fehlermeldungen. */
export type SegmentFehler =
  | 'leer'
  | 'traversal'
  | 'trenner-im-segment'
  | 'steuerzeichen'
  | 'geraetename'
  | 'trailing-punkt-oder-leerzeichen'
  | 'zu-tief';

export interface SegmentErgebnis {
  ok: boolean;
  /** Normalisierte (NFC) Segmente. Nur gefüllt, wenn `ok`. */
  segmente: string[];
  fehler?: SegmentFehler;
  /** Das beanstandete Segment — nur gesetzt, wenn `!ok`. */
  segment?: string;
}

/** Schutz gegen absurd tiefe Pfade (MAX_PATH-Nähe, Endlos-Rekursion). */
const MAX_TIEFE = 64;

const ok = (segmente: string[]): SegmentErgebnis => ({ ok: true, segmente });
const nein = (fehler: SegmentFehler, segment?: string): SegmentErgebnis =>
  ({ ok: false, segmente: [], fehler, segment });

/**
 * Zerlegt einen relativen POSIX-Pfad in geprüfte, NFC-normalisierte Segmente.
 *
 * Der leere Pfad (`''`, `'/'`) ist gültig und meint die Wurzel selbst — der
 * Adapter braucht das für Operationen auf dem Root-Handle.
 *
 * NFC-Normalisierung ist kein Kosmetik-Schritt: Kopien vom SMB-Share können
 * Umlaute in NFD tragen (`u` + Kombinationszeichen). Fragt die App in NFC an,
 * liefert ein naiver Vergleich `NotFoundError` auf eine Datei, die es gibt.
 * Beide Seiten normalisieren deshalb auf NFC (Klasse von Pitfall #22).
 */
export function pruefeSegmente(pfad: string): SegmentErgebnis {
  if (typeof pfad !== 'string') return nein('leer');

  const segmente: string[] = [];

  for (const teil of pfad.split('/')) {
    // Leere Segmente entstehen durch führende/doppelte/abschließende Slashes
    // und sind harmlos — `a//b` und `/a/b` meinen dasselbe wie `a/b`.
    if (teil === '') continue;

    if (teil === '.' || teil === '..') return nein('traversal', teil);

    // Backslash als Trenner: sonst käme `..\..\x` als EIN Segment durch und
    // würde vom Betriebssystem später doch als Traversal interpretiert.
    if (teil.includes('\\')) return nein('trenner-im-segment', teil);

    if (hatVerboteneZeichen(teil)) return nein('steuerzeichen', teil);

    const stamm = teil.split('.')[0]!.toLowerCase();
    if (WINDOWS_GERAETENAMEN.has(stamm)) return nein('geraetename', teil);

    // Windows normalisiert abschließende Punkte/Leerzeichen stillschweigend weg:
    // `x.` und `x ` landen beide auf `x` — ein Alias auf einen anderen Pfad.
    if (/[. ]$/.test(teil)) return nein('trailing-punkt-oder-leerzeichen', teil);

    segmente.push(teil.normalize('NFC'));
  }

  if (segmente.length > MAX_TIEFE) return nein('zu-tief');
  return ok(segmente);
}

/**
 * Setzt geprüfte Segmente wieder zu einem relativen POSIX-Pfad zusammen.
 * Umkehrung von `pruefeSegmente`, für Logging und Cache-Schlüssel.
 */
export function fuegeSegmenteZusammen(segmente: readonly string[]): string {
  return segmente.join('/');
}

/**
 * Verbindet einen Basis-Pfad mit einem Kind-Namen zu einem relativen Pfad.
 * Der Adapter baut damit beim Absteigen (`getDirectoryHandle`) den Pfad auf,
 * ohne je einen absoluten Pfad zu kennen.
 */
export function kindPfad(basis: string, name: string): string {
  return basis ? `${basis}/${name}` : name;
}

/**
 * Ist `name` ein gültiges EINZELNES Segment (kein Trenner, kein Traversal)?
 * Das ist die Prüfung für `getFileHandle(name)` / `getDirectoryHandle(name)`:
 * die FSAPI erlaubt dort ausdrücklich keine Pfade, nur Namen.
 */
export function istGueltigesSegment(name: string): boolean {
  if (typeof name !== 'string' || name === '') return false;
  if (name.includes('/')) return false;
  const res = pruefeSegmente(name);
  return res.ok && res.segmente.length === 1;
}

/** NFC-Form eines Namens — beide Seiten der Brücke vergleichen in dieser Form. */
export function normalisiereName(name: string): string {
  return name.normalize('NFC');
}

/**
 * Der ausgelieferte Code-Katalog — **unsere Kuration** über der Kürzel-Zuarbeit
 * des Fachsystems.
 *
 * Zwei Quellen, sauber getrennt:
 *
 * | | Was | Wo |
 * |---|---|---|
 * | Fremddaten | Bezeichnung, wer den Eintrag setzt | `seed-codes.data.ts` (generiert aus der Zuarbeit) |
 * | Unsere Entscheidung | Ordner, Prominenz, Spine-Phase, Rang, terminal | diese Datei |
 *
 * Deshalb überlebt die Kuration jede neue Zuarbeit: `npm run gen:status-codes`
 * schreibt nur die Datendatei neu, der Diff zeigt genau, was das Fachsystem
 * geändert hat. Umgekehrt formulieren wir keine Bezeichnung um — die Zuarbeit
 * ist wortgetreu, inklusive Abkürzungen; jede „Verbesserung" zerstörte die
 * Wiedererkennung gegen das Fachsystem.
 *
 * **Herkunft der Ordner-Zuordnung**: aus Bildschirmfotos der Ordnerbäume
 * übertragen. Das ist eine **Vorbelegung, die die PL bestätigt** — genau wie
 * beim Meilenstein-Seed. Codes, die dort nicht sichtbar waren, kommen aus der
 * Zuarbeit mit und landen im Sammelordner „Nicht zugeordnet".
 *
 * **Spalten-Konvention** (gegen `docs/fixtures/` verifiziert): der Code IST das
 * Spalten-Suffix. `D_<CODE>` trägt das Datum, `T_<CODE>` einen Texteintrag dazu,
 * ein `X` am Codeanfang bedeutet Verbund-Ebene. Abweichende Spaltennamen stehen
 * als `spalte`/`text` in der Kuration.
 *
 * **Nicht jeder Code steht in jedem Programm.** Ein Code, den ein
 * Programm-Schema nicht mappt, löst schlicht nicht auf und trägt nie einen Wert
 * — das ist kein Fehler.
 *
 * **Rang bewusst sparsam**: ohne `rang` trägt ein Feld NICHT zur Statusableitung
 * bei. Vergeben ist er nur für Codes, die eine Phase eindeutig markieren; alles
 * andere entscheidet die PL im Cockpit gegen die Simulation.
 *
 * Details: `docs/status-system/KATALOG-CODES.md`.
 */
import { NICHT_ZUGEORDNET_ID } from './kategorien';
import { ZUARBEIT_CODES, type ZuarbeitCode } from './seed-codes.data';
import type { Prominenz, SpinePhase, StatusFeldEintrag } from './typen';

/** Was WIR zu einem Code entscheiden. Bezeichnung und Rollen stehen in der Zuarbeit. */
interface Kuration {
  /** Abweichende Primärspalte. Default: `D_<code>`. Reine Texteinträge tragen `T_<code>`. */
  spalte?: string;
  /** Begleitende Textspalte, wenn das Fachsystem eine führt. */
  text?: string;
  /** Default `normal`. */
  prominenz?: Prominenz;
  spine?: SpinePhase;
  rang?: number;
  terminal?: true;
}

/** Reine Nachrichtenkanäle — vollständig erfasst, aber nicht im Vordergrund. */
const KANAL: Prominenz = 'nebensaechlich';
/** Fixpunkte der amtlichen Reise. */
const MST: Prominenz = 'meilenstein';

/**
 * Ordner → Code → Kuration. Die Gruppierung bildet die Ordnerbäume der
 * Bildschirmfotos ab; ein leeres `{}` heißt „nur einsortiert, sonst Default".
 *
 * Jeder Code hier muss in der Zuarbeit stehen — sonst hätte er keine
 * Bezeichnung. Bewacht vom Test `kuration-nur-bekannte-codes`.
 */
const KURATION: Record<string, Record<string, Kuration>> = {
  'vb.kommunikation': {
    XYB: { prominenz: KANAL },
    XYE: { prominenz: KANAL },
    XYFO: { prominenz: KANAL },
    XYF: { prominenz: KANAL },
    XYT: { prominenz: KANAL },
    XYG: { prominenz: KANAL },
    XYW: {},
    XCARE: {},
    XJURB: {},
    XYPM: { spalte: 'D_XYPM_A', text: 'T_XYPM_A', prominenz: KANAL },
    XPV: {},
    XCOV: {},
  },
  'vb.antragsbearbeitung': {
    XSW: { spalte: 'T_XSW' },
    'XRN+': {},
    'XRN-': {},
    XTE: {},
    XTEC: { prominenz: MST, spine: 'vollstaendigkeit', rang: 21 },
    XAT: { spalte: 'T_XAT' },
    'XAT+': { spalte: 'T_XAT+' },
    XANT: { prominenz: MST, spine: 'vollstaendigkeit', rang: 22 },
    'XPC+': { text: 'T_XPC+', prominenz: MST, spine: 'vollstaendigkeit', rang: 25 },
    'XPC?': {},
    'XPC-': {},
    XIZ: {},
    XINNO: { spalte: 'T_XINNO' },
    XALF: {},
    XARF: {},
    XABLF: {},
    XKS: { prominenz: MST, spine: 'fachpruefung', rang: 34 },
    XQS: { prominenz: MST, spine: 'fachpruefung', rang: 36 },
    XQSW: {},
    XTG: {},
    XFB: {},
    XHSP: {},
    XBG: {},
    XSPDOK: {},
    XAZBF: {},
  },
  'vb.betreuung': {
    XVU: {},
    XVN: {},
    XVL: {},
    XVT: {},
    XVK: {},
    XVZ: {},
    XVE: { prominenz: MST, spine: 'schluss', rang: 50, terminal: true },
  },
  'tv.kommunikation': {
    COMP: { prominenz: KANAL },
    YIRR: {},
    YIZ: {},
    YG: { prominenz: KANAL },
    YT: { prominenz: KANAL },
    YE: { prominenz: KANAL },
    YFO: { prominenz: KANAL },
    YB: { prominenz: KANAL },
    YF: { prominenz: KANAL },
    YJ: {},
    YJE: {},
    YJEQS: {},
    YJQ: {},
    YJZ: {},
    YW: { spalte: 'T_YW' },
    HINT: { spalte: 'T_HINT' },
    ANT: { text: 'T_ANT' },
    YPM: { spalte: 'D_YPM_A', text: 'T_YPM_A', prominenz: KANAL },
    YZU: {},
    YZUN: {},
    YZUD: {},
    YRP: {},
    YWSP: {},
    'YWSP?': {},
    'YWSP-': {},
    YKA: {},
    YKB: {},
    VME: {},
    VOE: {},
    NA: {},
    NE: {},
    AKTK: {},
    AKTT: {},
    AKTF: {},
    AKTQ: {},
    AKTQB: {},
    AKTQZ: {},
  },
  'tv.antragsbearbeitung': {
    AA: {},
    AAI: { text: 'T_AAI', prominenz: MST, spine: 'eingang', rang: 10 },
    AAE2: {},
    ABK: { spalte: 'T_ABK' },
    ADV: { prominenz: MST, spine: 'vollstaendigkeit', rang: 20 },
    AE: {},
    AR: { spalte: 'T_AR' },
    AUS: {},
    ANRD: { text: 'T_ANRD' },
    ALS: {},
    ALSB: {},
    ALT: {},
    ALU: {},
    ALQ: {},
    AADP: {},
    AN: {},
    ANM: {},
    AL: {},
    AMA: { spalte: 'T_AMA' },
    AVU: { spalte: 'T_AVU' },
    AVB: { spalte: 'T_AVB' },
    AT4: { spine: 'fachpruefung', rang: 30 },
    AK4: { spine: 'fachpruefung', rang: 30 },
    'AQ4-': {},
    AQ4: { spine: 'fachpruefung', rang: 32 },
    'QS-': {},
    QS: { spine: 'fachpruefung', rang: 32 },
    ABX: {},
    AB: { spine: 'bewilligung', rang: 40 },
    AZBE: { spine: 'bewilligung', rang: 44 },
    AZBQ: {},
    AZBZ: { prominenz: MST, spine: 'bewilligung', rang: 46 },
    ABE: {},
    AFUE: { text: 'T_AFUE' },
    ADS: { text: 'T_ADS' },
    ADL1: {},
    ADL2: {},
    ADL3: {},
  },
  'tv.antragsbearbeitung.precheck': {
    'PC+': { prominenz: MST, spine: 'vollstaendigkeit', rang: 24 },
    'PC?': {},
    'PC-': {},
    PCAN: {},
    PCQ: {},
    PCAL: {},
  },
  'tv.antragsbearbeitung.ruecknahmeempfehlung': {
    ARK: {},
    ART: {},
    'ARQ-': {},
    ARQ: {},
    ARZ: {},
    ARR: {},
    AAR: { prominenz: MST, spine: 'schluss', rang: 50, terminal: true },
    ARW: {},
  },
  'tv.antragsbearbeitung.ablehnung': {
    ABLK: {},
    ABLT: {},
    'ABLQ-': {},
    ABLQ: {},
    ABLJ: {},
    ABLQS: {},
    ABLZ: { prominenz: MST, spine: 'fachpruefung', rang: 38, terminal: true },
    AAA: {},
    ABL10: {},
    'ABL10+': {},
    ABLD: { spine: 'fachpruefung', rang: 39, terminal: true },
  },
  'tv.antragsbearbeitung.widerspruch-antrag': {
    ABLW: {},
    ABLWR: {},
    ABLWE: {},
    ABLWJ: {},
    ABLWQ: {},
    ABLWG: {},
    'ABLWG+': {},
    ABLWZ: {},
    ABLWD: {},
    AZBWZ: {},
  },
  'tv.antragsbearbeitung.widerspruch-zuwendung': {
    AZW: {},
    AZWR: {},
    AZWE: {},
    AZWJ: {},
    AZWQ: {},
    AZWG: {},
    'AZWG+': {},
    AZWA: {},
    AZWZ: {},
    AZWD: {},
  },
  'tv.antragsbearbeitung.ruecknahme-zuwendung': {
    RZA: {},
    RZE: {},
    RZQ: {},
    RZG: {},
    'RZG+': {},
    RZZ: { prominenz: MST, spine: 'schluss', rang: 50, terminal: true },
  },
  'tv.antragsbearbeitung.stichprobe': {
    STIP: {},
    SPDOK: {},
    STZG: {},
    STIT: {},
    STOK: {},
  },
};

/** Ebene eines Codes: `X` am Anfang heißt Verbund. */
export function ebeneVonCode(code: string): 'verbund' | 'tv' {
  return code.startsWith('X') ? 'verbund' : 'tv';
}

/** Rohtabelle für Tests und Doku-Prüfungen (Reihenfolge = Anzeige-Reihenfolge). */
export const SEED_CODE_TABELLE: readonly { kategorieId: string; codes: readonly string[] }[] =
  Object.entries(KURATION).map(([kategorieId, codes]) => ({ kategorieId, codes: Object.keys(codes) }));

function baueFeld(z: ZuarbeitCode, k: Kuration, kategorieId: string): StatusFeldEintrag {
  const spalte = k.spalte ?? `D_${z.code}`;
  return {
    // Die `feldId` ist die Primärspalte, nicht der nackte Code: sie ist es, was
    // in den CSV-Schemas steht und aufgelöst wird.
    feldId: spalte,
    label: z.label,
    typ: spalte.startsWith('T_') ? 'text' : 'datum',
    ebene: ebeneVonCode(z.code),
    // Die X-Codes stehen NICHT im Verbund-Record (der führt nur Titel und
    // Status), sondern identisch auf jeder TV-Zeile der CSV.
    herkunft: 'tv-record',
    code: z.code,
    ...(k.text ? { textSpalte: k.text } : {}),
    kategorieId,
    rollen: [...z.rollen],
    ...(k.spine ? { spinePhase: k.spine } : {}),
    ...(k.rang !== undefined ? { rang: k.rang } : {}),
    ...(k.terminal ? { terminal: true } : {}),
    prominenzDefault: k.prominenz ?? 'normal',
    aktiv: true,
    unkuratiert: false,
  };
}

/**
 * Baut die Feld-Einträge des Code-Katalogs: erst die einsortierten Codes in
 * Ordner-Reihenfolge, dann alles Übrige aus der Zuarbeit im Sammelordner.
 *
 * Rein und deterministisch (feste Reihenfolge, kein Zeitstempel) — der
 * Seed-Determinismus-Test hängt daran.
 */
export function baueSeedCodeFelder(): StatusFeldEintrag[] {
  const zuarbeit = new Map(ZUARBEIT_CODES.map(z => [z.code, z]));
  const out: StatusFeldEintrag[] = [];
  const einsortiert = new Set<string>();

  for (const [kategorieId, codes] of Object.entries(KURATION)) {
    for (const [code, k] of Object.entries(codes)) {
      const z = zuarbeit.get(code);
      // Ein kuratierter Code, den die Zuarbeit nicht führt, hat keine
      // Bezeichnung und wird übersprungen statt namenlos zu erscheinen.
      if (!z) continue;
      einsortiert.add(code);
      out.push(baueFeld(z, k, kategorieId));
    }
  }

  for (const z of ZUARBEIT_CODES) {
    if (einsortiert.has(z.code)) continue;
    out.push(baueFeld(z, {}, NICHT_ZUGEORDNET_ID[ebeneVonCode(z.code)]));
  }

  return out;
}

/**
 * Die Kürzel, mit denen das AB-Dashboard rechnet — Startvorschlag für die
 * **Relevanz-Häkchen** (Konzept 4.1).
 *
 * Herkunft: die Eingaben der 25 transkribierten WENN-Regeln plus die beiden
 * Sperren, dazu `AAE`/`XTE` für den wirksamen Eingang (Frist) und `XKS` aus dem
 * ungeklärten RNE-Gate (Verifikationsfrage V1 in `todo-regeln-ab-seed.md`).
 * Genau die Spalten also, die eine AB-Kollegin heute in ihrer Mappe führt.
 *
 * **Ein Vorschlag, keine Wahrheit**: die Liste wird über eine Aktion in den
 * Entwurf übernommen und ist danach normal editierbar. Sie ist rollen-typisch
 * (AB) — der FB-Satz entsteht nach demselben Muster, wenn die FB-Regeln kommen.
 * Deshalb setzt die Übernahme nur Häkchen und nimmt keine weg.
 *
 * 31 Codes, alle in der Zuarbeit vorhanden (ein Test hält das fest).
 */
export const AB_DASHBOARD_RELEVANZ: readonly string[] = [
  'AAE', 'AAR', 'ABB', 'ABLK', 'ABLT', 'ABLW', 'ABLZ', 'AK4', 'AL', 'ALSB',
  'ALT', 'ALU', 'AN', 'ANT', 'ARK', 'ART', 'ARW', 'ARZ', 'AT4', 'AVK',
  'AZBE', 'PC-', 'PC+', 'QS', 'QS-', 'VV', 'XABLF', 'XKS', 'XPC-', 'XPC+',
  'XTE',
];

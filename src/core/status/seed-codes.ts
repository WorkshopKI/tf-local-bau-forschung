/**
 * Der ausgelieferte Code-Katalog — **unsere Kuration** über der Kürzel-Zuarbeit
 * des Fachsystems.
 *
 * Zwei Quellen, sauber getrennt:
 *
 * | | Was | Wo |
 * |---|---|---|
 * | Fremddaten | Bezeichnung, wer den Eintrag setzt | `seed-codes.data.ts` (generiert aus der Zuarbeit) |
 * | Unsere Entscheidung | Ordner, Prominenz, ZAH-Phase | diese Datei |
 *
 * Deshalb überlebt die Kuration jede neue Zuarbeit: `npm run gen:status-codes`
 * schreibt nur die Datendatei neu, der Diff zeigt genau, was das Fachsystem
 * geändert hat. Umgekehrt formulieren wir keine Bezeichnung um — die Zuarbeit
 * ist wortgetreu, inklusive Abkürzungen; jede „Verbesserung" zerstörte die
 * Wiedererkennung gegen das Fachsystem.
 *
 * **Eine einzige Ausnahme, und sie ist keine Umformulierung**: wo die flache
 * Zuarbeit einem zweiten Dokument desselben Fachsystems belegt widerspricht
 * (Rechtschreibung, ein Projektform-Präfix, eine Dopplung), steht die Korrektur
 * mit Begründung in `seed-label-korrekturen.ts` und greift hier. Sie ist an den
 * falschen Wortlaut gebunden und läuft ins Leere, sobald die Quelle ihn behebt.
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
 * **ZAH-Phase bewusst sparsam**: sie beantwortet „welches Datum gehört zum
 * aktuellen Status?" und ist nur dort vergeben, wo die Zuordnung fachlich klar
 * ist. Ein Feld ohne Phase trägt nichts bei — besser als eine geratene Marke.
 * Sie leitet **keinen Status ab** (Pitfall #44); alles Weitere entscheidet die
 * PL im Cockpit.
 *
 * Details: `docs/status-system/KATALOG-CODES.md`.
 */
import { NICHT_ZUGEORDNET_ID } from './kategorien';
import { ZUARBEIT_CODES, type ZuarbeitCode } from './seed-codes.data';
import { korrigiereZuarbeitLabel } from './seed-label-korrekturen';
import type { Prominenz, StatusFeldEintrag, ZahPhaseId } from './typen';

/** Was WIR zu einem Code entscheiden. Bezeichnung und Rollen stehen in der Zuarbeit. */
interface Kuration {
  /** Abweichende Primärspalte. Default: `D_<code>`. Reine Texteinträge tragen `T_<code>`. */
  spalte?: string;
  /** Begleitende Textspalte, wenn das Fachsystem eine führt. */
  text?: string;
  /** Default `normal`. */
  prominenz?: Prominenz;
  /**
   * Zu welcher ZAH-Phase dieses Datumsfeld gehört — die Antwort auf „welches
   * Datum gehört zum aktuellen Status?" (Status-Erklärung, Chronik-Marke).
   *
   * Bewusst nur an den Feldern, bei denen die Zuordnung fachlich klar ist. Ein
   * Feld ohne Phase trägt nichts bei; das ist besser als eine geratene Marke.
   * PL-editierbar im Kürzel-Tab.
   */
  zah?: ZahPhaseId;
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
    XTEC: { prominenz: MST, zah: 'vollstaendigkeit' },
    XAT: { spalte: 'T_XAT' },
    'XAT+': { spalte: 'T_XAT+' },
    XANT: { prominenz: MST, zah: 'vollstaendigkeit' },
    'XPC+': { text: 'T_XPC+', prominenz: MST, zah: 'vollstaendigkeit' },
    'XPC?': {},
    'XPC-': {},
    XIZ: {},
    XINNO: { spalte: 'T_XINNO' },
    XALF: {},
    XARF: {},
    XABLF: {},
    XKS: { prominenz: MST, zah: 'pruefung' },
    XQS: { prominenz: MST, zah: 'pruefung' },
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
    XVE: { prominenz: MST, zah: 'abgeschlossen' },
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
    AAI: { text: 'T_AAI', prominenz: MST, zah: 'eingang' },
    AAE2: {},
    ABK: { spalte: 'T_ABK' },
    ADV: { prominenz: MST, zah: 'vollstaendigkeit' },
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
    AT4: { zah: 'pruefung' },
    AK4: { zah: 'pruefung' },
    'AQ4-': {},
    AQ4: { zah: 'pruefung' },
    // V4 bestaetigt (Fachabstimmung 03.08.2026): `QS` = Gutachten-QS fertig,
    // `QS-` = QS zurueck an AB/FB. Die Regeln R17/R18 lesen genau so.
    'QS-': {},
    QS: { zah: 'pruefung' },
    ABX: {},
    // Die alte Achse legte Entscheidung und Bewilligung zusammen; der Schnitt
    // liegt zwischen „erstellt" und „an ZE": bis der Bescheid raus ist, läuft
    // die Entscheidung, mit dem Versand beginnt die Begleitung (Status 59).
    AB: { zah: 'entscheidung' },
    AZBE: { zah: 'entscheidung' },
    AZBQ: {},
    AZBZ: { prominenz: MST, zah: 'begleitung' },
    ABE: {},
    AFUE: { text: 'T_AFUE' },
    ADS: { text: 'T_ADS' },
    ADL1: {},
    ADL2: {},
    ADL3: {},
  },
  'tv.antragsbearbeitung.precheck': {
    'PC+': { prominenz: MST, zah: 'vollstaendigkeit' },
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
    AAR: { prominenz: MST, zah: 'abgeschlossen' },
    ARW: {},
  },
  'tv.antragsbearbeitung.ablehnung': {
    ABLK: {},
    ABLT: {},
    'ABLQ-': {},
    ABLQ: {},
    ABLJ: {},
    ABLQS: {},
    // Die Ablehnung an den Antragsteller IST die Entscheidung (Status 70);
    // bestandskräftig wird sie erst mit `ABLD` — dann ist der Vorgang
    // abgeschlossen (73). Die alte Achse kannte diesen Unterschied nicht.
    ABLZ: { prominenz: MST, zah: 'entscheidung' },
    AAA: {},
    ABL10: {},
    'ABL10+': {},
    ABLD: { zah: 'abgeschlossen' },
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
    RZZ: { prominenz: MST, zah: 'abgeschlossen' },
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

/** Ein Feld, dessen `ebene` nicht zu seinem Code passt. */
export interface EbenenKonflikt {
  feldId: string;
  code: string;
  ist: 'verbund' | 'tv';
  soll: 'verbund' | 'tv';
}

/**
 * Felder, deren **Setzebene** dem X-Präfix widerspricht.
 *
 * Das Fachsystem erzwingt die Trennung: ein Kürzel mit führendem `X` wird auf
 * Verbundebene gesetzt und ist am Teilvorhaben gar nicht setzbar, alle anderen
 * umgekehrt. Beim Katalogbau ({@link ebeneVonCode}) und beim Entdecken neuer
 * Spalten wird das materialisiert — brechen kann es deshalb nur durch
 * **Kuration**: die PL ändert `ebene` im Cockpit, oder eine Bestandsfassung
 * trägt eine Zuordnung aus der Zeit vor dieser Regel.
 *
 * Nicht zu verwechseln mit der **Wirkungsebene**: `ABB` trägt kein `X`, wird am
 * Teilvorhaben gesetzt und kippt über die C16-Zeile trotzdem den Verbundstatus.
 * Zwei Felder, nie eines — diese Prüfung meint nur das erste.
 *
 * Rein und ohne Konsole, damit der Test sie ohne Attrappe prüfen kann (Muster
 * von `programmNummer.ts`).
 */
export function ebenenKonflikte(
  felder: readonly Pick<StatusFeldEintrag, 'feldId' | 'code' | 'ebene'>[],
): EbenenKonflikt[] {
  const out: EbenenKonflikt[] = [];
  for (const f of felder) {
    if (!f.code) continue;
    const soll = ebeneVonCode(f.code);
    if (f.ebene !== soll) out.push({ feldId: f.feldId, code: f.code, ist: f.ebene, soll });
  }
  return out;
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
    ...(k.zah ? { zahPhaseId: k.zah } : {}),
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
  // EINMAL korrigiert, dann beide Schleifen aus derselben Liste — sonst trüge
  // ein einsortierter Code den richtigen und ein unsortierter den falschen Text.
  const codes = ZUARBEIT_CODES.map(korrigiereZuarbeitLabel);
  const zuarbeit = new Map(codes.map(z => [z.code, z]));
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

  for (const z of codes) {
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

/**
 * Der ausgelieferte **AB-Regelsatz**: 25 Regeln + 2 Sperren, transkribiert aus
 * den WENN-Formeln der Mappe „AB Anträge".
 *
 * Quelle und Begründung je Regel: `docs/architecture/todo-regeln-ab-seed.md`.
 * Das ist kein Vorschlag aus dem Nichts, sondern die Verschriftlichung dessen,
 * was die AB-Kolleginnen heute rechnen — nur geteilt und versioniert statt
 * privat in einer Mappe.
 *
 * **Reihenfolge ist Bedeutung.** Die Kaskade der Mappe (Strang 1 … 10) steckt in
 * `reihenfolge` mit Zehnerlücken; die erste zutreffende Regel gewinnt. Wer
 * umsortiert, ändert das Ergebnis — das ist Absicht und der Grund, warum die
 * Reihenfolge per Drag pflegbar ist.
 *
 * **Spaltennamen kommen über {@link feld}**, nie als Literal: vier Codes
 * (`AAE`, `ABB`, `AZ1`, `VBE`) hängen an einem kanonischen Feld und heißen im
 * Katalog anders als `D_<code>`. Eine Regel mit `D_ABB` fände nie einen Wert und
 * schwiege für immer.
 *
 * In der Transkription bereinigte Mappen-Fehler und die offenen
 * Verifikationsfragen V1–V4 stehen im Quell-Dokument.
 */
import { KANONISCHE_CODE_FELDER } from './seed-kanonisch';
import { ALLE_STRAENGE, type Bedingung, type TodoRegel } from './typen';

/** Kürzel → feldId im Katalog. Kanonisch belegte Codes heißen dort anders. */
export function feld(code: string): string {
  return KANONISCHE_CODE_FELDER.get(code) ?? `D_${code}`;
}

const gefuellt = (code: string): Bedingung => ({ feldId: feld(code), op: 'gefuellt' });
const leer = (code: string): Bedingung => ({ feldId: feld(code), op: 'leer' });
/** Widerspruchsfrist: echtes `> N` — an Tag 31 läuft sie noch. */
const tageSeit = (code: string, tage: number): Bedingung => ({ feldId: feld(code), op: 'tageSeit', tage });
const alle = (...b: Bedingung[]): Bedingung => ({ alle: b });
const einige = (...b: Bedingung[]): Bedingung => ({ einige: b });

/** FuE = 3, DS = 5 (`vb-phase-mappings.ts`). DL/NW 1/NW 2 haben keinen PreCheck. */
const MIT_PRECHECK = [3, 5];

/**
 * Die Stränge, die eine Sperre stilllegt: PreCheck (R1/R2), Nachlieferung (R22)
 * und Nachforderung/PreCheck-offen (R23–R25).
 *
 * Beide Sperren decken **denselben** Satz ab — so steht es in der Sperrtabelle
 * der Quelle. Die Einzelvermerke an R22 („S2 greift nicht") sind Erinnerungen an
 * denselben Sachverhalt, keine engere Fassung; wo sie knapper wirken, gilt die
 * Tabelle. Vermerkt als Randfall für die Abstimmung mit den ABs.
 */
const GESPERRTE_STRAENGE = ['r1', 'r2', 'r22', 'r23a', 'r23b', 'r24', 'r25'];

export const AB_TODO_REGELN: readonly TodoRegel[] = [
  // --- Sperren (vor allem anderen ausgewertet) -------------------------------
  {
    /**
     * Die Populations-Filter der Mappe. Der Slicer-Screenshot zeigt fixiert
     * `D_AZBE = Leer` und `D_VV = Leer` — beides schneidet ganze Vorgänge weg,
     * nicht einzelne Stränge. Ohne sie meldeten Regeln ohne Endschranke über den
     * ganzen Altbestand (gemessen: „in QS" 1766).
     *
     * `D_AZ1_1` (Erstentscheidung) stand im Screenshot auf „Alle" und filterte
     * NICHT — der ursprünglich vorgeschlagene S3 ist damit widerlegt und wird
     * nicht gebaut (Fachabstimmung A3, siehe `todo-regeln-ab-seed.md`).
     */
    id: 's0', reihenfolge: 5, beschreibung: 'S0 · Verfahren abgeschlossen (Schlussvermerk)',
    bedingung: gefuellt('VV'),
    todo: '', zustaendig: [], sperrt: [ALLE_STRAENGE], aktiv: true,
  },
  {
    /**
     * Ausgenommen ist R3 („ZuwB erstellen"), und zwar mit Absicht doppelt:
     * R3 verlangt ohnehin `D_AZBE` leer und ist zu dieser Sperre logisch
     * disjunkt. Die Ausnahme steht trotzdem da, weil sie sichtbar macht, warum
     * R3 überlebt — und weil sie hält, wenn jemand R3 später umschreibt.
     */
    id: 's0b', reihenfolge: 6, beschreibung: 'S0b · Zuwendungsbescheid erstellt (in Begleitung)',
    bedingung: gefuellt('AZBE'),
    todo: '', zustaendig: [], sperrt: [ALLE_STRAENGE], sperrtNicht: ['r3'], aktiv: true,
  },
  {
    id: 's1', reihenfolge: 10, beschreibung: 'S1 · Antrag vom ASt zurückgezogen',
    bedingung: gefuellt('AAR'),
    todo: '', zustaendig: [], sperrt: GESPERRTE_STRAENGE, aktiv: true,
  },
  {
    id: 's2', reihenfolge: 20, beschreibung: 'S2 · RNE oder Ablehnung begonnen',
    bedingung: einige(gefuellt('ARK'), gefuellt('ART'), gefuellt('ABLK'), gefuellt('ABLT')),
    todo: '', zustaendig: [], sperrt: GESPERRTE_STRAENGE, aktiv: true,
  },

  // --- 1 · PreCheck negativ --------------------------------------------------
  {
    id: 'r1', reihenfolge: 30, beschreibung: 'R1 · PreCheck negativ (TV)',
    bedingung: alle(gefuellt('PC-'), leer('PC+')),
    todo: 'Abl/RNE erstellen', zustaendig: ['ab'], aktiv: true,
  },
  {
    id: 'r2', reihenfolge: 40, beschreibung: 'R2 · PreCheck negativ (Verbund)',
    bedingung: alle(gefuellt('XPC-'), leer('XPC+')),
    todo: 'Abl/RNE von FB abwarten', zustaendig: [], wartetAuf: 'fb', aktiv: true,
  },

  // --- 2 · Zuwendungsbescheid ------------------------------------------------
  {
    id: 'r3', reihenfolge: 50, beschreibung: 'R3 · bewilligt, ZuwB fehlt',
    bedingung: alle(gefuellt('ABB'), leer('AZBE')),
    todo: 'ZuwB erstellen', zustaendig: ['ab'], aktiv: true,
  },

  // --- 3 · Schlussvermerk nach Rücknahme -------------------------------------
  {
    id: 'r4', reihenfolge: 60, beschreibung: 'R4 · SV signiert, QS offen',
    bedingung: alle(gefuellt('AVK'), leer('VV')),
    todo: 'SV in QS', zustaendig: [], wartetAuf: 'qs', aktiv: true,
  },
  {
    id: 'r5', reihenfolge: 70, beschreibung: 'R5 · zurückgezogen, SV fehlt',
    bedingung: alle(gefuellt('AAR'), leer('AVK'), leer('VV')),
    todo: 'SV erstellen', zustaendig: ['ab'], aktiv: true,
  },

  // --- 4 · Rücknahmeempfehlung ----------------------------------------------
  // Das Gate `D_XKS leer` („nur solange die kaufm. QS nicht erfolgt ist") stand
  // in der Mappe an allen vier Regeln dieses Strangs und war als V1 zu
  // verifizieren. Die Fachabstimmung vom 03.08.2026 bestätigt es als ABSICHT:
  // nach erfolgter kaufmännischer QS ist der RNE-Vorgang aus AB-Sicht durch,
  // eine Erinnerung daran wäre Lärm. Damit ist es reguläre Bedingung.
  {
    id: 'r6', reihenfolge: 80, beschreibung: 'R6 · RNE-Widerspruchsfrist abgelaufen',
    bedingung: alle(gefuellt('ARZ'), leer('ARW'), tageSeit('ARZ', 31), leer('AVK'), leer('XKS')),
    todo: 'SV erstellen', zustaendig: ['ab'], aktiv: true,
  },
  {
    id: 'r7', reihenfolge: 90, beschreibung: 'R7 · Widerspruch gegen RNE eingegangen',
    bedingung: alle(gefuellt('ARZ'), gefuellt('ARW'), leer('AAR'), leer('XKS')),
    todo: 'Stellungnahme RNE prüfen', zustaendig: ['ab', 'fb'], aktiv: true,
  },
  {
    // Die „≤ 31 Tage" der Quelle stehen nicht als Bedingung: R6 steht davor und
    // nimmt den abgelaufenen Fall weg. Genau so rechnet die verschachtelte
    // WENN-Formel — die Kaskade IST die Fallunterscheidung.
    id: 'r8', reihenfolge: 100, beschreibung: 'R8 · RNE versandt, Frist läuft',
    bedingung: alle(gefuellt('ARZ'), leer('ARW'), leer('AAR'), leer('XKS')),
    todo: 'RNE abwarten', zustaendig: [], wartetAuf: 'ast', aktiv: true,
  },
  {
    id: 'r9', reihenfolge: 110, beschreibung: 'R9 · RNE technisch erstellt, kaufm. Teil fehlt',
    bedingung: alle(gefuellt('ART'), leer('ARZ'), leer('AAR'), leer('XKS')),
    todo: 'RNE ergänzen', zustaendig: ['ab'], aktiv: true,
  },

  // --- 5 · Nachforderungs-Erinnerung ----------------------------------------
  {
    // „heute > Termin" ist `datumVor` mit Grenze = Stichtag: das Termindatum
    // liegt in der Vergangenheit. Kein eigener Operator dafür.
    id: 'r10', reihenfolge: 120, beschreibung: 'R10 · Nachlieferungstermin verstrichen',
    bedingung: alle(
      gefuellt('AN'), gefuellt('ANT'),
      { feldId: feld('ANT'), op: 'datumVor', tageRelativHeute: 0 },
      leer('AL'),
    ),
    todo: 'Erinnerung an NF', zustaendig: ['ab'], aktiv: true,
  },

  // --- 6 · Ablehnung ---------------------------------------------------------
  {
    id: 'r11', reihenfolge: 130, beschreibung: 'R11 · Ablehnungs-Widerspruchsfrist abgelaufen',
    bedingung: alle(
      gefuellt('ABLZ'), leer('ABLW'), tageSeit('ABLZ', 31), leer('AVK'), leer('AAR'),
    ),
    todo: 'SV erstellen', zustaendig: ['ab'], aktiv: true,
  },
  {
    id: 'r12', reihenfolge: 140, beschreibung: 'R12 · Widerspruch gegen Ablehnung',
    bedingung: alle(gefuellt('ABLZ'), gefuellt('ABLW')),
    todo: 'Widerspruch gg Abl bearbeiten', zustaendig: ['ab', 'fb', 'jur'], aktiv: true,
  },
  {
    id: 'r13', reihenfolge: 150, beschreibung: 'R13 · Ablehnung versandt, Frist läuft',
    bedingung: alle(gefuellt('ABLZ'), leer('ABLW')),
    todo: 'Abl abwarten', zustaendig: [], wartetAuf: 'ast', aktiv: true,
  },
  {
    id: 'r14', reihenfolge: 160, beschreibung: 'R14 · alle Ablehnungen fertig, QS offen',
    bedingung: alle(gefuellt('XABLF'), leer('ABLZ')),
    todo: 'Abl in QS', zustaendig: [], wartetAuf: 'qs', aktiv: true,
  },
  {
    id: 'r15', reihenfolge: 170, beschreibung: 'R15 · Ablehnung technisch erstellt, kaufm. Teil fehlt',
    bedingung: alle(gefuellt('ABLT'), leer('XABLF'), leer('ABLZ')),
    todo: 'Abl ergänzen', zustaendig: ['ab'], aktiv: true,
  },
  {
    // Die Quelle vermerkt: unterdrückt, solange das Gutachten „in QS" ist (R19).
    // R19 steht in der Kaskade weiter hinten, kann diese Regel also nicht
    // verdrängen — die Ausnahme steht deshalb als Bedingung IN der Regel:
    // nicht (AK4 und AT4 gefüllt) = eines von beidem ist leer.
    id: 'r16', reihenfolge: 180, beschreibung: 'R16 · nur kaufm. Ablehnung erstellt',
    bedingung: alle(gefuellt('ABLK'), einige(leer('AK4'), leer('AT4'))),
    todo: 'Abl erstellt', zustaendig: [], wartetAuf: 'fb', aktiv: true,
  },

  // --- 7 · Gutachten-QS ------------------------------------------------------
  {
    id: 'r17', reihenfolge: 190, beschreibung: 'R17 · Gutachten-QS erfolgt',
    bedingung: gefuellt('QS'),
    todo: 'QS erfolgt', zustaendig: ['ab'], aktiv: true,
  },
  {
    id: 'r18', reihenfolge: 200, beschreibung: 'R18 · QS zurück an AB/FB',
    bedingung: alle(gefuellt('QS-'), leer('QS')),
    todo: 'Rückfragen aus QS', zustaendig: ['ab'], aktiv: true,
  },

  // --- 8 · Gutachten ---------------------------------------------------------
  {
    id: 'r19', reihenfolge: 210, beschreibung: 'R19 · beide Gutachten-Teile fertig',
    bedingung: alle(gefuellt('AK4'), gefuellt('AT4')),
    todo: 'in QS', zustaendig: [], wartetAuf: 'qs', aktiv: true,
  },
  {
    // `T_XPC+` ist der PreCheck-Vermerk, nicht das Datum in `D_XPC+` — deshalb
    // trägt der Kontext die Textspalten mit (`baueTodoKontext`).
    id: 'r20', reihenfolge: 220, beschreibung: 'R20 · kaufm. Gutachten fertig, fachlich offen',
    bedingung: alle(
      { feldId: 'T_XPC+', op: 'gefuellt' }, gefuellt('AK4'), leer('AT4'),
    ),
    todo: 'kaufm. fertig für QS', zustaendig: [], wartetAuf: 'fb', aktiv: true,
  },
  {
    id: 'r21', reihenfolge: 230, beschreibung: 'R21 · Gutachten zu schreiben',
    bedingung: alle(
      { feldId: 'T_XPC+', op: 'gefuellt' }, leer('AK4'),
      einige(gefuellt('AT4'), gefuellt('ALSB')),
    ),
    todo: 'GA schreiben', zustaendig: ['ab'], aktiv: true,
  },

  // --- 9 · Nachlieferung -----------------------------------------------------
  {
    id: 'r22', reihenfolge: 240, beschreibung: 'R22 · Nachlieferung nach Nachforderung eingegangen',
    bedingung: { feldId: feld('AL'), op: 'datumNachFeld', vergleichFeldId: feld('AN') },
    todo: 'NL prüfen', zustaendig: ['ab', 'fb'], aktiv: true,
  },

  // --- 10 · Nachforderung / PreCheck offen -----------------------------------
  // V2 ist beantwortet: der PreCheck hat ZWEI Teile mit verschiedenen Rollen —
  // der TV-PreCheck (`D_PC±`) ist die betriebswirtschaftliche Vorprüfung des AB,
  // der Verbund-PreCheck (`D_XPC±`) die inhaltliche des FB. „PC offen" muss
  // deshalb sagen, auf WEN gewartet wird; die Engine kennt keine gerechneten
  // Rollen, also steht je Teil eine Regel da. Beide behalten denselben
  // To-do-Text — das Board gruppiert danach, und fachlich ist es eine Aufgabe.
  {
    id: 'r23a', reihenfolge: 250, beschreibung: 'R23a · PreCheck TV offen (nur FuE/DS)',
    bedingung: alle(
      { feldId: 'status', op: 'ist', wert: 'beantragt' },
      { feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: MIT_PRECHECK },
      leer('AN'), leer('PC+'), leer('PC-'),
    ),
    todo: 'PC offen', zustaendig: [], wartetAuf: 'ab', aktiv: true,
  },
  {
    // Sind BEIDE PreCheck-Teile vermerkt und `D_AN` trotzdem leer, trifft keine
    // der beiden Regeln mehr und der Antrag fällt auf R24/R25 durch. Das ist die
    // Korrektur, nicht der Verlust: „PC offen" wäre dort schlicht falsch.
    id: 'r23b', reihenfolge: 255, beschreibung: 'R23b · PreCheck Verbund offen (nur FuE/DS)',
    bedingung: alle(
      { feldId: 'status', op: 'ist', wert: 'beantragt' },
      { feldId: 'vb_phase', op: 'foerdervarianteIn', varianten: MIT_PRECHECK },
      leer('AN'), leer('XPC+'), leer('XPC-'),
    ),
    todo: 'PC offen', zustaendig: [], wartetAuf: 'fb', aktiv: true,
  },
  {
    id: 'r24', reihenfolge: 260, beschreibung: 'R24 · fachlicher NF-Teil da, kaufm. fehlt',
    bedingung: alle(leer('AN'), leer('ALSB'), leer('ALT'), gefuellt('ALU')),
    todo: 'NF ergänzen', zustaendig: ['ab'], aktiv: true,
  },
  {
    // `gefuellt('status')` steht zusätzlich zur Quelle da. In Excel ist
    // `STATUS_TV <> "beantragt"` auf einer LEEREN Zelle wahr — auf echten Daten
    // egal (jeder Antrag hat einen Status), in der Engine aber nicht: ohne diese
    // Bedingung bekäme ein Datensatz ganz ohne Feldwerte „NF erstellen", also
    // eine erfundene Aufgabe aus lauter Abwesenheit.
    id: 'r25', reihenfolge: 270, beschreibung: 'R25 · Nachforderung zu erstellen',
    bedingung: alle(
      leer('AN'), leer('ALSB'), leer('ALT'), leer('ALU'),
      { feldId: 'status', op: 'gefuellt' },
      { feldId: 'status', op: 'istNicht', wert: 'beantragt' },
    ),
    todo: 'NF erstellen', zustaendig: ['ab'], aktiv: true,
  },
];

/**
 * Regel-Ids, die der Seed einmal führte und nicht mehr führt.
 *
 * Ohne diese Liste ließe sich beim Nachziehen nicht unterscheiden, ob eine
 * unbekannte Id von der PL erfunden wurde (bleibt) oder aus der Auslieferung
 * verschwunden ist (soll nicht weiter feuern). Stillgelegt wird sie, nicht
 * gelöscht — eine Fassung soll ihre Historie behalten.
 *
 * `r23` ist mit der Fachabstimmung in `r23a`/`r23b` aufgegangen (V2).
 */
export const ENTFALLENE_REGEL_IDS: readonly string[] = ['r23'];

/** Frische Kopien — der Seed darf nie durch eine Kuration mutiert werden. */
export function baueTodoRegelSeed(): TodoRegel[] {
  return AB_TODO_REGELN.map(r => ({
    ...r,
    zustaendig: [...r.zustaendig],
    ...(r.sperrt ? { sperrt: [...r.sperrt] } : {}),
    ...(r.sperrtNicht ? { sperrtNicht: [...r.sperrtNicht] } : {}),
    bedingung: JSON.parse(JSON.stringify(r.bedingung)) as Bedingung,
  }));
}

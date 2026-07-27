/**
 * Der ausgelieferte Code-Katalog: die Statuseinträge, die das Fachsystem führt.
 *
 * **Herkunft und Vorbehalt**: aus Bildschirmfotos der Ordnerbäume übertragen
 * („Verbundeinträge" und „Teilvorhaben"). Das ist eine **Vorbelegung, die die PL
 * bestätigt** — genau wie beim Meilenstein-Seed. Vier Ordner waren eingeklappt;
 * ihre Codes fehlen hier und kommen über die Spalten-Entdeckung herein.
 *
 * **Spalten-Konvention** (gegen `docs/fixtures/` verifiziert): der Code IST das
 * Spalten-Suffix. `D_<CODE>` trägt das Datum, `T_<CODE>` einen Texteintrag dazu,
 * ein `X` am Codeanfang bedeutet Verbund-Ebene. Deshalb genügt hier der Code;
 * abweichende Spaltennamen stehen als `spalte`/`text` daneben.
 *
 * **Nicht jeder Code steht in jedem Programm.** Die drei Fixture-Exporte decken
 * die Antragsbearbeitung ab, nicht die Kommunikations- und
 * Widerspruchs-Familien. Ein Code, den ein Programm-Schema nicht mappt, löst
 * schlicht nicht auf und trägt nie einen Wert — das ist kein Fehler.
 *
 * **Rang bewusst sparsam**: ohne `rang` trägt ein Feld NICHT zur Statusableitung
 * bei. Vergeben ist er nur für Codes, die eine Phase eindeutig markieren; alles
 * andere entscheidet die PL im Cockpit gegen die Simulation.
 *
 * Details: `docs/status-system/KATALOG-CODES.md`.
 */
import type {
  Prominenz, SpinePhase, StatusFeldEintrag, Zustaendigkeit,
} from './typen';

interface SeedCode {
  /** Code des Fachsystems ohne Spalten-Präfix. */
  code: string;
  label: string;
  /** Abweichende Primärspalte. Default: `D_<code>`. Reine Texteinträge tragen hier `T_<code>`. */
  spalte?: string;
  /** Begleitende Textspalte, wenn das Fachsystem eine führt. */
  text?: string;
  /** Default `beide`. Abgeleitet aus der Beschriftung („adm."/„kaufmännisch" ⇒ AB,
   *  „techn."/„fachlich"/„FB" ⇒ FB). */
  zust?: Zustaendigkeit;
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

// ---------------------------------------------------------------------------
// Verbundeinträge (X-Präfix)
// ---------------------------------------------------------------------------

const VB_KOMMUNIKATION: SeedCode[] = [
  { code: 'XYB', label: 'Brief', prominenz: KANAL },
  { code: 'XYE', label: 'E-Mail', prominenz: KANAL },
  { code: 'XYFO', label: 'Eingang Foyer', prominenz: KANAL },
  { code: 'XYF', label: 'Fax', prominenz: KANAL },
  { code: 'XYT', label: 'Telefon', prominenz: KANAL },
  { code: 'XYG', label: 'Beratungsgespräch', prominenz: KANAL },
  { code: 'XYW', label: 'Wichtig' },
  { code: 'XCARE', label: 'Marker für kritisches Projekt in der Begleitung' },
  { code: 'XJURB', label: 'juristische Bearbeiter:in' },
  // Im Fixture heißen die Spalten `D_XYPM_A`/`T_XYPM_A`.
  { code: 'XYPM', label: 'Pressemitteilung', spalte: 'D_XYPM_A', text: 'T_XYPM_A', prominenz: KANAL },
  { code: 'XTP', label: 'Termin für Präsentation' },
  { code: 'XPV', label: 'Projekt vorgestellt' },
  { code: 'XCOV', label: 'thematisch COVID19' },
];

const VB_ANTRAGSBEARBEITUNG: SeedCode[] = [
  { code: 'XSW', label: 'Skizze00x Phase 1/2 oder Wiedereinreicher TB/BB', spalte: 'T_XSW' },
  { code: 'XRN+', label: 'regulärer NWP am Projekt beteiligt' },
  { code: 'XRN-', label: 'kein regulärer NWP am Projekt beteiligt' },
  { code: 'XTE', label: 'alle Anträge eingegangen' },
  { code: 'XTEC', label: 'alle Anträge in C16 eingegeben', prominenz: MST, spine: 'vollstaendigkeit', rang: 21 },
  { code: 'XAT', label: 'Anzahl der erwarteten Teilvorhaben', spalte: 'T_XAT' },
  { code: 'XAT+', label: 'Anzahl der Teilvorhaben (inkl. assoziiert)', spalte: 'T_XAT+' },
  { code: 'XANT', label: 'Termin Vollständigkeit Verbund', prominenz: MST, spine: 'vollstaendigkeit', rang: 22 },
  { code: 'XPC+', label: 'PreCheck positiv', text: 'T_XPC+', prominenz: MST, spine: 'vollstaendigkeit', rang: 25 },
  { code: 'XPC?', label: 'PreCheck Nachforderung' },
  { code: 'XPC-', label: 'PreCheck negativ' },
  { code: 'XIZ', label: 'Irrläufer an richtigen PT' },
  { code: 'XINNO', label: 'Innovationsgrad bei GA', spalte: 'T_XINNO', zust: 'fb' },
  { code: 'XALF', label: 'alle erforderlichen Nachforderungen sind fertig (AB/FB)' },
  { code: 'XARF', label: 'alle erforderlichen Rücknahmeempfehlungen sind fertig (AB/FB)' },
  { code: 'XABLF', label: 'alle erforderlichen Ablehnungen sind fertig (AB/FB)' },
  { code: 'XKS', label: 'Gutachten fertig – FB', zust: 'fb', prominenz: MST, spine: 'fachpruefung', rang: 34 },
  { code: 'XQS', label: 'Gutachten QS fertig', prominenz: MST, spine: 'fachpruefung', rang: 36 },
  { code: 'XQSW', label: 'Gutachten QS nach Widerspruch fertig' },
  { code: 'XTG', label: 'voraussichtlicher Termin GA (technisch)', zust: 'fb' },
  { code: 'XFB', label: 'Bewilligung ausgesetzt – max. 2 Bewilligungen in 12 Monaten' },
  { code: 'XHSP', label: 'Bewilligung ausgesetzt – Haushaltssperre' },
  { code: 'XBG', label: 'beispielhaftes Gutachten', zust: 'fb' },
  { code: 'XSPDOK', label: 'Stichprobendokumente an ZG' },
  { code: 'XAZBF', label: 'alle Zuwendungsbescheide sind erstellt' },
];

const VB_BETREUUNG: SeedCode[] = [
  { code: 'XVU', label: 'Eingang unterschriebener Kooperationsvertrag' },
  { code: 'XVN', label: 'Nachforderung Kooperationsvertrag' },
  { code: 'XVL', label: 'Nachlieferung Kooperationsvertrag' },
  { code: 'XVT', label: 'unterschriebener Kooperationsvertrag technisch geprüft', zust: 'fb' },
  { code: 'XVK', label: 'unterschriebener Kooperationsvertrag kaufmännisch geprüft', zust: 'ab' },
  { code: 'XVZ', label: 'Auflagenerfüllung an ZE Kooperationsvertrag' },
  { code: 'XVE', label: 'Verbund beendet', prominenz: MST, spine: 'schluss', rang: 50, terminal: true },
];

// ---------------------------------------------------------------------------
// Teilvorhaben
// ---------------------------------------------------------------------------

const TV_KOMMUNIKATION: SeedCode[] = [
  { code: 'COMP', label: 'Compounddokument', prominenz: KANAL },
  { code: 'IDMSG', label: 'Rollen an Antragsteller', prominenz: KANAL },
  { code: 'YIRR', label: 'FuE / Akronym' },
  { code: 'YIZ', label: 'Irrläufer an anderen PT AiF/EN' },
  { code: 'YG', label: 'Beratungsgespräch bei VDI/VDE-IT', prominenz: KANAL },
  { code: 'YT', label: 'Telefonat mit', prominenz: KANAL },
  { code: 'YE', label: 'E-Mail', prominenz: KANAL },
  { code: 'YFO', label: 'Eingang Foyer', prominenz: KANAL },
  { code: 'YB', label: 'Brief', prominenz: KANAL },
  { code: 'YF', label: 'Fax', prominenz: KANAL },
  { code: 'YJ', label: 'juristisches Schreiben eingegangen' },
  { code: 'YJE', label: 'juristisches Schreiben ohne QS-Bedarf erstellt' },
  { code: 'YJEQS', label: 'juristisches Schreiben mit QS-Bedarf erstellt' },
  { code: 'YJQ', label: 'QS juristisches Schreiben erfolgt' },
  { code: 'YJZ', label: 'juristisches Schreiben wurde versendet' },
  { code: 'YW', label: 'Wichtig', spalte: 'T_YW' },
  { code: 'HINT', label: 'Bemerkung', spalte: 'T_HINT' },
  { code: 'ANT', label: 'Termin für Nachlieferung', text: 'T_ANT' },
  { code: 'YPM', label: 'Pressemitteilung', spalte: 'D_YPM_A', text: 'T_YPM_A', prominenz: KANAL },
  { code: 'YZU', label: 'Zustellungsurkunde an ASt/ZE' },
  { code: 'YZUN', label: 'Zustellung nicht möglich' },
  { code: 'YZUD', label: 'Zustellung an Person/Briefkasten/sonstiges' },
  { code: 'YRP', label: 'Rücknahme ist eingegangen – zur Prüfung an AB', zust: 'ab' },
  { code: 'YWSP', label: 'Widerspruch ist eingegangen' },
  { code: 'YWSP?', label: 'Widerspruch ist unvollständig' },
  { code: 'YWSP-', label: 'Widerspruch ist unzulässig' },
  { code: 'YKA', label: 'Eingang Klage vor Bewilligung' },
  { code: 'YKB', label: 'Eingang Klage nach Bewilligung' },
  { code: 'VME', label: 'Vollmacht NWME/Berater mit Einschränkungen' },
  { code: 'VOE', label: 'Vollmacht NWME/Berater ohne Einschränkungen' },
  { code: 'NA', label: 'Eingang Änderung Firmendaten' },
  { code: 'NE', label: 'Änderung Firmendaten erledigt' },
  { code: 'AKTK', label: 'Aktennotiz adm. erstellt/ergänzt/keine Ergänzung', zust: 'ab' },
  { code: 'AKTT', label: 'Aktennotiz fachl. erstellt/ergänzt/keine Ergänzung', zust: 'fb' },
  { code: 'AKTF', label: 'Aktennotiz ist fertig (Grund adm./fachl.)' },
  { code: 'AKTQ', label: 'QS der Aktennotiz ohne Bescheid als Folge ist erfolgt' },
  { code: 'AKTQB', label: 'QS der Aktennotiz zur Bescheiderstellung ist erfolgt' },
  { code: 'AKTQZ', label: 'QS Rückforderungs-/Erstattungsbetrag und Zinsen erfolgt', zust: 'ab' },
];

const TV_PRECHECK: SeedCode[] = [
  { code: 'PC+', label: 'pre-check positiv', prominenz: MST, spine: 'vollstaendigkeit', rang: 24 },
  { code: 'PC?', label: 'pre-check unvollständig' },
  { code: 'PC-', label: 'pre-check negativ' },
  { code: 'PCAN', label: 'pre-check Nachforderungen an ASt' },
  { code: 'PCQ', label: 'pre-check NF Qualitätssicherung' },
  { code: 'PCAL', label: 'pre-check Nachlieferungen' },
];

const TV_RUECKNAHMEEMPFEHLUNG: SeedCode[] = [
  { code: 'ARK', label: 'Rücknahmeempfehlung adm. erstellt/ergänzt/keine Ergänzung', zust: 'ab' },
  { code: 'ART', label: 'Rücknahmeempfehlung techn. erstellt/ergänzt/keine Ergänzung', zust: 'fb' },
  { code: 'ARQ-', label: 'QS Rücknahmeempfehlung zurück an AB/FB' },
  { code: 'ARQ', label: 'Rücknahmeempfehlung QS erfolgt' },
  { code: 'ARZ', label: 'Rücknahmeempfehlung an ASt' },
  { code: 'ARR', label: 'Termin Rücknahmeempfehlung' },
  { code: 'AAR', label: 'Antrag vom ASt zurückgezogen', prominenz: MST, spine: 'fachpruefung', rang: 38, terminal: true },
  { code: 'ARW', label: 'Stellungnahme des ASt zur Rücknahmeempfehlung' },
];

const TV_ABLEHNUNG: SeedCode[] = [
  { code: 'ABLK', label: 'Ablehnung adm. erstellt/ergänzt/keine Ergänzung', zust: 'ab' },
  { code: 'ABLT', label: 'Ablehnung techn. erstellt/ergänzt/keine Ergänzung', zust: 'fb' },
  { code: 'ABLQ-', label: 'Ablehnung QS negativ zurück an AB/FB' },
  { code: 'ABLQ', label: 'Ablehnung Qualitätssicherung' },
  { code: 'ABLJ', label: 'Ablehnung juristische Qualitätssicherung' },
  { code: 'ABLQS', label: 'Finale Qualitätssicherung Ablehnung' },
  { code: 'ABLZ', label: 'Ablehnung an ASt', prominenz: MST, spine: 'fachpruefung', rang: 38, terminal: true },
  { code: 'AAA', label: 'allgemeine Ablehnung' },
  { code: 'ABL10', label: '10. Ablehnung an BMWK' },
  { code: 'ABL10+', label: '10. Ablehnung Freigabe durch BMWK' },
  { code: 'ABLD', label: 'Termin Ablehnung rechtskräftig', spine: 'fachpruefung', rang: 39, terminal: true },
];

const TV_WIDERSPRUCH_ANTRAG: SeedCode[] = [
  { code: 'ABLW', label: 'Widerspruch gegen Ablehnungsbescheid' },
  { code: 'ABLWR', label: 'Widerspruch zur Ablehnung zurückgezogen' },
  { code: 'ABLWE', label: 'pos/neg Widerspruchsbescheid erstellt' },
  { code: 'ABLWJ', label: 'pos/neg Widerspruchsbescheid juristische QS' },
  { code: 'ABLWQ', label: 'pos/neg Widerspruchsbescheid QS ist erfolgt' },
  { code: 'ABLWG', label: 'Widerspruchsbescheid zur Kenntnisnahme / zur Freigabe ans BMWE' },
  { code: 'ABLWG+', label: 'Freigabe Widerspruchsbescheid vom BMWE erfolgt / nicht erforderlich' },
  { code: 'ABLWZ', label: 'negativer Widerspruchsbescheid nach Ablehnung' },
  { code: 'ABLWD', label: 'Termin Widerspruchsbescheid rechtskräftig' },
  { code: 'AZBWZ', label: 'positiver Widerspruchsbescheid nach Ablehnung' },
];

const TV_WIDERSPRUCH_ZUWENDUNG: SeedCode[] = [
  { code: 'AZW', label: 'Widerspruch Zuwendungsbescheid eingegangen' },
  { code: 'AZWR', label: 'Widerspruch Zuwendungsbescheid zurückgezogen' },
  { code: 'AZWE', label: 'Widerspruchsbescheid erstellt' },
  { code: 'AZWJ', label: 'Widerspruchsbescheid juristische QS erfolgt' },
  { code: 'AZWQ', label: 'Widerspruchsbescheid QS durch PL erfolgt (pos/neg)' },
  { code: 'AZWG', label: 'Widerspruchsbescheid zur Kenntnisnahme ans BMWK' },
  { code: 'AZWG+', label: 'Rückfragen/Hinweise vom BMWK' },
  { code: 'AZWA', label: 'negativer Widerspruchsbescheid' },
  { code: 'AZWZ', label: 'positiver Widerspruchsbescheid' },
  { code: 'AZWD', label: 'Frist Klage Widerspruchsbescheid' },
];

const TV_RUECKNAHME_ZUWENDUNG: SeedCode[] = [
  { code: 'RZA', label: 'Grund für Rücknahme des Zuwendungsbescheides eingegangen' },
  { code: 'RZE', label: 'Rücknahmebescheid des Zuwendungsbescheides erstellt' },
  { code: 'RZQ', label: 'Rücknahmebescheid QS ist erfolgt' },
  { code: 'RZG', label: 'Rücknahmebescheid ans BMWK' },
  { code: 'RZG+', label: 'Rückfragen/Hinweise vom BMWK' },
  { code: 'RZZ', label: 'Rücknahmebescheid an ZE', prominenz: MST, spine: 'bewilligung', rang: 48, terminal: true },
];

const TV_STICHPROBE: SeedCode[] = [
  { code: 'STIP', label: 'Stichprobe' },
  { code: 'SPDOK', label: 'Stichprobendokumente an ZG' },
  { code: 'STZG', label: 'Akte zur Stichprobe an ZG' },
  { code: 'STIT', label: 'Stichprobe zurück an IT' },
  { code: 'STOK', label: 'Stichprobe ok' },
];

const TV_ANTRAGSBEARBEITUNG: SeedCode[] = [
  { code: 'AA', label: 'Antrag vom ASt unterschrieben' },
  // AAE („Antragseingang", D_AAE) fehlt hier bewusst: die Spalte ist app-weit
  // auf das kanonische `antragsdatum` gemappt (CANONICAL_FIELD_NAME_ALIASES) und
  // steht als solches im Seed. Ein zweiter Eintrag auf derselben Spalte gäbe
  // doppelte Ereignisse und doppelte Ableitungs-Beiträge. Gleiches gilt für
  // ABB (`bewilligung_datum`) und AZ1 (`erstentscheidung`).
  { code: 'AAI', label: 'Antragsimport aus ZIM-Foyer oder FZD', text: 'T_AAI', prominenz: MST, spine: 'eingang', rang: 10 },
  { code: 'AAE2', label: 'Antragseingang 2' },
  { code: 'ABK', label: 'beantragte Kosten (Deckblatt Mantelbogen)', spalte: 'T_ABK', zust: 'ab' },
  { code: 'ADV', label: 'Antrag in C16 eingestellt', prominenz: MST, spine: 'vollstaendigkeit', rang: 20 },
  { code: 'AE', label: 'Eingangsbestätigung an ASt' },
  { code: 'AR', label: 'Antrag mit Risiko', spalte: 'T_AR' },
  { code: 'AUS', label: 'Unternehmen in Schwierigkeiten', zust: 'ab' },
  { code: 'ANRD', label: 'Nachrangdarlehen vorhanden – (nicht) i.O.', text: 'T_ANRD', zust: 'ab' },
  { code: 'ALS', label: 'TB ohne (weitere) Nachforderungen' },
  { code: 'ALSB', label: 'BB ohne (weitere) Nachforderungen' },
  { code: 'ALT', label: 'Brief Nachforderung von AB angelegt/ergänzt', zust: 'ab' },
  { code: 'ALU', label: 'Brief Nachforderung von FB angelegt/ergänzt', zust: 'fb' },
  { code: 'ALQ', label: 'Nachforderung von PL gelesen' },
  { code: 'AADP', label: 'Auftrag an Dritte positiv' },
  { code: 'AN', label: 'Nachforderung an ASt' },
  { code: 'ANM', label: 'Mahnung Nachforderung' },
  { code: 'AL', label: 'Nachlieferung Eingang' },
  { code: 'AMA', label: 'Mitarbeiter Anzahl Anlage 1', spalte: 'T_AMA', zust: 'ab' },
  { code: 'AVU', label: 'Verbundumsatz laut Anlage 1', spalte: 'T_AVU', zust: 'ab' },
  { code: 'AVB', label: 'Verbundbilanz laut Anlage 1', spalte: 'T_AVB', zust: 'ab' },
  { code: 'AT4', label: 'Gutachten technisch fertig', zust: 'fb', spine: 'fachpruefung', rang: 30 },
  { code: 'AK4', label: 'Gutachten kaufmännisch fertig', zust: 'ab', spine: 'fachpruefung', rang: 30 },
  { code: 'AQ4-', label: 'fachliche QS zurück an FB', zust: 'fb' },
  { code: 'AQ4', label: 'fachliche QS fertig', zust: 'fb', spine: 'fachpruefung', rang: 32 },
  { code: 'QS-', label: 'kaufmännische QS zurück an AB', zust: 'ab' },
  { code: 'QS', label: 'kaufmännische QS erfolgt', zust: 'ab', spine: 'fachpruefung', rang: 32 },
  { code: 'ABX', label: 'Bewilligung ausgesetzt' },
  { code: 'AB', label: 'Bewilligungsempfehlung durch Haushaltsbeauftragte/Titelverantwortliche', spine: 'bewilligung', rang: 40 },
  { code: 'AZBE', label: 'Zuwendungsbescheid erstellt', spine: 'bewilligung', rang: 44 },
  { code: 'AZBQ', label: 'Zuwendungsbescheid Qualitätssicherung' },
  { code: 'AZBZ', label: 'Bewilligung an ZE', prominenz: MST, spine: 'bewilligung', rang: 46 },
  { code: 'ABE', label: 'Eingang Empfangsbestätigung' },
  { code: 'AFUE', label: 'FKZ zum zugehörigen FuE', text: 'T_AFUE' },
  { code: 'ADS', label: 'FKZ der Durchführbarkeitsstudie', text: 'T_ADS' },
  { code: 'ADL1', label: 'FKZ vom ersten DL-Antrag' },
  { code: 'ADL2', label: 'FKZ vom ersten DL-Folgeantrag' },
  { code: 'ADL3', label: 'FKZ vom zweiten DL-Folgeantrag' },
];

/** Kategorie-Id → Codes. Die Ebene zieht der Bauer aus der Kategorie. */
const NACH_KATEGORIE: Record<string, SeedCode[]> = {
  'vb.kommunikation': VB_KOMMUNIKATION,
  'vb.antragsbearbeitung': VB_ANTRAGSBEARBEITUNG,
  'vb.betreuung': VB_BETREUUNG,
  'tv.kommunikation': TV_KOMMUNIKATION,
  'tv.antragsbearbeitung': TV_ANTRAGSBEARBEITUNG,
  'tv.antragsbearbeitung.precheck': TV_PRECHECK,
  'tv.antragsbearbeitung.ruecknahmeempfehlung': TV_RUECKNAHMEEMPFEHLUNG,
  'tv.antragsbearbeitung.ablehnung': TV_ABLEHNUNG,
  'tv.antragsbearbeitung.widerspruch-antrag': TV_WIDERSPRUCH_ANTRAG,
  'tv.antragsbearbeitung.widerspruch-zuwendung': TV_WIDERSPRUCH_ZUWENDUNG,
  'tv.antragsbearbeitung.ruecknahme-zuwendung': TV_RUECKNAHME_ZUWENDUNG,
  'tv.antragsbearbeitung.stichprobe': TV_STICHPROBE,
};

/** Rohtabelle für Tests und Doku-Prüfungen (Reihenfolge = Anzeige-Reihenfolge). */
export const SEED_CODE_TABELLE: readonly { kategorieId: string; codes: readonly SeedCode[] }[] =
  Object.entries(NACH_KATEGORIE).map(([kategorieId, codes]) => ({ kategorieId, codes }));

/** Ebene eines Codes: `X` am Anfang heißt Verbund. */
export function ebeneVonCode(code: string): 'verbund' | 'tv' {
  return code.startsWith('X') ? 'verbund' : 'tv';
}

/**
 * Baut die Feld-Einträge des Code-Katalogs. Rein und deterministisch (feste
 * Reihenfolge, kein Zeitstempel) — der Seed-Determinismus-Test hängt daran.
 *
 * Die `feldId` ist die Primärspalte, nicht der nackte Code: sie ist es, was in
 * den CSV-Schemas steht und aufgelöst wird.
 */
export function baueSeedCodeFelder(): StatusFeldEintrag[] {
  const out: StatusFeldEintrag[] = [];
  for (const { kategorieId, codes } of SEED_CODE_TABELLE) {
    for (const c of codes) {
      const spalte = c.spalte ?? `D_${c.code}`;
      const ebene = ebeneVonCode(c.code);
      out.push({
        feldId: spalte,
        label: c.label,
        typ: spalte.startsWith('T_') ? 'text' : 'datum',
        ebene,
        // Die X-Codes stehen NICHT im Verbund-Record (der führt nur Titel und
        // Status), sondern identisch auf jeder TV-Zeile der CSV.
        herkunft: 'tv-record',
        code: c.code,
        ...(c.text ? { textSpalte: c.text } : {}),
        kategorieId,
        zustaendigkeit: c.zust ?? 'beide',
        ...(c.spine ? { spinePhase: c.spine } : {}),
        ...(c.rang !== undefined ? { rang: c.rang } : {}),
        ...(c.terminal ? { terminal: true } : {}),
        prominenzDefault: c.prominenz ?? 'normal',
        aktiv: true,
        unkuratiert: false,
      });
    }
  }
  return out;
}

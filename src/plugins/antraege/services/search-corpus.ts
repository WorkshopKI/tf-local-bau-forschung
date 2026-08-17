/**
 * Hybrid-Such-Korpora fuer das Antraege-Plugin.
 *
 * Zwei Hilfsstrukturen, die fuer die Hybrid-Suche (Substring auf CSV-Volltext
 * + Embedding-Match aus dem Auslastungs-Korpus + DMS-Index-Treffer) gebraucht
 * werden:
 *
 *  - `loadAntraegeTextCorpus` — projiziert den vollen `Antrag`-Record auf die
 *    suchrelevanten Text-Felder (Verbund-Titel, Titel, Projektbeschreibung,
 *    Deskriptoren, Akronym, Aktenzeichen, Verbundkennzeichen, Organisation,
 *    Standort, Web-Adresse, Netzwerk, Arbeitsnotizen, Wahlkreis)
 *    und cached zusaetzlich die lowercase-Variante
 *    (Substring-Match per Keystroke wird so von ~500 ms auf ~10–30 ms reduziert).
 *
 *    Unter welchem Schluessel eine CSV-Spalte im Antrags-Record liegt, sagt das
 *    Wizard-Mapping — nicht der Code. Die Zuordnung kommt deshalb aus
 *    [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts).
 *
 *  - `loadDmsFilenameToAkz` — Umkehr-Lookup fuer Phase-2-Treffer: Orama
 *    liefert pro Hit den `source`-Filename, wir wollen den `matched_antrag_id`
 *    (Aktenzeichen) wissen. Filter auf `triage_state === 'relevant'`.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_STORES } from '@/core/services/storage/idb-store';
import type { Antrag } from '@/core/services/csv/types';
import { listManifestEntries } from '@/phase2/scanner/manifest-store';
import { listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { normalizeKey } from '../fieldLookup';
import { buildDescriptorsText, deskriptorenAnzeige } from './descriptor-text';
import { netzwerkName, nimmWerte, type WertIndexRoh } from './wert-index';
import {
  baueKorpusFeldKarte, SLOT_REIHENFOLGE,
  type KorpusFeldKarte, type KorpusSlot,
} from './korpusFeldAufloesung';

export interface AntragTextEntry {
  /** Verbund-Titel. */
  vb: string;
  /** Teilvorhaben-Titel (CSV-Spalte `titel`). */
  tv: string;
  /** Kurzbeschreibung / Abstract / VB-Inhalt. */
  abstract: string;
  /** Konkatenierte Deskriptor-Werte: TECHN/BRANCHE/ANWEND-Strings +
   *  Klartexte der gesetzten ZT-Flags (siehe `descriptor-text.ts`) + seit v4.50
   *  der NACE-Branchentext, der dieselbe Frage feiner beantwortet. */
  descriptors: string;
  /** Akronym / Kurzname (CSV-Spalte `VB_KURZNAM`). Eigenes Feld, weil es NICHT
   *  verlaesslich im Titel steht: der Netzwerkantrag `16KN083001` heisst
   *  `mobiInspec`, sein VB-Titel lautet aber nur „Mobile Messtechnik fuer die
   *  Energieversorgung" — ohne dieses Feld war er per Stichwort unauffindbar,
   *  obwohl der Leerzustand der Suche „Nach Titel, Akronym, FKZ …" verspricht. */
  akronym: string;
  /** Pre-computed lowercase. Einmal beim Load berechnen, dann per Keystroke
   *  nur `.includes(q)` ohne neue String-Allokation. Wichtig fuer 13k-Korpora,
   *  sonst ~100 MB GC-Druck pro Keystroke. */
  vbLower: string;
  tvLower: string;
  absLower: string;
  descriptorsLower: string;
  akronymLower: string;
  /**
   * Die Kennzeichen DIESES Antrags, klein geschrieben: das Foerderkennzeichen
   * (`16KN065624`, zugleich der Schluessel dieser Map) und daneben das
   * Aktenzeichen des Fachsystems (`AKZ`, `KNF065624`).
   *
   * Zwei Schreibweisen derselben Sache, deshalb EIN Feld: wer eine Nummer
   * eintippt, fragt „welcher Antrag ist das", nicht „steht das in FKZ oder AKZ".
   * Am Bestand gemessen (12 358 Saetze mit AKZ) ist der ZIFFERNTEIL in 12 321
   * Faellen identisch — wer die Ziffern tippt, fand den Antrag also schon
   * vorher; die ganze Zeichenkette `KNF065624` fand in genau 38 Faellen etwas.
   * Der Buchstabenteil traegt zudem die Foerderart (`16KN` → KNF/INF/NWF/KNM/…)
   * und ist damit nicht aus dem FKZ ableitbar.
   *
   * Ohne Roh-Variante: gesucht wird hier, angezeigt wird die FKZ-Spalte.
   * Vorberechnet, weil `substringMatches` sonst pro Eintrag und Wort ein
   * `toLowerCase()` allozieren muesste — genau der GC-Druck, den die
   * vorberechneten Felder vermeiden.
   */
  akzLower: string;
  /**
   * Kennzeichen des VERBUNDS (`VB_NUMMER`, z. B. `ZKN073232`) — die Klammer um
   * die Teilvorhaben.
   *
   * Am Bestand gemessen: alle 14 225 Antraege tragen es, 7 535 verschiedene
   * Verbuende, davon 3 451 mit mehr als einem Teilvorhaben (bis zu 9). Es steht
   * in KEINEM anderen durchsuchten Feld — nicht im FKZ, nicht im Netzwerkfeld,
   * nicht im Titel (je 0 von 14 225). Ohne dieses Feld gab es keinen Weg, die
   * Geschwister eines Teilvorhabens ueber die Nummer beisammen zu sehen.
   */
  verbundNr: string;
  verbundNrLower: string;
  /** Antragsteller + ausfuehrende Stelle, zu EINEM Suchfeld zusammengezogen.
   *
   *  Zwei Spalten, weil sie zwei verschiedene Organisationen benennen koennen:
   *  `ORG_AST` ist die Rechtsperson („Fraunhofer-Gesellschaft zur Foerderung
   *  der angewandten Forschung e.V."), `ORG_AFS` die ausfuehrende Stelle
   *  („Fraunhofer-Institut fuer Nachrichtentechnik, Heinrich-Hertz-Institut").
   *  Am Bestand gemessen weichen sie in 293 von 11 882 Saetzen (2,5 %)
   *  voneinander ab — wer nach „Universitaet Leipzig" sucht, faende den Satz
   *  ueber `ORG_AFS` („Universitaetsklinikum Leipzig AoeR") nicht.
   *
   *  Zusammengezogen statt zwei Felder, weil sie in 97,5 % der Saetze identisch
   *  sind; bei Gleichheit wird nur einmal gespeichert. Die Wort-fuer-Wort-Suche
   *  kann an der Fuge keinen falschen Treffer erzeugen: ein Substring ueber die
   *  Trennstelle enthaelt immer das Leerzeichen, ein Suchwort nie. */
  organisation: string;
  organisationLower: string;
  /** Der ORT, Rechtsperson und ausfuehrende Stelle zusammengezogen — „welche
   *  Vorhaben wurden in Dresden gefoerdert".
   *
   *  Ohne das Bundesland: bis v4.80 lagen beide hier, und weil die 16
   *  Laendernamen jede Haeufigkeitsliste anfuehren, bestand die
   *  Vorschlagsliste unter `ort:` fast nur aus Bundeslaendern. Sie haben seit
   *  v4.81 ihr eigenes Feld (`bundesland`).
   *
   *  Seit v4.23 zugleich die ANZEIGEFORM dieses Belegs (`' · '`-getrennt): die
   *  Fundstelle „Ort" ist die einzige, die sonst nirgends im Ergebnis steht, und
   *  ein Etikett ohne Wert beantwortet die Frage „warum erscheint dieser
   *  Treffer?" nicht. */
  standort: string;
  /** Suchform des Standorts — ANDERS gebaut als die uebrigen `*Lower`-Felder:
   *  klein, Trennzeichen zu Leerraum, von Leerzeichen eingerahmt. Verglichen
   *  wird gegen `standortNadel(wort)`, ein Treffer muss also am WORTANFANG
   *  beginnen.
   *
   *  Grund, am Bestand gemessen: als freier Substring holte „essen" 439
   *  zusaetzliche Antraege herein — fast alle aus H·essen, nicht aus Essen (23).
   *  Ortsangaben sind kurz und stecken ineinander; freies Substring-Matching
   *  taugt hier nicht, waehrend es in Fliesstext genau richtig ist („laser"
   *  soll „Laserquelle" finden). Nebenwirkung, erwuenscht: „sachsen" trifft
   *  Sachsen und Sachsen-Anhalt, aber nicht mehr Niedersachsen.
   *
   *  Was bleibt, ist Praefix-Verhalten am Wortanfang: „regen" findet auch
   *  Regensburg. Das ist die normale Erwartung an ein Suchfeld, das mit jedem
   *  Tastendruck sucht — „dresd" soll Dresden schon finden. */
  standortSuchform: string;
  /** Bundesland im KLARTEXT (`SN` → „Sachsen"), beide Seiten zusammengezogen.
   *  Anzeigeform wie der Standort, aus demselben Grund. */
  bundesland: string;
  /** Suchform des Bundeslands — am Wortanfang verankert wie `standortSuchform`,
   *  und zusaetzlich mit dem ROHEN Kuerzel bestueckt: `bl:SN` soll weiter
   *  finden, obwohl die Vorschlagsliste nur noch Namen anbietet. Das Kuerzel
   *  steht deshalb in der Suchform, nicht im angezeigten Wert.
   *
   *  Nur noch der RUECKFALL fuer Unaufloesbares (Tippen im Wortlauf, fremde
   *  Werte) — was sich auf eines der 16 Laender aufloesen laesst, wird ueber
   *  `bundeslandCodes` GENAU verglichen. */
  bundeslandSuchform: string;
  /** Die aufgeloesten Laender-Kuerzel, jedes einzeln von Leerzeichen gerahmt
   *  (`" sn "`, bei zwei verschiedenen Seiten `" sn st "`).
   *
   *  Warum ueberhaupt eine zweite Form: das Bundesland ist ein GESCHLOSSENES
   *  Vokabular aus 16 Werten, und in dem stecken zwei ineinander — die Nadel
   *  `" sachsen"` findet in `" sachsen anhalt st "` genauso ihren Wortanfang wie
   *  in `" sachsen sn "`. Am Bestand gemessen (Stand 2026-08) lieferte
   *  `bl:Sachsen` deshalb 3 278 statt 2 742 Treffer: 536 Antraege aus
   *  Sachsen-Anhalt, ohne dass die Zeile das verraten haette. Ein Vokabular mit
   *  abzaehlbaren Werten wird verglichen, nicht durchsucht. */
  bundeslandCodes: string;
  /** Web-Adresse der Einrichtung, aus der Kontakt-Mail der Projektleitung
   *  abgeleitet (`bergmann@gmbu.de` → `gmbu.de`). ANZEIGEFORM, wie beim
   *  Standort — eine Fundstelle, die sonst nirgends in der Zeile stuende,
   *  muss sich ausschreiben.
   *
   *  Der Grund, am Bestand gemessen: viele Einrichtungen fuehren ihr Kuerzel im
   *  Namen („… e.V. (IUTA)", 244 Faelle) und sind darueber auffindbar. Andere
   *  nicht — die „Gesellschaft zur Foerderung von Medizin-, Bio- und
   *  Umwelt-Technologien e.V." heisst im ganzen Bestand nirgends „GMBU", obwohl
   *  jeder sie so nennt. Ihre Mail-Domain schliesst genau diese Luecke. */
  domain: string;
  /** Suchform der Web-Adresse — wie `standortSuchform` am Wortanfang verankert
   *  und OHNE die Top-Level-Domain: sonst traefe die Anfrage „de" jeden Antrag. */
  domainSuchform: string;
  /**
   * Netzwerkangabe eines ZIM-Netzwerkvorhabens, roh wie im Export:
   * `"LOHCmobil" 16KN065602_AM` — Name UND Kennzeichen des Netzwerks.
   *
   * Am Bestand gemessen (14 225 FKZ): 11 492 Antraege tragen die Angabe. In
   * 10 925 davon steht der Name ohnehin schon im Titel — der Zugewinn sind die
   * restlichen 556 UND das Netz-Kennzeichen, das in keinem anderen Feld steht:
   * darueber findet man erstmals alle Teilvorhaben EINES Netzwerks auf einmal.
   *
   * Freier Substring wie beim Titel, NICHT am Wortanfang verankert: „LOHC" soll
   * `"LOHCmobil"` finden.
   */
  netzwerk: string;
  netzwerkLower: string;
  /**
   * Die Arbeitsnotizen am Vorgang: `T_YW` („Wichtig", 3 343 Antraege) und
   * `T_HINT` („Bemerkung", 3 161), zusammengezogen wie Antragsteller und
   * ausfuehrende Stelle.
   *
   * Diese Saetze stehen in KEINEM anderen Feld — bis v4.50 fuehrte der einzige
   * Weg dorthin ueber das Oeffnen des Antrags. Bis zu 250 Zeichen je Notiz.
   */
  notiz: string;
  notizLower: string;
  /**
   * Wahlkreis der ausfuehrenden Stelle (`WKNAAK_AFS`, z. B. „Goslar - Northeim
   * - Goettingen II"). 14 218 Antraege; in 5 274 Faellen nennt er einen Ort, der
   * im Standort-Feld nicht vorkommt — genau dort liegt der Zugewinn.
   */
  wahlkreis: string;
  /** Suchform des Wahlkreises — am Wortanfang verankert wie der Standort, aus
   *  demselben Grund: es sind Ortsnamen, und die stecken ineinander. */
  wahlkreisSuchform: string;
}

/**
 * Feld-Name-Kandidaten je Spalte — der FALLBACK, wenn kein Schema die Spalte
 * fuehrt.
 *
 * Der CSV-Merger ([helpers.ts](src/core/services/csv/merger/helpers.ts))
 * speichert ein Feld unter `entry.canonical ?? entry.custom ?? col.toLowerCase()`.
 * C16 exportiert mit Leerzeichen im Spaltennamen (`VB INHALT`, `VB TITEL`) →
 * ohne Wizard-Mapping landet das als `'vb inhalt'` / `'vb titel'` (mit Space,
 * nicht Underscore). Wir gleichen deshalb gegen die NORMALISIERTE Form
 * (lowercase + alle Trenner raus) ab — gleicher Algorithmus wie
 * `findFieldValue` in `fieldLookup.ts`.
 *
 * Diese Liste zu RATEN war der Defekt: welcher Schluessel es wirklich wird,
 * entscheidet das Wizard-Mapping, nicht der Code. Am Bestand lag `VB_INHALT`
 * unter `inhalt_kurzzusammenfassung` und fehlte damit vollstaendig im Korpus.
 * Die verbindliche Aufloesung macht jetzt
 * [korpusFeldAufloesung.ts](src/plugins/antraege/services/korpusFeldAufloesung.ts)
 * ueber den Spalten-CODE; was hier steht, greift zusaetzlich.
 *
 * Vorberechnete Sets — der Cursor-Walk macht 14 k × 10 Lookups, Re-Hashing der
 * Kandidaten pro Eintrag waere Verschwendung.
 */
const KORPUS_BASIS: KorpusFeldKarte = {
  vbTitel: mengeAus('verbund_titel', 'vb_titel', 'vb titel'),
  abstract: mengeAus(
    'projektbeschreibung_text',
    'vb_inhalt', 'vb inhalt',
    'vorhaben_inhalt', 'vorhabeninhalt',
    'inhalt_kurzzusammenfassung', 'kurzzusammenfassung',
    'kurzbeschreibung', 'beschreibung', 'inhalt',
  ),
  akronym: mengeAus('akronym', 'vb_kurznam', 'vb kurznam'),
  /** Ausfuehrende Stelle. `org_afs` traegt im Repo den Canonical-Namen
   *  `antragsteller` ([constants.ts](src/core/services/csv/constants.ts)) — beide
   *  Schreibweisen stehen hier, weil die Spalte je nach Wizard-Mapping unter dem
   *  einen ODER dem anderen Schluessel im Store liegt. */
  orgAfs: mengeAus('antragsteller', 'org_afs', 'org afs'),
  /** Rechtsperson. Hat KEIN Canonical-Feld — landet als Custom-Spalte, und zwar
   *  am Bestand unter drei verschiedenen Namen je Quelle. */
  orgAst: mengeAus('org_ast', 'org ast', 'antragsteller_ast'),
  /** Sitz der Rechtsperson bzw. der ausfuehrenden Stelle. Beide Spalten, weil sie
   *  am Bestand gemessen in 1 052 von 14 224 Saetzen (7,4 %) auseinandergehen —
   *  Firmensitz Hamburg, gearbeitet wird in Wedel. */
  ortAst: mengeAus('ort_ast', 'ort ast'),
  ortAfs: mengeAus('ort_afs', 'ort afs'),
  /** Bundesland — im Export NUR als Kuerzel (`SN`, `BW`). Gemessene Abweichung
   *  zwischen den beiden Spalten: 621 Saetze. `buland_ast` und `bl_ast` sind
   *  dieselbe Angabe unter zwei Spaltennamen (je nach Quelldatei). */
  landAst: mengeAus('buland_ast', 'buland ast', 'bl_ast', 'bl ast'),
  landAfs: mengeAus('buland_afs', 'buland afs', 'bl_afs', 'bl afs'),
  /** Kontakt-Mail der Projektleitung des ANTRAGSTELLERS. Quelle des
   *  Domain-Kuerzels, siehe `domainLabel`. */
  emailPl: mengeAus('email_pl', 'email pl'),
  /** Netzwerkangabe. Am Bestand unter ZWEI Schluesseln je nach Quelle:
   *  `netzwerk` (7737/9097) und `netzwerk_kurzname_fkz_ztp` (9052). */
  netzwerk: mengeAus('netzwerk', 'netzwerkna', 'netzwerk_kurzname_fkz_ztp'),
  /** Arbeitsnotizen. `T_YW` liegt unter `wichtig`, `T_HINT` unter `bemerkung`. */
  notizWichtig: mengeAus('wichtig', 't_yw', 't yw'),
  notizBemerkung: mengeAus('bemerkung', 't_hint', 't hint'),
  /** Wahlkreis der ausfuehrenden Stelle. */
  wahlkreis: mengeAus('wahlkreisname_afs', 'wknaak_afs', 'wknaak afs'),
  /** Klartext der NACE-Branche. Faellt NICHT in ein eigenes Feld, sondern zu den
   *  Deskriptoren — dort steht die Branche schon (BRANCHE_/TECHN_/ANWEND_), nur
   *  eben grob. 2 256 Antraege fuehren ihn, 1 512 davon mit Woertern, die in den
   *  Deskriptoren fehlen. */
  nace: mengeAus('nace_code_beschreibung_nw_antragsebene', 'nace_lang', 'nace lang'),
  /** Verbundkennzeichen. `VB_NUMMER` ist im Repo das kanonische `verbund_id`
   *  ([constants.ts](src/core/services/csv/constants.ts)). */
  verbundNr: mengeAus('verbund_id', 'vb_nummer', 'vb nummer'),
  /** Aktenzeichen des Fachsystems. Kein kanonisches Feld — landet als Custom-
   *  Spalte `akz`. */
  akzC16: mengeAus('akz'),
};

function mengeAus(...namen: string[]): ReadonlySet<string> {
  return new Set(namen.map(normalizeKey));
}

/**
 * Bundesland-Kuerzel → Klartext. Das Kuerzel allein taugt nicht als Suchwort:
 * die Suche fragt `feld.includes(wort)`, ein zwei Zeichen langes Feld kann also
 * nur von einer ein- bis zweibuchstabigen Anfrage getroffen werden — niemand
 * sucht „SN", wenn er Sachsen meint.
 *
 * Alle 16 Laender sind im Bestand belegt (Stand 2026-08, 14 224 Saetze mit
 * Angabe); `bundeslandName` faellt fuer Unbekanntes auf das Kuerzel zurueck,
 * damit nie eine Angabe verschwindet.
 */
const BUNDESLAND_NAMEN: Readonly<Record<string, string>> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

/**
 * Klartext-Name zu einem Bundesland-Kuerzel. Unbekanntes Kuerzel → das Kuerzel
 * selbst (nie leer, nie geraten). Pure — testbar ohne IDB.
 */
export function bundeslandName(kuerzel: string): string {
  const k = kuerzel.trim().toUpperCase();
  if (k.length === 0) return '';
  return BUNDESLAND_NAMEN[k] ?? kuerzel.trim();
}

/** Klartext (kleingeschrieben, NFC) → Kuerzel. Die Umkehrung von
 *  `BUNDESLAND_NAMEN`, einmal gebaut statt bei jedem Aufruf gesucht. */
const BUNDESLAND_CODES: ReadonlyMap<string, string> = new Map(
  Object.entries(BUNDESLAND_NAMEN).map(([code, name]) => [name.toLowerCase().normalize('NFC'), code]),
);

/**
 * Ein Bundesland-Kuerzel zu dem, was jemand geschrieben hat — egal ob er das
 * Kuerzel oder den Namen tippt: `SN`, `sn`, `Sachsen`, `sachsen` → `'SN'`.
 *
 * **Leer, wenn es keines der 16 Laender ist** — und genau daran haengt die
 * Rueckfall-Entscheidung: `bl:sach` (halb getippt) und fremde Werte loesen nicht
 * auf und werden weiter am Wortanfang gesucht, damit die Suche waehrend des
 * Tippens etwas zeigt. Nie geraten, nie ein Teiltreffer.
 *
 * Umlaute ueber NFC (Pitfall #22): „Baden-Württemberg" kommt aus zwei Quellen
 * mit zwei Zerlegungen.
 *
 * Pure — testbar ohne IDB.
 */
export function bundeslandCode(wert: string): string {
  const w = wert.trim().normalize('NFC');
  if (w.length === 0) return '';
  const gross = w.toUpperCase();
  if (BUNDESLAND_NAMEN[gross] !== undefined) return gross;
  return BUNDESLAND_CODES.get(w.toLowerCase()) ?? '';
}

/** Gerahmte Form eines Kuerzels fuer den genauen Vergleich: `'SN'` → `' sn '`.
 *  Beide Seiten gerahmt, damit `' sn '` in `' sn st '` steckt, aber kein
 *  laengeres Kuerzel anschneidet. */
export function bundeslandCodeNadel(code: string): string {
  return code.length > 0 ? ` ${code.toLowerCase()} ` : '';
}

/**
 * Anzeige-, Vergleichs- und Suchform des Bundeslands aus den beiden
 * Kuerzel-Spalten.
 *
 * Drei Formen, weil sie Verschiedenes leisten:
 * - `bundesland` wird ANGEZEIGT und vorgeschlagen: nur der Klartext — eine
 *   Vorschlagsliste, in der „Sachsen" und „SN" als zwei Werte nebeneinander
 *   stehen, teilt dasselbe Land in zwei Zeilen.
 * - `bundeslandCodes` wird VERGLICHEN: das aufgeloeste Kuerzel, gerahmt. Ueber
 *   diese Form sind `bl:Sachsen` und `bl:SN` dieselbe Frage — niemand muss
 *   wissen, in welcher Schreibweise der Export sein Land ablegt.
 * - `bundeslandSuchform` ist der RUECKFALL fuer alles, was sich nicht aufloesen
 *   laesst (halb getippte Woerter, fremde Werte).
 *
 * Pure — testbar ohne IDB.
 */
export function bundeslandFelder(landAfs: string, landAst: string): {
  bundesland: string;
  bundeslandSuchform: string;
  bundeslandCodes: string;
} {
  const bundesland = verbindeMit(' · ', bundeslandName(landAfs), bundeslandName(landAst));
  const codes = [...new Set([bundeslandCode(landAfs), bundeslandCode(landAst)])].filter(c => c.length > 0);
  return {
    bundesland,
    bundeslandSuchform: standortSuchform(verbindeEindeutig(bundesland, landAfs, landAst)),
    bundeslandCodes: codes.length > 0 ? ` ${codes.map(c => c.toLowerCase()).join(' ')} ` : '',
  };
}

/** Alles ausser Buchstaben und Ziffern trennt Woerter — „Sachsen-Anhalt" und
 *  „Ellwangen (Jagst)" zerfallen damit in zwei suchbare Woerter. */
const STANDORT_TRENNER = /[^\p{L}\p{N}]+/gu;

/**
 * Speicherform einer Ortsangabe: klein, Trennzeichen zu Leerraum, VORN UND
 * HINTEN von einem Leerzeichen eingerahmt. Der Rahmen macht aus einem
 * `includes` einen Vergleich am Wortanfang. Leere Angabe → leeres Feld (nicht
 * `' '`, sonst traefe jede Nadel jeden Eintrag). Pure.
 */
export function standortSuchform(text: string): string {
  const kern = text.toLowerCase().replace(STANDORT_TRENNER, ' ').trim();
  return kern.length === 0 ? '' : ` ${kern} `;
}

/**
 * Anfrageform eines Suchworts: dieselbe Normalisierung, aber nur VORN
 * eingerahmt — sonst faende „dresd" das fertige „Dresden" nicht mehr, und die
 * Suche bei jedem Tastendruck waere kaputt. Leeres Wort → leere Nadel, die der
 * Aufrufer verwerfen muss (`''.includes('')` ist `true`). Pure.
 */
export function standortNadel(wort: string): string {
  const kern = wort.toLowerCase().replace(STANDORT_TRENNER, ' ').trim();
  return kern.length === 0 ? '' : ` ${kern}`;
}

/**
 * Domains, die NICHTS ueber die Einrichtung sagen und deshalb draussen bleiben.
 *
 * Der erste Block ist der wichtige: die Quelldatei fuehrt in `TIB_MAIL`,
 * `BIB_MAIL`, `ZTP_MAIL` und `PFM_MAIL` die Adressen des PROJEKTTRAEGERS. Am
 * Bestand gemessen steht `vdivde-it.de` 26 933 mal in der Datei, `filina-it.de`
 * 3 367 mal, `eura-ag.de` 788 mal — bei rund 8 000 Saetzen also mehrfach pro
 * Zeile. Als Suchwort waeren sie ein Treffer auf alles.
 *
 * Die Spalten-Aufloesung (`emailPl`) schliesst diese Spalten bereits
 * strukturell aus; die Liste ist das zweite Netz, falls jemand `EMAIL_PL`
 * einmal anders mappt.
 *
 * Der zweite Block sind Freemailer: wer von `t-online.de` schreibt (100 Faelle),
 * verraet damit seine Einrichtung nicht.
 */
const GESPERRTE_DOMAINS: ReadonlySet<string> = new Set([
  'vdivde-it.de', 'filina-it.de', 'eura-ag.de', 'euronorm.de',
  't-online.de', 'gmx.de', 'gmx.net', 'web.de', 'gmail.com', 'googlemail.com',
  'aol.com', 'freenet.de', 'yahoo.de', 'yahoo.com', 'hotmail.de', 'hotmail.com',
  'outlook.de', 'outlook.com', 'posteo.de', 'mail.de',
]);

/** Erste Mail-Adresse in einem Feld. `EMAIL_PL` fuehrt gelegentlich mehrere,
 *  durch Semikolon oder Komma getrennt. */
const MAIL_MUSTER = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/;

/**
 * Web-Adresse der Einrichtung aus einer Kontakt-Mail — NUR der Host, nie die
 * Adresse.
 *
 * Der lokale Teil („bergmann") ist eine Personenangabe und hat in einem
 * Suchfeld nichts zu suchen; der Host benennt die Organisation. Gesperrte und
 * unbrauchbare Hosts liefern den leeren String, den der Aufrufer wie ein
 * fehlendes Feld behandelt. Pure — testbar ohne IDB.
 */
export function domainLabel(feldwert: string): string {
  const treffer = MAIL_MUSTER.exec(feldwert ?? '');
  const roh = treffer?.[1];
  if (!roh) return '';
  const host = roh.toLowerCase().replace(/\.+$/, '');
  if (host.length === 0 || GESPERRTE_DOMAINS.has(host)) return '';
  return host;
}

/**
 * Suchform der Web-Adresse: wie beim Standort am Wortanfang verankert, aber
 * OHNE die Top-Level-Domain.
 *
 * Ohne diesen Schnitt traefe die zweibuchstabige Anfrage „de" jeden Antrag mit
 * Mail-Adresse — dieselbe Falle, die beim Bundesland-Kuerzel schon zugeschlagen
 * hat. Die uebrigen Segmente bleiben alle erhalten: `mb.tu-chemnitz.de` wird zu
 * ` mb tu chemnitz `, damit „chemnitz" den Treffer auch findet. Pure.
 */
export function domainSuchform(host: string): string {
  const punkt = host.lastIndexOf('.');
  const ohneTld = punkt > 0 ? host.slice(0, punkt) : host;
  return standortSuchform(ohneTld);
}

/**
 * Umkehr-Verzeichnis Schluessel → Slot, EINMAL je Ladelauf gebaut.
 *
 * Vorher fragte der Korpus je Eintrag jeden Slot einzeln (`pickByNormalized`) —
 * also je Antrag `Slots × Spalten` Vergleiche, jeder mit einem eigenen
 * `normalizeKey`. Bei 14 225 Antraegen à ~200 Spalten war das mit 10 Slots schon
 * teuer und waere mit 15 um die Haelfte teurer geworden. Ein Durchgang ueber die
 * Schluessel des Records liefert dasselbe Ergebnis: `normalizeKey` faellt einmal
 * je Spalte an, nicht einmal je Spalte UND Slot.
 *
 * Gleiche Semantik wie vorher: je Slot gewinnt der ERSTE passende Schluessel in
 * der Schluessel-Reihenfolge des Records. Dass kein Schluessel zwei Slots
 * bedient, sichert `baueKorpusFeldKarte` (Kollisions-Regel) — der Guard hier ist
 * nur die Reihenfolge von `SLOT_REIHENFOLGE`.
 */
function baueSlotIndex(karte: KorpusFeldKarte): Map<string, KorpusSlot> {
  const index = new Map<string, KorpusSlot>();
  for (const slot of SLOT_REIHENFOLGE) {
    for (const key of karte[slot]) if (!index.has(key)) index.set(key, slot);
  }
  return index;
}

/** Alle Slot-Werte eines Records in EINEM Durchgang. Fehlende Slots fehlen. */
function leseSlots(
  record: Record<string, unknown>,
  index: ReadonlyMap<string, KorpusSlot>,
): Partial<Record<KorpusSlot, string>> {
  const out: Partial<Record<KorpusSlot, string>> = {};
  for (const key of Object.keys(record)) {
    if (key.startsWith('_')) continue;
    const v = record[key];
    if (typeof v !== 'string' || v.length === 0) continue;
    const slot = index.get(normalizeKey(key));
    if (slot === undefined || out[slot] !== undefined) continue;
    out[slot] = v;
  }
  return out;
}


/**
 * Zieht mehrere Angaben derselben Art zu EINEM Suchfeld zusammen und laesst
 * Wiederholungen weg — Antragsteller/ausfuehrende Stelle sind in 97,5 % der
 * Saetze identisch, Ort und Bundesland in ueber 90 %. Reihenfolge bleibt
 * erhalten, Leeres faellt raus. Pure — testbar ohne IDB.
 *
 * Die Wort-fuer-Wort-Suche kann an den Fugen keinen falschen Treffer erzeugen:
 * ein Substring ueber eine Trennstelle enthaelt immer das Leerzeichen, ein
 * Suchwort nie (`zerlegeAnfrage` trennt an Leerraum).
 */
export function verbindeEindeutig(...werte: string[]): string {
  return verbindeMit(' ', ...werte);
}

/**
 * Dasselbe mit frei gewaehltem Trenner.
 *
 * Der Standort braucht ihn: sein Feld wird seit v4.23 nicht mehr nur GESUCHT,
 * sondern auch ANGEZEIGT (Trefferliste, Spalte „Ort & Bundesland") — und
 * „Dresden Sachsen" liest sich dort wie ein Tippfehler, „Dresden · Sachsen"
 * nicht.
 *
 * Am Suchverhalten aendert der Trenner nichts: `standortSuchform` ersetzt jede
 * Nicht-Buchstaben-Folge (`STANDORT_TRENNER`) durch Leerraum, die Suchform ist
 * mit Punkt wie ohne `' dresden sachsen '`. Der zugehoerige Test steht in
 * `korpusFelder.test.ts` und ist der Grund, warum das hier gefahrlos ist.
 */
export function verbindeMit(trenner: string, ...werte: string[]): string {
  const gesehen: string[] = [];
  for (const w of werte) {
    const t = w.trim();
    if (t.length > 0 && !gesehen.includes(t)) gesehen.push(t);
  }
  return gesehen.join(trenner);
}

export interface LoadCorpusOptions {
  /** Cancel-Signal fuer lange Laufzeiten (Programm-Switch). */
  signal?: AbortSignal;
  /**
   * Zaehlwerk fuer die Vervollstaendigung. Wird MITGEFUELLT, wenn es dasteht —
   * dieser Cursor-Walk liest die atomaren Feldwerte ohnehin, ein zweiter Lauf
   * ueber 14 000 Antraege waere reine Wiederholung. Wer den Index nicht braucht
   * (der XLSX-Export), laesst das Feld weg und zahlt nichts.
   *
   * Die zusammengezogenen Korpus-Felder taugen dafuer NICHT: `organisation`
   * verbindet Antragsteller und ausfuehrende Stelle mit einem Leerzeichen und
   * ist danach nicht mehr in zwei Namen zu zerlegen.
   */
  werteIndex?: WertIndexRoh;
  /** Wenn `true`, kommen auch Antraege ohne jeglichen Text in die Map
   *  (mit leeren Strings). Default `false` — die Hybrid-Suche braucht keine
   *  Eintraege ohne Text, der XLSX-Export aber schon (sonst Lücken in der
   *  FKZ-Spalte). */
  includeEmpty?: boolean;
}

/**
 * Laedt den vollen Antrag-Store fuer das aktive Programm und projiziert auf
 * die suchrelevanten Strings. Default: nur Antraege mit mindestens einem
 * nicht-leeren Feld kommen in die Map. Mit `includeEmpty: true` werden auch
 * leere Eintraege geliefert (fuer den Export, wo jede gelistete Akz eine
 * Zeile braucht).
 *
 * Statt `index.getAll` (liefert ~500 MB Structured-Clone in einem Stoss und
 * blockiert den Main-Thread mehrere Sekunden) iterieren wir den Index mit
 * einem Cursor. Chrome liefert die Records inkrementell, der Peak-Speicher
 * bleibt bei ~36 KB pro Schritt, und es gibt keine langen Sync-Blocker mehr
 * — der Browser kann zwischen Cursor-Steps Frames rendern.
 */
export async function loadAntraegeTextCorpus(
  idb: IDBStore,
  programmId: string,
  opts: LoadCorpusOptions = {},
): Promise<Map<string, AntragTextEntry>> {
  const { signal, includeEmpty = false, werteIndex } = opts;
  // VOR der Transaktion: ein `await` zwischen zwei Cursor-Schritten wuerde die
  // IDB-Transaktion beenden. Die Karte gilt ohnehin fuer den ganzen Lauf.
  const karte = baueKorpusFeldKarte(
    await listSchemasByProgramm(idb, programmId),
    KORPUS_BASIS,
  );
  const slotIndex = baueSlotIndex(karte);
  const db = idb.getDb();
  const result = new Map<string, AntragTextEntry>();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CSV_STORES.ANTRAEGE, 'readonly');
    const idx = tx.objectStore(CSV_STORES.ANTRAEGE).index('programm_id');
    const req = idx.openCursor(IDBKeyRange.only(programmId));
    req.onsuccess = () => {
      if (signal?.aborted) { resolve(); return; }
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      const a = cursor.value as Antrag;
      const rec = a as unknown as Record<string, unknown>;
      const feld = leseSlots(rec, slotIndex);
      const vb = feld.vbTitel ?? '';
      const tv = typeof a.titel === 'string' ? a.titel : '';
      const ab = feld.abstract ?? '';
      // Der NACE-Klartext haengt sich an die Deskriptoren an, statt ein eigenes
      // Feld zu bekommen: er beantwortet dieselbe Frage („aus welcher Branche"),
      // nur mit anderen Worten. Ein eigenes Etikett in der Trefferzeile waere
      // eine Unterscheidung, die dem Suchenden nichts sagt.
      const descriptors = verbindeMit(' • ', buildDescriptorsText(a), feld.nace ?? '');
      const ak = feld.akronym ?? '';
      const organisation = verbindeEindeutig(feld.orgAfs ?? '', feld.orgAst ?? '');
      // Mit sichtbarem Trenner: dieses Feld wird auch ANGEZEIGT (siehe
      // `verbindeMit`). Die Suchform darunter bleibt davon unberuehrt.
      const standort = verbindeMit(' · ', feld.ortAfs ?? '', feld.ortAst ?? '');
      const { bundesland, bundeslandSuchform, bundeslandCodes } = bundeslandFelder(
        feld.landAfs ?? '', feld.landAst ?? '',
      );
      const domain = domainLabel(feld.emailPl ?? '');
      const netzwerk = feld.netzwerk ?? '';
      // Zwei Notizfelder, eine Fundstelle — mit sichtbarem Trenner, weil dieser
      // Text in der Trefferzeile ausgeschrieben wird.
      const notiz = verbindeMit(' · ', feld.notizWichtig ?? '', feld.notizBemerkung ?? '');
      const wahlkreis = feld.wahlkreis ?? '';
      const verbundNr = feld.verbundNr ?? '';
      if (werteIndex) {
        nimmWerte(werteIndex, 'standort', [feld.ortAfs, feld.ortAst]);
        // Nur der Klartext — das Kuerzel lebt in der Suchform, nicht in der
        // Vorschlagsliste (siehe `bundeslandFelder`).
        nimmWerte(werteIndex, 'bundesland', [
          bundeslandName(feld.landAfs ?? ''), bundeslandName(feld.landAst ?? ''),
        ]);
        nimmWerte(werteIndex, 'organisation', [feld.orgAfs, feld.orgAst]);
        nimmWerte(werteIndex, 'wahlkreis', [wahlkreis]);
        if (netzwerk.length > 0) nimmWerte(werteIndex, 'netzwerk', [netzwerkName(netzwerk)]);
        nimmWerte(werteIndex, 'deskriptoren', deskriptorenAnzeige(a));
      }
      // Beide Schreibweisen desselben Antrags in EINEM Feld — siehe `akzLower`.
      const kennzeichen = verbindeEindeutig(a.aktenzeichen, feld.akzC16 ?? '');
      if (
        includeEmpty
        || vb.length > 0 || tv.length > 0 || ab.length > 0
        || descriptors.length > 0 || ak.length > 0
        || organisation.length > 0 || standort.length > 0 || bundesland.length > 0
        || domain.length > 0 || netzwerk.length > 0
        || notiz.length > 0 || wahlkreis.length > 0
        || verbundNr.length > 0
      ) {
        result.set(a.aktenzeichen, {
          vb,
          tv,
          abstract: ab,
          descriptors,
          akronym: ak,
          vbLower: vb.toLowerCase(),
          tvLower: tv.toLowerCase(),
          absLower: ab.toLowerCase(),
          descriptorsLower: descriptors.toLowerCase(),
          akronymLower: ak.toLowerCase(),
          akzLower: kennzeichen.toLowerCase(),
          verbundNr,
          verbundNrLower: verbundNr.toLowerCase(),
          organisation,
          organisationLower: organisation.toLowerCase(),
          standort,
          standortSuchform: standortSuchform(standort),
          bundesland,
          bundeslandSuchform,
          bundeslandCodes,
          domain,
          domainSuchform: domainSuchform(domain),
          netzwerk,
          netzwerkLower: netzwerk.toLowerCase(),
          notiz,
          notizLower: notiz.toLowerCase(),
          wahlkreis,
          wahlkreisSuchform: standortSuchform(wahlkreis),
        });
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
  return result;
}

/**
 * Filename → Aktenzeichen fuer alle relevanten Phase-2-Manifest-Eintraege.
 * Wird einmal pro Plugin-Mount geladen; Konsumenten (DMS-Index-Suche) lookup'en
 * pro Orama-Hit ihren `source`-Filename, um auf den zugehoerigen Antrag zu
 * mappen.
 *
 * Filter: nur Eintraege mit `triage_state === 'relevant'` und gesetztem
 * `matched_antrag_id`. Irrelevante Dokumente oder Orphans bleiben aussen vor.
 *
 * Liefert leere Map wenn der Manifest-Store leer ist (keine Phase-2-Daten).
 */
export async function loadDmsFilenameToAkz(idb: IDBStore): Promise<Map<string, string>> {
  const entries = await listManifestEntries(idb);
  const result = new Map<string, string>();
  for (const e of entries) {
    if (e.triage_state !== 'relevant') continue;
    if (typeof e.matched_antrag_id !== 'string' || e.matched_antrag_id.length === 0) continue;
    result.set(e.filename, e.matched_antrag_id);
  }
  return result;
}

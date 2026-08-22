/**
 * Welche Stichwörter der Bestand führt — die häufigsten Wörter aus den Titeln
 * (Verbund und Teilvorhaben) und der Kurzbeschreibung.
 *
 * Das Geschwister von [wert-index.ts](./wert-index.ts), für die Felder, die
 * dort ausdrücklich NICHT hineinpassen: Titel und Beschreibung tragen
 * Fließtext, und „eine Vorschlagsliste daraus wäre eine Wortwolke, keine
 * Hilfe". Der Einwand steht — die Rohmessung gibt ihm recht. Am echten Bestand
 * (14 225 Anträge) lauten die zehn häufigsten Wörter: Entwicklung 8 124,
 * werden 7 755, eine 5 685, Ziel 5 558, soll 5 520, eines 5 248, einer 4 688,
 * sowie 4 387, durch 3 759, entwickelt 3 635. Eine Liste, die niemandem etwas
 * über den Bestand sagt.
 *
 * Deshalb hängt hier alles an DREI Filtern, in dieser Reihenfolge gemessen:
 *
 *  1. **Nur groß geschriebene Wörter.** Im Deutschen ist die Großschreibung
 *     der Nomen-Marker, den ein Wortzähler umsonst bekommt: sie wirft in einem
 *     Schritt raus, was drei Listen nicht schaffen — genutzt, geplanten,
 *     realisiert, untersucht, integriert, stark, zielt, automatisierten. Am
 *     Satzanfang stehen auch Füllwörter groß; die fängt Filter 2.
 *  2. **Stoppwörter** — die geschlossene Klasse der Funktionswörter, klein
 *     verglichen (fängt „Diese", „Durch", „Dabei" am Satzanfang).
 *  3. **Füllwörter der Förderdomäne** — Entwicklung, Verfahren, Vorhaben,
 *     Ziel, Netzwerk … Wörter, die in JEDEM zweiten Antrag stehen und deshalb
 *     nichts trennen. Verglichen wird die kanonische Form, ein Eintrag deckt
 *     damit alle Beugungen. Bei zusammengesetzten Wörtern mit Bindestrich
 *     zählt zusätzlich das Grundwort hinten (`FuE-Projekt` → `projekt`).
 *
 * Danach lauten die zehn häufigsten: Prozesse 903, Analyse 876, Fertigung 787,
 * Bauteile 715, Daten 646, Komponenten 564, Steuerung 549, Sensoren 536,
 * Anlagen 532, Produktion 510 — gemessen am selben Bestand, 587 ms für den
 * ganzen Lauf.
 *
 * **Gezählt wird in Anträgen, nicht in Vorkommen** (wie `nimmWerte`): ein Wort,
 * das in einer Kurzbeschreibung fünfmal steht, zählt einmal. Nur so ist die
 * Zahl dieselbe Größe wie die Trefferzahl daneben.
 *
 * **Beugungen fallen zusammen** (`kanonischeForm`) — sonst stünden „Bauteile"
 * und „Bauteilen" als zwei Zeilen mit demselben Gegenstand untereinander,
 * dieselbe Unterscheidung ohne Unterschied, die `verdichteWertIndex` bei den
 * Schreibweisen aufgelöst hat. Angezeigt wird die häufigste Form.
 *
 * Rein — kein React, kein IDB. Gefüllt wird im Cursor-Walk des Korpus
 * ([search-corpus.ts](./search-corpus.ts)), damit kein zweiter Lauf über
 * 14 000 Anträge nötig ist.
 */
import { wortStamm } from '@/core/services/search/wortstamm';
import type { WertEintrag } from './wert-index';

/** Kürzer ist kein Stichwort, sondern ein Kürzel oder ein Funktionswort. */
const MIN_LAENGE = 4;

/**
 * Wortgrenzen. Der Bindestrich bleibt IM Wort: „3D-Druck" und „KI-gestützt"
 * sind je ein Wort, keine zwei.
 */
const TRENNER = /[^\p{L}\p{N}-]+/u;

/**
 * Beginnt mit einem Großbuchstaben — siehe Filter 1 im Modulkopf.
 *
 * Der Preis der Regel steht hier: Wörter, die mit einer Ziffer anfangen, fallen
 * mit heraus (`3D-Druck`). Die Alternative wäre, Ziffern zuzulassen — dann
 * stünden aber Förderkennzeichen (`16KN0830`) und Jahreszahlen in der Liste,
 * und das ist der teurere Fehler. `Additive Fertigung / 3D-Druck` steht als
 * Zukunftsthema ohnehin in der Nachbarspalte.
 */
const GROSS = /^\p{Lu}/u;

/**
 * Funktionswörter. Klein verglichen, denn am Satzanfang stehen sie groß.
 *
 * Nur was ≥ 4 Zeichen hat, muss hier stehen — kürzere fallen schon an
 * `MIN_LAENGE`. Die Liste ist an den 200 häufigsten Wörtern des echten
 * Bestands abgeglichen, nicht aus einer Grammatik abgeschrieben.
 */
const STOPPWOERTER: ReadonlySet<string> = new Set([
  'aber', 'alle', 'allem', 'allen', 'aller', 'alles', 'also', 'andere', 'anderem',
  'anderen', 'anderer', 'anderes', 'auch', 'aufgrund', 'außerdem', 'beide', 'beiden',
  'beim', 'bereits', 'besonders', 'bevor', 'bislang', 'bisher', 'bisherige',
  'bisherigen', 'bzw', 'dabei', 'dadurch', 'dafür', 'daher', 'damit', 'danach',
  'dann', 'daran', 'darauf', 'daraus', 'darin', 'darüber', 'darum', 'dass', 'davon',
  'dazu', 'dem', 'demnach', 'denen', 'denn', 'dennoch', 'deren', 'derzeit',
  'derzeitigen', 'deshalb', 'dessen', 'desto', 'deswegen', 'deutlich', 'dies',
  'diese', 'diesem', 'diesen', 'dieser', 'dieses', 'doch', 'dort', 'durch', 'eben',
  'ebenfalls', 'ebenso', 'eine', 'einem', 'einen', 'einer', 'eines', 'einige',
  'einigen', 'einiger', 'einmal', 'entsprechend', 'erst', 'erste', 'ersten',
  'erster', 'etwa', 'etwas', 'fast', 'folgende', 'folgenden', 'für', 'gegen',
  'gegenüber', 'gemäß', 'gerade', 'gibt', 'gleichzeitig', 'haben', 'hier',
  'hierbei', 'hierdurch', 'hierfür', 'hierzu', 'hinaus', 'ihre', 'ihrem', 'ihren',
  'ihrer', 'ihres', 'immer', 'indem', 'infolge', 'innerhalb', 'insbesondere',
  'insgesamt', 'jede', 'jedem', 'jeden', 'jeder', 'jedes', 'jedoch', 'jene',
  'jeweils', 'kann', 'kaum', 'keine', 'keinen', 'keiner', 'können', 'könnte',
  'künftig', 'lassen', 'lässt', 'mehr', 'mehrere', 'mehreren', 'mindestens',
  'mittels', 'muss', 'müssen', 'nach', 'nachdem', 'neben', 'nicht', 'noch', 'oder',
  'ohne', 'sehr', 'sein', 'seine', 'seinem', 'seinen', 'seiner', 'seit', 'sich',
  'sind', 'sogar', 'solche', 'solchen', 'soll', 'sollen', 'sollte', 'somit',
  'sondern', 'sonst', 'sowie', 'sowohl', 'statt', 'stets', 'teilweise', 'über',
  'unser', 'unter', 'viele', 'vielen', 'während', 'waren', 'wegen', 'weil',
  'weiter', 'weitere', 'weiteren', 'weiterer', 'welche', 'welchem', 'welchen',
  'welcher', 'welches', 'wenig', 'weniger', 'wenn', 'werden', 'wird', 'wobei',
  'wodurch', 'worden', 'wurde', 'wurden', 'zudem', 'zunächst', 'zusammen', 'zwar',
  'zwei', 'zwischen',
  // Partizipien, die einen Satz eröffnen und dann groß dastehen. Sie erreichen
  // die Spitze der Liste nicht, aber sie sind kein Stichwort — und der Filter
  // soll sagen, was er tut, nicht nur wo er zufällig genügt.
  'durchgeführt', 'eingesetzt', 'entwickelt', 'erreicht', 'erzielt', 'erhöht',
  'genutzt', 'geplant', 'geplante', 'geplanten', 'integriert', 'realisiert',
  'reduziert', 'untersucht', 'verwendet', 'benötigt', 'ermöglicht',
]);

/**
 * Füllwörter der Förderdomäne — kuratiert, am echten Bestand belegt.
 *
 * Jeder Eintrag steht in seiner GRUNDFORM; verglichen wird kanonisch
 * (`kanonischeForm`), ein Eintrag deckt damit „Entwicklung", „Entwicklungen"
 * und „Entwicklungs-" ab.
 *
 * Die Grenze verläuft an der Frage „trennt das Wort die Anträge?". „Entwicklung"
 * steht in 8 124 von 14 225 — es trennt nichts. „Sensorik" steht in 485 und
 * benennt einen Gegenstand. Wer die Liste erweitert, misst vorher nach:
 * `dev:local` → Korpus laden → Wörter zählen (siehe Modulkopf).
 */
const FUELLWOERTER_ROH: readonly string[] = [
  // Was jeder Antrag TUT
  'entwicklung', 'herstellung', 'optimierung', 'validierung', 'untersuchung',
  'charakterisierung', 'bewertung', 'aufbau', 'umsetzung', 'konzeption',
  'auslegung', 'erprobung', 'realisierung', 'implementierung', 'konstruktion',
  'modellierung', 'erfassung', 'bestimmung', 'verbesserung', 'steigerung',
  'erhöhung', 'einführung', 'erstellung', 'erweiterung', 'anpassung',
  'auswertung', 'prüfung', 'verwendung', 'integration', 'einsparung',
  'gestützt', 'gestützte', 'basiert', 'orientiert', 'unterstützt',
  // Wie das Vorhaben über sich selbst spricht
  'verfahren', 'projekt', 'vorhaben', 'teilvorhaben', 'teilprojekt',
  'arbeitspaket', 'ziel', 'einsatz', 'basis', 'anwendung', 'nutzung', 'bereich',
  'ansatz', 'konzept', 'prototyp', 'demonstrator', 'phase', 'aufgabe',
  'durchführbarkeitsstudie', 'machbarkeitsstudie', 'ergebnis', 'lösung',
  'anforderung', 'kombination', 'methode', 'grundlage', 'form', 'hilfe',
  'vergleich', 'möglichkeit', 'reduktion', 'einfluss', 'erhalt',
  'herausforderung', 'stand', 'technik', 'rahmen',
  // Wer beteiligt ist — steht als eigene Spalte daneben
  'unternehmen', 'partner', 'netzwerkpartner', 'netzwerk', 'konsortium',
  'zusammenarbeit', 'kunde', 'branche', 'markt', 'forschung', 'gmbh',
  'deutschland',
  // Zu allgemein, um etwas zu benennen
  'system', 'technologie', 'produkt', 'innovation', 'eigenschaft', 'bedarf',
  'fokus', 'kosten', 'teil', 'art', 'weise', 'beispiel', 'anzahl', 'vielzahl',
  'reihe', 'seite', 'größe', 'wert', 'zeit', 'jahr', 'punkt', 'folge',
];

/**
 * Die kanonische Form eines Wortes — Beugungen fallen darauf zusammen.
 *
 * `wortStamm` löst genau EINE Endung ab (es baut Suchnadeln, keine Grundformen):
 * „System" wird zu „syst", „Systems" aber nur zu „system" — die beiden träfen
 * sich nie. Deshalb hier bis zum Festpunkt, höchstens fünf Runden. Das schneidet
 * mehr ab, als eine Grundform hätte („prozess" → „proz"), aber es schneidet
 * BEIDE Formen auf dasselbe — und mehr muss ein Ordnungsschlüssel nicht können.
 * Angezeigt wird nie der Schlüssel, sondern die häufigste echte Schreibweise.
 */
export function kanonischeForm(wort: string): string {
  let form = wort.toLowerCase();
  for (let runde = 0; runde < 5; runde++) {
    const kuerzer = wortStamm(form);
    if (kuerzer === form) return form;
    form = kuerzer;
  }
  return form;
}

const FUELLWOERTER: ReadonlySet<string> = new Set(FUELLWOERTER_ROH.map(kanonischeForm));

/**
 * Ist das Wort Beiwerk statt Stichwort?
 *
 * Bei Bindestrich-Zusammensetzungen entscheidet zusätzlich das Grundwort hinten:
 * im Deutschen trägt es die Bedeutung, und `FuE-Projekt` ist genauso Beiwerk wie
 * `Projekt`. `KI-gestützt` fällt über `gestützt`, `Laser-Sensorik` bleibt.
 */
function istBeiwerk(klein: string): boolean {
  if (STOPPWOERTER.has(klein) || FUELLWOERTER.has(kanonischeForm(klein))) return true;
  const strich = klein.lastIndexOf('-');
  if (strich <= 0) return false;
  const grundwort = klein.slice(strich + 1);
  return STOPPWOERTER.has(grundwort) || FUELLWOERTER.has(kanonischeForm(grundwort));
}

/** Ein Stichwort im Aufbau: wie viele Anträge, und in welchen Schreibweisen. */
interface WortZaehler {
  antraege: number;
  /** Schreibweise → wie oft sie den Ausschlag gab. Bestimmt die Anzeige. */
  formen: Map<string, number>;
}

/** Der Index im Aufbau — Zählwerk je kanonischer Form, noch nicht sortiert. */
export type WortIndexRoh = Map<string, WortZaehler>;

export function leererWortIndexRoh(): WortIndexRoh {
  return new Map();
}

/**
 * Zählt die Stichwörter EINES Antrags. Alle Texte zusammen, jede kanonische
 * Form höchstens einmal — der Antrag ist die Zähleinheit, nicht der Satz.
 */
export function nimmWoerter(roh: WortIndexRoh, texte: readonly (string | undefined)[]): void {
  const gesehen = new Set<string>();
  for (const text of texte) {
    if (typeof text !== 'string' || text.length === 0) continue;
    for (const teil of text.split(TRENNER)) {
      const wort = teil.replace(/^-+|-+$/gu, '');
      if (wort.length < MIN_LAENGE || !GROSS.test(wort)) continue;
      const klein = wort.normalize('NFC').toLowerCase();
      if (istBeiwerk(klein)) continue;
      const schluessel = kanonischeForm(klein);
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      const da = roh.get(schluessel);
      if (!da) {
        roh.set(schluessel, { antraege: 1, formen: new Map([[wort, 1]]) });
        continue;
      }
      da.antraege++;
      da.formen.set(wort, (da.formen.get(wort) ?? 0) + 1);
    }
  }
}

/** Der fertige Index: die häufigsten Stichwörter — und wie viele es gibt. */
export interface WortIndex {
  /** Die häufigsten, häufigste zuerst, gekappt. */
  liste: readonly WertEintrag[];
  /**
   * Wie viele verschiedene Stichwörter der Bestand führt — vor dem Kappen.
   *
   * Getrennt geführt, weil `liste.length` die Obergrenze des Caches ist und
   * nicht der Bestand: „Stichwörter 100 Werte" neben „Ort 2.055 Werte" wäre
   * eine erfundene Zahl, die nur wie eine gemessene aussieht.
   */
  gesamt: number;
}

export const LEERER_WORT_INDEX: WortIndex = { liste: [], gesamt: 0 };

/**
 * Die häufigsten Stichwörter, häufigste zuerst — mehr als `max` behält der
 * Index nicht.
 *
 * Der Rohzähler führt rund 48 000 kanonische Formen, von denen die weit
 * überwiegende Mehrheit in einem einzigen Antrag steht. Sie mitzuschleppen
 * kostete Speicher für Zeilen, die keine Liste je zeigt.
 *
 * Bei Gleichstand alphabetisch, damit die Reihenfolge an den Daten hängt und
 * nicht am Cursor-Lauf — dieselbe Regel wie in `haeufigsteWerte`.
 */
export function verdichteWortIndex(roh: WortIndexRoh, max: number): WortIndex {
  const liste: WertEintrag[] = [];
  for (const zaehler of roh.values()) {
    liste.push({ wert: haeufigsteSchreibweise(zaehler.formen), anzahl: zaehler.antraege });
  }
  liste.sort((a, b) => (b.anzahl - a.anzahl) || a.wert.localeCompare(b.wert, 'de'));
  return { liste: liste.slice(0, max), gesamt: roh.size };
}

/** Die häufigste Schreibweise; bei Gleichstand die alphabetisch erste. */
function haeufigsteSchreibweise(formen: ReadonlyMap<string, number>): string {
  let beste = '';
  let besteZahl = -1;
  for (const [form, zahl] of formen) {
    if (zahl > besteZahl || (zahl === besteZahl && form.localeCompare(beste, 'de') < 0)) {
      beste = form;
      besteZahl = zahl;
    }
  }
  return beste;
}

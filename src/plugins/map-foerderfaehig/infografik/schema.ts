/**
 * Datenmodell, Prompt und Parser der Infografik-Extraktion.
 *
 * Ein interner Lauf liefert die Textanteile für Canvas, SdT-Delta und
 * Wirkungskette. Der Parser ist bewusst nachsichtig gegenüber Trailing-Artefakten
 * und fehlenden Feldern — aber NICHT gegenüber fehlendem Beleg: was das Modell
 * nicht mit einer Sektion belegt, wird als „nicht belegt" geführt, nicht
 * stillschweigend übernommen.
 *
 * Reine Funktionen — der Cache- und Transport-Rahmen liegt in `useMapVb.ts`.
 */
import type { VbSektion } from '@/plugins/antraege/aufbereitung/gliederung';
import { extractLastJsonObject } from '@/plugins/antraege/aufbereitung/steckbrief';
import { alsSektionIds, alsText } from './roh';
import { OHNE_WERT } from './fakten';
import {
  parseSubstanz, UNSCHAERFE_MAX,
  type UnschaerfeBegriff, type Widerspruch,
} from './substanz';
import {
  baueZweitmeinungPromptTeil, parseZweitmeinung, zweitmeinungSchemaZeilen,
  type ZweitmeinungEintrag,
} from './zweitmeinung';
import type { MapChecklistenItem } from '../checkliste/typen';

/**
 * Schemaversion der Modell-Antwort. Geht in den Cache-Schlüssel ein
 * (`useMapVb.ts`), damit Einträge aus einer älteren Feldmenge sauber verfallen
 * statt als unvollständige Antwort weiterzuleben.
 *
 * 1 → 2: `widersprueche` und `unschaerfeBegriffe` ergänzt (Substanzcheck).
 * 2 → 3: `innoZweitmeinung` ergänzt (KI-Zweitmeinung). Ohne den Bump bliebe ein
 *        v2-Eintrag ein gültiger Treffer zum unveränderten Korpus — die
 *        Zweitmeinung wäre für diese Einreichung dauerhaft leer, ohne dass je ein
 *        Neu-Lauf ausgelöst würde.
 */
export const INFOGRAFIK_SCHEMA_VERSION = 3;

/** Wie gut eine Angabe in der Vorhabensbeschreibung belegt ist. */
export type Belegtheit = 'belegt' | 'vage' | 'fehlt';

export interface CanvasFeld {
  text: string;
  sektionIds: string[];
  belegtheit: Belegtheit;
}

/** Die vier Textfelder des Canvas, die aus der VB kommen. */
export interface CanvasTexte {
  problemSdt: CanvasFeld;
  innovation: CanvasFeld;
  technischesRisiko: CanvasFeld;
  marktVerwertung: CanvasFeld;
}

export interface SdtDeltaZeile {
  parameter: string;
  sdtWert: string;
  zielWert: string;
  /** `quantifiziert` = messbare Zahl, `qualitativ` = nur beschrieben. */
  quantifizierung: 'quantifiziert' | 'qualitativ' | 'fehlt';
  sektionIds: string[];
}

export interface WirkungsGlied {
  text: string;
  /** Zahlenziel, falls die VB eines nennt (z. B. „3 neue Arbeitsplätze"). */
  zahlenziel?: string;
  sektionIds: string[];
  belegtheit: Belegtheit;
}

export interface Wirkungskette {
  problem: WirkungsGlied;
  ergebnis: WirkungsGlied;
  verwertung: WirkungsGlied;
  wirkung: WirkungsGlied;
}

export interface InfografikDaten {
  canvas: CanvasTexte;
  sdtDelta: SdtDeltaZeile[];
  wirkungskette: Wirkungskette;
  /** Abweichungen zwischen Fliesstext und Einreichungsdaten. Leer = gutes Ergebnis. */
  widersprueche: Widerspruch[];
  /** Anspruchsformeln ohne Beleg oder Zahl, max. `UNSCHAERFE_MAX`. */
  unschaerfeBegriffe: UnschaerfeBegriff[];
  /**
   * Unverbindliche Einstufung der Skala-Items. Sichtbar erst nach der eigenen
   * Bewertung (`ansicht/zweitmeinung-vergleich.ts`), nirgends aggregiert.
   */
  innoZweitmeinung: ZweitmeinungEintrag[];
  /** Stempel der Ankertexte, auf denen die Einstufung beruht — NICHT im Cache-Key. */
  zweitmeinungAnkerHash: string;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const CANVAS_FELDER: ReadonlyArray<{ key: keyof CanvasTexte; frage: string }> = [
  { key: 'problemSdt', frage: 'Welches Problem wird gelöst und was ist der heutige Stand der Technik?' },
  { key: 'innovation', frage: 'Was ist der Kern der Innovation gegenüber dem Bestehenden?' },
  { key: 'technischesRisiko', frage: 'Welche konkreten technischen Entwicklungshürden bestehen?' },
  { key: 'marktVerwertung', frage: 'Welche Märkte werden adressiert und wie soll verwertet werden?' },
];

const KETTEN_GLIEDER: ReadonlyArray<{ key: keyof Wirkungskette; frage: string }> = [
  { key: 'problem', frage: 'Von welchem Ausgangsproblem geht das Vorhaben aus?' },
  { key: 'ergebnis', frage: 'Was ist das angestrebte technische Ergebnis?' },
  { key: 'verwertung', frage: 'Wie wird das Ergebnis verwertet?' },
  { key: 'wirkung', frage: 'Welche wirtschaftliche Wirkung wird erwartet (Umsatz, Arbeitsplätze)?' },
];

/**
 * Baut das Extraktions-Prompt. Rein.
 *
 * `faktenBlock` kommt deterministisch aus `fakten.ts` und ist die Referenzseite
 * des Widerspruchschecks — er steht bewusst VOR der Vorhabensbeschreibung, damit
 * das Modell die Zahlen kennt, bevor es den Fliesstext liest.
 *
 * `skalaItems` trägt die Ankertexte der Zweitmeinung aus der Checklisten-Entität
 * heran. Kein Default-Wert: ein `= []` verwandelte einen Verdrahtungsfehler in
 * eine still dauerhaft leere Zweitmeinung, ein Compile-Fehler ist billiger.
 */
export function buildInfografikPrompt(
  gliederung: readonly VbSektion[],
  vbMarkdown: string,
  faktenBlock: string,
  skalaItems: readonly MapChecklistenItem[],
): string {
  const sektionsListe = gliederung
    .map(s => `- ${s.id}: ${s.nummer != null ? `${s.nummer} ` : ''}${s.titel}`)
    .join('\n');

  // Ohne Skala-Items entfallen Regelblock UND Schema-Zeile gemeinsam — das Modell
  // wird nie nach einem Feld gefragt, dessen Bewertungsgrundlage im Prompt fehlt.
  const zweitmeinungSchema = zweitmeinungSchemaZeilen(skalaItems);

  return [
    'Extrahiere aus der Vorhabensbeschreibung die Angaben für die Prüfansichten',
    'und gleiche den Text gegen die verbindlichen Fakten der Einreichung ab.',
    '',
    'Regeln:',
    '- Belege JEDE Aussage mit den IDs der Abschnitte, aus denen sie stammt.',
    '- Formuliere nah am Wortlaut des Originals, 2 bis 4 Sätze je Feld. Trägt die VB zu',
    '  einem Feld nur einen Satz her, ist ein Satz richtig — erfinde nichts dazu.',
    '- `belegtheit`: "belegt" wenn die VB die Aussage ausdrücklich trägt, "vage" wenn sie',
    '  nur angedeutet oder rein qualitativ ist, "fehlt" wenn sie gar nicht vorkommt.',
    '- Bei "fehlt" bleibt `text` leer. Erfinde nichts.',
    '',
    'Regeln für `widersprueche` (Abgleich Text gegen Fakten):',
    '- Melde NUR echte Abweichungen: der Text nennt einen anderen Wert, einen anderen',
    '  Zeitraum oder eine Bezeichnung, die es in den Fakten nicht gibt.',
    // Wertungsfrei formuliert: „das ist ein GUTES Ergebnis" lud zur Selbstprüfung ein
    // („war meine leere Liste wirklich gut? — nochmal durchgehen"), also genau zu der
    // Deliberationsschleife, die vermieden werden soll (Prompt-Audit 2026-07).
    '- Vermute nicht. Eine leere Liste ist ein zulässiges Ergebnis.',
    `- Fakten mit dem Wert "${OHNE_WERT}" sind KEINE Vergleichsgrundlage; über sie`,
    '  lässt sich nichts widersprechen.',
    '- `fakt` ist die betroffene Faktenzeile ohne den Listenstrich, `aussageImText` der',
    '  Satz aus dem Text, in dem die abweichende Angabe steht. Beides ist Pflicht.',
    '',
    'Regeln für `unschaerfeBegriffe` (Quantifizierungspflicht):',
    '- Sammle Formulierungen mit Anspruchscharakter, die weder Zahl noch Beleg tragen',
    '  („deutliche Effizienzsteigerung", „innovativer Ansatz", „übliche Risiken").',
    `- Höchstens ${UNSCHAERFE_MAX} Einträge. Stelle die nach vorn, die eine zentrale`,
    '  Leistungs- oder Zielaussage des Vorhabens betreffen.',
    // Beide Gründe trafen bei den prompt-eigenen Beispielen gleichzeitig zu, ohne
    // Tiebreak — eine Entscheidung ohne Kriterium, bis zu UNSCHAERFE_MAX Mal.
    '- `grund`: "nicht quantifiziert", sobald eine Zahl fehlt — auch wenn der Begriff',
    '  zusätzlich unbestimmt ist. "nicht definiert" nur, wenn eine Zahl gar nicht in',
    '  Frage kommt und allein der Begriff offen bleibt.',
    '- Reine Füllwörter ohne Anspruchscharakter gehören NICHT in die Liste.',
    ...baueZweitmeinungPromptTeil(skalaItems),
    '',
    '## Abschnitte',
    sektionsListe,
    '',
    faktenBlock,
    '',
    '## Vorhabensbeschreibung',
    vbMarkdown,
    '',
    '## Gefordertes JSON',
    // Feld-Beschreibungen in spitzen Klammern statt „…": ein Echo der Schablone
    // lieferte sonst `"…"` als Wert — nicht leer, also `belegtheit: "vage"` statt
    // "fehlt". Der Verdächtig-Guard prüft nur auf "fehlt", griff also nicht, und das
    // Ergebnis wurde GECACHT: eine dauerhaft eingefrorene Fehlansicht.
    'Die spitzen Klammern sind Feld-Beschreibungen, keine Werte. `belegtheit`,',
    '`quantifizierung`, `art` und `grund` nehmen GENAU EINEN der mit | getrennten Werte.',
    // Unindentiert — die Schlusszeile fordert „kompakt und ohne Einrückung". Ein
    // eingerücktes Beispiel widerspräche der eigenen Anweisung, und das Modell müsste
    // entscheiden, welche der beiden gilt (Guard: keine-kompakt-anweisung-neben-...).
    '```json',
    '{',
    '"canvas": {',
    ...CANVAS_FELDER.map(f =>
      `"${f.key}": { "text": "<${f.frage}>", "sektionIds": ["<sektion-id>"], "belegtheit": "belegt|vage|fehlt" },`),
    '},',
    '"sdtDelta": [',
    '{ "parameter": "<Parameter>", "sdtWert": "<Wert im Stand der Technik>", "zielWert": "<Zielwert>", "quantifizierung": "quantifiziert|qualitativ|fehlt", "sektionIds": ["<sektion-id>"] }',
    '],',
    '"wirkungskette": {',
    ...KETTEN_GLIEDER.map(g =>
      `"${g.key}": { "text": "<${g.frage}>", "zahlenziel": "<Zahlenziel oder leer>", "sektionIds": ["<sektion-id>"], "belegtheit": "belegt|vage|fehlt" },`),
    '},',
    '"widersprueche": [',
    '{ "fakt": "<Faktenzeile>", "aussageImText": "<Satz aus dem Text>", "art": "zahl|zeitraum|bezeichnung", "sektionIds": ["<sektion-id>"] }',
    '],',
    '"unschaerfeBegriffe": [',
    '{ "begriff": "<Formulierung>", "kontext": "<Umfeld im Text>", "grund": "nicht definiert|nicht quantifiziert", "sektionIds": ["<sektion-id>"] }',
    zweitmeinungSchema.length > 0 ? '],' : ']',
    ...zweitmeinungSchema,
    '}',
    '```',
    '',
    'Gib ausschließlich dieses JSON-Objekt zurück, kompakt und ohne Einrückung.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const LEERES_FELD: CanvasFeld = { text: '', sektionIds: [], belegtheit: 'fehlt' };

/**
 * Deutet die Belegtheit. Ohne Text oder ohne gültige Fundstelle gilt eine
 * Aussage NIE als belegt — ein unbelegter Satz ist im Prüfkontext wertlos, und
 * das Modell soll ihn nicht durch eine Selbstauskunft aufwerten können.
 */
function alsBelegtheit(wert: unknown, text: string, sektionIds: readonly string[]): Belegtheit {
  if (text.length === 0) return 'fehlt';
  if (sektionIds.length === 0) return 'vage';
  return wert === 'belegt' ? 'belegt' : wert === 'vage' ? 'vage' : 'vage';
}

function alsFeld(roh: unknown, bekannt: ReadonlySet<string>): CanvasFeld {
  if (roh === null || typeof roh !== 'object') return { ...LEERES_FELD };
  const o = roh as Record<string, unknown>;
  const text = alsText(o['text']);
  const sektionIds = alsSektionIds(o['sektionIds'], bekannt);
  return { text, sektionIds, belegtheit: alsBelegtheit(o['belegtheit'], text, sektionIds) };
}

function alsGlied(roh: unknown, bekannt: ReadonlySet<string>): WirkungsGlied {
  const feld = alsFeld(roh, bekannt);
  const zahlenziel = roh !== null && typeof roh === 'object'
    ? alsText((roh as Record<string, unknown>)['zahlenziel'])
    : '';
  return { ...feld, ...(zahlenziel.length > 0 ? { zahlenziel } : {}) };
}

function alsDeltaZeile(roh: unknown, bekannt: ReadonlySet<string>): SdtDeltaZeile | null {
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  const parameter = alsText(o['parameter']);
  if (parameter.length === 0) return null;

  const q = o['quantifizierung'];
  return {
    parameter,
    sdtWert: alsText(o['sdtWert']),
    zielWert: alsText(o['zielWert']),
    quantifizierung: q === 'quantifiziert' ? 'quantifiziert' : q === 'qualitativ' ? 'qualitativ' : 'fehlt',
    sektionIds: alsSektionIds(o['sektionIds'], bekannt),
  };
}

/**
 * Parst die Modell-Antwort. `null` nur, wenn gar kein JSON-Objekt erkennbar ist —
 * fehlende Einzelfelder werden zu „fehlt", nicht zum Abbruch. Rein.
 */
export function parseInfografik(
  raw: string,
  gliederung: readonly VbSektion[],
  skalaItems: readonly MapChecklistenItem[],
): InfografikDaten | null {
  const objekt = extractLastJsonObject(raw);
  if (objekt === null) return null;

  const bekannt = new Set(gliederung.map(s => s.id));
  const canvasRoh = (objekt['canvas'] ?? {}) as Record<string, unknown>;
  const ketteRoh = (objekt['wirkungskette'] ?? {}) as Record<string, unknown>;
  const substanz = parseSubstanz(objekt, bekannt);
  const zweitmeinung = parseZweitmeinung(objekt, bekannt, skalaItems);

  return {
    canvas: {
      problemSdt: alsFeld(canvasRoh['problemSdt'], bekannt),
      innovation: alsFeld(canvasRoh['innovation'], bekannt),
      technischesRisiko: alsFeld(canvasRoh['technischesRisiko'], bekannt),
      marktVerwertung: alsFeld(canvasRoh['marktVerwertung'], bekannt),
    },
    sdtDelta: (Array.isArray(objekt['sdtDelta']) ? objekt['sdtDelta'] : [])
      .map(z => alsDeltaZeile(z, bekannt))
      .filter((z): z is SdtDeltaZeile => z !== null),
    wirkungskette: {
      problem: alsGlied(ketteRoh['problem'], bekannt),
      ergebnis: alsGlied(ketteRoh['ergebnis'], bekannt),
      verwertung: alsGlied(ketteRoh['verwertung'], bekannt),
      wirkung: alsGlied(ketteRoh['wirkung'], bekannt),
    },
    ...substanz,
    ...zweitmeinung,
  };
}

/**
 * Erkennt eine Antwort, die zwar formal passt, aber inhaltlich nichts trägt —
 * Grundlage des Verdächtig-Guards, der einen solchen Lauf nicht cacht. Rein.
 *
 * Die Substanz-Listen bleiben hier bewusst AUSSEN VOR: ein sauberer Antrag
 * liefert null Widersprüche, und diese Null ist das gewünschte Ergebnis. Sie in
 * den Guard aufzunehmen hiesse, den Falsch-Positiv-freien Lauf als Fehlschlag zu
 * werten und einen Retry zu erzwingen.
 *
 * Auch `innoZweitmeinung` bleibt draussen, aus einem anderen Grund: sie ist ein
 * ausdrücklich experimentelles Beiwerk. Zählte sie mit, würde ein Lauf mit
 * vollständigem Canvas, sauberem Delta und belegter Wirkungskette verworfen und
 * wiederholt, nur weil das Modell die Einstufung ausliess — und beim zweiten
 * Fehlversuch wäre er degradiert und gar nicht gecacht. Der Prüfer verlöre die
 * ganze Analyse wegen eines Nebenprodukts. Fehlt die Zweitmeinung, degradiert sie
 * nur sich selbst: die Streifen erscheinen nicht, alles andere steht.
 */
export function istInhaltsleer(daten: InfografikDaten): boolean {
  const canvasLeer = Object.values(daten.canvas).every(f => f.belegtheit === 'fehlt');
  const ketteLeer = Object.values(daten.wirkungskette).every(g => g.belegtheit === 'fehlt');
  return canvasLeer && ketteLeer && daten.sdtDelta.length === 0;
}

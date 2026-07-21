/**
 * KI-Zweitmeinung auf die Skala-Items des Innovationsgrads.
 *
 * Der Extraktions-Lauf ordnet die drei Kategorien zusätzlich den Ankertexten zu.
 * Das ist eine **unverbindliche Zweitmeinung** — sie entscheidet nichts, ändert
 * keinen Status und wird nirgends aggregiert. Sichtbar wird sie erst, nachdem der
 * Mensch seine eigene Stufe gespeichert hat; durchgesetzt wird diese Regel in
 * `ansicht/zweitmeinung-vergleich.ts`, nicht hier und nicht im JSX.
 *
 * Zwei Eigenschaften prägen dieses Modul:
 *
 * 1. **Die Ankertexte kommen aus der Entität, nie aus einer Konstante hier.**
 *    Der Kurator kann sie im Checklisten-Editor ändern; ein zweiter, hartkodierter
 *    Stand würde still davon abdriften und das Modell nach einer Skala fragen, die
 *    niemand mehr benutzt.
 * 2. **Im Zweifel verwerfen, nicht raten** (Leitplanke von `substanz.ts`): eine
 *    erfundene Item-ID oder eine Einstufung ohne Begründung fällt raus. Eine
 *    fehlende Zeile kostet den Prüfer nichts — eine falsche kostet ihn Vertrauen
 *    in die ganze Ansicht.
 *
 * Reine Funktionen.
 */
import { hashText } from '@/plugins/antraege/gutachten/runner';
import type { MapChecklistenItem, MapStufe } from '../checkliste/typen';
import { alsSektionIds, alsText } from './roh';

/** Einstufung des Modells zu genau einem Skala-Item. */
export interface ZweitmeinungEintrag {
  /** Item-ID aus der Checklisten-Definition — gegen sie validiert. */
  itemId: string;
  stufe: MapStufe;
  /** 2–3 Sätze, bezogen auf die Ankertexte. Pflicht. */
  begruendung: string;
  sektionIds: string[];
}

export interface ZweitmeinungDaten {
  /** Leer, wenn das Modell nichts Gültiges lieferte — kein Fehlerfall. */
  innoZweitmeinung: ZweitmeinungEintrag[];
  /** Stempel der Ankertexte, auf denen die Einstufung beruht (siehe `ankerHashFuer`). */
  zweitmeinungAnkerHash: string;
}

const STUFEN: ReadonlySet<string> = new Set<MapStufe>(['B0', 'B1', 'B2', 'B3']);

/** Reihenfolge der Stufen — Grundlage von `stufenAbstand`. */
const STUFEN_FOLGE: readonly MapStufe[] = ['B0', 'B1', 'B2', 'B3'];

/**
 * Abstand zweier Stufen in Stufenschritten (0…3). Geteilt zwischen UI-Vergleich
 * und Smoke-Gold-Abgleich — eine ±1-Definition, zwei Nutzer.
 */
export function stufenAbstand(a: MapStufe, b: MapStufe): number {
  return Math.abs(STUFEN_FOLGE.indexOf(a) - STUFEN_FOLGE.indexOf(b));
}

/**
 * Stempel über die Bewertungsgrundlage: Item-IDs plus Stufen, Punkte und
 * Ankertexte **wörtlich**.
 *
 * Er geht bewusst NICHT in den Cache-Schlüssel ein, sondern in die Nutzlast.
 * Im Schlüssel würde eine Anker-Änderung im Editor den gesamten Infografik-Lauf
 * verwerfen — Canvas, SdT-Delta, Wirkungskette und die Substanz-Listen wären nach
 * dem nächsten Öffnen leer, obwohl sie mit den Ankertexten nichts zu tun haben
 * (`leseMapAnalyse` liest nur, es rechnet nie nach). Als Stempel in der Nutzlast
 * bleibt alles stehen, und die Zweitmeinung wird lediglich als „beruht auf einer
 * älteren Fassung" gekennzeichnet.
 */
export function ankerHashFuer(skalaItems: readonly MapChecklistenItem[]): string {
  const text = skalaItems
    .map(item => [
      item.id,
      ...(item.anker ?? []).map(a => `${a.stufe}|${a.punkte}|${a.kurz}|${a.merkmale.join('~')}`),
    ].join('§'))
    .join('¶');
  return hashText(text);
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/**
 * Baut den Zweitmeinungs-Block für das Extraktions-Prompt. Rein.
 *
 * Ohne Skala-Items liefert die Funktion ein **leeres Array** — dann fehlt der
 * Block im Prompt und das Modell wird nicht nach einem Feld gefragt, dessen
 * Grundlage es nicht kennt. Das ist die saubere Degradation, solange die
 * Checklisten-Definition noch lädt.
 */
export function baueZweitmeinungPromptTeil(
  skalaItems: readonly MapChecklistenItem[],
): string[] {
  if (skalaItems.length === 0) return [];

  const kategorien = skalaItems.flatMap(item => [
    '',
    `### ${item.id} — ${item.kriterium}`,
    ...(item.anker ?? []).flatMap(a => [
      `${a.stufe} · ${a.kurz} (${a.punkte} Punkte):`,
      ...a.merkmale.map(m => `  - ${m}`),
    ]),
  ]);

  return [
    '',
    'Regeln für `innoZweitmeinung` (Einordnung des Innovationsgrads):',
    '- Ordne JEDE der unten genannten Kategorien genau einer Stufe B0 bis B3 zu.',
    '- Grundlage sind allein die Ankertexte unten und der Inhalt der',
    '  Vorhabensbeschreibung. Lege keine eigenen Massstäbe an.',
    '- `begruendung`: 2 bis 3 Sätze. Benenne, welche Merkmale der gewählten Stufe',
    '  die Vorhabensbeschreibung trägt und welche Merkmale der nächsthöheren Stufe',
    '  sie nicht trägt. Keine Stilkritik, keine Förderempfehlung.',
    '- Eine einzige B0-Einstufung setzt den Innovationsgrad insgesamt auf 0,',
    '  unabhängig von den beiden anderen Kategorien. Stufe B0 deshalb nur ein, wenn',
    '  die B0-Merkmale zutreffen.',
    '- Schweigt die Vorhabensbeschreibung zu einer Kategorie, ist B0 die richtige',
    '  Stufe; die Begründung benennt dann die Lücke.',
    '- Benutze als `itemId` eine der Kategorie-IDs unten.',
    '',
    '## Kategorien des Innovationsgrads (Ankertexte)',
    ...kategorien,
  ];
}

/**
 * Schema-Zeilen für den JSON-Block. Leer, wenn es keine Skala-Items gibt.
 *
 * Unindentiert und mit Feld-Beschreibungen in spitzen Klammern — beides folgt der
 * Form, die `schema.ts` seit dem Prompt-Audit für alle Beispielzeilen benutzt: ein
 * eingerücktes Beispiel widerspräche der Schlusszeile („kompakt und ohne
 * Einrückung"), und ein Echo-fähiger Platzhalter wie „…" landete als Wert im
 * Parser.
 */
export function zweitmeinungSchemaZeilen(
  skalaItems: readonly MapChecklistenItem[],
): string[] {
  if (skalaItems.length === 0) return [];
  return [
    '"innoZweitmeinung": [',
    '{ "itemId": "<eine der Kategorie-IDs oben>", "stufe": "B0|B1|B2|B3",'
    + ' "begruendung": "<2 bis 3 Sätze zu den Ankertexten>", "sektionIds": ["<sektion-id>"] }',
    ']',
  ];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function alsEintrag(
  roh: unknown, bekannteSektionen: ReadonlySet<string>, bekannteItems: ReadonlySet<string>,
): ZweitmeinungEintrag | null {
  if (roh === null || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;

  // Eine ID, die es in der Definition nicht (mehr) gibt, ist keine Einstufung,
  // sondern eine erfundene Kategorie — sie darf auch kein stillgelegtes Item
  // wiederbeleben (die Menge kommt bereits gefiltert herein).
  const itemId = alsText(o['itemId']);
  if (!bekannteItems.has(itemId)) return null;

  const stufe = alsText(o['stufe']);
  if (!STUFEN.has(stufe)) return null;

  // Eine Einstufung ohne Begründung ist im Prüfkontext wertlos: der Prüfer kann
  // sie weder nachvollziehen noch widerlegen.
  const begruendung = alsText(o['begruendung']);
  if (begruendung.length === 0) return null;

  return {
    itemId,
    stufe: stufe as MapStufe,
    begruendung,
    // Darf leer bleiben. Verwürfe man Einträge ohne Fundstelle, wäre die
    // Smoke-Prüfung „mindestens eine Fundstelle je Item" tautologisch — sie
    // misst dann den Parser statt das Modell.
    sektionIds: alsSektionIds(o['sektionIds'], bekannteSektionen),
  };
}

/**
 * Liest die Zweitmeinung aus dem bereits geparsten Antwort-Objekt. Fehlt das Feld
 * ganz (altes Schema, Modell hat es ausgelassen), ist die Liste leer — das ist
 * kein Fehlerfall und darf keinen Retry auslösen. Rein.
 */
export function parseZweitmeinung(
  objekt: Record<string, unknown>,
  bekannteSektionen: ReadonlySet<string>,
  skalaItems: readonly MapChecklistenItem[],
): ZweitmeinungDaten {
  const bekannteItems = new Set(skalaItems.map(i => i.id));
  const roh = Array.isArray(objekt['innoZweitmeinung']) ? objekt['innoZweitmeinung'] : [];

  const gesehen = new Set<string>();
  const innoZweitmeinung: ZweitmeinungEintrag[] = [];
  for (const r of roh) {
    const eintrag = alsEintrag(r, bekannteSektionen, bekannteItems);
    // Doppelte Einstufung derselben Kategorie: die erste gewinnt. Ein Modell, das
    // sich korrigiert, hängt die Korrektur an — aber es widerspricht sich hier
    // selbst, und die spätere Zeile ist nicht verlässlicher als die frühere.
    if (eintrag === null || gesehen.has(eintrag.itemId)) continue;
    gesehen.add(eintrag.itemId);
    innoZweitmeinung.push(eintrag);
  }

  return { innoZweitmeinung, zweitmeinungAnkerHash: ankerHashFuer(skalaItems) };
}

/**
 * Prompt und Parser für die drei Schlagworte einer Meldungszeile — rein, ohne
 * KI-Aufruf. Derselbe Schnitt wie
 * [frageplan.ts](src/core/services/search/frageplan.ts) /
 * [frageplan-lauf.ts](src/core/services/search/frageplan-lauf.ts): was sich
 * testen lässt, steht hier; der eine Aufruf steht daneben.
 *
 * **Warum der Prompt so viel über Allerweltswörter redet.** Die Schlagworte
 * werden ODER-verknüpft gesucht, und ein einziges zu weites Wort reisst das
 * Ergebnis auf. In der App gegen den echten Bestand gemessen (Betrachtungs-
 * bereich 4.327 Vorhaben, 23.08.2026):
 *
 *   Entwicklung 3.235 (74,8 %) · Technologie 3.065 (70,8 %) · KI 1.569 (36,3 %)
 *   Sensor 1.055 (24,4 %) · Künstliche Intelligenz 1.046 (24,2 %)
 *   Innovation 347 (8,0 %) · Digitalisierung 177 (4,1 %) · Mittelstand 31 (0,7 %)
 *   Cybersicherheit 6 (0,1 %) · Mobile Fabrik 2 (0,0 %)
 *
 * Das weite Trio der ersten Beispielzeile („Digitalisierung / Künstliche
 * Intelligenz / Mittelstand") kommt ODER-verknüpft auf 1.150 Treffer — ein
 * Viertel des Bereichs. Ein spezifisches Trio derselben Zeile („Mobile Fabrik /
 * Demonstrationsinfrastruktur / Erfolgskontrolle") kommt auf 2. Ein
 * spezifisches Schlagwort ist deshalb keine Stilfrage — es entscheidet, ob das
 * Urteil überhaupt etwas aussagt.
 *
 * **Die zweite Staffel der Verbotsliste** stammt aus einem Durchlauf über alle
 * 45 Meldungen der Liste `Auszug_72_Zeilen_ 20260818`, die über der
 * Betragsschwelle liegen (23.08.2026). Die Schlagworte dieses Laufs waren von
 * Hand formuliert, weil die interne KI nicht erreichbar war — gemessen wurde
 * ihre Wirkung im echten Suchpfad:
 *
 *   Automatisierung 852 (19,7 %) · Maschinenbau 672 (15,5 %)
 *   Medizintechnik 353 (8,2 %) · Additive Fertigung 343 (7,9 %)
 *   Logistik 105 (2,4 %) · Maschinelles Lernen 86 (2,0 %) · Demonstrator 82 (1,9 %)
 *
 * Sie stehen jetzt im Verbot, weil sie dieselbe Rolle spielen wie „Entwicklung":
 * sie benennen die Branche oder die Methodenfamilie, nicht das Vorhaben. Der
 * Schnitt liegt bei einem Prozent des Betrachtungsbereichs — direkt darunter
 * fangen die Wörter an, die wirklich unterscheiden (Qualifizierung 0,8 %,
 * Computer Vision 0,3 %). Fachlich enge Begriffe bleiben erlaubt, auch wenn sie
 * häufig sind: „Kreislaufwirtschaft" (1,8 %) benennt eine Sache, keine Schublade.
 */
import { einZugRegel } from '@/core/services/ai/ein-schuss-lauf';
import { alsListe, alsText, istRecord, parseJsonArrayTolerant, stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';

/** So viele Schlagworte verlangt der Prompt und lässt der Parser durch. */
export const SCHLAGWORT_ANZAHL = 3;

/**
 * Kürzeste brauchbare Länge eines Schlagworts.
 *
 * Vier Zeichen wie bei den Nadeln des Frageplans (`MIN_NADEL_LEN`) — aus
 * demselben Grund: kürzere Zeichenketten stecken in zu vielen Wörtern. „KI"
 * hätte diese Hürde ohnehin gerissen.
 */
export const MIN_SCHLAGWORT_LEN = 4;

/** So viel Aufgabenbeschreibung geht in den Prompt. */
const MAX_BESCHREIBUNG_LEN = 4_000;
const MAX_THEMA_LEN = 400;

/**
 * Wörter, die der Prompt ausdrücklich ausschliesst.
 *
 * Sie stehen als Liste da, damit der Prompt sie benennen kann statt „sei
 * spezifisch" zu sagen — eine benannte Verbotsliste wirkt, eine Stilbitte nicht.
 * Der Parser siebt sie NICHT nach: hielte er ein Schlagwort zurück, stünden in
 * der Zeile plötzlich zwei statt drei, und der Nutzer sähe nicht, warum. Er
 * sieht stattdessen in der Ergebniszeile, wie viele Treffer jedes Wort trug, und
 * kann es dort überschreiben.
 */
export const ZU_WEITE_WOERTER: readonly string[] = [
  'KI', 'Künstliche Intelligenz', 'Digitalisierung', 'Forschung', 'Entwicklung',
  'Innovation', 'Projekt', 'Verbundprojekt', 'Technologie', 'System', 'Software',
  'Nachhaltigkeit', 'Transfer', 'Mittelstand', 'KMU',
  // Zweite Staffel, an der 72er-Liste nachgemessen (siehe Kopfkommentar). Alle
  // liegen über einem Prozent des Betrachtungsbereichs und benennen die Branche
  // oder die Methodenfamilie statt des Vorhabens.
  'Automatisierung', 'Maschinenbau', 'Medizintechnik', 'Additive Fertigung',
  'Logistik', 'Maschinelles Lernen', 'Demonstrator',
];

export interface SchlagwortPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Der Prompt für eine Zeile.
 *
 * **Ohne Beispiel-JSON**, aus demselben Grund wie beim Frageplan: ein Modell,
 * das eine Schablone wiederholt, lieferte sonst die Schablone. Die Felder stehen
 * als Aufzählung da.
 */
export function baueSchlagwortPrompt(
  thema: string,
  aufgabenbeschreibung: string,
): SchlagwortPrompt {
  const systemPrompt = [
    'Du verschlagwortest ein gemeldetes Forschungsvorhaben, damit es gegen eine',
    'Datenbank deutscher Förderanträge (ZIM) abgeglichen werden kann.',
    'Du bewertest nichts und fasst nichts zusammen — du benennst nur, wonach gesucht werden soll.',
    '',
    `Antworte mit GENAU EINEM JSON-Objekt mit dem Schlüssel "schlagworte": einer Liste von genau ${SCHLAGWORT_ANZAHL} Zeichenketten.`,
    '',
    'Regeln:',
    '- Deutsch, je ein bis zwei Wörter, Substantive in Grundform.',
    '- FACHLICH UND SPEZIFISCH: das Verfahren, der Werkstoff, das Bauteil, die',
    '  Anwendung — das, was dieses Vorhaben von anderen unterscheidet.',
    '- Die Schlagworte werden ODER-verknüpft gesucht. Ein einziges zu weites Wort',
    '  macht das Ergebnis wertlos: am Bestand gemessen trifft „Entwicklung" 75 % aller',
    '  Vorhaben, „KI" 36 %, „Sensor" 24 %. Solche Wörter sind deshalb VERBOTEN, auch',
    '  wenn sie im Text stehen:',
    `    ${ZU_WEITE_WOERTER.join(' · ')}`,
    '- Steht im Text nur ein solches Allerweltswort, nimm den engeren Begriff daneben',
    '  („Künstliche Intelligenz zur Fehlererkennung in Schweissnähten" → „Fehlererkennung",',
    '  „Schweissnaht"), nicht das weite Wort.',
    '- Keine Eigennamen von Antragstellern, Instituten, Orten oder Programmen.',
    `- Mindestens ${MIN_SCHLAGWORT_LEN} Zeichen je Schlagwort.`,
    einZugRegel('der JSON-Block'),
  ].join('\n');

  const userPrompt = [
    'Thema:',
    '"""',
    thema.trim().slice(0, MAX_THEMA_LEN),
    '"""',
    '',
    'Aufgabenbeschreibung:',
    '"""',
    aufgabenbeschreibung.trim().slice(0, MAX_BESCHREIBUNG_LEN),
    '"""',
  ].join('\n');

  return { systemPrompt, userPrompt };
}

/** Eine Zeile einer Aufzählung („- Laserschweissen", „1. Laserschweissen"). */
function ausListenzeile(zeile: string): string {
  return zeile.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["'„»]|["'“«]$/g, '').trim();
}

/** Trimmen, normalisieren, entdoppeln, deckeln. */
function sammle(kandidaten: readonly string[]): string[] {
  const gesehen = new Set<string>();
  const out: string[] = [];
  for (const k of kandidaten) {
    const wort = k.normalize('NFC').trim();
    if (wort.length < MIN_SCHLAGWORT_LEN) continue;
    const key = wort.toLowerCase();
    if (gesehen.has(key)) continue;
    gesehen.add(key);
    out.push(wort);
    if (out.length === SCHLAGWORT_ANZAHL) break;
  }
  return out;
}

/**
 * Die Schlagworte aus der Rohantwort. Leere Liste heisst „nichts Verwertbares".
 *
 * Zwei Wege, in dieser Reihenfolge: das letzte balancierte JSON-Objekt der
 * Antwort (schreibt das Modell erst eine Erläuterung, ist das Ergebnis das
 * hintere — dieselbe Regel wie in `parseFrageplan`), sonst die Aufzählung im
 * Fliesstext. Der zweite Weg ist kein Luxus: ein Modell, das gerade Prosa
 * schreibt, liefert die drei Wörter oft trotzdem, nur eben als Liste.
 *
 * Weniger als drei Schlagworte sind ein gültiges Ergebnis — die Suche läuft dann
 * mit zweien, und die Anzeige sagt, wie viele es waren. Ein Retry wäre nur
 * Wartezeit (Pflicht 6 des einschüssigen Laufs).
 */
export function parseSchlagworte(roh: string): string[] {
  const text = stripMarkdownWrapper(roh ?? '');

  const objekte = parseJsonArrayTolerant(text).filter(istRecord);
  const obj = objekte[objekte.length - 1];
  if (obj) {
    const ausJson = sammle(alsListe(obj.schlagworte).map(alsText));
    if (ausJson.length > 0) return ausJson;
  }

  const zeilen = text.split('\n')
    .filter(z => /^\s*(?:[-*•]|\d+[.)])\s+/.test(z))
    .map(ausListenzeile);
  return sammle(zeilen);
}

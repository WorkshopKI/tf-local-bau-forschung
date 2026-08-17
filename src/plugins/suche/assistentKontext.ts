/**
 * Reine Helfer für den Kontext, den das Assistenten-Panel (Suche, Phase 4) an
 * den Chat anheftet: aus den obersten Suchtreffern wird ein Kontext-Block über
 * den bestehenden `extraContext`-Pfad des Chats gebaut (kein `setConversationFkz`
 * — das ist single-FKZ). Bewusst ohne React/IDB, damit unter `environment:'node'`
 * unit-testbar.
 *
 * **Wer auswählt, beschriftet auch** (v4.78). `waehleKontextTreffer` ist die EINE
 * Stelle, die entscheidet, wie viele Treffer mitfahren; Block und Chip lesen
 * beide ihr Ergebnis. Bis v4.77 schnitt der Block selbst auf acht, während der
 * Chip die Trefferzahl VOR dem Schnitt nannte — „Kontext: 558 Suchtreffer" über
 * einem Prompt mit achten. Der Schaden war nicht der Zähler: das Modell hielt die
 * acht für die Gesamtmenge und urteilte über sie („die übrigen Treffer enthalten
 * keine zentrale Normungs-Komponente" — gesagt über 550 Anträge, die es nie
 * gesehen hatte). Ein Auszug muss sich als Auszug zu erkennen geben, im Chip UND
 * im Prompt.
 */
import type { UnifiedSearchResult } from '@/core/types/search-result';
import { RELEVANZ_LABEL, TREFFERFELD_LABEL } from '@/core/services/search/trefferstelle';

/**
 * Wie viele Top-Treffer höchstens in den Kontext-Block wandern.
 *
 * Vierzig, nicht mehr acht: eine Frage wie „Welche Vorhaben drehen sich um X?"
 * ist eine Frage nach einer LISTE, und acht Zeilen sind dafür eine Stichprobe,
 * die sich als Antwort ausgibt.
 */
export const KONTEXT_MAX_TREFFER = 40;

/**
 * Zeichen-Deckel für den ganzen Block — der Wächter hinter dem Trefferdeckel.
 *
 * Gleiche Größenordnung wie `HISTORY_CHAR_BUDGET` (24 000) in
 * [conversation-context.ts](src/plugins/chat/conversation-context.ts), aus
 * demselben Grund: der Verlauf und dieser Block teilen sich dasselbe
 * Kontextfenster. Im Normalfall bindet der Trefferdeckel (40 × ~450 Zeichen ≈
 * 18 000), das Budget greift erst bei ungewöhnlich langen Titeln oder
 * Kurzbeschreibungen — und dann verschiebt es Chip und Prompt GEMEINSAM, weil
 * beide dieselbe Auswahl lesen.
 */
export const KONTEXT_CHAR_BUDGET = 24_000;

/** Zeichen-Deckel je Textauszug (Snippet, Kurzbeschreibung). Eine Zahl für
 *  beide — zwei Deckel für dieselbe Sache wären zwei Wahrheiten. */
const TEXT_MAX = 300;

function kuerze(text: string | undefined): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > TEXT_MAX ? `${t.slice(0, TEXT_MAX)}…` : t;
}

/**
 * Eine Trefferzeile, so wie sie im Prompt steht.
 *
 * Vier Angaben, jede aus einem Grund:
 *  - **Titel + FKZ** — die Identität, an der der Nutzer den Treffer wiederfindet.
 *  - **Snippet** — bei Anträgen Antragsteller · Akronym · Fördergeber, bei
 *    Dokumenten die Fundstelle.
 *  - **Relevanz + Fundstellen** — das Urteil der Suche im Klartext. Ohne sie
 *    musste das Modell aus dem Titel RATEN, welche Vorhaben die gefragten Themen
 *    wirklich führen; die Rangfolge weiß es bereits (`abdeckung`, siehe
 *    [trefferstelle.ts](src/core/services/search/trefferstelle.ts)).
 *  - **Kurzbeschreibung** — der Inhalt. Sie fehlte bis v4.78 vollständig, und
 *    genau das war der Grund, warum ein Testlauf eine Spalte „Kurzbeschreibung"
 *    ausgab, die er sich aus dem Titel zusammengereimt hatte.
 *
 * Die Deskriptoren stehen bewusst NICHT dabei: sie beantworteten dieselbe Frage
 * ein zweites Mal und kosteten bei vierzig Treffern das halbe Zeichen-Budget.
 */
function zeile(r: UnifiedSearchResult, i: number): string {
  const fkzTeil = r.fkz ? ` (${r.fkz})` : '';
  const teile: string[] = [`${i + 1}. ${r.title}${fkzTeil}`];

  const merkmale = [
    kuerze(r.snippet),
    r.relevanzStufe ? `Relevanz ${RELEVANZ_LABEL[r.relevanzStufe]}` : '',
    r.trefferfelder && r.trefferfelder.length > 0
      ? `gefunden in: ${r.trefferfelder.map(f => TREFFERFELD_LABEL[f]).join(', ')}`
      : '',
  ].filter(Boolean).join(' · ');
  if (merkmale) teile.push(merkmale);

  const inhalt = kuerze(r.kurzbeschreibung) || kuerze(r.textstelle?.text);
  if (inhalt) teile.push(inhalt);

  return teile.join('\n');
}

/**
 * Welche Treffer mitfahren — die Einzelquelle für Block UND Chip.
 *
 * Gemessen wird an der fertigen Zeile, nicht am Rohobjekt: sonst hielte das
 * Budget etwas anderes zurück, als der Prompt am Ende trägt. Der erste Treffer
 * fährt immer mit, auch wenn er allein das Budget sprengt — ein leerer Kontext
 * über einer Trefferliste wäre die schlechtere Auskunft.
 */
export function waehleKontextTreffer(
  results: readonly UnifiedSearchResult[],
  limit = KONTEXT_MAX_TREFFER,
  budget = KONTEXT_CHAR_BUDGET,
): UnifiedSearchResult[] {
  const out: UnifiedSearchResult[] = [];
  let zeichen = 0;
  for (const r of results) {
    if (out.length >= Math.max(0, limit)) break;
    const laenge = zeile(r, out.length).length;
    if (out.length > 0 && zeichen + laenge > budget) break;
    zeichen += laenge;
    out.push(r);
  }
  return out;
}

/**
 * Der Kontext-Block aus einer bereits getroffenen Auswahl.
 *
 * `gesamt` ist keine Zierde: der Kopf sagt dem Modell, dass es einen Auszug
 * liest und wie groß der Rest ist. Ohne diesen Satz beantwortet es „Welche
 * Vorhaben …?" so, als wäre die Liste vollständig — und begründet sogar, warum
 * die „übrigen" nicht passen.
 */
export function baueKontextBlock(
  gewaehlt: readonly UnifiedSearchResult[],
  gesamt: number,
): string {
  if (gewaehlt.length === 0) return '';
  const n = gewaehlt.length;
  const vollstaendig = n >= gesamt;
  const kopf = vollstaendig
    ? `Alle ${gesamt} Suchtreffer, nach Relevanz sortiert.`
    : `Die ${n} relevantesten von ${gesamt} Suchtreffern, nach Relevanz sortiert. `
      + `Die übrigen ${gesamt - n} liegen NICHT vor.`;
  const regel = vollstaendig
    ? 'Beziehe dich bei Bedarf auf diese Treffer.'
    : 'Beziehe dich bei Bedarf auf diese Treffer. Betrifft die Frage die '
      + `Gesamtmenge, sage ausdrücklich, dass dir nur diese ${n} vorliegen — und `
      + 'urteile nicht über die übrigen.';

  return [
    '\n\n--- Aktuelle Suchtreffer (Kontext) ---',
    kopf,
    ...gewaehlt.map((r, i) => zeile(r, i)),
    '--- Ende Suchtreffer ---',
    regel,
  ].join('\n\n');
}

/**
 * Baut den angehefteten Kontext-Block aus den obersten Suchtreffern.
 * Leeres Ergebnis → Leerstring (nichts anheften).
 */
export function buildTrefferKontext(
  results: readonly UnifiedSearchResult[],
  limit = KONTEXT_MAX_TREFFER,
): string {
  return baueKontextBlock(waehleKontextTreffer(results, limit), results.length);
}

/**
 * Der Hinweis, dass die Unterhaltung zu einer ANDEREN Suche gehört als die
 * Treffer, die gerade unter ihr liegen — oder `null`, wenn es nichts zu sagen
 * gibt.
 *
 * Steht hier und nicht im JSX, weil es eine Entscheidung mit vier Bedingungen
 * ist und keine Auszeichnung. Die Regel:
 *  - `threadQuery === null` → die Unterhaltung ist an keine Suche gebunden
 *    (nichts gesendet, oder aus dem Verlauf geholt — dort zu raten wäre
 *    schlimmer als zu schweigen);
 *  - keine Nachrichten → es gibt keinen Thread, den man einordnen müsste;
 *  - gleiche Anfrage → die Treffer sind noch die, über die gesprochen wurde.
 *
 * Verworfen wurde das automatische Löschen bei neuer Anfrage: die Stichwortsuche
 * läuft je Tastendruck (`wirksam` in `SuchSeite`), ein Reset daran nähme dem
 * Nutzer die Antwort weg, die er gerade liest.
 */
export function threadHinweis(
  threadQuery: string | null,
  contextQuery: string,
  hatNachrichten: boolean,
): string | null {
  if (threadQuery === null || !hatNachrichten) return null;
  if (threadQuery === contextQuery) return null;
  if (threadQuery === '') return 'Diese Unterhaltung entstand ohne Suchtreffer.';
  return `Diese Unterhaltung gehört zur Suche „${threadQuery}".`;
}

/**
 * Chip-Label über dem Thread. „Suchtreffer" ist im Deutschen numerus-invariant.
 *
 * Zwei Zahlen, weil der Chip sonst etwas verspricht, was der Prompt nicht hält.
 * `gesamt` hat einen Standardwert, damit der Aufrufer nicht versehentlich
 * dieselbe Zahl zweimal übergibt — wer nur eine kennt, meint eine vollständige
 * Liste.
 */
export function kontextChipLabel(verwendet: number, gesamt = verwendet): string {
  if (verwendet >= gesamt) return `Kontext: ${gesamt} Suchtreffer`;
  return `Kontext: ${verwendet} von ${gesamt} Treffern`;
}

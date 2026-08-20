/**
 * Deterministischer Leak-Check des Deep-Research-Prompts (Paket 5, DSGVO-Schicht 2).
 *
 * Der DR-Prompt wird intern aus dem Korpus erzeugt, sein Output aber vom Prüfer per
 * Zwischenablage in EXTERNE Dienste getragen. Vor dem Kopieren prüft der Code den
 * erzeugten Prompt case-insensitiv gegen die bekannten Stammdaten (Antragsteller-Name
 * inkl. Namensbestandteile ≥ 4 Zeichen, FKZ, Aktenzeichen/TV-Az, Akronym, Titel,
 * Personennamen aus dem Steckbrief). Treffer → der Baustein degradiert, der Prompt
 * wird NICHT zum Kopieren angeboten.
 *
 * Bewusst KEIN Fuzzy-Matching — nur exakte Substring-Treffer der bekannten Werte.
 * Ehrlich bleiben, nicht raten: ein verfehlter Leak ist die Gefahr, ein Fehlalarm
 * nur unbequem (Degradation ist DSGVO-sicher). Rein/Node-testbar.
 */

export interface BekannteStammwerte {
  antragsteller?: string | null;
  foerderkennzeichen?: string | null;
  akronym?: string | null;
  titel?: string | null;
  /** Verbund-Az + alle TV-Aktenzeichen (identifizierende IDs). */
  aktenzeichen?: string[];
  /** Personennamen (Steckbrief) + weitere Organisationsnamen (TV-Antragsteller) —
   *  werden wie Namen in Bestandteile ≥ 4 Zeichen zerlegt. */
  personennamen?: string[];
  /** Weitere identifizierende Titel (z. B. TV-Titel) — nur als voller String geprüft. */
  weitereTitel?: string[];
}

/** Nur diese wenigen Tokens sind SO generisch, dass sie fast jeden Prompt degradieren
 *  würden (Rechtsformen/Funktionswörter) — bewusst knapp, um keine echten Leaks zu
 *  überstoplisten. Volle Namensstrings werden IMMER geprüft, unabhängig hiervon. */
const GENERISCHE_TOKEN = new Set([
  'gmbh', 'ggmbh', 'mbh', 'gesellschaft', 'kgaa', 'gbr', 'ohg', 'partg',
]);

const MIN_TOKEN_LEN = 4;

/** Zerlegt einen Namen in prüfbare Bestandteile ≥ 4 Zeichen (ohne generische Tokens). */
function nameBestandteile(name: string): string[] {
  return name
    .split(/[\s,./()\-–—]+/)
    .map(t => t.trim())
    .filter(t => t.length >= MIN_TOKEN_LEN && !GENERISCHE_TOKEN.has(t.toLowerCase()));
}

/** Sammelt alle identifizierenden Werte (volle Strings + Namensbestandteile), dedupliziert. */
export function sammleIdentifizierendeWerte(werte: BekannteStammwerte): string[] {
  const raus = new Set<string>();
  const addFull = (v: string | null | undefined): void => {
    const t = (v ?? '').trim();
    if (t.length >= MIN_TOKEN_LEN) raus.add(t);
  };
  const addName = (v: string | null | undefined): void => {
    const t = (v ?? '').trim();
    addFull(t);
    for (const teil of nameBestandteile(t)) raus.add(teil);
  };

  addFull(werte.foerderkennzeichen);
  addFull(werte.akronym);
  addFull(werte.titel);
  for (const az of werte.aktenzeichen ?? []) addFull(az);
  for (const t of werte.weitereTitel ?? []) addFull(t);
  addName(werte.antragsteller);
  for (const p of werte.personennamen ?? []) addName(p);
  return [...raus];
}

/**
 * Prüft den erzeugten DR-Prompt gegen die bekannten Stammwerte. Rückgabe = die
 * gefundenen (identifizierenden) Werte — exakte, case-insensitive Substring-Treffer.
 * Leer = sauber.
 *
 * **`vorlage`**: der feste Rahmen-Text des Auftrags, ohne jede eingesetzte
 * Angabe. Bestandteile eines Namens, die schon DORT stehen, sind kein Leak —
 * sie stammen aus dem eigenen Code, nicht aus den Antragsdaten.
 *
 * Ohne diese Gegenprobe schlug der Wächter bei jedem Antragsteller an, dessen
 * Name ein Wort der Vorlage trägt: „Technik", „Technologie", „Forschung",
 * „Werkzeug", „Produkt", „Markt", „Oder". Am echten Haupt-Export sind das
 * gemessen 532 von 4 296 Verbünden (12,4 %) — „ESDA Technologie GmbH",
 * „Hochschule Aalen - Technik, Wirtschaft und Gesundheit". Für sie konnte KEIN
 * erzeugter Auftrag den Check je passieren: die Karte zeigte dauerhaft die
 * gelbe Warnung, die Kopier-Knöpfe erschienen nie, und der Retry kostete jedes
 * Mal einen zweiten LLM-Lauf (v4.124).
 *
 * Der volle Namensstring wird weiterhin IMMER geprüft — er steht nie in der
 * Vorlage, und genau ihn soll der Wächter fangen.
 */
export function findeLeaks(
  prompt: string, werte: BekannteStammwerte, vorlage?: string,
): string[] {
  const hay = prompt.toLowerCase();
  const rahmen = (vorlage ?? '').toLowerCase();
  const vollstaendige = new Set(
    [werte.antragsteller, ...(werte.personennamen ?? [])]
      .map(v => (v ?? '').trim().toLowerCase())
      .filter(v => v.length >= MIN_TOKEN_LEN),
  );
  const treffer: string[] = [];
  for (const wert of sammleIdentifizierendeWerte(werte)) {
    const w = wert.toLowerCase();
    if (!hay.includes(w)) continue;
    // Bestandteil, der schon im Rahmen steht ⇒ aus der Vorlage, kein Leak.
    // Volle Namen bleiben ausgenommen.
    if (rahmen && !vollstaendige.has(w) && rahmen.includes(w)) continue;
    treffer.push(wert);
  }
  return treffer;
}

/**
 * Geteilte Bausteine der Gutachten-Seeds.
 *
 * Der Kurzfassungs-Skill A und die Abschnitts-Skills B–G lagen bis zum
 * Konsolidierungs-Pass gemeinsam in `seed.ts` und teilten sich diese Helfer
 * beiläufig. Beim Aufteilen in `gutachten-kurzfassung.seed.ts` und
 * `gutachten-bg.seed.ts` brauchen sie eine gemeinsame Heimat — sonst entstünde
 * entweder eine Kopie oder ein Modul-Zyklus zwischen den beiden Seed-Dateien.
 *
 * ACHTUNG: die Inhalte hier sind prod-wirksam. Die Skills liegen live auf dem
 * geteilten Share, und mehrere Migrationen vergleichen den Share-Stand BYTE-GENAU
 * gegen die hier gebauten Templates, um kuratierte Edits zu schützen. Ein
 * geändertes Leerzeichen genügt, damit eine Migration einen kuratierten Skill für
 * unberührt hält (oder umgekehrt).
 */
import { GRUNDSATZ_REGELN } from './grundsatz';
import type { QualitaetsRegel } from './types';

/** Fester Seed-Zeitstempel — deterministisch (kein `new Date()` zur Seed-Zeit). */
export const SEED_TS = '2026-06-11T00:00:00.000Z';

/** Kurzform für einen Bibliotheks-Regel-Record mit Seed-Zeitstempel. */
export function regel(
  id: string,
  name: string,
  typ: string,
  params: Record<string, unknown>,
  schweregrad: 'fehler' | 'hinweis',
): QualitaetsRegel {
  return { id, name, typ, params, schweregrad, aktiv: true, erstellt_am: SEED_TS, geaendert_am: SEED_TS };
}

/** Basis-Beschreibung des `### Quellenanalyse`-Blocks (A + B teilen sie wortgleich). */
const QUELLENANALYSE_KONTRAKT =
  'Gruppierte wörtliche Kurz-Zitate aus der VB, die du als Beleg nutzt — je mit knapper Fundstellen-Angabe.';

/**
 * Zusatz-Instruktion (Journey-Paket 4): jede Zitat-Zeile mit der gestützten
 * Satz-Referenz abschließen. ZURÜCKGEBAUT (2026-07): die live A/B-Skills tragen den
 * Kontrakt NICHT mehr (`buildKurzfassungPrompt(false)`), weil das interne Modell damit
 * in einen Reasoning-Loop lief. Der `true`-Zweig bleibt NUR erhalten, damit die
 * Rückbau-Migration (`applyBelegKontraktRevert`) das Kontrakt-Template byte-genau
 * erkennen und auf den Alt-Stand zurücksetzen kann.
 */
const BELEG_KONTRAKT_SUFFIX =
  ' Schließe jede Zitat-Zeile mit einem Verweis auf die gestützten Sätze deines finalen Textes ab: '
  + '„ → stützt Satz N" (N = 1-basierte Satznummer; mehrere Sätze „→ stützt Sätze N, M"). '
  // eslint-disable-next-line max-len -- Alt-Stand muss byte-identisch bleiben
  + 'Beispiel: „…wörtliches Zitat…" (Abschn. 1.1) → stützt Satz 2.'; // allow-elidierte-wortlaut-vorgabe: eingefrorener Alt-Stand des zurückgebauten Beleg-Kontrakts (nur Migrations-Erkennung, kein Live-Prompt)

/** Quellenanalyse-Kontrakt-Zeile, optional mit Beleg→Satz-Zusatz (opt-in pro Skill). */
export function quellenanalyseKontrakt(belegKontrakt: boolean): string {
  return belegKontrakt ? QUELLENANALYSE_KONTRAKT + BELEG_KONTRAKT_SUFFIX : QUELLENANALYSE_KONTRAKT;
}

/** Baut ein Abschnitts-Template (gemeinsame Hülle, abschnittsspezifischer Kontrakt). */
export function abschnittTemplate(opts: {
  name: string;
  aufgabe: string;
  formatRegeln: readonly string[];
  finalText: string;
  /**
   * Optionaler Entwurfs-Abschnitt (Zwischenschritt vor dem finalen Text). Ist er gesetzt,
   * fordert das Template DREI Ausgabe-Abschnitte (Quellenanalyse / Entwurf / Finaler Text,
   * wie der Kurzfassungs-Skill A). Undefined reproduziert das Template BYTE-IDENTISCH zur
   * bisherigen 2-Abschnitt-Form (kritisch für die B-Rollout-Migration + grundsatz.test).
   */
  entwurf?: string;
  /** Optionales Stilbeispiel (nur Schreibstil; wird klar markiert angehängt). */
  stilbeispiel?: string;
  /**
   * Journey-Paket 4: Zitat→Satz-Referenz-Zusatz im Quellenanalyse-Kontrakt (opt-in
   * pro Abschnitt, aktuell nur B). `false`/undefined reproduziert das Template
   * BYTE-IDENTISCH zum Vor-Paket-4-Stand (kritisch für die Rollout-Migration).
   */
  belegKontrakt?: boolean;
  /**
   * Optionaler Pflicht-Anfang: der Wortlaut, mit dem der finale Text beginnen MUSS.
   *
   * Wird als eigener, durch Zeilenumbrüche begrenzter Block gerendert — **nie** in
   * Anführungszeichen, **nie** mit Auslassungszeichen. Der Vorgänger-Wortlaut
   * verlangte eine EXAKTE Wiedergabe als zitierte Inline-Regel — von einem Wortlaut,
   * der mitten im Satz endet und dessen Ende zusätzlich von einem Auslassungszeichen
   * innerhalb der Anführungszeichen verdeckt wurde. Damit ist die Anweisung nicht
   * erfüllbar. Qwen drehte darauf in eine Reasoning-Schleife („wo endet der String?")
   * bis das Ausgabebudget aufgebraucht war — sichtbarer Abbruch statt Antwort. Der Block
   * unten löst genau diese Mehrdeutigkeit explizit auf.
   *
   * `undefined` reproduziert das Template BYTE-IDENTISCH zur Form ohne Block (kritisch
   * für die Migrations-Erkennung der Abschnitte B–F).
   */
  pflichtAnfang?: string;
}): string {
  const extra = opts.formatRegeln.map(r => `- ${r}`).join('\n');
  const pflicht = opts.pflichtAnfang
    ? `\n\n## Pflicht-Anfang des finalen Textes\nDer finale Text beginnt mit genau diesem Wortlaut:\n\n`
      + `${opts.pflichtAnfang}\n\n`
      + 'Dieser Wortlaut endet absichtlich mitten im Satz. Übernimm ihn unverändert und führe ihn '
      + 'zu einem vollständigen Satz fort.'
    : '';
  const stil = opts.stilbeispiel
    ? `\n\n## Stilbeispiel (nur Schreibstil — Inhalt stammt aus einem anderen Antrag, NICHT übernehmen)\n${opts.stilbeispiel}`
    : '';
  const anzahlWort = opts.entwurf ? 'drei' : 'zwei';
  const entwurfBlock = opts.entwurf ? `\n\n### Entwurf\n${opts.entwurf}` : '';
  return `Erstelle den Abschnitt **${opts.name}** eines ZIM-Gutachtens aus der folgenden Vorhabensbeschreibung (VB).

## Stammdaten des Antrags
{{stammdaten}}

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

## Bereits freigegebene frühere Abschnitte (Konsistenz-Referenz — Terminologie und keine Widersprüche)
{{vorherigeAbschnitte}}

## Aufgabe & Kontrakt
${opts.aufgabe}

${GRUNDSATZ_REGELN}
${extra}${pflicht}

## Ausgabeformat (genau diese ${anzahlWort} Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
${quellenanalyseKontrakt(opts.belegKontrakt ?? false)}${entwurfBlock}

### Finaler Text
${opts.finalText}${stil}`;
}

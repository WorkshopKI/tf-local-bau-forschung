/**
 * GA-QS-Regelsatz (Artefakt-Engine) — die 5 Prüfabschnitte aus `Prompt-QS-v2.md`
 * als `QualitaetsRegel` mit `pruefart`, gebunden an `artefaktTyp='ga'`
 * (`qsRegelnFuerArtefakt('ga')`). Ergänzt die generativen GA-Regeln um eine
 * QS-Sicht; die fachlichen Dimensionen laufen über den beratenden LLM-QS-Skill
 * (`qs-basis`, deterministisch übersprungen), die Formalia-Dimension ist ein
 * deterministischer Muster-Check.
 *
 * Die **Abschnittszuordnung** (intern A–G ↔ tatsächliche Gutachten-Überschriften)
 * wird wortgetreu aus QS v2 übernommen — ohne sie meldet die Vollständigkeits-QS
 * Phantom-Lücken, weil die Überschriften im Gutachten von „A"/„B" abweichen.
 */
import type { QualitaetsRegel, Pruefart } from './types';

const GA_QS_TS = '2026-06-22T00:00:00.000Z';

/** Eine Zeile der Abschnittszuordnungstabelle (QS v2). */
export interface AbschnittsZuordnung {
  /** Interne Kennung A–G. */
  intern: string;
  /** Tatsächliche Überschrift im fertigen Gutachten. */
  ueberschrift: string;
  /** Erwarteter Inhalt des Abschnitts. */
  inhalt: string;
}

/**
 * Abschnittszuordnung A–G (wortgetreu aus `Prompt-QS-v2.md`). Die QS nutzt die
 * `ueberschrift`, NICHT die interne Kennung — so wird kein Fehler gemeldet, wenn
 * das Gutachten z.B. „6.1 Potentiale der Antragssteller" statt „E" überschreibt.
 */
export const ABSCHNITTSZUORDNUNG: readonly AbschnittsZuordnung[] = [
  { intern: 'A', ueberschrift: 'Kurzfassung der Projektbeschreibung', inhalt: 'Problem, Ziel, Ansatz, Ergebnis' },
  { intern: 'B', ueberschrift: 'Innovationsgehalt, Chancen und Risiken', inhalt: 'Hintergrund, Stand der Technik, Lösungsweg' },
  { intern: 'C', ueberschrift: 'Herausforderungen und Technische Risiken', inhalt: 'Technische Risiken' },
  { intern: 'D', ueberschrift: 'Marktchancen', inhalt: 'Märkte, Zielgruppen, Wettbewerb' },
  { intern: 'E', ueberschrift: '6.1 Potentiale der Antragssteller', inhalt: 'Unternehmensprofil pro Partner (ggf. Unterabschnitte)' },
  { intern: 'F', ueberschrift: '6.2 Ergebnisverwertung und Einfluss auf die Entwicklung der Unternehmen', inhalt: 'Verwertungsplan' },
  { intern: 'G', ueberschrift: '6.4 Auswirkungen des FuE-Projektes auf die Kompetenz der Unternehmen', inhalt: 'Technologiekompetenz' },
];

/** GA-QS-Regel mit explizit gesetzter `pruefart`. */
function gaQsRegel(
  id: string, name: string, typ: string, params: Record<string, unknown>,
  schweregrad: 'fehler' | 'hinweis', pruefart: Pruefart,
): QualitaetsRegel {
  return { id, name, typ, params, schweregrad, pruefart, aktiv: true, erstellt_am: GA_QS_TS, geaendert_am: GA_QS_TS };
}

/**
 * GA-QS-Regelsatz (5 Prüfabschnitte aus QS v2):
 *  - Vollständigkeit → **administrativ** (sind A–G abgedeckt?),
 *  - Quellenabgleich/Halluzination → **fachlich** (LLM-QS),
 *  - Konsistenz → **fachlich** (LLM-QS),
 *  - Formalia → **textlich** (deterministischer Muster-Check: aktive Gutachtensprache),
 *  - Finales Review → **administrativ** (Gesamtbewertung/Aggregation).
 * Advisory-Typen (`ga_qs_*`) sind der deterministischen Engine bewusst unbekannt →
 * sie werden übersprungen und über den beratenden LLM-QS-Pfad (`qs-basis`) bewertet.
 */
export const GA_QS_REGELN: QualitaetsRegel[] = [
  gaQsRegel('ga-qs-vollstaendigkeit', 'Vollständigkeit (A–G abgedeckt)', 'ga_qs_vollstaendigkeit', {}, 'hinweis', 'administrativ'),
  gaQsRegel('ga-qs-quellenabgleich', 'Quellenabgleich (keine Halluzination)', 'ga_qs_quellenabgleich', {}, 'fehler', 'fachlich'),
  gaQsRegel('ga-qs-konsistenz', 'Konsistenz (Begriffe, Partner, Kennzahlen)', 'ga_qs_konsistenz', {}, 'hinweis', 'fachlich'),
  gaQsRegel(
    'ga-qs-formalia', 'Formalia (aktive Gutachtensprache)', 'verbotenes_muster',
    {
      muster: [
        'Der Antragsteller plant',
        'Der Antragsteller (?:beabsichtigt|möchte|will|wird|hat)',
        'Der Antrag\\b',
        '\\bAP\\s?\\d+',
      ],
      istRegex: true,
    },
    'hinweis', 'textlich',
  ),
  gaQsRegel('ga-qs-finales-review', 'Finales Review (Gesamtbewertung)', 'ga_qs_finales_review', {}, 'hinweis', 'administrativ'),
];

/** Set aller GA-QS-Regel-IDs (Bindung an `artefaktTyp='ga'`). */
export const GA_QS_REGEL_IDS: ReadonlySet<string> = new Set(GA_QS_REGELN.map(r => r.id));

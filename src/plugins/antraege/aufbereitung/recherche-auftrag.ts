/**
 * Die feste Vorlage des Deep-Research-Auftrags (Paket 5, Phase 1). Der gesamte
 * Auftragstext steht HIER im Code; variabel sind nur die Stichworte
 * (`recherche-stichworte.ts`), die das interne Modell liefert.
 *
 * Warum eine Vorlage statt einer Modell-Formulierung: der externe Dienst soll Stand der
 * Technik, Markt und Wettbewerb **unabhängig** recherchieren. Formulierte das Modell den
 * Auftrag frei, schrieb es die Antworten des Antrags hinein (identifizierte Lücken,
 * Marktzahlen, Wettbewerberliste, Zielkennwerte) — der externe Report bestätigte dann nur
 * noch den Antrag. Die Vorlage dreht das um: sie **fragt** nach Kennwerten und Lücken,
 * statt sie vorzugeben. Zugleich ist „kein Behördenkontext, keine identifizierenden
 * Angaben" damit eine Code-Eigenschaft und keine Prompt-Bitte (Muster der NF-Bausteine,
 * Pitfall #34: kuratierter Text wird gefüllt, nicht umformuliert).
 *
 * Rein/Node-testbar (Muster `baueMarktzugangText`); fehlende Stichworte entfallen
 * ersatzlos — nie geraten, nie Platzhalter.
 */
import { drSchemaBlockBeschreibung } from './recherche-schema';
import type { RechercheStichworte } from './recherche-stichworte';

/** Eine Stichwort-Zeile — leer/keine Werte → Zeile entfällt komplett. */
function zeile(label: string, werte: string | string[]): string | null {
  const text = Array.isArray(werte) ? werte.join(', ') : werte;
  return text.trim() ? `- ${label}: ${text.trim()}` : null;
}

const TEIL_1 = [
  '## Teil 1 — Stand der Technik',
  '1. Welche Verfahren, Technologien und Werkzeuge sind in diesem Feld heute etabliert? Ordne sie nach Ansatz.',
  '2. Woran arbeitet die aktuelle Forschung? Nenne die wichtigsten Richtungen der letzten Jahre mit Publikationen.',
  '3. Welche Kennwerte beschreiben die Leistungsfähigkeit heutiger Lösungen, und welche Werte gelten als Stand der Technik? Nenne konkrete Zahlen mit Quelle und Stichjahr.',
  '4. Welche Grenzen, ungelösten Probleme und offenen Fragen benennt die Fachliteratur selbst?',
  '5. Welche Normen, Standards oder Schnittstellen sind einschlägig?',
];

const TEIL_2 = [
  '## Teil 2 — Markt und Wettbewerb',
  '6. Wie groß ist der Markt und wie entwickelt er sich? Nenne Marktvolumen, Wachstumsrate, Stichjahr, Region und Quelle.',
  '7. Welche Anbieter und Wettbewerber sind aktiv? Unterscheide etablierte Anbieter, junge Unternehmen und offene Projekte.',
  '8. Welche vergleichbaren Produkte oder Lösungen sind verfügbar, und wodurch unterscheiden sie sich?',
  '9. Welche Trends, Treiber und Hemmnisse prägen das Feld?',
];

const VORGABEN = [
  '## Vorgaben',
  '- Recherchiere jede Frage unabhängig. Die Stichworte grenzen nur das Suchfeld ein; leite daraus nichts ab, was du nicht belegen kannst.',
  '- Belege jede Aussage mit einer Quelle: vollständige URL, Datum soweit auffindbar.',
  '- Bevorzuge Primärquellen — Fachpublikationen, Normen, Hersteller- und Produktangaben, Marktstudien.',
  '- Findest du zu einem Punkt nichts Belastbares, schreibe das ausdrücklich, statt zu schätzen.',
  '- Antworte auf Deutsch; englischsprachige Quellen sind ausdrücklich erwünscht.',
];

/**
 * Baut den vollständigen Deep-Research-Auftrag aus den Stichworten. Deterministisch:
 * gleiche Stichworte = gleicher Text (der Auftrag wird deshalb NICHT gecacht, sondern
 * beim Rendern gebaut — eine Vorlagen-Änderung wirkt sofort auf bestehende Läufe).
 */
/**
 * Der Auftrags-Rahmen OHNE jede eingesetzte Angabe — die Gegenprobe des
 * Leak-Wächters (`findeLeaks`). Träge gebaut und gemerkt: der Text ist konstant,
 * und ein Modul-Init zur Ladezeit hinge an der Import-Reihenfolge.
 */
let rahmenCache: string | null = null;
export function auftragsRahmen(): string {
  rahmenCache ??= baueDeepResearchAuftrag({
    themenfeld: '', anwendungsdomaene: '', technologien: [],
    leistungsdimensionen: [], marktsegmente: [], suchbegriffeEn: [],
  });
  return rahmenCache;
}

export function baueDeepResearchAuftrag(s: RechercheStichworte): string {
  const thema = s.themenfeld.trim();
  const stichwortZeilen = [
    zeile('Technologiefeld', thema),
    zeile('Anwendungsdomäne', s.anwendungsdomaene),
    zeile('Verfahren und Technologien', s.technologien),
    zeile('Relevante Leistungsdimensionen', s.leistungsdimensionen),
    zeile('Marktsegmente', s.marktsegmente),
    zeile('Englische Suchbegriffe', s.suchbegriffeEn),
  ].filter((z): z is string => z !== null);

  const bloecke: string[][] = [
    [thema
      ? `Recherche-Auftrag: Stand der Technik sowie Markt und Wettbewerb im Themenfeld „${thema}".`
      : 'Recherche-Auftrag: Stand der Technik sowie Markt und Wettbewerb im unten umrissenen Themenfeld.'],
    ...(stichwortZeilen.length ? [[
      '## Suchfeld',
      'Die folgenden Stichworte grenzen das Suchfeld ein. Sie sind keine zu bestätigenden Thesen — prüfe ergebnisoffen.',
      ...stichwortZeilen,
    ]] : []),
    TEIL_1,
    TEIL_2,
    VORGABEN,
    [
      '## Abschluss',
      'Füge am Ende deines Reports zusätzlich diesen JSON-Block an:',
      drSchemaBlockBeschreibung(false),
    ],
  ];

  return bloecke.map(b => b.join('\n')).join('\n\n');
}

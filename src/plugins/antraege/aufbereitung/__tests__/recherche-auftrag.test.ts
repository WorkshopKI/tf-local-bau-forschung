import { describe, it, expect } from 'vitest';
import { baueDeepResearchAuftrag } from '../recherche-auftrag';
import { LEERE_STICHWORTE, type RechercheStichworte } from '../recherche-stichworte';

const voll: RechercheStichworte = {
  themenfeld: 'Agentenbasierte Organisationssimulation',
  anwendungsdomaene: 'Produzierender Mittelstand',
  technologien: ['Multi-Agenten-Systeme', 'Sprachmodell-Agenten', 'Planspiele'],
  leistungsdimensionen: ['Latenz', 'Skalierbarkeit der Agentenzahl'],
  marktsegmente: ['Change-Management-Beratung', 'Simulationssoftware'],
  suchbegriffeEn: ['agent-based simulation', 'LLM agents'],
};

describe('baueDeepResearchAuftrag', () => {
  it('baut den vollständigen Auftrag aus der Vorlage', () => {
    expect(baueDeepResearchAuftrag(voll)).toMatchInlineSnapshot(`
      "Recherche-Auftrag: Stand der Technik sowie Markt und Wettbewerb im Themenfeld „Agentenbasierte Organisationssimulation".

      ## Suchfeld
      Die folgenden Stichworte grenzen das Suchfeld ein. Sie sind keine zu bestätigenden Thesen — prüfe ergebnisoffen.
      - Technologiefeld: Agentenbasierte Organisationssimulation
      - Anwendungsdomäne: Produzierender Mittelstand
      - Verfahren und Technologien: Multi-Agenten-Systeme, Sprachmodell-Agenten, Planspiele
      - Relevante Leistungsdimensionen: Latenz, Skalierbarkeit der Agentenzahl
      - Marktsegmente: Change-Management-Beratung, Simulationssoftware
      - Englische Suchbegriffe: agent-based simulation, LLM agents

      ## Teil 1 — Stand der Technik
      1. Welche Verfahren, Technologien und Werkzeuge sind in diesem Feld heute etabliert? Ordne sie nach Ansatz.
      2. Woran arbeitet die aktuelle Forschung? Nenne die wichtigsten Richtungen der letzten Jahre mit Publikationen.
      3. Welche Kennwerte beschreiben die Leistungsfähigkeit heutiger Lösungen, und welche Werte gelten als Stand der Technik? Nenne konkrete Zahlen mit Quelle und Stichjahr.
      4. Welche Grenzen, ungelösten Probleme und offenen Fragen benennt die Fachliteratur selbst?
      5. Welche Normen, Standards oder Schnittstellen sind einschlägig?

      ## Teil 2 — Markt und Wettbewerb
      6. Wie groß ist der Markt und wie entwickelt er sich? Nenne Marktvolumen, Wachstumsrate, Stichjahr, Region und Quelle.
      7. Welche Anbieter und Wettbewerber sind aktiv? Unterscheide etablierte Anbieter, junge Unternehmen und offene Projekte.
      8. Welche vergleichbaren Produkte oder Lösungen sind verfügbar, und wodurch unterscheiden sie sich?
      9. Welche Trends, Treiber und Hemmnisse prägen das Feld?

      ## Vorgaben
      - Recherchiere jede Frage unabhängig. Die Stichworte grenzen nur das Suchfeld ein; leite daraus nichts ab, was du nicht belegen kannst.
      - Belege jede Aussage mit einer Quelle: vollständige URL, Datum soweit auffindbar.
      - Bevorzuge Primärquellen — Fachpublikationen, Normen, Hersteller- und Produktangaben, Marktstudien.
      - Findest du zu einem Punkt nichts Belastbares, schreibe das ausdrücklich, statt zu schätzen.
      - Antworte auf Deutsch; englischsprachige Quellen sind ausdrücklich erwünscht.

      ## Abschluss
      Füge am Ende deines Reports zusätzlich diesen JSON-Block an:
      (JSON-Block, beginnend mit einer Codefence-Zeile \`\`\`json)
      {
      "schemaVersion": 1,
      "quellen": [{ "url": "<vollstaendige URL>", "datum": "<YYYY-MM-DD, leer wenn unbekannt>" }],
      "identifikation": "<welche Firma / welche Produkte wurden untersucht, hoechstens 20 Woerter>",
      "aussagen": [{ "kategorie": "<eine der Kategorien unten>", "text": "<eine belegte Aussage>", "quellenUrls": ["<URL aus quellen>"] }]
      }
      (Ende des Codeblocks)
      Erlaubte Werte fuer "kategorie" (genau einer je Aussage): zielmarkt, wettbewerb, verwertungsweg, zeithorizont, umsatz, sdt.
      Die spitzen Klammern sind Feld-Beschreibungen, keine Werte.
      Jede Quelle braucht eine URL; das Datum nur, soweit auffindbar. Jede Aussage braucht eine Kategorie und mindestens eine Quellen-URL. Gibt es zu einem Feld nichts, gib eine leere Liste bzw. einen leeren String zurueck."
    `);
  });

  it('nennt keinen Behördenkontext (der Auftrag geht nach außen)', () => {
    const text = baueDeepResearchAuftrag(voll).toLowerCase();
    for (const wort of ['förderantrag', 'foerderantrag', 'prüfer', 'gutachten', 'zim', 'fördermittel', 'antragsteller']) {
      expect(text, wort).not.toContain(wort);
    }
  });

  it('fragt nach Kennwerten und Lücken, statt sie vorzugeben', () => {
    const text = baueDeepResearchAuftrag(voll);
    expect(text).toContain('welche Werte gelten als Stand der Technik');
    expect(text).toContain('Grenzen, ungelösten Probleme und offenen Fragen benennt die Fachliteratur');
  });

  it('lässt fehlende Stichwort-Felder ersatzlos entfallen (kein Platzhalter)', () => {
    const text = baueDeepResearchAuftrag({
      ...LEERE_STICHWORTE, themenfeld: 'Sensorik', technologien: ['MEMS'],
    });
    expect(text).toContain('- Verfahren und Technologien: MEMS');
    expect(text).not.toContain('Anwendungsdomäne');
    expect(text).not.toContain('Marktsegmente:');
    expect(text).not.toMatch(/\n\n\n/);
  });

  it('kommt ohne jedes Stichwort aus (Kopf ohne Themenfeld, kein Suchfeld-Block)', () => {
    const text = baueDeepResearchAuftrag(LEERE_STICHWORTE);
    expect(text).toContain('im unten umrissenen Themenfeld');
    expect(text).not.toContain('## Suchfeld');
    expect(text).toContain('## Teil 1 — Stand der Technik');
  });
});

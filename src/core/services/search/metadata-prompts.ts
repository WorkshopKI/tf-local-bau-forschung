/** Prompt-Templates und JSON-Schema fuer die LLM-basierte Metadata-Extraktion. */

export const METADATA_SYSTEM_PROMPT = 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.';

export const METADATA_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'document_metadata',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        doc_type: {
          type: 'string',
          enum: [
            'Bauantrag', 'Foerderantrag', 'Gutachten', 'Stellungnahme',
            'Protokoll', 'Nachforderung', 'Formular', 'Statik',
            'Brandschutzkonzept', 'Schallschutznachweis', 'Energienachweis',
            'Energieberatungsbericht', 'Genehmigung', 'Bescheid', 'Bericht',
            'Zwischenbericht', 'Review', 'Ethikantrag', 'Datenschutz',
            'Compliance', 'Sonstiges',
          ],
        },
        title: { type: 'string' },
        date: { type: 'string' },
        organizations: { type: 'array', items: { type: 'string' } },
        topic_tags: { type: 'array', items: { type: 'string' } },
        micro_summary: { type: 'string' },
        macro_summary: { type: 'string' },
        language: { type: 'string' },
      },
      required: [
        'doc_type', 'title', 'date', 'organizations',
        'topic_tags', 'micro_summary', 'macro_summary', 'language',
      ],
      additionalProperties: false,
    },
  },
};

export function buildExtractionPrompt(text: string): string {
  return `Extrahiere Metadaten aus diesem deutschen Verwaltungsdokument.

REGELN:
- Antworte NUR mit einem JSON-Objekt
- micro_summary: EIN eigener Satz der den Inhalt beschreibt. NICHT den Text kopieren!
- macro_summary: 3-5 eigene Saetze. NICHT den Text kopieren!
- topic_tags: IMMER 3-5 deutsche Schlagwoerter
- doc_type: Waehle den passendsten Typ
- organizations: Alle genannten Behoerden, Firmen, Institute

JSON-Format:
{
  "doc_type": "Bauantrag|Foerderantrag|Gutachten|Stellungnahme|Protokoll|Nachforderung|Formular|Statik|Brandschutzkonzept|Schallschutznachweis|Energienachweis|Zwischenbericht|Review|Ethikantrag|Datenschutz|Compliance|Sonstiges",
  "title": "Kurzer beschreibender Titel",
  "date": "YYYY-MM-DD oder null",
  "organizations": ["Org1", "Org2"],
  "topic_tags": ["Tag1", "Tag2", "Tag3"],
  "micro_summary": "Ein Satz der den Dokumentinhalt beschreibt.",
  "macro_summary": "Drei bis fuenf Saetze die den Inhalt zusammenfassen.",
  "language": "de"
}

DOKUMENT:
${text}`;
}

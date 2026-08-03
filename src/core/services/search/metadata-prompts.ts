/** Prompt-Templates und JSON-Schema fuer die LLM-basierte Metadata-Extraktion. */

export const METADATA_SYSTEM_PROMPT = 'Du bist ein Metadaten-Extraktor fuer deutsche Verwaltungsdokumente. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, keine Erklaerung, keine Backticks, kein Denkprozess.';

/**
 * DIE Quelle der erlaubten `doc_type`-Werte — Schema-Enum UND Prompt-Text leiten sich
 * daraus ab. Vorher standen sie doppelt: das Enum fuehrte 21 Werte, die Prompt-Zeile
 * nur 16 (es fehlten Energieberatungsbericht/Genehmigung/Bescheid/Bericht). Das Modell
 * bekam damit ein engeres Vokabular gezeigt, als das Schema zuliess.
 */
export const METADATA_DOC_TYPES = [
  'Foerderantrag', 'Gutachten', 'Stellungnahme',
  'Protokoll', 'Nachforderung', 'Formular', 'Statik',
  'Brandschutzkonzept', 'Schallschutznachweis', 'Energienachweis',
  'Energieberatungsbericht', 'Genehmigung', 'Bescheid', 'Bericht',
  'Zwischenbericht', 'Review', 'Ethikantrag', 'Datenschutz',
  'Compliance', 'Sonstiges',
] as const;

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
          enum: [...METADATA_DOC_TYPES],
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
- doc_type: Waehle GENAU EINEN dieser Werte: ${METADATA_DOC_TYPES.join(', ')}
- organizations: Alle genannten Behoerden, Firmen, Institute. Keine genannt? Leere Liste.
- date: leerer String, wenn im Dokument kein Datum steht (niemals null)

JSON-Format:
{
  "doc_type": "einer der oben genannten Werte",
  "title": "Kurzer beschreibender Titel",
  "date": "YYYY-MM-DD, oder leerer String wenn kein Datum erkennbar",
  "organizations": ["Org1", "Org2"],
  "topic_tags": ["Tag1", "Tag2", "Tag3"],
  "micro_summary": "Ein Satz der den Dokumentinhalt beschreibt.",
  "macro_summary": "Drei bis fuenf Saetze die den Inhalt zusammenfassen.",
  "language": "de"
}

DOKUMENT:
${text}`;
}

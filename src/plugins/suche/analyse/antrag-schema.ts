/**
 * Antrag-Schema fuer die KI-Analyse-Pipeline.
 *
 * Kuratierte Liste von 18 Feldern die das LLM in Stufe 1 (Query Understanding)
 * kennen muss, um zu wissen WAS filterbar ist. Wird zur Laufzeit zu einem
 * Schema-String fuer den System-Prompt gerendert.
 *
 * Hinweis: das ist nicht das vollstaendige `Antrag`-Interface (461 Felder),
 * sondern eine kuratierte Whitelist der relevantesten Felder. Custom-Spalten
 * (z.B. `foerdersumme_geplant_2024`) sind bewusst nicht hier — die LLM-Prompt
 * waere sonst unueberschaubar.
 */
import type { Programm } from '@/core/services/csv/types';

export interface AntragSchemaField {
  field: string;
  type: 'string' | 'date' | 'number' | 'string-array';
  beschreibung: string;
  beispielwerte?: string[];
}

export const ANTRAG_SCHEMA_FIELDS: ReadonlyArray<AntragSchemaField> = [
  { field: 'aktenzeichen', type: 'string', beschreibung: 'Foerderkennzeichen (FKZ), eindeutige ID des Antrags' },
  { field: 'titel', type: 'string', beschreibung: 'Vorhaben-Titel (Teilvorhaben)' },
  { field: 'verbund_titel', type: 'string', beschreibung: 'Projekt-/Verbund-Titel (gemeinsam fuer alle Teilvorhaben eines Verbunds)' },
  { field: 'antragsteller', type: 'string', beschreibung: 'Zuwendungsempfaenger / Organisation' },
  { field: 'antragsdatum', type: 'date', beschreibung: 'Eingang beim Foerdergeber (ISO YYYY-MM-DD)' },
  { field: 'bewilligung_datum', type: 'date', beschreibung: 'Datum der Bewilligung (falls bewilligt)' },
  { field: 'vn_eingang_datum', type: 'date', beschreibung: 'Eingang des Verwendungsnachweises (Begleitphase)' },
  { field: 'frist_datum', type: 'date', beschreibung: 'Naechste relevante Frist' },
  {
    field: 'status', type: 'string',
    beschreibung: 'Status des Antrags (Rohwerte aus CSV)',
    beispielwerte: ['beantragt', 'bearbeitungsreif', 'techn geprueft', 'bewilligt', 'abgelehnt', 'VN geprueft', 'Schlussvermerk'],
  },
  { field: 'programm_id', type: 'string', beschreibung: 'ID des Foerderprogramms (siehe Programm-Katalog unten)' },
  { field: 'unterprogramm_id', type: 'string', beschreibung: 'Unterprogramm-Code (FM-Nummer)' },
  { field: 'branche', type: 'string', beschreibung: 'Wirtschaftszweig / Branche des Antragstellers' },
  { field: 'foerdergeber', type: 'string', beschreibung: 'Zuwendungsgeber (z.B. Bund, Land, EU)' },
  { field: 'verbund_id', type: 'string', beschreibung: 'Verbund-ID (mehrere Teilvorhaben unter einem Verbund)' },
  {
    field: 'vb_phase', type: 'number',
    beschreibung: 'Verbund-Phasen-Code (1=NW1, 2=NW2, 3=FuE, 4=DL, 5=DS, 9=Irrlaeufer)',
  },
  { field: 'tib_kuerz', type: 'string', beschreibung: 'Bearbeiter-Kuerzel des zustaendigen Sachbearbeiters' },
  { field: 'kurzbeschreibung', type: 'string', beschreibung: 'Projektbeschreibung / Abstract (Volltext, fuer semantische Suche)' },
  { field: 'deskriptoren', type: 'string-array', beschreibung: 'Schlagworte / Themenfelder (z.B. „KI", „Industrie 4.0")' },
];

export function formatAntragsSchema(): string {
  return ANTRAG_SCHEMA_FIELDS.map(f => {
    const examples = f.beispielwerte?.length
      ? ` (Beispiele: ${f.beispielwerte.map(v => `"${v}"`).join(', ')})`
      : '';
    return `- \`${f.field}\` (${f.type}): ${f.beschreibung}${examples}`;
  }).join('\n');
}

export function getProgrammKatalog(programme: ReadonlyArray<Programm>): string {
  if (programme.length === 0) return '(keine Programme im Datenbestand)';
  return programme.map(p => `- ${p.name} (id: ${p.id})`).join('\n');
}

/** Mapping Programm-Name → Programm-ID (case-insensitive). Wird in Stufe 2
 *  benutzt, um Programm-Namen vom LLM in IDs zu konvertieren. */
export function buildProgrammNameToIdMap(programme: ReadonlyArray<Programm>): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of programme) out.set(p.name.toLowerCase(), p.id);
  return out;
}

import type { DocumentMetadata } from '@/core/services/search/metadata-extractor';

export interface ValidationResult {
  score: number;
  issues: string[];
  isFallback: boolean;
}

const KNOWN_DOC_TYPES = [
  'Bauantrag', 'Foerderantrag', 'Gutachten', 'Stellungnahme', 'Protokoll',
  'Nachforderung', 'Formular', 'Statik', 'Brandschutzkonzept',
  'Schallschutznachweis', 'Energienachweis', 'Zwischenbericht', 'Review',
  'Ethikantrag', 'Datenschutz', 'Compliance', 'Sonstiges',
];

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function validateMetadata(
  metadata: DocumentMetadata, filename: string, text: string,
): ValidationResult {
  // Fallback via Marker — sauberer als Heuristiken
  if (metadata._isFallback === true) {
    return { score: 0, issues: ['Fallback — LLM hat nicht geantwortet'], isFallback: true };
  }

  let score = 0;
  const issues: string[] = [];

  // JSON valide geparst (nicht Fallback): 30 Punkte
  score += 30;

  // doc_type ist nicht 'Sonstiges': +15
  const docType = str(metadata.doc_type);
  if (docType && docType !== 'Sonstiges') {
    score += 15;
  } else {
    issues.push('doc_type ist "Sonstiges" (nicht spezifisch)');
  }
  if (docType && !KNOWN_DOC_TYPES.includes(docType) && !/^[A-ZÄÖÜ][a-zäöüß]{2,}/.test(docType)) {
    issues.push(`doc_type unbekannt: "${docType}"`);
  }

  // title ist nicht der Dateiname: +10
  const title = str(metadata.title);
  const cleanName = filename.replace(/\.\w+$/, '').replace(/[_-]/g, ' ');
  if (title.trim().length >= 5 && title !== cleanName) {
    score += 10;
  } else if (title === cleanName) {
    issues.push('title ist der Dateiname');
  } else {
    issues.push('title zu kurz (< 5 Zeichen)');
  }

  // date wurde extrahiert: +10
  const date = str(metadata.date);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    score += 10;
  } else if (date) {
    issues.push(`date ungültiges Format: "${date}"`);
  } else {
    issues.push('Kein Datum extrahiert');
  }

  // organizations hat mindestens 1 Eintrag: +10
  const orgs = Array.isArray(metadata.organizations) ? metadata.organizations : [];
  if (orgs.length > 0) {
    score += 10;
  } else {
    issues.push('Keine Organisationen extrahiert');
  }

  // topic_tags hat 3-5 Einträge: +15
  const tags = Array.isArray(metadata.topic_tags) ? metadata.topic_tags : [];
  if (tags.length >= 3 && tags.length <= 5) {
    score += 15;
  } else {
    issues.push(`topic_tags: ${tags.length} (optimal: 3-5)`);
  }

  // micro_summary > 30 Zeichen UND ungleich Rohtext-Anfang: +10
  const micro = str(metadata.micro_summary);
  const textStart = text.slice(0, 200);
  if (micro.trim().length > 30 && micro !== textStart) {
    score += 10;
  } else if (micro === textStart) {
    issues.push('micro_summary ist kopierter Rohtext');
  } else {
    issues.push('micro_summary zu kurz (< 30 Zeichen)');
  }

  return {
    score: Math.min(100, score),
    issues,
    isFallback: false,
  };
}

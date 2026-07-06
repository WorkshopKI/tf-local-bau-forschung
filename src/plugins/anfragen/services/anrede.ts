/**
 * Export-Präambel für die externe Runde (ZIM-FAQ-Assistent).
 *
 * Der anonymisierte Mailtext ist an das eigene TEAM/an KOLLEGEN adressiert
 * („Sehr geehrtes Team …"). Ohne Kontext beantwortet der externe Assistent die
 * Anrede statt die eigentlichen Fragen. Statt die Anrede zu löschen (verlustbehaftet)
 * stellen wir dem kopierten Text einen kurzen Hinweis voran: Anrede ignorieren,
 * Fragen beantworten, Antwort-Mail an den Absender — UND die Platzhalter unverändert
 * erhalten (der Assistent „verschluckt" sonst manche, was die spätere deterministische
 * Wiedereinsetzung bricht).
 *
 * Verlustfrei: der gespeicherte `anonymisiertMd` bleibt unberührt; die Präambel ist
 * statisch und PII-frei, sie beeinflusst den Export-Guard nicht.
 */
export const ANFRAGE_EXPORT_PREAMBLE = [
  'Hinweis für die Beantwortung: Der folgende Text ist eine E-Mail, die an ein Team bzw. an',
  'Kolleginnen und Kollegen gerichtet ist. Ignoriere die Anrede und die Grußformel an das',
  'Team — entscheidend sind ausschließlich der Sachinhalt und die im Text gestellten Fragen.',
  'Formuliere daraus eine sachliche Antwort-E-Mail an die absendende Person.',
  '',
  'WICHTIG: Der Text enthält Platzhalter der Form [PERSON_1], [FIRMA_1], [ORT_1] usw. Übernimm',
  'ALLE diese Platzhalter unverändert und vollständig in deine Antwort — verändere, übersetze',
  'oder entferne sie nicht. Sie werden anschließend automatisch durch die echten Werte ersetzt.',
].join('\n');

/**
 * Stellt dem für den externen Assistenten bestimmten Text die Präambel voran.
 * Nur für den Export/Clipboard — nicht für Persistenz oder Export-Guard.
 */
export function anredeFuerExport(text: string): string {
  return `${ANFRAGE_EXPORT_PREAMBLE}\n\n---\n\n${text}`;
}

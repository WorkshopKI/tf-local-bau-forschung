/**
 * Seed-Skill für die DSGVO-Anonymisierung einer E-Mail-Kurzanfrage (Modul
 * „Anfragen"). Liegt in der geteilten `registry.json` und ist damit über alle
 * Build-Varianten sichtbar — startet deshalb ZWINGEND `aktiv: false`. Die
 * Freischaltung (`aktiv: true`) macht NICHT der Code, sondern ein manueller
 * Schritt nach bestandenem Recall-Gate (Phase 9). Siehe CLAUDE.md / Plan.
 *
 * Der Originaltext kommt über den `{{zielText}}`-Inhalts-Slot → die
 * DSGVO-Transport-Policy (`skillEnthaeltDokumentInhalte`) erzwingt damit
 * automatisch einen INTERNEN Transport (Ableitung schlägt Flag).
 */
import type { SkillRecord } from './types';

export const ANFRAGE_ANONYMISIEREN_SKILL_ID = 'anfrage-anonymisieren';

const SYSTEM_PROMPT = [
  'Du bist ein DSGVO-Anonymisierungs-Werkzeug für Förderreferenten. Deine Aufgabe ist es,',
  'personenbezogene und identifizierende Informationen aus einem E-Mail-Text zu entfernen und',
  'durch stabile Platzhalter zu ersetzen, damit der Text gefahrlos an ein externes KI-System',
  'weitergegeben werden kann.',
  '',
  'Regeln:',
  '- Ersetze JEDE identifizierende Information durch einen Platzhalter im Format [TYP_N]',
  '  (z. B. [PERSON_1], [FIRMA_1], [ORT_1], [FKZ_1], [EMAIL_1], [TELEFON_1], [IBAN_1]).',
  '- Dieselbe Entität bekommt im GESAMTEN Text denselben Platzhalter (Konsistenz). Verschiedene',
  '  Entitäten desselben Typs werden durchnummeriert.',
  '- Anonymisiere AGGRESSIV. Im Zweifel ersetzen. Over-Anonymisieren ist der sichere Fehler.',
  '- Erfasse auch: Personennamen (inkl. Anrede wie „Herr Dr. Schmidt"), Firmen-/Institutsnamen,',
  '  Orte/Adressen, Förderkennzeichen (FKZ), E-Mail-Adressen, Telefon-/Faxnummern, IBANs,',
  '  Exchange-X.500-DNs, interne Hostnames/Domains.',
  '- Erfasse AUSSERDEM identifizierenden FREITEXT: projektbeschreibende Details, die ein konkretes',
  '  Konsortium/Vorhaben erkennbar machen, auch ohne Namensnennung → ersetze sie durch [SONSTIGES_N].',
  '- Erfinde KEINE Platzhalter, deren Originaltext nicht im Text vorkommt.',
  '- Gib AUSSCHLIESSLICH ein JSON-Objekt zurück — ohne weiteren Text, ohne Markdown-Codefences.',
  '',
  'Erlaubte `typ`-Werte: person, firma, ort, fkz, email, telefon, iban, x500, hostname, sonstiges.',
].join('\n');

const PROMPT_TEMPLATE = [
  'Anonymisiere den folgenden E-Mail-Text. Gib AUSSCHLIESSLICH dieses JSON zurück',
  '(keine Erklärung, kein Markdown, keine Codefences):',
  '',
  '{"anonymisiert":"<der vollständige Text mit Platzhaltern>",'
    + '"mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}]}',
  '',
  'E-Mail-Text:',
  '{{zielText}}',
].join('\n');

export const ANFRAGE_ANONYMISIEREN_SKILL: SkillRecord = {
  id: ANFRAGE_ANONYMISIEREN_SKILL_ID,
  name: 'Anfrage anonymisieren',
  beschreibung: 'Ersetzt PII in einer E-Mail-Kurzanfrage durch stabile Platzhalter und liefert die '
    + 'Mapping-Tabelle (Platzhalter → Original). Nur interner Transport (Dokumentinhalte).',
  version: 1,
  promptTemplate: PROMPT_TEMPLATE,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['zielText'],
  geaendert_am: '2026-06-25T00:00:00.000Z',
  // Pflicht: ungeprüfter Skill in geteilter registry.json → erst nach Recall-Gate
  // manuell auf true (durch Thomas, NICHT durch Code).
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit dokumentiert: trägt Dokumentinhalte.
  enthaeltDokumentInhalte: true,
};

/**
 * Seed-Skill für die DSGVO-Anonymisierung einer E-Mail-Kurzanfrage (Modul
 * „Anfragen"). Liegt in der geteilten `registry.json` und ist damit über alle
 * Build-Varianten sichtbar — startet deshalb ZWINGEND `aktiv: false`. Die
 * Freischaltung (`aktiv: true`) macht NICHT der Code, sondern ein manueller
 * Schritt nach bestandenem Recall-Gate (Phase 9). Siehe CLAUDE.md / Plan.
 *
 * Ausnahme NUR dev: die UI behandelt den Anonymisierer in `isDevContext()` als
 * freigeschaltet (Runtime-Override `istAnonymisiererFreigeschaltet`, anonymisierung.ts)
 * — der Seed bleibt `aktiv: false`, das Gate gilt unverändert für prod/pl/kurator/as.
 *
 * Der Originaltext kommt über den `{{zielText}}`-Inhalts-Slot → die
 * DSGVO-Transport-Policy (`skillEnthaeltDokumentInhalte`) erzwingt damit
 * automatisch einen INTERNEN Transport (Ableitung schlägt Flag).
 */
import type { SkillRecord } from './types';

export const ANFRAGE_ANONYMISIEREN_SKILL_ID = 'anfrage-anonymisieren';

const SYSTEM_PROMPT = [
  'Du bist ein DSGVO-Anonymisierungs-Werkzeug für Förderreferenten. Deine Aufgabe ist es, einen',
  'E-Mail-Text so aufzubereiten, dass er gefahrlos an ein externes KI-System weitergegeben werden',
  'kann, OHNE dass der fachliche Sinn für eine inhaltliche Bewertung verloren geht.',
  '',
  'Du wendest dafür ZWEI Mechanismen in EINEM Durchgang an:',
  '',
  'STUFE A — PSEUDONYMISIEREN (Feld `mapping`, wird später wörtlich wiedereingesetzt):',
  'Diskrete, eindeutige Identifikatoren, die in der finalen Antwort WÖRTLICH zurück müssen',
  '(Anrede, Unterschrift, Aktenzeichen, Adresse, Nummern). Ersetze sie durch einen stabilen',
  'Platzhalter im Format [TYP_N] und trage Platzhalter→Original in `mapping` ein.',
  '- Ersetze: Personennamen (inkl. Anrede wie „Herr Dr. Schmidt"), Firmen-/Institutsnamen,',
  '  Orte/Adressen, Förderkennzeichen (FKZ), E-Mail-Adressen, Telefon-/Faxnummern, IBANs,',
  '  Exchange-X.500-DNs, interne Hostnames/Domains.',
  '- Dieselbe Entität bekommt im GESAMTEN Text denselben Platzhalter (Konsistenz). Verschiedene',
  '  Entitäten desselben Typs werden durchnummeriert (z. B. [PERSON_1], [PERSON_2]).',
  '- Erlaubte `typ`-Werte: person, firma, ort, fkz, email, telefon, iban, x500, hostname, sonstiges.',
  '- `sonstiges` ist NUR für harte Rest-PII, die in keinen anderen Typ passt (z. B. ein',
  '  Personalausweis-/Vertragskennzeichen) — NICHT für beschreibenden Freitext (der geht in Stufe B).',
  '',
  'STUFE B — VERALLGEMEINERN (Feld `verallgemeinerungen`, wird NICHT wiedereingesetzt):',
  'Identifizierender BESCHREIBENDER Freitext, der ein konkretes Vorhaben/Konsortium erkennbar macht',
  '(auch ohne Namensnennung), dessen FACHLICHE BEDEUTUNG das externe System aber für die Bewertung',
  'braucht. Ersetze die konkrete Stelle INLINE im Text durch eine verallgemeinerte Fassung, die auf',
  'die fachlich nötige Abstraktionsebene gehoben ist (Branche/Technologiefeld/Verfahrensart bleibt,',
  'die konkrete Identität verschwindet). Trage {original, verallgemeinert} in `verallgemeinerungen` ein.',
  '- Beispiel: „Schweißnahtprüfung für einen konkreten VW-Zulieferer" →',
  '  „ein Prüfverfahren in der Automobil-Zulieferindustrie".',
  '- Die verallgemeinerte Fassung muss FREI von Rest-PII sein (keine Namen, Orte, Zahlen, die zurückführen).',
  '',
  'ENTSCHEIDUNGSREGEL: Brauche ich den Wert WÖRTLICH zurück (Name, Nummer, Adresse)? → Stufe A.',
  'Brauche ich nur die FACHLICHE BEDEUTUNG? → Stufe B. Im Zweifel (harte PII) → Stufe A.',
  '',
  'Allgemeine Regeln:',
  '- Anonymisiere AGGRESSIV. Im Zweifel ersetzen. Over-Anonymisieren ist der sichere Fehler.',
  '- Erfinde NICHTS. Jeder `original`-Wert (in `mapping` wie in `verallgemeinerungen`) muss WÖRTLICH',
  '  im Eingabetext vorkommen.',
  '- Gib AUSSCHLIESSLICH ein JSON-Objekt zurück — ohne weiteren Text, ohne Markdown-Codefences.',
].join('\n');

const PROMPT_TEMPLATE = [
  'Anonymisiere den folgenden E-Mail-Text mit beiden Stufen (Pseudonymisieren + Verallgemeinern).',
  'Gib AUSSCHLIESSLICH dieses JSON zurück (keine Erklärung, kein Markdown, keine Codefences):',
  '',
  '{"anonymisiert":"<der vollständige Text mit [TYP_N]-Platzhaltern und verallgemeinerten Stellen>",'
    + '"mapping":[{"platzhalter":"[PERSON_1]","original":"Dr. Schmidt","typ":"person"}],'
    + '"verallgemeinerungen":[{"original":"Schweißnahtprüfung für einen konkreten VW-Zulieferer",'
    + '"verallgemeinert":"ein Prüfverfahren in der Automobil-Zulieferindustrie"}]}',
  '',
  'E-Mail-Text:',
  '{{zielText}}',
].join('\n');

export const ANFRAGE_ANONYMISIEREN_SKILL: SkillRecord = {
  id: ANFRAGE_ANONYMISIEREN_SKILL_ID,
  name: 'Anfrage anonymisieren',
  beschreibung: 'Anonymisiert eine E-Mail-Kurzanfrage in zwei Stufen: harte PII → stabile Platzhalter '
    + '(Mapping, wird wiedereingesetzt), identifizierender Freitext → verallgemeinert (nur lokal). '
    + 'Nur interner Transport (Dokumentinhalte).',
  version: 2,
  promptTemplate: PROMPT_TEMPLATE,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['zielText'],
  geaendert_am: '2026-06-27T00:00:00.000Z',
  // Pflicht: ungeprüfter Skill in geteilter registry.json → erst nach Recall-Gate
  // manuell auf true (durch Thomas, NICHT durch Code).
  aktiv: false,
  // Redundant zur Slot-Ableitung, aber explizit dokumentiert: trägt Dokumentinhalte.
  enthaeltDokumentInhalte: true,
};

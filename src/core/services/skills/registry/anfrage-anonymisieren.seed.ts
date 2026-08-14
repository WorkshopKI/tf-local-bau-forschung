/**
 * Seed-Skill für die DSGVO-Anonymisierung einer E-Mail-Kurzanfrage (Modul
 * „Anfragen"). Liegt in der geteilten `registry.json` und ist damit über alle
 * Build-Varianten sichtbar.
 *
 * FREIGESCHALTET (`aktiv: true`) seit 2026-07-03: Das Recall-Gate für das
 * Zwei-Stufen-Modell (version 2) wurde bestanden; die Produktiv-Freigabe ist die
 * bewusste manuelle Entscheidung von Thomas (Phase 9). Der Seed ist damit der
 * Code-Default und schaltet den Anonymisierer in FRISCHEN Installationen direkt frei.
 *
 * ACHTUNG — Bestands-Installationen: `mergeMissingSeeds` (storage.ts) ergänzt nur
 * FEHLENDE Seeds und überschreibt bestehende Registry-Einträge NIE. Ein Share,
 * dessen `_intern/skills/registry.json` den Skill bereits mit `aktiv: false` trägt,
 * bleibt gesperrt, bis er EINMAL zur Laufzeit freigeschaltet wird (Werkzeuge →
 * Skill-Verwaltung → „Anfrage anonymisieren" → aktiv → Speichern; ein Share =
 * team-weit für alle Varianten).
 *
 * dev war über den Runtime-Override `istAnonymisiererFreigeschaltet` (isDevContext)
 * schon immer frei; prod/pl/kurator/as folgen jetzt dem gesetzten `aktiv: true`.
 *
 * Der Originaltext kommt über den `{{zielText}}`-Inhalts-Slot → die
 * DSGVO-Transport-Policy (`skillEnthaeltDokumentInhalte`) erzwingt damit
 * automatisch einen INTERNEN Transport (Ableitung schlägt Flag).
 */
import type { SkillRecord } from './types';

export const ANFRAGE_ANONYMISIEREN_SKILL_ID = 'anfrage-anonymisieren';

/**
 * Vor-Audit-Fassung (version 2), eingefroren für die BYTE-genaue Erkennung in
 * `ANFRAGE_ANON_KLAR_MIGRATION`. NICHT mehr live geseedet.
 *
 * Drei Defekte, die der Prompt-Audit 2026-07 belegt hat:
 *  1. „Anonymisiere AGGRESSIV" gegen „OHNE dass der fachliche Sinn verloren geht" —
 *     entgegengesetzte Fehlerkosten für dieselbe Entscheidung, ohne Vorrang.
 *  2. Die WÖRTLICH-Pflicht galt pauschal für `mapping` UND `verallgemeinerungen`.
 *     Tragend ist sie nur für `mapping` (wird zeichengenau wiedereingesetzt); für
 *     die frei formulierte Stufe-B-Passage war sie eine nicht verifizierbare Auflage.
 *  3. Die Feld-Schablone trug vollplausible ECHTE Werte („Dr. Schmidt"). Wiederholt
 *     das Modell die Schablone, landet der Name im `mapping` — und `mapping` wird
 *     wörtlich in den finalen Text zurückgesetzt. Dass der Parser hier Prompt-Inhalt
 *     fischt, ist schon einmal passiert (deshalb `extractThinking`).
 */
export const ANON_SYSTEM_PROMPT_ALT = [
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

export const ANON_PROMPT_TEMPLATE_ALT = [
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

/* -------------------------------------------------------------------------- */
/* Live-Fassung (version 3) — Prompt-Audit 2026-07                             */
/* -------------------------------------------------------------------------- */

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
  // Auflösung des früheren Zielkonflikts „AGGRESSIV" vs. „fachlicher Sinn bleibt": beide
  // sind gleichzeitig erfüllbar, sobald klar ist, dass ERSETZEN nicht WEGLASSEN heißt.
  '- Anonymisiere AGGRESSIV: im Zweifel ERSETZEN statt stehen lassen.',
  '- Aggressiv heißt NIE ersatzlos streichen. Jede Stelle, die du anfasst, bekommt einen',
  '  Platzhalter (Stufe A) oder eine verallgemeinerte Fassung (Stufe B). Der fachliche Sinn',
  '  bleibt dadurch auch bei aggressivem Ersetzen erhalten — es gibt hier keinen Zielkonflikt.',
  '- Erfinde nichts.',
  '- `mapping[].original` muss ZEICHENGENAU so im Eingabetext stehen — dieser Wert wird später',
  '  unverändert wieder eingesetzt. Findest du ihn nicht wörtlich wieder, nimm ihn nicht auf.',
  '- `verallgemeinerungen[].original` ist die Textstelle, die du ersetzt hast, in der Form, in der',
  '  sie im Eingabetext stand. Sie wird nur protokolliert, nicht wiedereingesetzt.',
  '- Gib AUSSCHLIESSLICH ein JSON-Objekt zurück — ohne weiteren Text, ohne Markdown-Codefences.',
].join('\n');

const PROMPT_TEMPLATE = [
  'Anonymisiere den folgenden E-Mail-Text mit beiden Stufen (Pseudonymisieren + Verallgemeinern).',
  'Gib AUSSCHLIESSLICH dieses JSON zurück (keine Erklärung, kein Markdown, keine Codefences):',
  '',
  // Reine Feld-Schablone: KEINE plausiblen Echtwerte mehr. Die Vorgänger-Fassung trug
  // „Dr. Schmidt" als `mapping.original` — wiederholt das Modell die Schablone, wird der
  // Name über die Wiedereinsetzung in den finalen Text geschrieben.
  '{"anonymisiert":"<der vollständige Text mit [TYP_N]-Platzhaltern und verallgemeinerten Stellen>",'
    + '"mapping":[{"platzhalter":"<[TYP_N] wie im Text>","original":"<der Wortlaut, der dort stand>",'
    + '"typ":"<einer der erlaubten typ-Werte>"}],'
    + '"verallgemeinerungen":[{"original":"<die ersetzte Textstelle>",'
    + '"verallgemeinert":"<die abstrahierte Fassung>"}]}',
  '',
  'Die spitzen Klammern sind Feld-Beschreibungen, keine Werte — übernimm sie nicht in die Antwort.',
  'Ist eine Liste leer, gib sie als leeres Array zurück.',
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
  // v3: Prompt-Audit 2026-07 — Zielkonflikt aufgelöst, WÖRTLICH-Pflicht auf `mapping`
  // begrenzt, Feld-Schablone von plausiblen Echtwerten befreit (siehe ANON_*_ALT).
  version: 3,
  promptTemplate: PROMPT_TEMPLATE,
  systemPrompt: SYSTEM_PROMPT,
  maxTokens: 4096,
  modifiers: { neu: '', kuerzer: '', laenger: '' },
  regelIds: [],
  slots: ['zielText'],
  geaendert_am: '2026-06-27T00:00:00.000Z',
  // Recall-Gate (Zwei-Stufen-Modell, version 2) bestanden 2026-07-03 → bewusste
  // Produktiv-Freigabe durch Thomas. Bestands-Shares mit gespeichertem aktiv:false
  // brauchen zusätzlich die einmalige Laufzeit-Freischaltung (mergeMissingSeeds
  // überschreibt nie).
  aktiv: true,
  // Redundant zur Slot-Ableitung, aber explizit dokumentiert: trägt Dokumentinhalte.
  enthaeltDokumentInhalte: true,
};

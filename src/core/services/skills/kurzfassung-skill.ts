/**
 * Hart verdrahtete Skill-Definition „ZIM-Kurzfassung" für den Gutachten-
 * Durchstich. Quelle ist der bestehende ZIM-Gutachter-Prompt (Abschnitt A).
 * Das Template ist statisch (keine Logik) — Registry-ready.
 */
import { runChecks } from './checks';
import type { ParsedSkillOutput, SkillDefinition } from './types';

const SYSTEM_PROMPT =
  'Du bist ein erfahrener Textassistent für ZIM-Gutachten. Du erstellst streng '
  + 'quellenbasierte Kurzfassungen von Vorhabensbeschreibungen. Antworte ausschließlich '
  + 'auf Deutsch und halte dich exakt an das vorgegebene Ausgabeformat.';

const PROMPT_TEMPLATE = `Erstelle die **Kurzfassung** der folgenden Vorhabensbeschreibung (VB) für ein ZIM-Gutachten.

## Stammdaten des Antrags
{{stammdaten}}

## Vorhabensbeschreibung (Quelle)
{{vbMarkdown}}

## Aufgabe & Kontrakt
Fasse die VB zu einer Kurzfassung von ca. 10 Sätzen zusammen (Toleranz 8–12 Sätze). Struktur, soweit im Antrag vorhanden:
1. Ausgangsproblem (1–2 Sätze)
2. Projektziel (2–3 Sätze)
3. Technischer Ansatz (3–4 Sätze)
4. Erwartetes Ergebnis (1–2 Sätze)
5. Anwendungsbereich (1 Satz)

Regeln:
- **Streng quellenbasiert:** Nutze ausschließlich Inhalte der VB. Erfinde nichts.
- Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".
- **Aktiver Stil:** Formuliere „Das Vorhaben…" statt „Der Antragsteller plant…". Keine Arbeitspaket-Verweise („AP1").
- **Fließtext** im finalen Teil — KEINE Aufzählungen, keine Zwischenüberschriften.

## Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
Gruppierte wörtliche Kurz-Zitate aus der VB, die du als Beleg nutzt — je mit knapper Fundstellen-Angabe.

### Entwurf
Ein erster, noch ungeschliffener Entwurf der Kurzfassung.

### Finaler Text
Der finale, geschliffene Fließtext der Kurzfassung (ca. 10 Sätze, KEIN Listenformat).`;

/**
 * Zerlegt die LLM-Antwort an den `###`-Überschriften. Tolerant gegenüber
 * fehlendem Entwurf-Teil und beliebiger Überschriften-Tiefe; bei unparsebarer
 * Ausgabe wird alles als `finalerText` behandelt und eine Warnung gesetzt.
 */
export function parseSkillOutput(raw: string): ParsedSkillOutput {
  const headingRe = /^#{1,6}[ \t]*(Quellenanalyse|Entwurf|Finaler[ \t]+Text)\b.*$/gim;
  const matches = [...raw.matchAll(headingRe)];

  if (matches.length === 0) {
    return {
      quellenanalyse: '',
      entwurf: '',
      finalerText: raw.trim(),
      warnung: 'Antwort ohne erwartete Abschnitte — vollständig als finaler Text übernommen.',
    };
  }

  const sections: Partial<Record<'quellenanalyse' | 'entwurf' | 'finalerText', string>> = {};
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const rawKey = m[1]!.toLowerCase();
    const key = rawKey.startsWith('quellen')
      ? 'quellenanalyse'
      : rawKey.startsWith('entwurf')
        ? 'entwurf'
        : 'finalerText';
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? raw.length) : raw.length;
    sections[key] = raw.slice(start, end).trim();
  }

  const hatFinal = typeof sections.finalerText === 'string' && sections.finalerText.length > 0;
  return {
    quellenanalyse: sections.quellenanalyse ?? '',
    entwurf: sections.entwurf ?? '',
    finalerText: hatFinal
      ? sections.finalerText!
      : (sections.entwurf ?? sections.quellenanalyse ?? raw.trim()),
    ...(hatFinal ? {} : { warnung: 'Kein „Finaler Text"-Abschnitt erkannt — Entwurf/Quellenanalyse als Ersatz verwendet.' }),
  };
}

export const kurzfassungSkill: SkillDefinition = {
  id: 'gutachten-kurzfassung',
  name: 'Kurzfassung (Gutachten)',
  version: '1.0.0',
  systemPrompt: SYSTEM_PROMPT,
  promptTemplate: PROMPT_TEMPLATE,
  modifiers: {
    neu: 'Erstelle eine **vollständig neue** Variante der Kurzfassung mit anderer Formulierung und '
      + 'anderer Schwerpunktsetzung — gleiche Faktenbasis, gleicher Kontrakt.',
    kuerzer: 'Kürze die Kurzfassung spürbar (Richtung 8 Sätze). Streiche Redundanzen und Nebenaspekte; '
      + 'behalte Ausgangsproblem, Projektziel und den Kern des technischen Ansatzes.',
    laenger: 'Erweitere die Kurzfassung systematisch um etwa 50 % (Richtung 12 Sätze), indem du zusätzliche '
      + 'im Antrag genannte Details zu technischem Ansatz und erwartetem Ergebnis aufnimmst. Erfinde nichts — '
      + 'nutze ausschließlich Inhalte der VB.',
  },
  runChecks,
  parse: parseSkillOutput,
  maxTokens: 2048,
};

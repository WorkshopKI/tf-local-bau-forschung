/**
 * Zerlegt die rohe LLM-Antwort eines Skills in die drei `###`-Abschnitte
 * (Quellenanalyse / Entwurf / Finaler Text). Generisch, skill-unabhängig —
 * daher im Skills-Service (nicht in der Registry).
 */
import type { ParsedSkillOutput } from './types';

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

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
  // Marker-pflichtig (mind. ein `#` oder `*`), aber tolerant: führende/zusätzliche
  // Fett-Marker (`**### Finaler Text**`), beliebige Hash-Tiefe, Whitespace, optionaler
  // Doppelpunkt. Prosa ohne führenden Marker matcht NICHT (sonst würde z. B. „Der Entwurf
  // des Systems…" fälschlich als Überschrift erkannt).
  const headingRe = /^[ \t]*(?:#{1,6}|\*{1,3})[ \t#*]*(Quellenanalyse|Entwurf|Finaler[ \t]+Text)\b.*$/gim;
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
  const hatEntwurf = typeof sections.entwurf === 'string' && sections.entwurf.length > 0;
  // Sicherer Fallback: die Quellenanalyse (Zitat-Block) darf NIE als finalerText
  // durchgehen. Reihenfolge: finaler Text > Entwurf > leer (Parse-Fehler mit Warnung).
  return {
    quellenanalyse: sections.quellenanalyse ?? '',
    entwurf: sections.entwurf ?? '',
    finalerText: hatFinal ? sections.finalerText! : (hatEntwurf ? sections.entwurf! : ''),
    ...(hatFinal
      ? {}
      : {
          warnung: hatEntwurf
            ? 'Kein „Finaler Text"-Abschnitt erkannt — Entwurf als Ersatz verwendet.'
            : 'Kein „Finaler Text"-/„Entwurf"-Abschnitt erkannt — bitte erneut generieren.',
        }),
  };
}

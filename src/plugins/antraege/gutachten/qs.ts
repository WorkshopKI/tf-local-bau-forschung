/**
 * Reiner, toleranter Parser der LLM-QS-Ausgabe (markierter `###`-Freitext) →
 * `QsBefund[]`. Muster wie `parseSkillOutput` (Skills-Service), aber QS-spezifisch:
 * pro `### <Dimension>`-Block ein Befund; Bewertung aus dem Schlüsselwort
 * (`ok`/`hinweis`), sonst `'unklar'`. NIEMALS werfen — unparsebare Ausgabe wird als
 * EIN `'unklar'`-Befund markiert (DSGVO/Robustheit: kein erzwungenes JSON, der
 * llama.cpp-Grammar-Sampler greift ohnehin nicht). `QsBefund` lebt in der
 * Gutachten-Domäne (sie hängt vom Skills-Service ab, nicht umgekehrt).
 */
import { worstLevel, type AmpelLevel } from '@/core/services/skills';
import type { QsBefund } from './types';

/** Kanonische QS-Dimensionen (Anzeige-Reihenfolge; der Parser toleriert beliebige Überschriften). */
export const QS_DIMENSIONEN = ['Erdung in der VB', 'Kohärenz', 'Vollständigkeit', 'Ton'] as const;

/**
 * QS-Befund-Bewertung → Ampel-Stufe. QS ist BERATEND und nie `'fehler'`;
 * `'unklar'` (nicht-parsebare Modell-Ausgabe) zählt als Hinweis, damit der Block
 * sichtbar (aufgeklappt) bleibt.
 */
export function qsBefundLevel(bewertung: QsBefund['bewertung']): AmpelLevel {
  return bewertung === 'ok' ? 'ok' : 'hinweis';
}

export interface QsRollup {
  level: AmpelLevel;
  summary: string;
}

/** Roll-up über alle Befunde für den einklappbaren QS-Ampel-Kopf. */
export function qsRollup(befunde: QsBefund[]): QsRollup {
  const level = worstLevel(befunde.map(b => qsBefundLevel(b.bewertung)));
  const hinweise = befunde.filter(b => b.bewertung === 'hinweis').length;
  const unklar = befunde.filter(b => b.bewertung === 'unklar').length;
  let summary: string;
  if (hinweise > 0) summary = hinweise === 1 ? '1 Hinweis' : `${hinweise} Hinweise`;
  else if (unklar > 0) summary = unklar === 1 ? '1 unklar' : `${unklar} unklar`;
  else summary = 'alles ok';
  return { level, summary };
}

/** Maximale Länge eines einzelnen Befund-Textes (defensive Kappung). */
const MAX_BEFUND_TEXT = 600;

const HEADING_RE = /^#{1,6}[ \t]*(.+?)[ \t]*$/gim;
const BEWERTUNG_LINE_RE = /^[ \t]*Bewertung[ \t]*[:\-–][ \t]*(ok|hinweis|unklar)\b.*$/im;

function bewertungAus(block: string): QsBefund['bewertung'] {
  const line = block.match(BEWERTUNG_LINE_RE);
  if (line) return line[1]!.toLowerCase() as QsBefund['bewertung'];
  // Fallback: irgendwo im Block ein eindeutiges Schlüsselwort suchen.
  if (/\bunklar\b/i.test(block)) return 'unklar';
  if (/\bhinweis\b/i.test(block)) return 'hinweis';
  if (/\b(ok|in ordnung|unauffällig)\b/i.test(block)) return 'ok';
  return 'unklar';
}

function textAus(block: string): string {
  return block
    .replace(BEWERTUNG_LINE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BEFUND_TEXT)
    .trim();
}

/**
 * Zerlegt die rohe QS-Antwort an `###`-Überschriften in beratende Befunde. Leere
 * Eingabe → `[]`. Ohne erkennbare Blöcke, aber mit Inhalt → ein `'unklar'`-Befund.
 */
export function parseQsBefunde(raw: string): QsBefund[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const matches = [...text.matchAll(HEADING_RE)];
  if (matches.length === 0) {
    return [{ dimension: 'QS', bewertung: 'unklar', text: textAus(text) || 'Antwort nicht im erwarteten Format.' }];
  }

  const befunde: QsBefund[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const dimension = m[1]!.trim();
    if (!dimension) continue;
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    const block = text.slice(start, end);
    befunde.push({ dimension, bewertung: bewertungAus(block), text: textAus(block) });
  }
  // Nur Überschriften ohne verwertbaren Inhalt → als unklar markieren statt leer.
  if (befunde.length === 0) {
    return [{ dimension: 'QS', bewertung: 'unklar', text: 'Antwort nicht im erwarteten Format.' }];
  }
  return befunde;
}

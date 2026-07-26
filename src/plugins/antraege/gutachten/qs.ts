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

/** Höchstzahl der als Prüfkandidaten genannten Satz-Nummern (Prompt-Hygiene). */
const MAX_PRUEFKANDIDATEN = 12;

/**
 * Baut den autoritativen Kriterien-Block für einen kriterien-basierten QS-Lauf
 * (`SkillRecord.qsKriterien`). Er wird von `composeSkillPrompt` ans Prompt-Ende
 * gehängt und überstimmt die generischen Dimensionen des `qs-basis`-Templates —
 * bewusst als Anhang, damit der kuratierte Seed unangetastet bleibt (der Block
 * ist also selbst-erklärend und nennt sein Ausgabeformat vollständig).
 *
 * `pruefkandidaten` sind 0-basierte Satz-Indizes ohne Beleg-Zuordnung; sie gehen
 * als 1-basierte Nummern und ausdrücklich als *Hinsehen-Hilfe* mit, nicht als
 * Vorverurteilung. Leere Kriterien-Liste → `''` (Aufrufer hängt dann nichts an).
 */
export function buildQsKriterienBlock(kriterien: string[], pruefkandidaten: number[] = []): string {
  const liste = kriterien.map(k => k.trim()).filter(Boolean);
  if (liste.length === 0) return '';
  const zeilen = [
    '## Abnahme-Kriterien (überstimmen die Dimensionen oben)',
    'Bewerte den Abschnitt AUSSCHLIESSLICH entlang der folgenden Kriterien — die weiter '
      + 'oben genannten Dimensionen gelten für diesen Lauf NICHT. Gib genau einen Block je '
      + 'Kriterium aus, in dieser Reihenfolge, mit der Überschrift als ###-Zeile:',
    '',
    ...liste.map(k => `### ${k}`),
    '',
    'Format je Block:',
    'Bewertung: ok | hinweis | unklar',
    'Eine bis zwei Sätze Begründung mit konkreter Belegstelle.',
    'Sätze: <Nummern der betroffenen Sätze, z.B. 3, 5 — weglassen, wenn kein Satz konkret betroffen ist>',
    '',
    '„ok" = Kriterium erfüllt; „hinweis" = beratender Verbesserungshinweis; „unklar" = nicht '
      + 'beurteilbar. Zähle die Sätze des zu bewertenden Abschnitts ab 1. Erfinde nichts und '
      + 'schreibe den Abschnitt NICHT um.',
  ];
  if (pruefkandidaten.length > 0) {
    const nummern = pruefkandidaten.slice(0, MAX_PRUEFKANDIDATEN).map(i => i + 1).join(', ');
    zeilen.push(
      '',
      `Hinweis zur Auswahl: Für diese Sätze konnte automatisch keine Belegstelle in der `
      + `Quellenanalyse zugeordnet werden: ${nummern}. Das ist KEIN Befund — sieh dort nur `
      + `zuerst nach, wenn ein Kriterium die Beleglage betrifft.`,
    );
  }
  return zeilen.join('\n');
}

/** Maximale Länge eines einzelnen Befund-Textes (defensive Kappung). */
const MAX_BEFUND_TEXT = 600;

const HEADING_RE = /^#{1,6}[ \t]*(.+?)[ \t]*$/gim;
const BEWERTUNG_LINE_RE = /^[ \t]*Bewertung[ \t]*[:\-–][ \t]*(ok|hinweis|unklar)\b.*$/im;
/** Optionale Satz-Referenz-Zeile eines kriterien-basierten Befunds („Sätze: 3, 5"). */
const SAETZE_LINE_RE = /^[ \t]*S(?:ä|ae|a)tze[ \t]*[:\-–][ \t]*([0-9,\s.und&+-]*)$/im;

/**
 * Satz-Nummern eines Befunds: das Modell nennt sie 1-basiert, intern gilt
 * 0-basiert (`splitSentences`-Position, wie `QuellenBeleg.satzIndizes`).
 * Alles Unplausible fällt still weg — ein falsch geratener Index darf die QS
 * nicht scheitern lassen, sondern nur die Zuordnung kosten. Ohne bekannte
 * Satzanzahl wird gar nicht zugeordnet (lieber keine als eine falsche Marke).
 */
function satzIndizesAus(block: string, satzAnzahl: number | undefined): number[] {
  if (!satzAnzahl || satzAnzahl <= 0) return [];
  const line = block.match(SAETZE_LINE_RE);
  if (!line?.[1]) return [];
  const roh = line[1].match(/\d+/g) ?? [];
  const idx = roh
    .map(n => Number.parseInt(n, 10) - 1)
    .filter(i => Number.isInteger(i) && i >= 0 && i < satzAnzahl);
  return [...new Set(idx)].sort((a, b) => a - b);
}

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
    .replace(SAETZE_LINE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_BEFUND_TEXT)
    .trim();
}

/**
 * Zerlegt die rohe QS-Antwort an `###`-Überschriften in beratende Befunde. Leere
 * Eingabe → `[]`. Ohne erkennbare Blöcke, aber mit Inhalt → ein `'unklar'`-Befund.
 *
 * `satzAnzahl` (optional) = `splitSentences(finalerText).length` des bewerteten
 * Abschnitts. Nur damit werden die 1-basierten Satz-Referenzen eines
 * kriterien-basierten Laufs übernommen und gegen den echten Text validiert;
 * ohne die Angabe verhält sich der Parser exakt wie vorher.
 */
export function parseQsBefunde(raw: string, satzAnzahl?: number): QsBefund[] {
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
    const satzIndizes = satzIndizesAus(block, satzAnzahl);
    befunde.push({
      dimension,
      bewertung: bewertungAus(block),
      text: textAus(block),
      ...(satzIndizes.length ? { satzIndizes } : {}),
    });
  }
  // Nur Überschriften ohne verwertbaren Inhalt → als unklar markieren statt leer.
  if (befunde.length === 0) {
    return [{ dimension: 'QS', bewertung: 'unklar', text: 'Antwort nicht im erwarteten Format.' }];
  }
  return befunde;
}

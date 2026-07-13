/**
 * Zerlegt die rohe LLM-Antwort eines Skills in die drei `###`-Abschnitte
 * (Quellenanalyse / Entwurf / Finaler Text). Generisch, skill-unabhängig —
 * daher im Skills-Service (nicht in der Registry).
 *
 * Opt-in: deklariert der Skill `teilStruktur`, wird der **Body des Finaler-Text-
 * Blocks** zusätzlich tolerant als JSON-Array `[{key,text}]` gelesen und auf
 * `teile[]` gemappt (Reihenfolge + Labels aus der Deklaration). `finalerText`
 * bleibt die flache Quelle der Wahrheit (Teile per `teilJoin` verbunden). Schlägt
 * der JSON-Parse fehl ODER liefert das Modell Prosa → exakt heutiges Verhalten.
 */
import { parseJsonArrayTolerant, stripMarkdownWrapper } from '@/core/services/ai/json-tolerant';
import { splitSentences } from '../registry/check-engine';
import type { TeilDeklaration, TeilFeld, TeilJoin } from '../registry/types';
import type { ParsedSkillOutput, QuellenBeleg } from './types';

/**
 * Liest strukturierte Quellen-Belege aus der Quellenanalyse (Journey-Paket 4).
 * Eine Beleg-Zeile ist eine Zitat-Zeile (enthält ein Anführungszeichen ODER die
 * `→ stützt`-Marke). Optionaler Suffix ` → stützt Satz {n}` / ` → stützt Sätze
 * {n}, {m}` am Zeilenende (deutsch, 1-basiert) → 0-basierte `satzIndizes`,
 * validiert gegen `splitSentences(finalerText).length`. Ungültige/außerhalb →
 * `satzIndizes: []` (Beleg bleibt erhalten = „ohne Zuordnung"). Wirft NIE.
 */
function parseBelege(quellenanalyse: string, finalerText: string): QuellenBeleg[] {
  if (!quellenanalyse.trim()) return [];
  const satzAnzahl = splitSentences(finalerText).length;
  const belege: QuellenBeleg[] = [];
  // Nur wenn das Modell den NEUEN Kontrakt überhaupt genutzt hat (≥1 `→ stützt`-
  // Zeile) werden Belege gebaut — sonst `[]` ⇒ flaches Rendering wie heute (kein
  // Alt-Format-Regress durch lauter „ohne Zuordnung"-Karten).
  let hatReferenz = false;

  for (const rawLine of quellenanalyse.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    const hatMarke = /(?:→|->)\s*st(?:ü|ue)tzt\s+S(?:a|ä|ae)tz/iu.test(line);
    const hatZitat = /[„“”"«»]/u.test(line);
    if (!hatMarke && !hatZitat) continue;

    // Führenden Listen-Marker entfernen (-, *, •, "1.", "1)").
    line = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '');

    // Satz-Referenz-Suffix am Zeilenende (1-basiert → 0-basiert, validiert). Ein
    // nachgestelltes Satzzeichen/Anführungszeichen (`→ stützt Satz 2.` — genau die
    // Form aus dem Template-Beispiel) wird toleriert, sonst gingen folgsame Modelle
    // still leer aus (kein `hatReferenz` ⇒ flaches Rendering trotz vorhandener Marker).
    let satzIndizes: number[] = [];
    const refMatch = line.match(
      /\s*(?:→|->)\s*st(?:ü|ue)tzt\s+S(?:a|ä|ae)tz(?:e)?\s+([\d,\s]+?)\s*[.;:)\]»“”"']*\s*$/iu,
    );
    if (refMatch) {
      hatReferenz = true;
      satzIndizes = refMatch[1]!
        .split(',')
        .map(s => Number.parseInt(s.trim(), 10))
        .filter(n => Number.isFinite(n))
        .map(n => n - 1)
        .filter(idx => idx >= 0 && idx < satzAnzahl);
      line = line.slice(0, refMatch.index).trim();
    }

    // Abschnitts-Referenz „(Abschn. x.y)".
    let abschnittRef: string | undefined;
    const absMatch = line.match(/\(\s*Abschn\.?\s*([\d.]+)\s*\)/iu);
    if (absMatch) {
      abschnittRef = absMatch[1];
      line = line.replace(absMatch[0], '').trim();
    }

    const zitat = line.trim();
    if (!zitat && satzIndizes.length === 0 && abschnittRef === undefined) continue;
    belege.push({ zitat, ...(abschnittRef ? { abschnittRef } : {}), satzIndizes });
  }
  return hatReferenz ? belege : [];
}

/**
 * Liest den Finaler-Text-Body als JSON-Array `[{key,text}]` (tolerant gegen
 * Markdown-Fence, Prosa davor, Truncation) und mappt ihn in DEKLARIERTER
 * Reihenfolge auf `TeilFeld[]`: unbekannte Keys werden verworfen, fehlende
 * (z.B. truncation-bedingt) ausgelassen, Labels kommen aus der Deklaration
 * (nie aus dem Modell-Output). Leer → `[]` (Caller fällt auf Prosa zurück).
 */
function extractTeile(body: string, struktur: TeilDeklaration[]): TeilFeld[] {
  const stripped = stripMarkdownWrapper(body).trim();
  const start = stripped.indexOf('[');
  if (start < 0) return [];
  const parsed = parseJsonArrayTolerant(stripped.slice(start));
  if (parsed.length === 0) return [];

  const byKey = new Map<string, string>();
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key : '';
    const text = typeof o.text === 'string' ? o.text : '';
    if (key && text.trim() && !byKey.has(key)) byKey.set(key, text.trim());
  }

  const out: TeilFeld[] = [];
  for (const decl of struktur) {
    const text = byKey.get(decl.key);
    if (text !== undefined) out.push({ key: decl.key, label: decl.label, text });
  }
  return out;
}

/**
 * Zerlegt die LLM-Antwort an den `###`-Überschriften. Tolerant gegenüber
 * fehlendem Entwurf-Teil und beliebiger Überschriften-Tiefe; bei unparsebarer
 * Ausgabe wird alles als `finalerText` behandelt und eine Warnung gesetzt.
 *
 * `teilStruktur`/`teilJoin` (optional): aktiviert den strukturierten Finaler-
 * Text-Pfad (siehe Modul-Doc). Ohne sie: byte-identisch zum bisherigen Verhalten.
 */
export function parseSkillOutput(
  raw: string,
  teilStruktur?: TeilDeklaration[],
  teilJoin: TeilJoin = '\n\n',
): ParsedSkillOutput {
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
  const flatFinal = hatFinal ? sections.finalerText! : (hatEntwurf ? sections.entwurf! : '');

  // Opt-in strukturierter Pfad: nur wenn teilStruktur deklariert UND der Finaler-
  // Text-Body ≥1 valides Teil-Objekt liefert. Sonst Durchfall auf den Prosa-Pfad
  // unten (greift auch automatisch, wenn das Modell Prosa statt JSON lieferte —
  // `extractTeile` gibt dann `[]` zurück). Nie unter das heutige Verhalten.
  const quellenanalyse = sections.quellenanalyse ?? '';

  if (teilStruktur && teilStruktur.length > 0 && flatFinal) {
    const teile = extractTeile(flatFinal, teilStruktur);
    if (teile.length > 0) {
      const finalerText = teile.map(t => t.text).join(teilJoin);
      const belege = parseBelege(quellenanalyse, finalerText);
      return {
        quellenanalyse,
        entwurf: sections.entwurf ?? '',
        finalerText,
        teile,
        ...(belege.length > 0 ? { belege } : {}),
      };
    }
  }

  const belege = parseBelege(quellenanalyse, flatFinal);
  return {
    quellenanalyse,
    entwurf: sections.entwurf ?? '',
    finalerText: flatFinal,
    ...(belege.length > 0 ? { belege } : {}),
    ...(hatFinal
      ? {}
      : {
          warnung: hatEntwurf
            ? 'Kein „Finaler Text"-Abschnitt erkannt — Entwurf als Ersatz verwendet.'
            : 'Kein „Finaler Text"-/„Entwurf"-Abschnitt erkannt — bitte erneut generieren.',
        }),
  };
}

/**
 * Deterministische Qualitäts-Checks für Skill-Ausgaben — reine Funktionen, KEIN
 * LLM. Bewusst getrennt von der Generierung (Baustein 2 des Gutachten-Durchstichs):
 * die Checks laufen auch ohne erreichbaren Transport.
 *
 * Heuristiken sind absichtlich konservativ — sie sollen dem Gutachter Hinweise
 * geben, nicht hart blockieren. Einzig „Satzanzahl außerhalb 8–12" gilt als
 * `fehler`; Stil-Befunde sind `hinweis`.
 */

export type CheckLevel = 'ok' | 'hinweis' | 'fehler';

export interface CheckResult {
  /** Stabiler Schlüssel (für Keys/Tests). */
  id: string;
  level: CheckLevel;
  label: string;
  /** Einzeiliges Detail (z.B. die beanstandete Stelle). */
  detail?: string;
}

/** Deutsche Abkürzungen, deren Punkt KEIN Satzende ist. */
const ABKUERZUNGEN = [
  'z. B.', 'z.B.', 'd. h.', 'd.h.', 'u. a.', 'u.a.', 'u. U.', 'u.U.',
  'i. d. R.', 'i.d.R.', 'z. T.', 'z.T.', 'o. Ä.', 'o.Ä.', 's. o.', 's.o.',
  'ca.', 'bzw.', 'evtl.', 'ggf.', 'inkl.', 'vgl.', 'sog.', 'ggü.', 'usw.',
  'etc.', 'Nr.', 'Abb.', 'Tab.', 'Art.', 'Abs.', 'max.', 'min.',
  'Mio.', 'Mrd.', 'Std.',
];

/** Platzhalter für maskierte Abkürzungs-Punkte (U+0001, in Texten unmöglich). */
const DOT_SENTINEL = String.fromCharCode(1);

/**
 * Zerlegt einen Fließtext in Sätze. Abkürzungs-Punkte werden vor dem Split
 * maskiert, damit „z. B." oder „ca." kein Satzende erzeugen. Satzgrenze =
 * `.!?` gefolgt von Whitespace.
 */
export function splitSentences(text: string): string[] {
  let masked = text;
  for (const abbr of ABKUERZUNGEN) {
    const safe = abbr.split('.').join(DOT_SENTINEL);
    masked = masked.split(abbr).join(safe);
  }
  return masked
    .split(/(?<=[.!?])\s+/)
    .map(s => s.split(DOT_SENTINEL).join('.').trim())
    .filter(s => s.length > 0 && /[A-Za-zÀ-ÿ]/.test(s));
}

const MIN_SAETZE = 8;
const MAX_SAETZE = 12;

/** Satzanzahl im Zielbereich 8–12 (Kontrakt: ~10 Sätze). */
export function checkSatzanzahl(finalerText: string): CheckResult {
  const count = splitSentences(finalerText).length;
  const ok = count >= MIN_SAETZE && count <= MAX_SAETZE;
  return {
    id: 'satzanzahl',
    level: ok ? 'ok' : 'fehler',
    label: `Satzanzahl im Zielbereich (${count}/${MIN_SAETZE}–${MAX_SAETZE})`,
    ...(ok ? {} : { detail: count < MIN_SAETZE ? 'Zu kurz — Kurzfassung erweitern.' : 'Zu lang — Kurzfassung kürzen.' }),
  };
}

const LIST_MARKER = /^\s*(?:[-*•]\s|\d+[.)]\s)/;

/** Keine Aufzählungszeichen am Zeilenanfang (finaler Teil ist Fließtext). */
export function checkKeineAufzaehlungen(finalerText: string): CheckResult {
  const lines = finalerText.split(/\r?\n/);
  const offender = lines.find(l => LIST_MARKER.test(l));
  if (!offender) {
    return { id: 'keine-aufzaehlungen', level: 'ok', label: 'Keine Aufzählungen im Fließtext' };
  }
  return {
    id: 'keine-aufzaehlungen',
    level: 'fehler',
    label: 'Aufzählung im Fließtext gefunden',
    detail: `„${offender.trim().slice(0, 60)}…" — als Fließtext umformulieren.`,
  };
}

/** Passiv-/Antragsteller-Formulierungen + Arbeitspaket-Verweise (nur Hinweis). */
const PASSIV_PATTERNS: Array<{ re: RegExp; phrase: string }> = [
  { re: /Der Antragsteller plant/i, phrase: 'Der Antragsteller plant' },
  { re: /Der Antragsteller (?:beabsichtigt|möchte|will|wird|hat)/i, phrase: 'Der Antragsteller …' },
  { re: /Der Antrag\b/i, phrase: 'Der Antrag …' },
  { re: /\bAP\s?\d+/i, phrase: 'Arbeitspaket-Verweis (AP…)' },
];

/** Aktiver Stil (Hinweis): meldet Passiv-/Antragsteller-Formulierungen mit Satz-Nr. */
export function checkPassivStil(finalerText: string): CheckResult {
  const sentences = splitSentences(finalerText);
  const treffer: Array<{ satz: number; phrase: string }> = [];
  sentences.forEach((s, i) => {
    for (const { re, phrase } of PASSIV_PATTERNS) {
      if (re.test(s)) { treffer.push({ satz: i + 1, phrase }); break; }
    }
  });
  if (treffer.length === 0) {
    return { id: 'aktiver-stil', level: 'ok', label: 'Aktiver Stil' };
  }
  const first = treffer[0]!;
  return {
    id: 'aktiver-stil',
    level: 'hinweis',
    label: `Aktiver Stil: ${treffer.length} ${treffer.length === 1 ? 'Hinweis' : 'Hinweise'}`,
    detail: `„${first.phrase}" in Satz ${first.satz} — passiv formuliert.`,
  };
}

/** Führt alle deterministischen Checks auf dem finalen Text aus. */
export function runChecks(finalerText: string): CheckResult[] {
  return [
    checkSatzanzahl(finalerText),
    checkKeineAufzaehlungen(finalerText),
    checkPassivStil(finalerText),
  ];
}

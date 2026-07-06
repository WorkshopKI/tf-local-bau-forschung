/**
 * Deklarative Check-Engine: interpretiert `QualitaetsRegel[]` über dem FINALEN
 * Text einer Skill-Ausgabe. Ersetzt die fest verdrahteten Funktionen des
 * Gutachten-Testballons (`skills/checks.ts`). Reine Funktionen, KEIN LLM.
 *
 * Zwei öffentliche Verwendungen aus EINER Quelle (keine Drift):
 *  - `runRegelChecks()` — prüft den finalen Text gegen die aktiven Regeln.
 *  - `buildPromptVorgaben()` — erzeugt den Block, der dem Skill-Prompt angehängt
 *    wird, damit das LLM dieselben Vorgaben anstrebt, die geprüft werden.
 *
 * Unbekannte Regel-Typen werden hier übersprungen (kein Check, kein Hinweis),
 * aber NICHT verworfen — die Persistenz behält sie (Vorwärts-Kompatibilität).
 */
import { KNOWN_REGEL_TYPEN, type QualitaetsRegel, type RegelTyp } from './types';
import { extractPlatzhalter } from './nf-bausteine.seed';
import { effektiveKategorie } from './kategorien';

export type CheckLevel = 'ok' | 'hinweis' | 'fehler';

/**
 * Richtung eines Größen-Verstoßes — die Engine kennt sie (sie berechnet zu-viel/
 * zu-wenig ohnehin) und exponiert sie als EINE Quelle für den beschränkten
 * Auto-Retry (`chooseRetryModifier`), damit der keinen Detail-String parsen muss.
 * Nur bei Größen-Regeln (`zeichen_max`/`wortanzahl`/`satzanzahl`) gesetzt.
 */
export type CheckRichtung = 'zu_lang' | 'zu_kurz';

export interface CheckResult {
  /** Stabiler Schlüssel (für Keys/Tests) — entspricht der Regel-ID. */
  id: string;
  level: CheckLevel;
  label: string;
  /** Einzeiliges Detail (z.B. die beanstandete Stelle). */
  detail?: string;
  /** ID der erzeugenden Qualitätsregel (neu ggü. dem Testballon-CheckResult). */
  regelId?: string;
  /** Richtung eines Größen-Verstoßes (nur bei Größen-Regeln, nur wenn `level !== 'ok'`). */
  richtung?: CheckRichtung;
  /**
   * Gemessener Ist-Wert einer Größen-Regel (Zeichen/Wörter/Sätze/Absätze) — additiv,
   * nur bei Größen-Regeln gesetzt. Erlaubt UI + Korrektur-Ableitung (`regelKorrektur-
   * Anweisung`) den Ist-Wert OHNE Detail-String-Parsen; der Zielwert kommt aus
   * `regel.params` (`regelLimit`). Bewusst auch bei `ok` gesetzt (reine Kennzahl).
   */
  messwert?: number;
  /**
   * Lokalisierte Fundstellen eines lokalisierbaren Befunds (additiv, aktuell nur
   * `verbotenes_muster`): je Treffer der 0-basierte Satz-Index (über `splitSentences`
   * des finalen Textes — dieselbe Segmentierung, die das UI zum Highlighten nutzt)
   * + das menschenlesbare Muster-Label. Erlaubt der UI den „Anzeigen"-Sprung zur
   * Stelle. Fehlt bei nicht-lokalisierbaren Regeln + in Alt-Runs.
   */
  fundstellen?: { satzIndex: number; muster?: string }[];
  /**
   * Effektive Kategorie der erzeugenden Regel (additiv) — beim Lauf gestempelt,
   * damit das UI nach Art gruppieren kann, OHNE je Check die Registry abzufragen.
   */
  kategorie?: string;
}

/* -------------------------------------------------------------------------- */
/* Satz-Segmentierung (aus dem Testballon übernommen, inkl. Abkürzungs-Heuristik) */
/* -------------------------------------------------------------------------- */

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

/** Zählt Wörter in einem Text (Whitespace-getrennt, leere ignoriert). */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Zählt Absätze (durch Doppel-Zeilenumbruch getrennt, leere ignoriert).
 * Bewusst dieselbe Split-Semantik wie `buildAnchorParagraphs` (fill-template.ts),
 * damit der `absatz_min`-Check zur tatsächlich erzeugten DOCX-Struktur passt.
 */
function countAbsaetze(text: string): number {
  return text.split(/\n{2,}/).filter(p => p.trim().length > 0).length;
}

const LIST_MARKER = /^\s*(?:[-*•]\s|\d+[.)]\s)/;

/* -------------------------------------------------------------------------- */
/* Param-Accessoren (tolerant — `params` ist offen typisiert)                  */
/* -------------------------------------------------------------------------- */

function numParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function optNumParam(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strParam(params: Record<string, unknown>, key: string, fallback = ''): string {
  const v = params[key];
  return typeof v === 'string' ? v : fallback;
}

function strArrParam(params: Record<string, unknown>, key: string): string[] {
  const v = params[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function boolParam(params: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : fallback;
}

/* -------------------------------------------------------------------------- */
/* Regel-Handler: pro Typ ein Check + ein Prompt-Hinweis                       */
/* -------------------------------------------------------------------------- */

interface CheckOutcome {
  ok: boolean;
  label: string;
  detail?: string;
  /** Richtung des Verstoßes (nur Größen-Regeln) — propagiert in `CheckResult.richtung`. */
  richtung?: CheckRichtung;
  /** Gemessener Ist-Wert (nur Größen-Regeln) — propagiert in `CheckResult.messwert`. */
  messwert?: number;
  /** Lokalisierte Fundstellen — propagiert in `CheckResult.fundstellen`. */
  fundstellen?: { satzIndex: number; muster?: string }[];
}

interface RegelHandler {
  check: (finalerText: string, params: Record<string, unknown>) => CheckOutcome;
  hint: (params: Record<string, unknown>) => string;
}

/* -------------------------------------------------------------------------- */
/* Erkennung (verbotenes_muster) — EINE Quelle für Check-Engine + Live-Tester  */
/* -------------------------------------------------------------------------- */

/** Drei Eingabe-Modi des `verbotenes_muster`-Editors (steuert nur die Eingabe). */
export type EingabeModus = 'phrasen' | 'synonym' | 'regex';

/** Quelldaten einer Synonym-Gruppe: ein Stamm + austauschbare Varianten. */
export interface SynonymGruppe {
  stamm: string;
  varianten: string[];
}

/** Ein kompilierter Erkennungs-Eintrag: das Regex + sein menschenlesbares Label. */
export interface ErkennungsEintrag {
  regex: RegExp;
  label: string;
}

/** Entwertet Regex-Metazeichen → wörtliche (Phrasen-)Suche. Eine Quelle. */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Effektiver Eingabe-Modus einer Regel. Explizites `params.eingabeModus` gewinnt;
 * fehlt es (Alt-Regeln), wird aus dem Legacy-Flag `istRegex` abgeleitet
 * (`true → regex`, sonst `phrasen`) — so öffnen Bestandsregeln im richtigen Modus.
 */
export function eingabeModusOf(params: Record<string, unknown>): EingabeModus {
  const m = params.eingabeModus;
  if (m === 'phrasen' || m === 'synonym' || m === 'regex') return m;
  return boolParam(params, 'istRegex', false) ? 'regex' : 'phrasen';
}

/** Liest `params.gruppen` tolerant (offen typisiert) als `SynonymGruppe[]`. */
function gruppenParam(params: Record<string, unknown>): SynonymGruppe[] {
  const v = params.gruppen;
  if (!Array.isArray(v)) return [];
  return v
    .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
    .map(g => ({
      stamm: typeof g.stamm === 'string' ? g.stamm : '',
      varianten: Array.isArray(g.varianten)
        ? g.varianten.filter((x): x is string => typeof x === 'string')
        : [],
    }));
}

/**
 * Kompiliert eine Synonym-Gruppe zur (escapeten) Regex-Quelle:
 * Stamm + optionale Varianten-Alternation, durch `\s*` getrennt. Nur-Stamm →
 * `escape(stamm)`; nur-Varianten → `(?:a|b)`; leer → `''` (wird übersprungen).
 */
export function kompiliereGruppe(g: SynonymGruppe): string {
  const stamm = (g.stamm ?? '').trim();
  const varianten = (Array.isArray(g.varianten) ? g.varianten : [])
    .map(v => (v ?? '').trim())
    .filter(Boolean);
  const stammRe = stamm ? escapeRegexLiteral(stamm) : '';
  if (varianten.length === 0) return stammRe;
  const varRe = '(?:' + varianten.map(escapeRegexLiteral).join('|') + ')';
  return stammRe ? stammRe + '\\s*' + varRe : varRe;
}

/** Menschenlesbares Label einer Synonym-Gruppe: „Stamm var1/var2". */
function gruppenLabel(g: SynonymGruppe): string {
  const stamm = (g.stamm ?? '').trim();
  const varianten = (Array.isArray(g.varianten) ? g.varianten : [])
    .map(v => (v ?? '').trim())
    .filter(Boolean);
  return [stamm, varianten.length ? varianten.join('/') : '']
    .filter(Boolean)
    .join(' ');
}

/**
 * DIE Match-Quelle für `verbotenes_muster` — Check-Engine UND Live-Tester nutzen
 * sie, damit es keinen zweiten Matcher gibt. Liefert pro Eintrag das Regex und
 * ein menschenlesbares Label (kein roher Regex im UI/Hinweis).
 */
export function erkennungsEintraege(params: Record<string, unknown>): ErkennungsEintrag[] {
  if (eingabeModusOf(params) === 'synonym') {
    return gruppenParam(params)
      .map(g => ({ g, src: kompiliereGruppe(g) }))
      .filter(x => x.src.length > 0)
      .map(({ g, src }) => ({ regex: new RegExp(src, 'i'), label: gruppenLabel(g) }));
  }
  // phrasen | regex teilen sich `muster`; nur die Kompilierung unterscheidet sich.
  const istRegex = eingabeModusOf(params) === 'regex';
  return strArrParam(params, 'muster').map(m => {
    let regex: RegExp;
    try {
      regex = new RegExp(istRegex ? m : escapeRegexLiteral(m), 'i');
    } catch {
      // Ungültige User-Regex → als Literal behandeln statt zu crashen.
      regex = new RegExp(escapeRegexLiteral(m), 'i');
    }
    return { regex, label: m };
  });
}

const HANDLERS: Record<RegelTyp, RegelHandler> = {
  zeichen_max: {
    check: (text, params) => {
      const max = numParam(params, 'max', 1000);
      const len = text.length;
      return {
        ok: len <= max,
        label: `Zeichen ${len} / max ${max}`,
        messwert: len,
        ...(len > max ? { detail: `${len - max} Zeichen über dem Limit — kürzen.`, richtung: 'zu_lang' } : {}),
      };
    },
    hint: params => `Begrenze den finalen Text auf maximal ${numParam(params, 'max', 1000)} Zeichen inklusive Leerzeichen.`,
  },

  wortanzahl: {
    check: (text, params) => {
      const min = optNumParam(params, 'min');
      const max = optNumParam(params, 'max');
      const count = countWords(text);
      const tooFew = min !== undefined && count < min;
      const tooMany = max !== undefined && count > max;
      const range = min !== undefined && max !== undefined ? `${min}–${max}` : min !== undefined ? `≥ ${min}` : max !== undefined ? `≤ ${max}` : '—';
      return {
        ok: !tooFew && !tooMany,
        label: `Wortanzahl ${count} (${range})`,
        messwert: count,
        ...(tooFew
          ? { detail: 'Zu wenige Wörter — erweitern.', richtung: 'zu_kurz' }
          : tooMany
            ? { detail: 'Zu viele Wörter — kürzen.', richtung: 'zu_lang' }
            : {}),
      };
    },
    hint: params => {
      const min = optNumParam(params, 'min');
      const max = optNumParam(params, 'max');
      if (min !== undefined && max !== undefined) return `Schreibe ${min} bis ${max} Wörter.`;
      if (min !== undefined) return `Schreibe mindestens ${min} Wörter.`;
      if (max !== undefined) return `Schreibe höchstens ${max} Wörter.`;
      return 'Halte die Wortanzahl im vorgegebenen Bereich.';
    },
  },

  satzanzahl: {
    check: (text, params) => {
      const min = numParam(params, 'min', 8);
      const max = numParam(params, 'max', 12);
      const count = splitSentences(text).length;
      const ok = count >= min && count <= max;
      return {
        ok,
        label: `Satzanzahl ${count} (${min}–${max})`,
        messwert: count,
        ...(ok
          ? {}
          : count < min
            ? { detail: 'Zu kurz — erweitern.', richtung: 'zu_kurz' }
            : { detail: 'Zu lang — kürzen.', richtung: 'zu_lang' }),
      };
    },
    hint: params => `Schreibe ${numParam(params, 'min', 8)} bis ${numParam(params, 'max', 12)} Sätze.`,
  },

  satzlaenge_max: {
    check: (text, params) => {
      const maxWoerter = numParam(params, 'maxWoerter', 25);
      const sentences = splitSentences(text);
      const lange = sentences
        .map((s, i) => ({ nr: i + 1, woerter: countWords(s) }))
        .filter(x => x.woerter > maxWoerter);
      return {
        ok: lange.length === 0,
        label: lange.length === 0
          ? `Satzlänge im Limit (max ${maxWoerter} Wörter)`
          : `Satzlänge: ${lange.length} ${lange.length === 1 ? 'Satz' : 'Sätze'} über ${maxWoerter} Wörtern`,
        ...(lange.length > 0 ? { detail: `z.B. Satz ${lange[0]!.nr} (${lange[0]!.woerter} Wörter) — aufteilen.` } : {}),
      };
    },
    hint: params => `Formuliere kurze Sätze mit höchstens ${numParam(params, 'maxWoerter', 25)} Wörtern.`,
  },

  verbotenes_muster: {
    check: (text, params) => {
      const eintraege = erkennungsEintraege(params);
      if (eintraege.length === 0) return { ok: true, label: 'Keine verbotenen Muster' };
      const sentences = splitSentences(text);
      // ALLE Treffer sammeln (eine Fundstelle je Satz — der erste passende Eintrag),
      // damit das UI zyklisch zu jeder Stelle springen kann.
      const fundstellen: { satzIndex: number; muster?: string }[] = [];
      for (let i = 0; i < sentences.length; i++) {
        for (const eintrag of eintraege) {
          if (eintrag.regex.test(sentences[i]!)) {
            fundstellen.push({ satzIndex: i, muster: eintrag.label });
            break;
          }
        }
      }
      if (fundstellen.length === 0) return { ok: true, label: 'Keine verbotenen Muster' };
      const first = fundstellen[0]!;
      return {
        ok: false,
        label: 'Verbotenes Muster gefunden',
        // Bei GENAU einem Treffer byte-identisch zum Bestand (Label statt rohem
        // Regex — bei Synonym menschenlesbar, bei Phrasen = Muster); bei mehreren
        // die Anzahl + der erste Treffer.
        detail: fundstellen.length === 1
          ? `„${first.muster}" in Satz ${first.satzIndex + 1}.`
          : `${fundstellen.length} Stellen (u.a. „${first.muster}" in Satz ${first.satzIndex + 1}).`,
        fundstellen,
      };
    },
    // Zweiseitig (vermeiden + stattdessen) und REGEXFREI: ein gepflegter
    // `hinweisVermeiden` gewinnt; sonst menschenlesbare Labels (Phrasen/Synonym)
    // bzw. ein generischer Satz im Regex-Modus — nie roher Regex im Prompt.
    hint: params => {
      const modus = eingabeModusOf(params);
      const vermeiden = strParam(params, 'hinweisVermeiden').trim();
      const stattdessen = strParam(params, 'hinweisStattdessen').trim();
      let neg: string;
      if (vermeiden) {
        neg = `Vermeide ${vermeiden}.`;
      } else if (modus === 'regex') {
        neg = 'Vermeide die hinterlegten verbotenen Formulierungen.';
      } else {
        const labels = erkennungsEintraege(params).map(e => e.label).filter(Boolean);
        neg = labels.length
          ? `Vermeide Formulierungen wie ${labels.map(l => `„${l}"`).join(', ')}.`
          : 'Vermeide die hinterlegten verbotenen Formulierungen.';
      }
      return (neg + (stattdessen ? ` Formuliere stattdessen ${stattdessen}.` : '')).trim();
    },
  },

  pflicht_anfang: {
    check: (text, params) => {
      const ziel = strParam(params, 'text').trim();
      if (!ziel) return { ok: true, label: 'Pflicht-Anfang (kein Text gesetzt)' };
      const ok = text.trimStart().startsWith(ziel);
      return {
        ok,
        label: ok ? 'Pflicht-Anfang erfüllt' : 'Pflicht-Anfang fehlt',
        ...(ok ? {} : { detail: `Muss mit „${ziel.slice(0, 60)}…" beginnen.` }),
      };
    },
    hint: params => `Beginne den finalen Text exakt mit: „${strParam(params, 'text').trim()}"`,
  },

  keine_aufzaehlungen: {
    check: (text) => {
      const offender = text.split(/\r?\n/).find(l => LIST_MARKER.test(l));
      return {
        ok: !offender,
        label: offender ? 'Aufzählung im Fließtext gefunden' : 'Keine Aufzählungen im Fließtext',
        ...(offender ? { detail: `„${offender.trim().slice(0, 60)}…" — als Fließtext umformulieren.` } : {}),
      };
    },
    hint: () => 'Der finale Text ist Fließtext ohne Aufzählungen.',
  },

  absatz_min: {
    check: (text, params) => {
      const min = numParam(params, 'min', 1);
      // Absatz-Trennung identisch zu `buildAnchorParagraphs` (fill-template.ts):
      // Doppel-Zeilenumbruch trennt Absätze — so stimmt der Check mit dem DOCX-Ergebnis überein.
      const count = countAbsaetze(text);
      return {
        ok: count >= min,
        label: `Absätze ${count} (min ${min})`,
        messwert: count,
        ...(count < min ? { detail: `Nur ${count} ${count === 1 ? 'Absatz' : 'Absätze'} — mindestens ${min} erforderlich.` } : {}),
      };
    },
    hint: params => `Gliedere den finalen Text in mindestens ${numParam(params, 'min', 1)} Absätze.`,
  },

  // NF-administrativ: im finalen Text dürfen KEINE ungefüllten Platzhalter mehr
  // stehen (…/{…}/{a / b}/x €). Nutzt denselben Extraktor wie der Baustein-Katalog
  // (eine Quelle, kein Drift). Das ist das harte Tor „kein ungefüllter Platzhalter".
  nf_keine_platzhalter_reste: {
    check: (text) => {
      const reste = extractPlatzhalter(text);
      return {
        ok: reste.length === 0,
        label: reste.length === 0
          ? 'Alle Platzhalter gefüllt'
          : `${reste.length} ungefüllte(r) Platzhalter`,
        ...(reste.length > 0
          ? { detail: `z.B. „${reste[0]!.roh}" — füllen bzw. Alternative wählen.` }
          : {}),
      };
    },
    hint: () => 'Fülle alle Platzhalter (…, {…}, {a / b}, x €) aus — im finalen Text bleiben keine Reste.',
  },
};

function isKnownTyp(typ: string): typ is RegelTyp {
  return KNOWN_REGEL_TYPEN.has(typ);
}

/* -------------------------------------------------------------------------- */
/* Öffentliche Engine-API                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Prüft den finalen Text gegen die AKTIVEN Regeln. Unbekannte Typen werden
 * übersprungen. `level` = `'ok'` bei Erfolg, sonst der `schweregrad` der Regel.
 */
export function runRegelChecks(finalerText: string, regeln: QualitaetsRegel[]): CheckResult[] {
  const results: CheckResult[] = [];
  for (const regel of regeln) {
    if (!regel.aktiv) continue;
    if (!isKnownTyp(regel.typ)) continue;
    const outcome = HANDLERS[regel.typ].check(finalerText, regel.params);
    results.push({
      id: regel.id,
      regelId: regel.id,
      level: outcome.ok ? 'ok' : regel.schweregrad,
      label: outcome.label,
      kategorie: effektiveKategorie(regel),
      ...(outcome.detail ? { detail: outcome.detail } : {}),
      ...(outcome.richtung && !outcome.ok ? { richtung: outcome.richtung } : {}),
      ...(outcome.messwert !== undefined ? { messwert: outcome.messwert } : {}),
      ...(outcome.fundstellen && outcome.fundstellen.length > 0 ? { fundstellen: outcome.fundstellen } : {}),
    });
  }
  return results;
}

/** Erzeugt den deutschen Prompt-Hinweis einer einzelnen Regel (für Vorschau). */
export function buildPromptHinweis(regel: QualitaetsRegel): string | null {
  if (!isKnownTyp(regel.typ)) return null;
  return HANDLERS[regel.typ].hint(regel.params);
}

/**
 * Baut den Block „Formale Vorgaben", der dem Skill-Prompt zur Laufzeit
 * angehängt wird (nur AKTIVE, bekannte Regeln). Leerstring, wenn keine.
 */
export function buildPromptVorgaben(regeln: QualitaetsRegel[]): string {
  const hinweise: string[] = [];
  for (const r of regeln) {
    if (!r.aktiv || !isKnownTyp(r.typ)) continue;
    hinweise.push(HANDLERS[r.typ].hint(r.params));
  }
  if (hinweise.length === 0) return '';
  return `## Formale Vorgaben\n${hinweise.map(h => `- ${h}`).join('\n')}`;
}

/**
 * Regel→Korrektur-Ableitung (rein, kein LLM) — Journey-Paket 3.
 *
 * Aus einem verletzten `CheckResult` + seiner `QualitaetsRegel` deterministisch
 * ableiten, OB und WIE die KI korrigieren kann: welcher bestehende
 * `SkillModifierKey` (`neu`/`kuerzer`/`laenger`) plus eine deutsche
 * Zusatz-Anweisung mit konkreten Zielwerten (aus `regel.params`) und dem
 * gemessenen Ist-Wert (`check.messwert` — NIE aus `detail`-Strings geparst).
 *
 * Contract:
 *  - Liefert `null`, wenn keine deterministische KI-Aktion sinnvoll ist:
 *    `verbotenes_muster` (Stil-Entscheidung liegt beim Gutachter → nur „Anzeigen"),
 *    unbekannte Typen, `pruefart` `'fachlich'`/`'administrativ'`, sowie fehlende
 *    Pflicht-Parameter (nie werfen).
 *  - Die Anweisung ist eine ZUSATZ-Anweisung auf dem bestehenden Modifier-Pfad —
 *    hier werden KEINE neuen Modifier-Keys erfunden.
 *
 * Stil-Vorbild: `kategorien.ts` (private Maps + benannte Exports, kein Default).
 */
import type { QualitaetsRegel, SkillModifierKey } from './types';
import type { CheckResult } from './check-engine';

export interface RegelKorrektur {
  /** Bestehender Modifier, der den Korrektur-Lauf trägt. */
  modifier: SkillModifierKey;
  /** Deutsche Zusatz-Anweisung mit Zielwert (aus Regel) + Ist-Wert (aus Messwert). */
  anweisung: string;
  /** Button-Beschriftung, z.B. „Mit KI kürzen". */
  label: string;
}

/** Button-Beschriftung je Modifier (eine Quelle). */
const MODIFIER_LABEL: Record<SkillModifierKey, string> = {
  kuerzer: 'Mit KI kürzen',
  laenger: 'Mit KI erweitern',
  neu: 'Mit KI korrigieren',
};

/** Toleranter Zahlen-Accessor über dem offen typisierten `params`. */
function optNum(params: Record<string, unknown>, key: string): number | null {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function optStr(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === 'string' ? v.trim() : '';
}

/** „; aktuell {ist}." wenn ein Messwert vorliegt, sonst nur „." */
function istTail(messwert: number | undefined): string {
  return messwert !== undefined ? `; aktuell ${messwert}.` : '.';
}

function mk(modifier: SkillModifierKey, anweisung: string): RegelKorrektur {
  return { modifier, anweisung, label: MODIFIER_LABEL[modifier] };
}

/**
 * Zielwert (Limit) einer Regel für die Mono-Anzeige „{ist} / {limit}". `richtung`
 * wählt bei zweiseitigen Größen-Regeln den verletzten Rand (zu_lang → max,
 * zu_kurz → min). `null`, wenn kein sinnvoller Einzel-Zielwert existiert.
 */
export function regelLimit(regel: QualitaetsRegel, richtung?: CheckResult['richtung']): number | null {
  const p = regel.params;
  switch (regel.typ) {
    case 'zeichen_max':
      return optNum(p, 'max');
    case 'satzlaenge_max':
      return optNum(p, 'maxWoerter');
    case 'absatz_min':
      return optNum(p, 'min');
    case 'wortanzahl':
    case 'satzanzahl':
      if (richtung === 'zu_kurz') return optNum(p, 'min');
      if (richtung === 'zu_lang') return optNum(p, 'max');
      return optNum(p, 'max') ?? optNum(p, 'min');
    default:
      return null;
  }
}

/**
 * Leitet die deterministische Korrektur-Aktion aus Check + Regel ab; `null`, wenn
 * keine KI-Aktion vorgesehen ist (siehe Contract oben). Level-agnostisch — das UI
 * entscheidet separat, für welche Schweregrade der Button erscheint (nur `fehler`).
 */
export function regelKorrekturAnweisung(check: CheckResult, regel: QualitaetsRegel): RegelKorrektur | null {
  // Nicht-textliche Regeln werden nicht deterministisch per Modifier korrigiert.
  if (regel.pruefart === 'fachlich' || regel.pruefart === 'administrativ') return null;

  const p = regel.params;
  const ist = check.messwert;

  switch (regel.typ) {
    case 'zeichen_max': {
      const max = optNum(p, 'max');
      if (max == null) return null;
      return mk('kuerzer', `Kürze auf höchstens ${max} Zeichen${istTail(ist)}`);
    }
    case 'wortanzahl': {
      if (check.richtung === 'zu_kurz') {
        const min = optNum(p, 'min');
        if (min == null) return null;
        return mk('laenger', `Erweitere auf mindestens ${min} Wörter${istTail(ist)}`);
      }
      if (check.richtung === 'zu_lang') {
        const max = optNum(p, 'max');
        if (max == null) return null;
        return mk('kuerzer', `Kürze auf höchstens ${max} Wörter${istTail(ist)}`);
      }
      return null;
    }
    case 'satzanzahl': {
      if (check.richtung === 'zu_kurz') {
        const min = optNum(p, 'min');
        if (min == null) return null;
        return mk('laenger', `Erweitere auf mindestens ${min} Sätze${istTail(ist)}`);
      }
      if (check.richtung === 'zu_lang') {
        const max = optNum(p, 'max');
        if (max == null) return null;
        return mk('kuerzer', `Kürze auf höchstens ${max} Sätze${istTail(ist)}`);
      }
      return null;
    }
    case 'absatz_min': {
      // Min-Regel (keine `richtung` in der Engine) — Untererfüllung → erweitern.
      const min = optNum(p, 'min');
      if (min == null) return null;
      return mk('laenger', `Gliedere in mindestens ${min} Absätze${istTail(ist)}`);
    }
    case 'satzlaenge_max': {
      const maxWoerter = optNum(p, 'maxWoerter');
      if (maxWoerter == null) return null;
      return mk('neu', `Formuliere Sätze mit höchstens ${maxWoerter} Wörtern.`);
    }
    case 'pflicht_anfang': {
      const text = optStr(p, 'text');
      if (!text) return null;
      return mk('neu', `Beginne exakt mit: „${text}“`);
    }
    case 'keine_aufzaehlungen':
      return mk('neu', 'Wandle Aufzählungen in Fließtext um.');
    // Stil-Entscheidung liegt beim Gutachter → nur „Anzeigen", keine KI-Aktion.
    case 'verbotenes_muster':
      return null;
    default:
      return null;
  }
}

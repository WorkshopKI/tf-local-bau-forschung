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
import { pflichtAnfangAnweisung, type CheckResult } from './check-engine';

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
/**
 * Korrektur-Anweisung für die zweiseitigen Größen-Regeln (`wortanzahl`/`satzanzahl`).
 * Nennt den VERLETZTEN Rand — bewusst, gegen die naheliegende Vermutung.
 *
 * Zwei Alternativen wurden gemessen (Haiku, drei fiktive VBs, je drei Läufe, 08/2026;
 * gezählt sind die Läufe, deren korrigierter Text im Zielband liegt, über B und C):
 *
 * | Anweisung                          | B (400–500) | C (300–350) | zusammen |
 * |------------------------------------|-------------|-------------|----------|
 * | „mindestens 400" (diese Fassung)   | 9/9         | 5/9         | **14/18** |
 * | „400 bis 500"                      | 4/9         | 6/9         | 10/18    |
 * | „rund 450 (Spanne 400 bis 500)"    | 4/9         | 7/9         | 11/18    |
 *
 * Der Mechanismus dahinter: bei einer Untergrenze zielt das Modell darüber (+5 bis
 * +25 %), bei einer Spanne auf deren unteren Rand. Ob das trifft, hängt an der BREITE
 * des Bandes — B (100 Wörter breit) fängt den Überschuss, C (50) nicht. Eine Anweisung,
 * die für beide passt, gibt es in diesen drei Fassungen nicht; die hier ist die beste
 * gemessene, nicht die eleganteste.
 *
 * Offen (n=1, danach war das Mess-Budget erschöpft): „mindestens N, ziele auf rund
 * MITTE, überschreite MAX nicht" — der einzige Lauf lag mit 397/393/353 näher an den
 * Rändern als jede andere Fassung. Vor dem Einbau messen, nicht vermuten.
 */
function groessenKorrektur(
  check: CheckResult,
  p: QualitaetsRegel['params'],
  einheit: 'Wörter' | 'Sätze',
  ist: number | undefined,
): RegelKorrektur | null {
  if (check.richtung === 'zu_kurz') {
    const min = optNum(p, 'min');
    if (min == null) return null;
    return mk('laenger', `Erweitere auf mindestens ${min} ${einheit}${istTail(ist)}`);
  }
  if (check.richtung === 'zu_lang') {
    const max = optNum(p, 'max');
    if (max == null) return null;
    return mk('kuerzer', `Kürze auf höchstens ${max} ${einheit}${istTail(ist)}`);
  }
  return null;
}

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
    case 'wortanzahl':
      return groessenKorrektur(check, p, 'Wörter', ist);
    case 'satzanzahl':
      return groessenKorrektur(check, p, 'Sätze', ist);
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
      // NICHT selbst formulieren: die frühere Kurzform zeigte den Wortlaut zitiert
      // und abgeschnitten. Das ist Bug-Klasse 13 und trieb Qwen in eine
      // Reasoning-Schleife. Der Wortlaut gehört unzitiert auf eine eigene Zeile,
      // mit Hinweis auf das absichtliche Satz-Ende — eine Quelle für beide Pfade.
      return mk('neu', pflichtAnfangAnweisung(text, 'korrektur'));
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

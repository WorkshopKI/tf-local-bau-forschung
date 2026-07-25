/**
 * Auswertung deklarativer `Bedingung`-Bäume — die EINZIGE Heimat dieser Logik.
 *
 * Herausgelöst aus `ableitung.ts` (dort blieb sie modul-privat), weil ausser den
 * Nächste-Schritte-Regeln auch die Bearbeitungs-Meilensteine
 * (`@/core/meilensteine`) dieselben Bedingungen auswerten. Ein zweiter Evaluator
 * würde unweigerlich auseinanderlaufen (Normalisierung, Datums-Parsing,
 * Mehrfachwerte über TVs) — deshalb genau dieser eine.
 *
 * Rein: keine IO, keine Uhr. `heute` wird von aussen gereicht; fehlt es,
 * evaluieren die Datums-Operatoren zu `false`.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { Bedingung } from './typen';
import { normalisiereWert } from './typen';

const MS_TAG = 86_400_000;

/**
 * Auswertungs-Kontext: feldId → alle beobachteten Werte. Ein Feld kann MEHRERE
 * Werte tragen, wenn es auf TV-Ebene liegt und der Verbund mehrere Teilvorhaben
 * hat — die Blatt-Prädikate arbeiten deshalb durchgehend über `some`/`every`.
 */
export type BedingungsKontext = Map<string, string[]>;

/** Baut den Kontext aus Verbund-Feldern + je-TV-Feldern. Rein. */
export function baueKontext(
  felder: Record<string, string>,
  tvFelder?: Record<string, Record<string, string>>,
): BedingungsKontext {
  const m: BedingungsKontext = new Map();
  const add = (feldId: string, wert: string): void => {
    const list = m.get(feldId);
    if (list) list.push(wert); else m.set(feldId, [wert]);
  };
  for (const [f, w] of Object.entries(felder)) add(f, w);
  if (tvFelder) for (const rec of Object.values(tvFelder)) for (const [f, w] of Object.entries(rec)) add(f, w);
  return m;
}

/**
 * Wertet einen Bedingungs-Baum aus. `alle` = UND, `einige` = ODER; Blätter
 * prüfen einen Feldwert. Bei Mehrfachwerten (mehrere TVs) genügt EIN Treffer —
 * ausser bei `istNicht`/`leer`, die entsprechend negieren.
 */
export function pruefeBedingung(b: Bedingung, ctx: BedingungsKontext, heute?: string): boolean {
  if ('alle' in b) return b.alle.every(x => pruefeBedingung(x, ctx, heute));
  if ('einige' in b) return b.einige.some(x => pruefeBedingung(x, ctx, heute));
  const werte = ctx.get(b.feldId) ?? [];
  switch (b.op) {
    case 'ist': return werte.some(v => normalisiereWert(v) === normalisiereWert(b.wert ?? ''));
    case 'istNicht': return !werte.some(v => normalisiereWert(v) === normalisiereWert(b.wert ?? ''));
    case 'gefuellt': return werte.some(v => v.trim() !== '');
    case 'leer': return !werte.some(v => v.trim() !== '');
    case 'datumVor':
    case 'datumNach': {
      if (!heute) return false;
      const grenzeMs = new Date(heute).getTime() + b.tageRelativHeute * MS_TAG;
      const datum = werte.map(v => parseGermanDate(v)).find((d): d is string => !!d);
      if (!datum) return false;
      const ms = new Date(datum).getTime();
      return b.op === 'datumVor' ? ms < grenzeMs : ms > grenzeMs;
    }
    default: return false;
  }
}

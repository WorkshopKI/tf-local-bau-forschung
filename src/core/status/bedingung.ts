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
import { toVbPhaseNumber } from '@/core/utils/vb-phase-mappings';
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

/** Das erste lesbare Datum eines Feldes als Millisekunden, sonst `null`. */
function ersterDatumsWert(ctx: BedingungsKontext, feldId: string): number | null {
  const datum = (ctx.get(feldId) ?? [])
    .map(v => parseGermanDate(v))
    .find((d): d is string => !!d);
  if (!datum) return null;
  const ms = new Date(datum).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Wertet einen Bedingungs-Baum aus. `alle` = UND, `einige` = ODER; Blätter
 * prüfen einen Feldwert. Bei Mehrfachwerten (mehrere TVs) genügt EIN Treffer —
 * ausser bei `istNicht`/`leer`, die entsprechend negieren.
 *
 * `heute` ist der **injizierte Stichtag** — hier wird nie `new Date()` gerufen,
 * damit dieselben Daten am selben Stichtag immer dasselbe Ergebnis liefern.
 * Fehlt er, evaluieren die stichtagsabhängigen Operatoren zu `false`.
 */
/**
 * Sagt dieser Bedingungs-Baum überhaupt etwas? (v4.134)
 *
 * `{ einige: [] }` ist immer `false`, `{ alle: [] }` immer `true` — beide **ohne
 * Bezug zu den Daten**. Das ist keine Bedingung, sondern eine Lücke, und sie
 * darf nicht als Urteil durchgehen: am echten Meilenstein-Plan trugen 4 der 11
 * aktiven Knoten ein leeres `einige` und galten damit ab ihrer Soll-Woche für
 * immer als „gerissen" (gemessen 20.08.2026 — sie stellten 108 der 124 Anlässe
 * im Fristen-Widget). Wer nicht sagen kann, ob etwas erfüllt ist, sagt genau
 * das.
 *
 * Rekursiv, weil eine Lücke auch verschachtelt auftreten kann
 * (`{ alle: [{ einige: [] }] }` ist ebenfalls aussagelos).
 */
export function bedingungIstLeer(b: Bedingung): boolean {
  if ('alle' in b) return b.alle.every(bedingungIstLeer);
  if ('einige' in b) return b.einige.every(bedingungIstLeer);
  return false;
}

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
      const ms = ersterDatumsWert(ctx, b.feldId);
      if (ms === null) return false;
      return b.op === 'datumVor' ? ms < grenzeMs : ms > grenzeMs;
    }
    case 'tageSeit': {
      // Echtes `> N`, nicht `>= N`: die Mappe fragt „Widerspruchsfrist von 31
      // Tagen ABGELAUFEN" — an Tag 31 läuft sie noch, ab Tag 32 ist sie vorbei.
      if (!heute) return false;
      const ms = ersterDatumsWert(ctx, b.feldId);
      if (ms === null) return false;
      const heuteMs = new Date(heute).getTime();
      if (Number.isNaN(heuteMs)) return false;
      return Math.floor((heuteMs - ms) / MS_TAG) > b.tage;
    }
    case 'datumNachFeld': {
      // Kein Stichtag nötig — zwei Daten gegeneinander. Fehlt eines, ist die
      // Aussage nicht belegt und damit `false` (nicht „stimmt vermutlich").
      const a = ersterDatumsWert(ctx, b.feldId);
      const c = ersterDatumsWert(ctx, b.vergleichFeldId);
      if (a === null || c === null) return false;
      return a > c;
    }
    case 'foerdervarianteIn': {
      return werte.some(v => {
        const n = toVbPhaseNumber(v);
        return n !== null && b.varianten.includes(n);
      });
    }
    default: return false;
  }
}

/**
 * Alle Feld-Referenzen eines Bedingungs-Baums (dedupliziert, Reihenfolge stabil).
 *
 * Die **eine** Stelle, die weiß, welche Blatt-Formen ein Feld nennen — inklusive
 * des zweiten Feldes bei `datumNachFeld`. Aufrufer sind die Feld-Auflösung der
 * Meilensteine (`meilensteine/felder.ts`) und die Import-Validierung
 * (`export-import.ts`); liefe eine davon auf einer eigenen Kopie, fiele ein neuer
 * Operator dort still aus dem Auswertungs-Kontext und die Bedingung wäre
 * dauerhaft `false`, ohne dass es jemand merkt.
 */
export function bedingungFeldRefs(b: Bedingung, out: string[] = []): string[] {
  if ('alle' in b) {
    for (const x of b.alle) bedingungFeldRefs(x, out);
    return out;
  }
  if ('einige' in b) {
    for (const x of b.einige) bedingungFeldRefs(x, out);
    return out;
  }
  if (!out.includes(b.feldId)) out.push(b.feldId);
  if (b.op === 'datumNachFeld' && !out.includes(b.vergleichFeldId)) out.push(b.vergleichFeldId);
  return out;
}

/**
 * Welche `feldId` darf eine Bedingung überhaupt nennen? Die Katalog-Felder plus
 * ihre Begleit-**Textspalten** (`T_XPC+` gehört zu `D_XPC+`, trägt aber einen
 * anderen Wert — siehe `baueTodoKontext`).
 *
 * Der **eine** Prüfbegriff für beide Seiten: der Regel-Editor warnt damit vorab,
 * die Import-Validierung lehnt damit ab. Liefen sie auf zwei Listen, könnte man
 * im Editor eine Regel bauen, die der Share-Import später zurückweist — oder,
 * schlimmer, eine, die stillschweigend nie zutrifft.
 */
export function referenzierbareFelder(
  felder: readonly { feldId: string; textSpalte?: string }[],
): Set<string> {
  const out = new Set<string>();
  for (const f of felder) {
    if (typeof f?.feldId === 'string') out.add(f.feldId);
    if (f?.textSpalte) out.add(f.textSpalte);
  }
  return out;
}

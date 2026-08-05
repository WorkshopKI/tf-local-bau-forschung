/**
 * Der **Regelsatz** einer To-do-Regel: welche Rolle arbeitet diese Kaskade ab?
 *
 * Bis v2.389 gab es genau eine Kaskade, und die war die des AB. Die anderen
 * Rollen kamen darin nur als `wartetAuf` vor — der FB sah seine Arbeit
 * ausschließlich als Spiegelbild der AB-Sicht. Seit v2.390 trägt jede Regel
 * einen Regelsatz, und die Engine wertet je Rolle den ihren aus.
 *
 * **Ein Board, eine Engine, der Regelsatz als Parameter.** Ein zweites FB-Board
 * hätte zwei Auswertungen nebeneinander gestellt, und zwei Auswertungen laufen
 * auseinander — dieselbe Begründung wie beim geteilten Bedingungs-Evaluator
 * (Pitfall #41).
 *
 * Zwei Lesestellen, sonst keine — analog `rollenVonFeld` in `rollen.ts`.
 * Rein: keine IO, kein React.
 */
import type { Rolle, TodoRegel } from './typen';

/**
 * Der Regelsatz, den eine Regel ohne eigene Angabe meint.
 *
 * `'ab'`, weil der ausgelieferte Seed die AB-Mappe transkribiert: jede
 * Bestandsfassung in IDB und auf dem Share trägt Regeln ohne `regelsatz`, und
 * die sollen sich verhalten wie vorher — ohne dass jemand die geteilte Datei
 * umschreiben muss.
 */
export const REGELSATZ_DEFAULT: Rolle = 'ab';

/** Der Regelsatz einer Regel — die EINZIGE Lesestelle. */
export function regelsatzVon(regel: Pick<TodoRegel, 'regelsatz'>): Rolle {
  return regel.regelsatz ?? REGELSATZ_DEFAULT;
}

/**
 * Greift diese Sperre im Regelsatz dieser Rolle? — die EINZIGE Lesestelle.
 *
 * **Leer heißt „alle", nicht „keine".** Das ist die Konvention von
 * `StatusFeldEintrag.rollen` (Pitfall #43) und ausdrücklich NICHT die von
 * `TodoRegel.zustaendig`, wo leer „keine Rolle benannt" bedeutet. Die beiden
 * Konventionen stehen im selben Typ nebeneinander; wer sie verwechselt, legt
 * entweder alle Regelsätze still oder keinen.
 */
export function sperreGiltFuer(regel: Pick<TodoRegel, 'giltFuer'>, rolle: Rolle): boolean {
  const nur = regel.giltFuer;
  return nur === undefined || nur.length === 0 || nur.includes(rolle);
}

/** Präfix eines Strang-Eintrags in {@link TodoRegel.sperrt}: `strang:rne`. */
export const STRANG_PREFIX = 'strang:';

/** `strang:rne` → `rne`; alles andere → `null` (dann ist es eine Regel-Id). */
export function strangAusEintrag(eintrag: string): string | null {
  return eintrag.startsWith(STRANG_PREFIX)
    ? eintrag.slice(STRANG_PREFIX.length).trim() || null
    : null;
}

/**
 * Trifft dieser `sperrt`-Eintrag auf diese Regel zu? — die EINZIGE Lesestelle.
 *
 * Drei Formen, in dieser Reihenfolge geprüft: der Sentinel `'*'` (alles), ein
 * Strang-Eintrag (`strang:rne` gegen {@link TodoRegel.strang}), sonst eine
 * Regel-Id. Der Sentinel wird hier NICHT behandelt — er wirkt in `sperrLage`
 * über eine eigene Schranke, weil er auch Regeln erfasst, die es beim Schreiben
 * der Sperre noch gar nicht gab.
 *
 * **Eine Regel ohne `strang` wird von keinem Strang-Eintrag erfasst.** Das ist
 * die gewollte Lesart und zugleich die Falle, vor der das Detail warnt: wer eine
 * Regel in einen gesperrten Strang stellen will, muss ihn ihr geben.
 */
export function sperrEintragTrifft(eintrag: string, regel: Pick<TodoRegel, 'id' | 'strang'>): boolean {
  const strang = strangAusEintrag(eintrag);
  if (strang !== null) return regel.strang !== undefined && regel.strang.trim() === strang;
  return eintrag === regel.id;
}

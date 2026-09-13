/**
 * **Ein Wort je Uhr** — die eine Heimat der Wörter, mit denen die App sagt, ob
 * etwas zu spät ist.
 *
 * Drei Uhren messen Verschiedenes, und bis v6.65 hießen alle „überfällig" oder
 * „T über", in demselben Rot: die **Bearbeitungsfrist** (90 Tage ab wirksamem
 * Eingang, hält in Phasen ohne Frist), das **Soll eines Bearbeitungs-Meilensteins**
 * (Soll-Woche ab Anker) und der **Stillstand** gegen die Zieltage des Status. An
 * einem Vorgang standen so drei Tageszahlen nebeneinander, alle richtig, keine
 * erklärt — dazu eine vierte, die zweite 90-Tage-Uhr des Meilenstein-Plans ohne
 * Halt (seit v6.66 liest der Plan dieselbe Frist).
 *
 * Seither gilt, entschieden am 13.09.2026:
 * - **Frist** — „N Tage über der Frist" · „noch N Tage" · „heute fällig" ·
 *   „angehalten". Rot nur bei Überschreitung. Das Wort „überfällig" gehört nur
 *   ihr (Guard `ueberfaellig-nur-fuer-die-frist`).
 * - **Meilenstein** — „gerissen" · „fällig in N Tagen". Wie lange er schon
 *   gerissen ist, sagt der Titel, nicht die Zeile.
 * - **Stillstand** — „keine Bewegung seit N Tagen (Ziel M)". Orange: ein Signal
 *   zum Eingreifen, kein Rückstand.
 *
 * `kurz` ist für enge Spalten und Zeilen, `lang` für Sätze (Tagesbrief,
 * Kopfkarte, Assistent). Rein: keine Uhr, kein React.
 */
import type { FristErgebnis } from '@/core/services/csv/frist-ergebnis';

export type WortForm = 'kurz' | 'lang';

function tage(n: number, form: WortForm, dativ = false): string {
  if (form === 'kurz') return `${n} T`;
  if (n === 1) return `${n} Tag`;
  return `${n} ${dativ ? 'Tagen' : 'Tage'}`;
}

/**
 * Die Bearbeitungsfrist aus „Tagen bis zur Frist" — positiv = Frist in der
 * Zukunft, negativ = überschritten. Nur für eine **laufende** Uhr; wer den
 * Zustand hat, nimmt {@link fristWort}.
 */
export function fristTageWort(tageBisFrist: number, form: WortForm = 'kurz'): string {
  if (tageBisFrist === 0) return 'heute fällig';
  if (tageBisFrist > 0) return `noch ${tage(tageBisFrist, form)}`;
  return form === 'kurz'
    ? `${tage(-tageBisFrist, form)} über Frist`
    : `${tage(-tageBisFrist, form)} über der Frist`;
}

/** Die Bearbeitungsfrist aus ihrem Zustand — laufend, angehalten, nicht berechenbar. */
export function fristWort(
  e: Pick<FristErgebnis, 'zustand' | 'tageRest'>, form: WortForm = 'kurz',
): string {
  if (e.zustand === 'laeuft' && e.tageRest !== undefined) return fristTageWort(e.tageRest, form);
  if (e.zustand === 'angehalten') return form === 'kurz' ? 'angehalten' : 'Frist angehalten';
  return form === 'kurz' ? '—' : 'Frist nicht berechenbar';
}

/** Ein Meilenstein, dessen Soll vorbei ist. Ohne Tage steht nur das Urteil. */
export function gerissenWort(tageSeitSoll: number | null, form: WortForm = 'kurz'): string {
  if (tageSeitSoll === null || tageSeitSoll <= 0) return 'gerissen';
  return form === 'kurz'
    ? `gerissen seit ${tage(tageSeitSoll, form)}`
    : `seit ${tage(tageSeitSoll, form, true)} gerissen`;
}

/** Ein Meilenstein, dessen Soll bevorsteht. */
export function faelligWort(tageBisSoll: number, form: WortForm = 'kurz'): string {
  if (tageBisSoll <= 0) return 'heute fällig';
  return form === 'kurz'
    ? `fällig in ${tage(tageBisSoll, form)}`
    : `in ${tage(tageBisSoll, form, true)} fällig`;
}

/**
 * Der Stillstand: seit wann keine datierte Bewegung, gegen welches Ziel.
 *
 * `belegt === false` heißt: die Liegezeit ist aus dem jüngsten Kürzel-Datum
 * genähert und damit eine Untergrenze — der lange Satz sagt dann „mindestens",
 * der kurze „≥", sonst läse sich eine Schätzung wie eine Messung (`waechter.ts`).
 */
export function bewegungWort(
  liegeTage: number | null, zieltage: number | null, belegt: boolean, form: WortForm = 'kurz',
): string {
  if (liegeTage === null) return form === 'kurz' ? 'keine datierte Bewegung' : 'keine datierte Bewegung gefunden';
  if (form === 'kurz') {
    const ziel = zieltage === null ? '' : ` (Ziel ${tage(zieltage, form)})`;
    return `keine Bewegung seit ${belegt ? '' : '≥'}${tage(liegeTage, form)}${ziel}`;
  }
  // Im Satz ohne Klammer: der steht oft selbst schon in einer.
  const ziel = zieltage === null ? '' : `, Ziel ${tage(zieltage, form)}`;
  return `keine Bewegung seit ${belegt ? '' : 'mindestens '}${tage(liegeTage, form, true)}${ziel}`;
}

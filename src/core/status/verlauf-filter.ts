/**
 * Der geteilte Filterzustand des Verlaufs: **wer** (Rolle) und **wo**
 * (Verbund / Teilvorhaben). Beide Ansichten lesen denselben — eine Auswahl, die
 * beim Wechsel von der Chronik zum Zeitstrahl verfiele, wäre zweimal dieselbe
 * Frage.
 *
 * **Neutral verschwindet nie.** 144 der 505 Codes lässt das Fachsystem von jedem
 * setzen (`rollen: []`), und „jeder" ist keine Rolle, sondern deren Abwesenheit
 * ({@link ./rollen.ts}). Wer sie bei einer Rollenwahl ausblendet, nimmt gut ein
 * Viertel des Verlaufs weg und behauptet dabei, sie gehörten jemand anderem.
 * Sie bleiben deshalb stehen und werden **abgeblendet** — sichtbar, aber ohne
 * Aussage über die Zuständigkeit.
 *
 * Fremde Rollen dagegen dürfen aus einer **Liste** verschwinden: dort ist
 * Kürzen der Zweck der Auswahl. Im Zeitstrahl nicht — ein Verlauf verlöre seine
 * Form; er blendet stattdessen ab (`Sicht`-Wert `weg` wird dort wie `gedimmt`
 * behandelt, siehe {@link sichtFuerBahn}).
 *
 * Rein: keine Uhr, kein IDB, kein React.
 */
import { ROLLEN, rollenVonFeld } from './rollen';
import type { ChronikEintrag } from './chronik';
import type { OffenesPaarJeTv } from './waechter';
import type { Rolle } from './typen';

/** Die Spalten-/Trägerachse: der Verbund selbst oder ein Teilvorhaben. */
export const BEREICH_VERBUND = 'verbund';

/**
 * Was mit einer Zeile geschieht.
 *
 * `voll` — gehört zur Auswahl. `gedimmt` — bleibt stehen, ohne Tönung.
 * `weg` — aus der Liste genommen.
 */
export type Sicht = 'voll' | 'gedimmt' | 'weg';

/** Ist die Rollenwahl wirkungslos (leer oder vollständig)? */
export function rollenWahlOffen(wahl: ReadonlySet<Rolle>): boolean {
  return wahl.size === 0 || wahl.size >= ROLLEN.length;
}

/**
 * Wie eine Zeile mit diesen Rollen zur Wahl steht.
 *
 * Ohne wirksame Wahl ist alles `voll` — sonst trüge jede Zeile eine
 * Hervorhebung, und Hervorhebung überall ist keine.
 */
export function rollenSicht(rollen: readonly Rolle[], wahl: ReadonlySet<Rolle>): Sicht {
  if (rollenWahlOffen(wahl)) return 'voll';
  if (rollen.length === 0) return 'gedimmt';
  return rollen.some(r => wahl.has(r)) ? 'voll' : 'weg';
}

/** Im Zeitstrahl gibt es kein `weg` — die Bahn behielte sonst Lücken statt Form. */
export function sichtFuerBahn(sicht: Sicht): Exclude<Sicht, 'weg'> {
  return sicht === 'voll' ? 'voll' : 'gedimmt';
}

/**
 * Die Träger eines Eintrags als Bereichs-Ids.
 *
 * Leere `tvIds` heißen **Verbund**, nicht „niemand": Verbund-Felder liefern
 * bewusst genau einen Eintrag ohne `tvId` (`sammleVorkommen`).
 */
export function bereicheVon(tvIds: readonly string[]): readonly string[] {
  return tvIds.length === 0 ? [BEREICH_VERBUND] : tvIds;
}

/**
 * Schneidet die Träger eines Eintrags auf die Bereichswahl.
 *
 * Nötig für jede Ansicht, die **je Träger** rechnet — allen voran die
 * TV-Streuung der Schritt-Matrix. Ein Eintrag, dessen Teilvorhaben denselben Tag
 * tragen, ist EIN Eintrag mit mehreren `tvIds`; er überlebte `trifftBereich`
 * unverändert und füllte danach weiter die Spalten NICHT gewählter Teilvorhaben
 * („gleichzeitig"), während ein Kürzel mit auseinanderliegenden Tagen in
 * mehrere Einträge zerfällt, von denen nur einer übrig blieb — Streuung „–".
 * Derselbe Klick wirkte damit einmal als Zeilen- und einmal als Zellenfilter,
 * und die Spalte behauptete ausgerechnet bei den streuenden Zeilen, es liege
 * nichts auseinander (v4.124).
 *
 * Verbund-Einträge (leere `tvIds`) bleiben unangetastet — sie haben keinen
 * Träger, den man schneiden könnte.
 */
export function schneideAufBereich<T extends { tvIds: readonly string[] }>(
  eintraege: readonly T[], wahl: ReadonlySet<string>,
): T[] {
  if (wahl.size === 0) return [...eintraege];
  const out: T[] = [];
  for (const e of eintraege) {
    if (e.tvIds.length === 0) {
      if (wahl.has(BEREICH_VERBUND)) out.push(e);
      continue;
    }
    const behalten = e.tvIds.filter(id => wahl.has(id));
    if (behalten.length === 0) continue;
    out.push(behalten.length === e.tvIds.length ? e : { ...e, tvIds: behalten });
  }
  return out;
}

/** Steht mindestens ein Träger dieses Eintrags in der Bereichswahl? */
export function trifftBereich(tvIds: readonly string[], wahl: ReadonlySet<string>): boolean {
  if (wahl.size === 0) return true;
  return bereicheVon(tvIds).some(b => wahl.has(b));
}

/**
 * Wie viele **Datumsangaben** je Rolle in der aktuellen Bereichswahl stehen —
 * die Zahl neben dem Chip.
 *
 * Gezählt werden Zellen, nicht Ereignisse: derselbe Nenner wie in den
 * Kennzahlen darüber. Ein Eintrag mit zwei Rollen zählt für **beide** — die
 * Summe der Chips ist deshalb größer als die Zahl der Datumsangaben, und das
 * ist richtig so: `PC+` wird von AB **und** FB gesetzt.
 *
 * Neutrale Einträge zählen nirgends — sie gehören keiner Rolle. Ihre Zahl steht
 * separat als {@link neutralZaehler}, damit die Anzeige sie benennen kann,
 * statt sie verschwinden zu lassen.
 */
export function rollenZaehler(
  chronik: readonly ChronikEintrag[], bereichWahl: ReadonlySet<string>,
): Record<Rolle, number> {
  const out = { ab: 0, fb: 0, qs: 0, pa: 0, jur: 0 } as Record<Rolle, number>;
  for (const e of chronik) {
    if (!trifftBereich(e.tvIds, bereichWahl)) continue;
    const treffer = bereicheVon(e.tvIds).filter(
      b => bereichWahl.size === 0 || bereichWahl.has(b),
    ).length;
    for (const r of rollenVonFeld(e.feld)) out[r] += treffer;
  }
  return out;
}

/**
 * Rollen-Zähler über eine beliebige Menge rollentragender Einträge — die
 * **Bilanz einer Zeitstrahl-Bahn** (`VerlaufsUebergang[]`).
 *
 * Bewusst strukturell typisiert statt auf `VerlaufsUebergang` festgelegt: die
 * Regel ist dieselbe wie in {@link rollenZaehler} (ein Eintrag zählt für **jede**
 * seiner Rollen, neutrale zählen nirgends), und sie zweimal zu schreiben hieße,
 * dass Leiste und Bahn irgendwann zwei Zahlen für dieselbe Frage nennen.
 */
export function rollenBilanz(
  eintraege: readonly { rollen: readonly Rolle[] }[],
): Record<Rolle, number> {
  const out = { ab: 0, fb: 0, qs: 0, pa: 0, jur: 0 } as Record<Rolle, number>;
  for (const e of eintraege) for (const r of e.rollen) out[r] += 1;
  return out;
}

/** Datumsangaben ohne Rollenzuweisung („jeder darf setzen"). */
export function neutralZaehler(
  chronik: readonly ChronikEintrag[], bereichWahl: ReadonlySet<string>,
): number {
  let n = 0;
  for (const e of chronik) {
    if (rollenVonFeld(e.feld).length > 0) continue;
    if (!trifftBereich(e.tvIds, bereichWahl)) continue;
    n += bereicheVon(e.tvIds).filter(b => bereichWahl.size === 0 || bereichWahl.has(b)).length;
  }
  return n;
}

/** Wie viele Datumsangaben je Bereich — die Zahl neben „Verbund" / „TV 1". */
export function bereichZaehler(
  chronik: readonly ChronikEintrag[], rollenWahl: ReadonlySet<Rolle>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of chronik) {
    if (rollenSicht(rollenVonFeld(e.feld), rollenWahl) === 'weg') continue;
    for (const b of bereicheVon(e.tvIds)) out.set(b, (out.get(b) ?? 0) + 1);
  }
  return out;
}

/**
 * Nächster Zustand nach einem Klick auf einen Auswahl-Chip.
 *
 * **Erster Klick isoliert.** Wer auf „QS" klickt, während alles gewählt ist,
 * will QS sehen — nicht alles außer QS. Weitere Klicks addieren, und die Abwahl
 * des letzten fällt auf „alle" zurück, damit man sich nicht in einen leeren
 * Bildschirm klicken kann.
 */
export function schalteAuswahl<T>(
  wahl: ReadonlySet<T>, geklickt: T, alle: readonly T[],
): Set<T> {
  const vollstaendig = wahl.size === 0 || wahl.size >= alle.length;
  if (vollstaendig) return new Set([geklickt]);
  if (!wahl.has(geklickt)) return new Set([...wahl, geklickt]);
  const rest = new Set(wahl);
  rest.delete(geklickt);
  return rest.size === 0 ? new Set(alle) : rest;
}

/**
 * Die Lücken, die nach Rollen- und Bereichswahl übrig bleiben.
 *
 * Eine Lücke gehört genau einem Teilvorhaben und trägt höchstens eine Rolle
 * (`OffenesPaar.rolle`); ohne Rolle ist sie neutral und wird — wie neutrale
 * Termine — nicht weggefiltert.
 */
export function filterePaare(
  paare: readonly OffenesPaarJeTv[],
  rollenWahl: ReadonlySet<Rolle>,
  bereichWahl: ReadonlySet<string>,
): OffenesPaarJeTv[] {
  return paare.filter(p =>
    rollenSicht(p.rolle === null ? [] : [p.rolle], rollenWahl) !== 'weg'
    && trifftBereich([p.tvId], bereichWahl));
}

/**
 * Was eine To-do-Regel am **Bestand** tut: wie oft sie zutrifft, und wie oft sie
 * die Kaskade gewinnt.
 *
 * „Position 5 von 31" sagt einem Regelautor nichts. Die FB-Erhebung hat gezeigt,
 * warum: eine Regel traf 153 Vorgänge, gewann die Kaskade aber nur bei 43. Genau
 * dieser Unterschied **ist** das Kaskadendenken — wer ihn nicht sieht, hält eine
 * verdeckte Regel für wirkungslos und eine wirkungslose für gepflegt.
 *
 * **Kein zweiter Evaluator, kein zweiter Lauf.** Die Zahlen kommen aus dem
 * Ergebnis, das die Engine ohnehin liefert: `trefferLauf` bricht beim Sieger
 * NICHT ab, sondern führt jeden weiteren Treffer in `weitereTreffer` mit. Sieger
 * ∪ `weitereTreffer` ist damit exakt die Menge der Regeln, deren Bedingung
 * zutraf UND die keine Sperre unterdrückt hat — „Kaskade raus, Sperre bleibt",
 * per Konstruktion identisch zur Engine. `fb-erhebung.ts` geht denselben Weg und
 * begründet ihn dort ausführlich; ein eigener `pruefeBedingung`-Lauf wäre ein
 * zweiter Evaluator (Pitfall #41), und `sperrLage` ist modul-privat, aus gutem
 * Grund.
 *
 * **Sperren bekommen ihre eigene Zahl.** Eine Sperre erzeugt kein To-do und
 * taucht deshalb in keiner der beiden Mengen auf; „trifft 0 · gewinnt 0" an
 * jeder Sperre läse sich wie ein Messfehler. Gezählt wird stattdessen, wie oft
 * sie GREIFT — das steht in `gesperrtDurch`.
 *
 * Rein: keine IO, keine Uhr, kein React. Der Aufrufer bringt die bewerteten
 * Vorgänge mit (`useRegelWirkung`).
 */
import type { TodoErgebnis } from './todo-engine';
import type { TodoRegel } from './typen';

/** Ein Vorgang mit dem Ergebnis EINES Regelsatzes. */
export interface BewerteterLauf {
  aktenzeichen: string;
  ergebnis: TodoErgebnis;
}

/** Was eine Regel am Bestand tut. Alle Zahlen beziehen sich auf DENSELBEN Lauf. */
export interface RegelWirkung {
  /**
   * Vorgänge, bei denen diese Regel die Kaskade gewinnt — das To-do, das im
   * Board steht.
   */
  gewinnt: number;
  /**
   * Vorgänge, auf die ihre Bedingung zutrifft, ohne Kaskadenvorrang anderer
   * Regeln. Immer ≥ `gewinnt`. Der Sperr-Pass gilt weiterhin: ein stillgelegter
   * Strang zählt hier nicht mit, denn Sperren sind keine Kaskadenfrage.
   */
  trifftZu: number;
  /**
   * Nur an einer **Sperre**: in wie vielen Vorgängen sie greift. An gewöhnlichen
   * Regeln 0 — dort sind `gewinnt`/`trifftZu` die Aussage.
   */
  greift: number;
}

const NICHTS: RegelWirkung = { gewinnt: 0, trifftZu: 0, greift: 0 };

/** Die Signatur einer Regelmenge — ändert sie sich, ist ein Lauf veraltet. */
export interface WirkungsSignatur {
  wert: string;
}

/**
 * Wovon die Zahlen abhängen: Bestand (kommt vom Aufrufer), Stichtag — und
 * genau diese Angaben der Regeln.
 *
 * Bewusst NICHT die ganze Regel serialisiert: Beschreibung, To-do-Text und
 * Begründung ändern die Zahlen nicht, und ein Tippfehler in der Beschreibung
 * darf einen teuren Lauf nicht entwerten.
 */
export function wirkungsSignatur(
  regeln: readonly TodoRegel[], stichtag: string, rolle: string,
): WirkungsSignatur {
  const kern = [...regeln]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(r => [
      r.id, r.reihenfolge, r.aktiv ? 1 : 0,
      r.regelsatz ?? '', (r.giltFuer ?? []).join('+'),
      (r.sperrt ?? []).join('+'), (r.sperrtNicht ?? []).join('+'),
      JSON.stringify(r.bedingung),
    ].join('|'));
  return { wert: JSON.stringify({ stichtag, rolle, kern }) };
}

/**
 * Erhebt je Regel-Id die drei Zahlen. Rein; dieselbe Eingabe, dieselbe Ausgabe.
 *
 * Inaktive Regeln erscheinen NICHT im Ergebnis — sie stehen in keiner Kaskade,
 * und eine 0 an ihnen wäre keine Messung, sondern eine Tautologie. Der Aufrufer
 * unterscheidet damit „gemessen: nichts" von „nicht gemessen".
 */
export function erhebeRegelWirkung(
  laeufe: Iterable<BewerteterLauf>, regeln: readonly TodoRegel[],
): Map<string, RegelWirkung> {
  const out = new Map<string, RegelWirkung>();
  for (const r of regeln) {
    if (r.aktiv) out.set(r.id, { ...NICHTS });
  }

  for (const { ergebnis } of laeufe) {
    const sieger = ergebnis.regelId;
    if (sieger !== null) {
      const w = out.get(sieger);
      if (w) { w.gewinnt += 1; w.trifftZu += 1; }
    }
    // `weitereTreffer` kann den Sieger nicht enthalten (die Engine schreibt ihn
    // dort nicht hinein), doppelt gezählt wird also nichts.
    for (const t of ergebnis.weitereTreffer) {
      const w = out.get(t.regelId);
      if (w) w.trifftZu += 1;
    }
    for (const id of ergebnis.gesperrtDurch) {
      const w = out.get(id);
      if (w) w.greift += 1;
    }
  }

  return out;
}

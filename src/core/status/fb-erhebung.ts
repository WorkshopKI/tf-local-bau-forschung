/**
 * **Erhebungsmaterial für den FB-Regelsatz.**
 *
 * Für die AB-Seite gab es eine XLSX-Mappe zum Transkribieren; für die FB-Seite
 * gibt es nichts dergleichen. Die Spezifikation muss deshalb aus dem Bestand
 * kommen: wo warten die AB-Regeln schon heute auf den FB, und wo ist die
 * AB-Kaskade für eine rein fachliche Lage blind?
 *
 * Dieses Modul beantwortet die erste Frage (abgeleitete Platzhalter). Es ist
 * **rein** — Stichtag und die auszuwertende Menge kommen von außen, damit
 * dieselbe Rechnung im Regeln-Tab, im Export und im Test dasselbe liefert.
 */
import { ermittleTodosAlleRollen, type TodoErgebnis } from './todo-engine';
import { ROLLEN } from './rollen';
import type { BedingungsKontext } from './bedingung';
import type { Rolle, TodoRegel } from './typen';

/** Wie viele Beispiel-Aktenzeichen je Gruppe mitgeführt werden. */
export const BEISPIELE_MAX = 3;

/** Ein auszuwertender Vorgang: sein Aktenzeichen und sein Feld-Kontext. */
export interface ErhebungsFall {
  aktenzeichen: string;
  ctx: BedingungsKontext;
}

/** Ein bereits ausgewerteter Vorgang — die Form, die auch das Board schon hat. */
export interface BewerteterVorgang {
  aktenzeichen: string;
  todos: Record<Rolle, TodoErgebnis>;
}

/**
 * Eine Situation, in der eine Rolle heute nur geliehen dasteht: die
 * Herkunftsregel wartet auf sie, ein eigener Regelsatz beschreibt sie nicht.
 * Genau diese Zeilen sind die Tagesordnung des FB-Termins.
 */
export interface PlatzhalterGruppe {
  rolle: Rolle;
  /** Die Regel, aus deren `wartetAuf` der Platzhalter stammt. */
  quellRegelId: string;
  /** Menschenlesbare Herkunft („R2 · PreCheck negativ (Verbund)"). */
  beschreibung: string;
  todo: string;
  anzahl: number;
  /** Bis zu {@link BEISPIELE_MAX} Aktenzeichen — damit die Zahl prüfbar wird. */
  beispiele: string[];
}

/** Wie viel Arbeit eine Rolle sieht, und wie viel davon nur geliehen ist. */
export interface RollenBilanz {
  rolle: Rolle;
  todos: number;
  abgeleitet: number;
}

export interface PlatzhalterErhebung {
  /** Ausgewertete Vorgänge — ohne sie ist keine Zahl darunter einzuordnen. */
  gesamt: number;
  gruppen: PlatzhalterGruppe[];
  proRolle: RollenBilanz[];
}

/**
 * Fasst fertig ausgewertete Vorgänge zusammen. Rein.
 *
 * Getrennt von {@link erhebePlatzhalter}, weil das Board seine Ergebnisse
 * ohnehin schon hat — es soll für die Kopfzeile nicht ein zweites Mal über den
 * Bestand rechnen.
 */
export function fassePlatzhalterZusammen(
  vorgaenge: Iterable<BewerteterVorgang>, regeln: readonly TodoRegel[],
): PlatzhalterErhebung {
  const proRegel = new Map<string, PlatzhalterGruppe>();
  const bilanz = new Map<Rolle, RollenBilanz>(
    ROLLEN.map(r => [r, { rolle: r, todos: 0, abgeleitet: 0 }]),
  );
  let gesamt = 0;

  for (const v of vorgaenge) {
    gesamt += 1;
    for (const rolle of ROLLEN) {
      const e = v.todos[rolle];
      if (e.todo === null) continue;
      const b = bilanz.get(rolle)!;
      b.todos += 1;
      if (e.quelle !== 'abgeleitet' || e.abgeleitetAus === undefined) continue;
      b.abgeleitet += 1;
      const key = `${rolle}::${e.abgeleitetAus}`;
      const gruppe = proRegel.get(key);
      if (gruppe) {
        gruppe.anzahl += 1;
        if (gruppe.beispiele.length < BEISPIELE_MAX) gruppe.beispiele.push(v.aktenzeichen);
      } else {
        proRegel.set(key, {
          rolle,
          quellRegelId: e.abgeleitetAus,
          beschreibung: e.beschreibung ?? e.abgeleitetAus,
          todo: e.todo,
          anzahl: 1,
          beispiele: [v.aktenzeichen],
        });
      }
    }
  }

  // Häufigste zuerst — das ist die Reihenfolge, in der der Termin sie abarbeiten
  // sollte. Bei Gleichstand entscheidet die Kaskaden-Position, damit dieselbe
  // Eingabe immer dieselbe Ausgabe ergibt (der Export wird verglichen).
  const position = new Map(regeln.map(r => [r.id, r.reihenfolge]));
  const gruppen = [...proRegel.values()].sort((a, b) => (
    b.anzahl - a.anzahl
    || (position.get(a.quellRegelId) ?? Infinity) - (position.get(b.quellRegelId) ?? Infinity)
    || a.quellRegelId.localeCompare(b.quellRegelId)
  ));

  return {
    gesamt,
    gruppen,
    proRolle: ROLLEN.map(r => bilanz.get(r)!).filter(b => b.todos > 0),
  };
}

/** Wertet die Fälle aus und fasst sie zusammen. Rein. */
export function erhebePlatzhalter(
  faelle: Iterable<ErhebungsFall>, regeln: readonly TodoRegel[], stichtag: string,
): PlatzhalterErhebung {
  const bewertet: BewerteterVorgang[] = [];
  for (const f of faelle) {
    bewertet.push({
      aktenzeichen: f.aktenzeichen,
      todos: ermittleTodosAlleRollen(regeln, f.ctx, stichtag),
    });
  }
  return fassePlatzhalterZusammen(bewertet, regeln);
}

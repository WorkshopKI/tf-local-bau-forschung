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
import { ermittleTodosAlleRollen, baueTodoKontext, type TodoErgebnis } from './todo-engine';
import { ROLLEN, rollenVonFeld } from './rollen';
import { findeOffenePaare } from './waechter';
import { normKey } from './normalisierung';
import type { BedingungsKontext } from './bedingung';
import type { FeldVorkommen } from './feld-aufloesung';
import type { TriggerZeile } from './typen';
import type { MappingVersion, Rolle, TodoRegel } from './typen';

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

// --- (b) Blinde Flecken -----------------------------------------------------

/**
 * Ein Vorgang, bei dem **keine** Regel greift, aber ein Kürzel-Paar einseitig
 * offen steht.
 *
 * Das ist die ergiebigste der drei Auswertungen: die AB-Kaskade ist hier
 * nachweislich blind — sie sagt „kein To-do ermittelt" —, während die Daten
 * zeigen, dass jemand angefangen und nicht abgeschlossen hat. Genau solche
 * Situationen soll der FB-Regelsatz beschreiben.
 *
 * **Ohne To-do heißt: in KEINEM Regelsatz.** Ein Vorgang, der bereits ein
 * FB-To-do trägt, ist kein blinder Fleck mehr.
 */
export interface BlinderFleck {
  /** Das gesetzte Kürzel. */
  gesetzt: string;
  /** Das fehlende Gegenstück. */
  fehlt: string;
  fehltLabel: string;
  /** Rolle des fehlenden Kürzels — wessen Schreibtisch. */
  rolle: Rolle | null;
  anzahl: number;
  /** Median der Standzeit in Tagen. Eine Zahl ohne `anzahl` sagt nichts. */
  medianTage: number;
  beispiele: string[];
}

export interface BlindeFleckenErhebung {
  /** Ausgewertete Vorgänge insgesamt. */
  gesamt: number;
  /** Davon ohne To-do in jedem Regelsatz. */
  ohneTodo: number;
  paare: BlinderFleck[];
}

/** Median einer nicht-leeren Zahlenliste (Nächstgelegener Rang, kein Interpolieren). */
function median(werte: number[]): number {
  const s = [...werte].sort((a, b) => a - b);
  return s.length % 2 === 1
    ? s[(s.length - 1) / 2]!
    : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
}

/** Ein Vorgang mit allem, was die blinden Flecken brauchen. */
export interface FleckenFall {
  aktenzeichen: string;
  vorkommen: readonly FeldVorkommen[];
}

export function erhebeBlindeFlecken(
  faelle: Iterable<FleckenFall>,
  version: MappingVersion,
  regeln: readonly TodoRegel[],
  stichtag: string,
): BlindeFleckenErhebung {
  const proPaar = new Map<string, { fleck: Omit<BlinderFleck, 'anzahl' | 'medianTage'>; tage: number[] }>();
  let gesamt = 0;
  let ohneTodo = 0;

  for (const f of faelle) {
    gesamt += 1;
    const todos = ermittleTodosAlleRollen(regeln, baueTodoKontext(f.vorkommen), stichtag);
    if (ROLLEN.some(r => todos[r].todo !== null)) continue;
    ohneTodo += 1;
    for (const p of findeOffenePaare(version, f.vorkommen, stichtag)) {
      const key = `${p.gesetzt}→${p.fehlt}`;
      const eintrag = proPaar.get(key);
      if (eintrag) {
        eintrag.tage.push(p.tage);
        if (eintrag.fleck.beispiele.length < BEISPIELE_MAX) eintrag.fleck.beispiele.push(f.aktenzeichen);
      } else {
        proPaar.set(key, {
          fleck: {
            gesetzt: p.gesetzt, fehlt: p.fehlt, fehltLabel: p.fehltLabel,
            rolle: p.rolle, beispiele: [f.aktenzeichen],
          },
          tage: [p.tage],
        });
      }
    }
  }

  const paare = [...proPaar.values()]
    .map(({ fleck, tage }) => ({ ...fleck, anzahl: tage.length, medianTage: median(tage) }))
    .sort((a, b) => b.anzahl - a.anzahl || a.gesetzt.localeCompare(b.gesetzt));
  return { gesamt, ohneTodo, paare };
}

// --- (c) FB-Kürzel-Landkarte ------------------------------------------------

/** Ein Kürzel, das diese Rolle setzt — mit seinem Gewicht im Bestand. */
export interface KuerzelKarteZeile {
  code: string;
  label: string;
  /** In wie vielen Vorgängen ist das Kürzel gesetzt? */
  vorkommen: number;
  /** Was das Fachsystem beim Setzen auslöst (Satzform der Trigger-Tabelle). */
  wirkung: string[];
}

/**
 * Alle Kürzel einer Rolle mit ihrem Vorkommen im Bestand, absteigend.
 *
 * Die Landkarte beantwortet die Frage, mit der ein FB-Termin anfängt: „womit
 * arbeiten wir eigentlich?" — und sagt gleich dazu, was das Fachsystem beim
 * Setzen auslöst. Kürzel ohne Vorkommen bleiben in der Liste: dass ein Code
 * vorgesehen, aber nie gesetzt ist, ist selbst ein Befund.
 */
export function erhebeKuerzelKarte(
  version: MappingVersion,
  vorkommenJeCode: ReadonlyMap<string, number>,
  trigger: readonly TriggerZeile[],
  rolle: Rolle,
): KuerzelKarteZeile[] {
  const wirkungen = new Map<string, string[]>();
  for (const t of trigger) {
    const k = normKey(t.kuerzel);
    const list = wirkungen.get(k);
    if (list) { if (!list.includes(t.satz)) list.push(t.satz); } else wirkungen.set(k, [t.satz]);
  }
  return version.felder
    .filter(f => f.code !== undefined && rollenVonFeld(f).includes(rolle))
    .map(f => ({
      code: f.code!,
      label: f.label,
      vorkommen: vorkommenJeCode.get(normKey(f.code!)) ?? 0,
      wirkung: wirkungen.get(normKey(f.code!)) ?? [],
    }))
    .sort((a, b) => b.vorkommen - a.vorkommen || a.code.localeCompare(b.code));
}

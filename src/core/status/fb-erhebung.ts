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
import { findeOffenePaare, letzteAktivitaetVon, tageZwischen } from './waechter';
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
  /**
   * **Sichtbar heute**: wie oft die Rolle dieses To-do geliehen dastehen sieht.
   *
   * Gezählt wird nur, wo die Quellregel ihre Kaskade *gewinnt* — verliert sie
   * gegen eine frühere Regel, entsteht kein Platzhalter, obwohl ihre Bedingung
   * zutrifft.
   */
  alsPlatzhalter: number;
  /**
   * **Tatsächlich betroffen**: wie oft die Bedingung der Quellregel im Bestand
   * zutrifft, ohne Kaskaden-Vorrang anderer Regeln.
   *
   * Das ist die Größenordnung, die eine eigene Regel dieser Rolle erreichte:
   * sie stünde in ihrem Satz allein. Gemessen wurden 153 gegenüber 38 sichtbaren
   * Platzhaltern — wer nur die kleinere Zahl kennt, plant den Termin falsch.
   */
  bedingungTrifft: number;
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
  /** regelId → in wie vielen Vorgängen ihre Bedingung zutraf. */
  const trefferProRegel = new Map<string, number>();
  let gesamt = 0;

  for (const v of vorgaenge) {
    gesamt += 1;
    // Welche Regeln hat dieser Vorgang überhaupt getroffen? Die Antwort liegt
    // bereits vor: `trefferLauf` bricht beim Sieger NICHT ab, sondern führt jeden
    // weiteren Treffer in `weitereTreffer` mit. Sieger ∪ weitereTreffer ist damit
    // genau die Menge der Regeln, deren Bedingung zutraf UND die keine Sperre
    // unterdrückt hat — „Kaskade raus, Sperre bleibt", ohne einen zweiten
    // Auswertungslauf und ohne die Engine anzufassen.
    //
    // Restunschärfe: verrechnet ist die Sperr-Lage des QUELL-Regelsatzes, nicht
    // die der Zielrolle. Beide sind identisch, solange keine Sperre ein
    // `giltFuer` trägt (heute trägt keine eines) — siehe `ermittleTodosAlleRollen`.
    const getroffen = new Set<string>();
    for (const rolle of ROLLEN) {
      const e = v.todos[rolle];
      if (e.regelId !== null) getroffen.add(e.regelId);
      for (const w of e.weitereTreffer) getroffen.add(w.regelId);
    }
    for (const id of getroffen) trefferProRegel.set(id, (trefferProRegel.get(id) ?? 0) + 1);

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
        gruppe.alsPlatzhalter += 1;
        if (gruppe.beispiele.length < BEISPIELE_MAX) gruppe.beispiele.push(v.aktenzeichen);
      } else {
        proRegel.set(key, {
          rolle,
          quellRegelId: e.abgeleitetAus,
          beschreibung: e.beschreibung ?? e.abgeleitetAus,
          todo: e.todo,
          alsPlatzhalter: 1,
          bedingungTrifft: 0,   // erst nach dem Durchgang bekannt
          beispiele: [v.aktenzeichen],
        });
      }
    }
  }

  // Häufigste zuerst — das ist die Reihenfolge, in der der Termin sie abarbeiten
  // sollte. Sortiert wird nach der SICHTBAREN Zahl: sie ist der Anlass, über die
  // Situation zu reden; `bedingungTrifft` sagt danach, wie groß sie ist.
  // Bei Gleichstand entscheidet die Kaskaden-Position, damit dieselbe Eingabe
  // immer dieselbe Ausgabe ergibt (der Export wird verglichen).
  const position = new Map(regeln.map(r => [r.id, r.reihenfolge]));
  const gruppen = [...proRegel.values()]
    .map(g => ({ ...g, bedingungTrifft: trefferProRegel.get(g.quellRegelId) ?? 0 }))
    .sort((a, b) => (
      b.alsPlatzhalter - a.alsPlatzhalter
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
/**
 * Ab wann ein einseitig offenes Paar als **Altbestand** gilt und nicht als
 * Rückstand.
 *
 * Gemessen wurden Mediane von 746 und 1183 Tagen. Eine Situation, die zwei bis
 * drei Jahre so steht, ist keine liegengebliebene Aufgabe — sie ist die Frage,
 * ob das Paar unter allen Umständen gilt. Beides in einer Zahl zu bündeln hieße,
 * dem Termin einen Rückstand zu melden, den es nicht gibt.
 */
export const PAAR_ALTBESTAND_TAGE = 400;

/** Eine Hälfte des Alterssplits. Leer heißt `anzahl: 0` — kein fehlender Block. */
export interface FleckenBlock {
  anzahl: number;
  /** Median der Standzeit des Paares in Tagen. */
  medianTage: number;
  /**
   * Median der Tage seit der letzten Aktivität am Vorgang.
   *
   * Die zweite Frage neben der Standzeit: ein Paar, das seit 1 000 Tagen offen
   * steht, an dessen Vorgang aber vorgestern etwas passiert ist, ist laufende
   * Arbeit — eines ohne jede Bewegung ist eine Altlast der Datenpflege.
   */
  medianLetzteAktivitaet: number;
  beispiele: string[];
}

export interface BlinderFleck {
  /** Das gesetzte Kürzel. */
  gesetzt: string;
  /** Das fehlende Gegenstück. */
  fehlt: string;
  fehltLabel: string;
  /** Rolle des fehlenden Kürzels — wessen Schreibtisch. */
  rolle: Rolle | null;
  /** Summe beider Blöcke. */
  anzahl: number;
  /** Median der Standzeit über beide Blöcke. Eine Zahl ohne `anzahl` sagt nichts. */
  medianTage: number;
  /** Bis einschließlich {@link PAAR_ALTBESTAND_TAGE} Tage Standzeit. */
  aktuell: FleckenBlock;
  /** Länger — der Block, den der Termin anders behandeln muss. */
  altbestand: FleckenBlock;
}

export interface BlindeFleckenErhebung {
  /** Ausgewertete Vorgänge insgesamt. */
  gesamt: number;
  /** Davon ohne To-do in jedem Regelsatz. */
  ohneTodo: number;
  paare: BlinderFleck[];
}

/** Median einer Zahlenliste (Nächstgelegener Rang, kein Interpolieren); leer ⇒ 0. */
function median(werte: number[]): number {
  if (werte.length === 0) return 0;
  const s = [...werte].sort((a, b) => a - b);
  return s.length % 2 === 1
    ? s[(s.length - 1) / 2]!
    : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
}

/** Ein einzelner Paarfall — die Zeile, aus der die Blöcke gerechnet werden. */
interface Paarfall {
  aktenzeichen: string;
  /** Standzeit des Paares in Tagen. */
  tage: number;
  /** Tage seit der letzten Aktivität am Vorgang. */
  letzteAktivitaet: number;
}

function baueBlock(faelle: readonly Paarfall[]): FleckenBlock {
  return {
    anzahl: faelle.length,
    medianTage: median(faelle.map(f => f.tage)),
    medianLetzteAktivitaet: median(faelle.map(f => f.letzteAktivitaet)),
    beispiele: faelle.slice(0, BEISPIELE_MAX).map(f => f.aktenzeichen),
  };
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
  type Kopf = Pick<BlinderFleck, 'gesetzt' | 'fehlt' | 'fehltLabel' | 'rolle'>;
  const proPaar = new Map<string, { kopf: Kopf; faelle: Paarfall[] }>();
  let gesamt = 0;
  let ohneTodo = 0;

  for (const f of faelle) {
    gesamt += 1;
    const todos = ermittleTodosAlleRollen(regeln, baueTodoKontext(f.vorkommen), stichtag);
    if (ROLLEN.some(r => todos[r].todo !== null)) continue;
    ohneTodo += 1;
    // Einmal je Vorgang, nicht je Paar — dieselbe Zeitachse wie im Wächter
    // (Einzelquelle, kein zweiter Aktivitätsbegriff).
    const achse = letzteAktivitaetVon(f.vorkommen, version, stichtag).letzteAktivitaet;
    const seitAktivitaet = achse === null ? null : tageZwischen(achse, stichtag);
    for (const p of findeOffenePaare(version, f.vorkommen, stichtag)) {
      const key = `${p.gesetzt}→${p.fehlt}`;
      // Ohne lesbare Zeitachse (kein relevantes Datumsfeld) gilt das Datum der
      // gesetzten Paar-Seite: das IST eine Aktivität an diesem Vorgang, kein
      // stiller Ersatzwert. Der kleinere Wert gewinnt — er liegt näher an heute.
      const letzteAktivitaet = seitAktivitaet === null ? p.tage : Math.min(seitAktivitaet, p.tage);
      const fall: Paarfall = { aktenzeichen: f.aktenzeichen, tage: p.tage, letzteAktivitaet };
      const eintrag = proPaar.get(key);
      if (eintrag) {
        eintrag.faelle.push(fall);
      } else {
        proPaar.set(key, {
          kopf: { gesetzt: p.gesetzt, fehlt: p.fehlt, fehltLabel: p.fehltLabel, rolle: p.rolle },
          faelle: [fall],
        });
      }
    }
  }

  const paare = [...proPaar.values()]
    .map(({ kopf, faelle: fs }) => ({
      ...kopf,
      anzahl: fs.length,
      medianTage: median(fs.map(x => x.tage)),
      aktuell: baueBlock(fs.filter(x => x.tage <= PAAR_ALTBESTAND_TAGE)),
      altbestand: baueBlock(fs.filter(x => x.tage > PAAR_ALTBESTAND_TAGE)),
    }))
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

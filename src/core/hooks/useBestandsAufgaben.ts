/**
 * **Die Ablage des Bestandslaufs** — eine Rechnung, drei Leser.
 *
 * Der Lauf selbst steht in [bestands-lauf.ts](../status/bestands-lauf.ts); hier
 * wohnt sein Ergebnis, damit Vorgangs-Board, Startseite und Förderanträge-Liste
 * **dieselbe** Aussage zeigen statt drei eigene Rechnungen. Bis v4.132 war das
 * ein plugin-lokaler Board-Cache, an den die beiden anderen nicht herankamen.
 *
 * **Ein Cache muss sagen, dass er einer ist.** Jeder Leser zeigt Alter und einen
 * „neu berechnen"-Weg. Stille Momentaufnahmen sind genau die Art von
 * Unehrlichkeit, gegen die der Wächter argumentiert — eine Seite, die ohne
 * Hinweis vier Minuten alte Zahlen zeigt, wäre dasselbe in klein.
 *
 * **Niemand wartet blockierend.** Wer den Lauf nur braucht, um eine Spalte zu
 * füllen (Startseite, Liste), startet ihn im Leerlauf und zeigt bis dahin einen
 * Platzhalter — nie eine zweite, andere Antwort, die sich danach ändert.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { bestandGeneration } from '@/core/services/bestand-generation';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import { useProfile } from '@/core/hooks/useProfile';
import {
  getAktiveVersion, ladeAktiveVersion, leseStatusRolle, REGELSATZ_DEFAULT,
  aufgabeAusBestand, type Aufgabe, type MappingVersion, type Rolle, type TodoRegel,
} from '@/core/status';
import { laufeBestand, type BestandZeile } from '@/core/status/bestands-lauf';

/**
 * Wie lange ein Ergebnis ohne neues Signal gilt.
 *
 * Fünf Minuten wie der Anträge-Store. Sie ist die **Obergrenze** der Schalheit,
 * nicht der Normalfall — ein Import entwertet über die Bestands-Generation
 * sofort.
 */
export const BESTAND_CACHE_TTL_MS = 5 * 60 * 1000;

export interface BestandsDaten {
  version: MappingVersion;
  zeilen: BestandZeile[];
  /** Vom Betrachtungsbereich übersprungen. */
  ausgeblendet: number;
  ladeMs: number;
  /** `aktenzeichen` → Zeile. Einmal beim Ablegen gebaut, nicht je Render. */
  nachAktenzeichen: ReadonlyMap<string, BestandZeile>;
  /** `verbundId` → seine Teilvorhaben. Solo-Anträge stehen hier nicht drin. */
  nachVerbund: ReadonlyMap<string, BestandZeile[]>;
  /**
   * Aktenzeichen, deren Kaskade wegen einer greifenden Sperre schweigt —
   * Schlussvermerk oder Zuwendungsbescheid liegen vor.
   *
   * Gelesen wird der **AB-Satz**, nicht die gewählte Rolle: ob ein Verfahren
   * abgeschlossen ist, darf sich nicht verschieben, weil jemand seine Anzeige
   * umschaltet (dieselbe Begründung wie beim Wächter).
   */
  abgeschlossen: ReadonlySet<string>;
}

interface AblageState {
  schluessel: string | null;
  daten: BestandsDaten | null;
  /** Wann gerechnet wurde (für „berechnet vor N min"). */
  berechnetAm: number;
  /** `0` = nicht scharf. Wie `lastLoadedAt` im Anträge-Store. */
  standAt: number;
  laden: boolean;
  fehler: string | null;
  setzen: (schluessel: string, daten: BestandsDaten, gelesen: number) => void;
  setLaden: (v: boolean) => void;
  setFehler: (v: string | null) => void;
  entwerten: () => void;
}

export const useBestandsAblage = create<AblageState>(set => ({
  schluessel: null,
  daten: null,
  berechnetAm: 0,
  standAt: 0,
  laden: false,
  fehler: null,
  setzen: (schluessel, daten, gelesen) => set({
    schluessel,
    daten,
    berechnetAm: Date.now(),
    // Scharf nur, wenn wirklich etwas gelesen wurde — und gemessen an den
    // GELESENEN Sätzen, nicht an den Ergebniszeilen. Null Zeilen hat zwei sehr
    // verschiedene Ursachen:
    //  - Cold Start: die IDB ist noch nicht befüllt. Diesen Zustand
    //    festzuschreiben hiesse, die Seite bis zum Reload leer zu halten.
    //  - Ein Betrachtungsbereich, der alles ausschliesst. Das ist eine echte,
    //    stabile Antwort — sie soll nicht bei jedem Besuch neu erarbeitet werden.
    standAt: gelesen > 0 ? Date.now() : 0,
    fehler: null,
  }),
  setLaden: laden => set({ laden }),
  setFehler: fehler => set({ fehler }),
  entwerten: () => set({ schluessel: null, daten: null, standAt: 0, berechnetAm: 0 }),
}));

/** Gilt der Eintrag noch? Rein — `jetzt` kommt von aussen. */
export function ablageGilt(
  state: Pick<AblageState, 'schluessel' | 'daten' | 'standAt'>,
  schluessel: string,
  jetzt: number,
): boolean {
  return state.daten !== null
    && state.schluessel === schluessel
    && state.standAt > 0
    && jetzt - state.standAt < BESTAND_CACHE_TTL_MS;
}

/**
 * Der Schlüssel trägt alles, was das Ergebnis verändern kann: die Fassung
 * (Nummer UND Zeitstempel — bei einer Nummern-Kollision kann dieselbe Nummer
 * verschiedenen Inhalt tragen), den Betrachtungsbereich, die Bestands-Generation
 * und den Stichtag-TAG (alle Liegezeiten sind relativ zu ihm; eine über
 * Mitternacht offene Sitzung zeigte sonst die Zahlen von gestern).
 */
export function bestandsSchluessel(
  version: MappingVersion, bereichMenge: ReadonlySet<string> | null, stichtag: string,
): string {
  return [
    version.version,
    version.zeitstempel ?? '',
    bereichMenge === null ? 'alle' : [...bereichMenge].sort().join(','),
    bestandGeneration(),
    stichtag.slice(0, 10),
  ].join('|');
}

function baueDaten(
  version: MappingVersion, zeilen: BestandZeile[], ausgeblendet: number, ladeMs: number,
): BestandsDaten {
  const nachAktenzeichen = new Map<string, BestandZeile>();
  const nachVerbund = new Map<string, BestandZeile[]>();
  const abgeschlossen = new Set<string>();
  for (const z of zeilen) {
    nachAktenzeichen.set(z.aktenzeichen, z);
    const ab = z.todos[REGELSATZ_DEFAULT];
    if (ab.todo === null && ab.gesperrtDurch.length > 0) abgeschlossen.add(z.aktenzeichen);
    if (z.verbundId === null) continue;
    const liste = nachVerbund.get(z.verbundId);
    if (liste) liste.push(z); else nachVerbund.set(z.verbundId, [z]);
  }
  return { version, zeilen, ausgeblendet, ladeMs, nachAktenzeichen, nachVerbund, abgeschlossen };
}

/**
 * Läuft gerade ein Lauf für diesen Schlüssel? Modul-global, nicht im Store: zwei
 * Leser auf derselben Seite (Liste + Startseiten-Widget) würden den 5-Sekunden-
 * Lauf sonst doppelt anstoßen.
 */
const laufend = new Map<string, Promise<void>>();

async function starteLauf(
  idb: Parameters<typeof laufeBestand>[0],
  version: MappingVersion,
  bereichMenge: ReadonlySet<string> | null,
  stichtag: string,
  schluessel: string,
): Promise<void> {
  const vorhanden = laufend.get(schluessel);
  if (vorhanden) return vorhanden;
  const p = (async () => {
    const store = useBestandsAblage.getState();
    store.setLaden(true);
    try {
      const lauf = await laufeBestand(idb, version, bereichMenge, stichtag);
      useBestandsAblage.getState().setzen(
        schluessel,
        baueDaten(version, lauf.zeilen, lauf.uebergangen, lauf.takt.gesamtMs),
        // GELESEN, nicht „übrig": ein Bereich, der alles wegnimmt, ist eine
        // Antwort — ein leerer Store ist keine.
        lauf.zeilen.length + lauf.uebergangen,
      );
    } catch (err) {
      // Entwerten, damit ein gescheiterter Lauf beim nächsten Aufruf heilt statt
      // hinter einem scharfen, aber leeren Eintrag zu stranden.
      useBestandsAblage.getState().entwerten();
      useBestandsAblage.getState().setFehler(
        (err as Error).message ?? 'Der Bestand konnte nicht berechnet werden.',
      );
    } finally {
      useBestandsAblage.getState().setLaden(false);
      laufend.delete(schluessel);
    }
  })();
  laufend.set(schluessel, p);
  return p;
}

/** Wann der Lauf angestoßen wird. */
export type LaufStart =
  /** Beim Mount, ohne Verzögerung — für Seiten, die ohne ihn nichts zeigen. */
  | 'sofort'
  /** Im nächsten Leerlauf — für Seiten, die ihn nur ergänzend brauchen. */
  | 'leerlauf'
  /** Gar nicht; es wird nur gelesen, was schon da ist. */
  | 'nie';

export interface BestandsAufgaben {
  laden: boolean;
  fehler: string | null;
  version: MappingVersion | null;
  zeilen: BestandZeile[];
  nachAktenzeichen: ReadonlyMap<string, BestandZeile>;
  nachVerbund: ReadonlyMap<string, BestandZeile[]>;
  /** Aktenzeichen mit greifender Sperre und ohne To-do — Verfahren durch. */
  abgeschlossen: ReadonlySet<string>;
  /** Ein gültiges Ergebnis liegt vor — auch wenn es leer ist. */
  bereit: boolean;
  /** Wie viele Anträge der Betrachtungsbereich weggenommen hat. */
  ausgeblendet: number;
  /** Rechenzeit des letzten Laufs, in Millisekunden. */
  ladeMs: number | null;
  /** Wann die Zahlen gerechnet wurden (`Date.now()`); `0` = noch nie. */
  berechnetAm: number;
  /** Die Fassung führt keine To-do-Regeln — dann kann die Kaskade nichts sagen. */
  ohneRegeln: boolean;
  /** Den Bestand neu durchrechnen, am Cache vorbei. */
  neuBerechnen: () => void;
}

const LEER_AKTEN: ReadonlyMap<string, BestandZeile> = new Map();
const LEER_VERBUND: ReadonlyMap<string, BestandZeile[]> = new Map();
const LEER_ZEILEN: BestandZeile[] = [];
const LEER_ABGESCHLOSSEN: ReadonlySet<string> = new Set();

/**
 * Das Ergebnis des Bestandslaufs lesen — und ihn anstoßen, wenn er fehlt.
 *
 * @param start Wann angestoßen wird (siehe {@link LaufStart}). Voreinstellung
 *   `'leerlauf'`: der häufigste Leser ist eine Seite, die auch ohne den Lauf
 *   etwas zeigt.
 * @param stichtag ISO. Wird **einmal je Aufrufer** gestempelt und darf sich
 *   während dessen Lebensdauer nicht ändern.
 */
export function useBestandsAufgaben(start: LaufStart, stichtag: string): BestandsAufgaben {
  const idb = useStorage().idb;
  const bereichMenge = useBereich().menge;
  const zustand = useBestandsAblage();

  // Die Fassung steht ohne `statusCockpit` gar nicht zur Verfügung; dann gibt es
  // keine Kaskade und der Lauf entfällt (die Leser fallen auf ihre bisherige
  // Anzeige zurück).
  const version = getAktiveVersion();
  const schluessel = useMemo(
    () => (version ? bestandsSchluessel(version, bereichMenge, stichtag) : null),
    [version, bereichMenge, stichtag],
  );

  const anstossen = useCallback((neu: boolean) => {
    void (async () => {
      const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      const key = bestandsSchluessel(v, bereichMenge, stichtag);
      if (!neu && ablageGilt(useBestandsAblage.getState(), key, Date.now())) return;
      if (neu) useBestandsAblage.getState().entwerten();
      await starteLauf(idb, v, bereichMenge, stichtag, key);
    })();
  }, [idb, bereichMenge, stichtag]);

  useEffect(() => {
    if (start === 'nie') return;
    if (schluessel !== null && ablageGilt(zustand, schluessel, Date.now())) return;
    if (start === 'sofort') { anstossen(false); return; }
    return scheduleIdle(() => anstossen(false));
    // `zustand` bewusst NICHT in den Dependencies: der Effekt soll auf einen
    // Wechsel von Bereich/Fassung reagieren, nicht auf jede Store-Änderung, die
    // er selbst auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, schluessel, anstossen]);

  const gilt = schluessel !== null && ablageGilt(zustand, schluessel, Date.now());
  const daten = gilt ? zustand.daten : null;
  const neuBerechnen = useCallback(() => anstossen(true), [anstossen]);

  return {
    laden: zustand.laden,
    fehler: zustand.fehler,
    version: daten?.version ?? version,
    zeilen: daten?.zeilen ?? LEER_ZEILEN,
    nachAktenzeichen: daten?.nachAktenzeichen ?? LEER_AKTEN,
    nachVerbund: daten?.nachVerbund ?? LEER_VERBUND,
    abgeschlossen: daten?.abgeschlossen ?? LEER_ABGESCHLOSSEN,
    bereit: daten !== null,
    ausgeblendet: daten?.ausgeblendet ?? 0,
    ladeMs: daten?.ladeMs ?? null,
    berechnetAm: gilt ? zustand.berechnetAm : 0,
    ohneRegeln: version !== null && (version.todoRegeln ?? []).length === 0,
    neuBerechnen,
  };
}

export interface ZeilenAufgaben {
  /**
   * Die Aufgabe einer Zeile — `aktenzeichen` sind die Teilvorhaben, für die sie
   * steht (bei einer Verbundzeile alle des Clusters). `null` = liegt (noch)
   * nicht vor; ob das Warten oder Schweigen heißt, sagt {@link laeuftNoch}.
   */
  fuer: (aktenzeichen: readonly string[]) => Aufgabe | null;
  /** Der Lauf ist unterwegs — dann zeigt die Anzeige einen Platzhalter. */
  laeuftNoch: boolean;
  /** Die Regeln der geltenden Fassung; nur zum Benennen der Sperren. */
  regeln: readonly TodoRegel[];
  /** Der gelesene Regelsatz — gehört sichtbar an die Anzeige. */
  rolle: Rolle;
  /** Die Fassung führt keine To-do-Regeln. */
  ohneRegeln: boolean;
}

/**
 * Der Leser für **Zeilen**: Startseite, Kanban-Karte, Tabellenspalte.
 *
 * Bündelt, was jede dieser Flächen sonst einzeln zusammensuchen müsste — die
 * Ablage, die Rollenwahl aus dem Profil und die Regeln zum Benennen der Sperren.
 * Die Rollenwahl kommt aus dem Profil wie im Ausklapp und im Board
 * (`leseStatusRolle`); `'alle'` liest den AB-Satz, genau wie `sichtVon` dort.
 */
export function useZeilenAufgaben(start: LaufStart, stichtag: string): ZeilenAufgaben {
  const { profile } = useProfile();
  const bestand = useBestandsAufgaben(start, stichtag);
  const gewaehlt = leseStatusRolle(profile?.status_rolle);
  const rolle: Rolle = gewaehlt === 'alle' ? REGELSATZ_DEFAULT : gewaehlt;
  const register = bestand.nachAktenzeichen;
  const ohneRegeln = bestand.ohneRegeln;

  const fuer = useCallback(
    (aktenzeichen: readonly string[]): Aufgabe | null =>
      aufgabeAusBestand(aktenzeichen, register, rolle, ohneRegeln),
    [register, rolle, ohneRegeln],
  );

  return {
    fuer,
    // Ohne Fassung (kein `statusCockpit`) läuft gar nichts — dann ist die
    // Kaskade nicht „unterwegs", sie gibt es hier nicht. Ein gescheiterter Lauf
    // zählt genauso: beide Male ist der Rückfall die ehrliche Anzeige.
    laeuftNoch: start !== 'nie' && !bestand.bereit
      && bestand.version !== null && bestand.fehler === null,
    regeln: bestand.version?.todoRegeln ?? [],
    rolle,
    ohneRegeln,
  };
}

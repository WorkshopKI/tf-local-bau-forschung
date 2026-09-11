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
 * Platzhalter — nie die Status-Formel, die sich danach in etwas anderes
 * verwandelt.
 *
 * **Nach einem Import bleibt der alte Stand stehen, als solcher markiert**
 * (`vorlaeufig`). Der Import entwertet das Ergebnis sofort, gerechnet wird aber
 * erst nach dem Veröffentlichen — auf dem echten Share 30–40 s, in denen die
 * Startseite sonst in jeder Zeile „…" zeigte und sich wie ein Hänger las. Die
 * To-dos von vor dem Import stimmen fast immer noch. Das gilt nur, wenn sich
 * **allein** die Bestands-Generation geändert hat: ein anderer Bereich, eine
 * andere Fassung, ein anderer Tag ist eine andere Frage, und deren alte Antwort
 * wäre falsch, nicht nur alt.
 *
 * **Gezeigt wird, was zum Schlüssel passt — nicht, was jünger als die TTL ist.**
 * Die TTL entscheidet nur, ob der nächste Anstoß neu rechnet. Bis v6.57.1 hing
 * auch die Anzeige an ihr: geprüft wurde bei jedem Render gegen die Uhr, der
 * Effekt, der neu rechnet, hing aber nur am Schlüssel. Eine Startseite, die
 * länger als fünf Minuten offen stand, zeigte beim nächsten Re-Render in allen
 * To-do-Zellen „…" und rechnete nie wieder — bis zum Reload (gemessen
 * 11.09.2026: 0 → 13 Platzhalter, kein Lauf in 12 s). Einen Timer auf den
 * Ablauf gibt es bewusst nicht: der Lauf belegt den Hauptthread mehrere
 * Sekunden, und ein Ergebnis, dessen Schlüssel noch passt, ist nicht falsch —
 * jeder Bestandswechsel ändert den Schlüssel.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStorage } from '@/core/hooks/useStorage';
import { useBereich } from '@/core/hooks/useBereich';
import { bestandGeneration } from '@/core/services/bestand-generation';
import { useBestandGeneration } from '@/core/hooks/useBestandGeneration';
import { scheduleIdle } from '@/core/utils/scheduleIdle';
import { useStartupDataStatus } from '@/core/services/csv/startup-data-status';
import { useProfile } from '@/core/hooks/useProfile';
import {
  getAktiveVersion, ladeAktiveVersion, leseStatusRolle, REGELSATZ_DEFAULT,
  aufgabeAusBestand, bestandslaufMenge, type Aufgabe, type MappingVersion, type Rolle, type TodoRegel,
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

/**
 * Wie lange ein Leerlauf-Leser höchstens auf das Ende des Start-Datenlaufs
 * wartet, bevor er ohne dessen Signal anläuft.
 *
 * Kein Performance-Wert, sondern eine Reißleine: die Startphase kann hängen
 * bleiben (siehe Effekt unten), und eine dauerhaft leere Aufgaben-Spalte wäre
 * schlimmer als ein zu früher Lauf.
 */
export const LEERLAUF_RUECKFALL_MS = 60 * 1000;

export interface BestandsDaten {
  version: MappingVersion;
  zeilen: BestandZeile[];
  /** Vom Betrachtungsbereich übersprungen. */
  ausgeblendet: number;
  /** Im Bereich, aber älterer Richtlinie — gelesen, nicht gerechnet (Aktenzeichen). */
  nichtGerechnet: ReadonlySet<string>;
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
  /**
   * Der Schlüssel OHNE Bestands-Generation ({@link bestandsBasis}). Stimmt er mit
   * dem gefragten überein, während der volle Schlüssel abweicht, hat sich nur der
   * Bestand geändert — dann darf der alte Stand vorläufig stehen bleiben.
   */
  basis: string | null;
  daten: BestandsDaten | null;
  /** Wann gerechnet wurde (für „berechnet vor N min"). */
  berechnetAm: number;
  /** `0` = nicht scharf. Wie `lastLoadedAt` im Anträge-Store. */
  standAt: number;
  laden: boolean;
  fehler: string | null;
  setzen: (schluessel: string, daten: BestandsDaten, gelesen: number, basis?: string | null) => void;
  setLaden: (v: boolean) => void;
  setFehler: (v: string | null) => void;
  entwerten: () => void;
}

export const useBestandsAblage = create<AblageState>(set => ({
  schluessel: null,
  basis: null,
  daten: null,
  berechnetAm: 0,
  standAt: 0,
  laden: false,
  fehler: null,
  setzen: (schluessel, daten, gelesen, basis = null) => set({
    schluessel,
    basis,
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
  entwerten: () => set({ schluessel: null, basis: null, daten: null, standAt: 0, berechnetAm: 0 }),
}));

/**
 * Passt der Eintrag zur Frage? Dann wird er gezeigt — egal wie alt. Rein.
 *
 * Nicht scharf (`standAt === 0`) passt nie: ein Cold Start mit leerer IDB ist
 * keine Antwort.
 */
export function ablagePasst(
  state: Pick<AblageState, 'schluessel' | 'daten' | 'standAt'>,
  schluessel: string,
): boolean {
  return state.daten !== null && state.schluessel === schluessel && state.standAt > 0;
}

/**
 * Ist der Eintrag noch frisch, also KEIN neuer Lauf nötig? Rein — `jetzt` kommt
 * von aussen. Entscheidet nur über den Anstoß, nicht über die Anzeige
 * ({@link ablagePasst}; siehe Dateikopf).
 */
export function ablageGilt(
  state: Pick<AblageState, 'schluessel' | 'daten' | 'standAt'>,
  schluessel: string,
  jetzt: number,
): boolean {
  return ablagePasst(state, schluessel) && jetzt - state.standAt < BESTAND_CACHE_TTL_MS;
}

/**
 * Darf der Eintrag vorläufig stehen bleiben? Genau dann, wenn er zu einer
 * anderen Bestands-Generation gehört, sonst aber dieselbe Frage beantwortet —
 * gleiche {@link bestandsBasis}. Rein.
 */
export function ablageVorlaeufig(
  state: Pick<AblageState, 'schluessel' | 'basis' | 'daten' | 'standAt'>,
  schluessel: string,
  basis: string,
): boolean {
  return state.daten !== null && state.standAt > 0
    && state.basis === basis && state.schluessel !== schluessel;
}

/**
 * Der Schlüssel trägt alles, was das Ergebnis verändern kann: die Fassung
 * (Nummer UND Zeitstempel — bei einer Nummern-Kollision kann dieselbe Nummer
 * verschiedenen Inhalt tragen), den Betrachtungsbereich, die Bestands-Generation
 * und den Stichtag-TAG (alle Liegezeiten sind relativ zu ihm; eine über
 * Mitternacht offene Sitzung zeigte sonst die Zahlen von gestern) — und die
 * Programme, die tatsächlich gerechnet werden (`bestandslaufMenge`).
 */
export function bestandsSchluessel(
  version: MappingVersion, bereichMenge: ReadonlySet<string> | null, stichtag: string,
  laufMenge: ReadonlySet<string> | null = null,
): string {
  return `${bestandsBasis(version, bereichMenge, stichtag, laufMenge)}|g${bestandGeneration()}`;
}

/**
 * Der Schlüssel ohne die Bestands-Generation — alles, was die FRAGE ausmacht,
 * nicht den Bestand, auf den sie trifft. Siehe {@link ablageVorlaeufig}.
 */
export function bestandsBasis(
  version: MappingVersion, bereichMenge: ReadonlySet<string> | null, stichtag: string,
  laufMenge: ReadonlySet<string> | null = null,
): string {
  return [
    version.version,
    version.zeitstempel ?? '',
    bereichMenge === null ? 'alle' : [...bereichMenge].sort().join(','),
    laufMenge === null ? '-' : [...laufMenge].sort().join(','),
    stichtag.slice(0, 10),
  ].join('|');
}

function baueDaten(
  version: MappingVersion, zeilen: BestandZeile[], ausgeblendet: number, ladeMs: number,
  nichtGerechnet: readonly string[] = [],
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
  return {
    version, zeilen, ausgeblendet, nichtGerechnet: new Set(nichtGerechnet), ladeMs,
    nachAktenzeichen, nachVerbund, abgeschlossen,
  };
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
  laufMenge: ReadonlySet<string> | null,
  basis: string,
): Promise<void> {
  const vorhanden = laufend.get(schluessel);
  if (vorhanden) return vorhanden;
  const p = (async () => {
    const store = useBestandsAblage.getState();
    store.setLaden(true);
    try {
      const lauf = await laufeBestand(idb, version, bereichMenge, stichtag, laufMenge);
      useBestandsAblage.getState().setzen(
        schluessel,
        baueDaten(version, lauf.zeilen, lauf.uebergangen, lauf.takt.gesamtMs, lauf.nichtGerechnet),
        // GELESEN, nicht „übrig": ein Bereich, der alles wegnimmt, ist eine
        // Antwort — ein leerer Store ist keine.
        lauf.zeilen.length + lauf.uebergangen + lauf.nichtGerechnet.length,
        basis,
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
  /** Ein zur Frage passendes Ergebnis liegt vor — auch wenn es leer ist. */
  bereit: boolean;
  /**
   * Die Daten stammen aus der Bestands-Generation VOR der letzten
   * Datenaktualisierung und stehen nur, bis der neue Lauf durch ist. `bereit`
   * ist dann `false` — wer eine Aussage als Fakt weitergibt (Assistent), wartet.
   */
  vorlaeufig: boolean;
  /** Wie viele Anträge der Betrachtungsbereich weggenommen hat. */
  ausgeblendet: number;
  /** Aktenzeichen im Bereich, aber älterer Richtlinie — nicht gerechnet. */
  nichtGerechnet: ReadonlySet<string>;
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
const LEER_NICHT_GERECHNET: ReadonlySet<string> = new Set();

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
  // Gerechnet werden nur die zwei jüngsten Richtlinien im Bereich (Spec 3.6).
  const laufMenge = useMemo(() => bestandslaufMenge(bereichMenge), [bereichMenge]);
  const zustand = useBestandsAblage();

  // Die Fassung steht ohne `statusCockpit` gar nicht zur Verfügung; dann gibt es
  // keine Kaskade und der Lauf entfällt (die Leser fallen auf ihre bisherige
  // Anzeige zurück).
  const version = getAktiveVersion();
  // Die Generation gehört in den Schlüssel (siehe `bestandsSchluessel`) — also
  // muss der Leser ihr auch FOLGEN. Ohne das Abo läse das Memo sie genau einmal
  // ab und bliebe nach einem Import auf der alten Generation stehen, während
  // `anstossen` sein Ergebnis unter der neuen ablegt: der Leser fände seinen
  // eigenen Lauf nie wieder und zeigte bis zum Sitzungsende die Zahlen von vor
  // dem Import.
  const generation = useBestandGeneration();
  const schluessel = useMemo(
    () => (version ? bestandsSchluessel(version, bereichMenge, stichtag, laufMenge) : null),
    [version, bereichMenge, laufMenge, stichtag, generation],
  );
  // Die Frage ohne den Bestand — trifft die Ablage sie, aber nicht den Schlüssel,
  // hat sich nur der Bestand geändert (siehe `ablageVorlaeufig`).
  const basis = useMemo(
    () => (version ? bestandsBasis(version, bereichMenge, stichtag, laufMenge) : null),
    [version, bereichMenge, laufMenge, stichtag],
  );

  const anstossen = useCallback((neu: boolean) => {
    void (async () => {
      const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      const key = bestandsSchluessel(v, bereichMenge, stichtag, laufMenge);
      if (!neu && ablageGilt(useBestandsAblage.getState(), key, Date.now())) return;
      if (neu) useBestandsAblage.getState().entwerten();
      await starteLauf(idb, v, bereichMenge, stichtag, key, laufMenge,
        bestandsBasis(v, bereichMenge, stichtag, laufMenge));
    })();
  }, [idb, bereichMenge, laufMenge, stichtag]);

  useEffect(() => {
    if (start === 'nie') return;
    if (schluessel !== null && ablageGilt(zustand, schluessel, Date.now())) return;
    if (start === 'sofort') { anstossen(false); return; }

    // Leerlauf-Leser (Startseite, Anträge-Liste) warten den Start-Datenlauf ab.
    // Vorher gestartet, schadet der Lauf zweifach: seine synchrone Innenschleife
    // belegt denselben Thread und dieselbe SMB-Leitung, auf die der Start wartet
    // — und `runDataUpdate` zählt danach die Bestands-Generation hoch und
    // entwertet das Ergebnis ohnehin. Am ersten Start des Tages fiel der ganze
    // Durchgang deshalb zweimal an. Vorbild mit derselben Begründung:
    // `plugins/auslastung/index.tsx` (`nachStartDatenupdateVorwaermen`).
    let abbrechenIdle: (() => void) | null = null;
    let gestartet = false;
    const los = (): void => {
      if (gestartet) return;
      gestartet = true;
      abbrechenIdle = scheduleIdle(() => anstossen(false));
    };

    if (useStartupDataStatus.getState().phase === 'done') {
      los();
      return () => { abbrechenIdle?.(); };
    }

    const abmelden = useStartupDataStatus.subscribe((s) => { if (s.phase === 'done') los(); });
    // Rückfall gegen eine hängende Phase: `getDatenShareHandle` liegt in
    // App.tsx außerhalb jedes `try`, und 'done' wird nur `if (!cancelled)`
    // gesetzt. Ohne diesen Timer bliebe die Aufgaben-Spalte im Fehlerfall für
    // die ganze Sitzung leer — das sähe aus wie ein Hänger, den wir gerade
    // beheben wollten. Großzügig bemessen: ein LANGSAMER Start-Pass soll
    // ausgewartet werden, nur ein toter nicht.
    const rueckfall = window.setTimeout(los, LEERLAUF_RUECKFALL_MS);

    return () => {
      abmelden();
      window.clearTimeout(rueckfall);
      abbrechenIdle?.();
    };
    // `zustand` bewusst NICHT in den Dependencies: der Effekt soll auf einen
    // Wechsel von Bereich/Fassung reagieren, nicht auf jede Store-Änderung, die
    // er selbst auslöst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, schluessel, anstossen]);

  // Gezeigt wird, was zur Frage passt — die TTL entscheidet oben nur über den
  // Anstoß (siehe Dateikopf). Passt nur die Frage, nicht der Bestand, steht der
  // alte Stand vorläufig da, bis der neue Lauf ihn ersetzt.
  const passt = schluessel !== null && ablagePasst(zustand, schluessel);
  const vorlaeufig = !passt && schluessel !== null && basis !== null
    && ablageVorlaeufig(zustand, schluessel, basis);
  const daten = passt || vorlaeufig ? zustand.daten : null;
  const neuBerechnen = useCallback(() => anstossen(true), [anstossen]);

  return {
    laden: zustand.laden,
    fehler: zustand.fehler,
    version: daten?.version ?? version,
    zeilen: daten?.zeilen ?? LEER_ZEILEN,
    nachAktenzeichen: daten?.nachAktenzeichen ?? LEER_AKTEN,
    nachVerbund: daten?.nachVerbund ?? LEER_VERBUND,
    abgeschlossen: daten?.abgeschlossen ?? LEER_ABGESCHLOSSEN,
    bereit: passt,
    vorlaeufig,
    ausgeblendet: daten?.ausgeblendet ?? 0,
    nichtGerechnet: daten?.nichtGerechnet ?? LEER_NICHT_GERECHNET,
    ladeMs: daten?.ladeMs ?? null,
    berechnetAm: daten ? zustand.berechnetAm : 0,
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
  /**
   * `fuer` antwortet aus dem Bestand vor der letzten Datenaktualisierung, bis
   * der neue Lauf durch ist — die Anzeige markiert das (`aufgabenAnzeige`).
   */
  vorlaeufig: boolean;
  /**
   * Liegen ALLE diese Teilvorhaben außerhalb der Richtlinien des Bestandslaufs?
   * Dann heißt `fuer(…) === null` nicht „die Kaskade schweigt", sondern „sie wurde
   * nicht gefragt" — die Anzeige sagt das (`aufgabenAnzeige.ausserhalbLauf`).
   */
  ausserhalb: (aktenzeichen: readonly string[]) => boolean;
  /** Die Regeln der geltenden Fassung; nur zum Benennen der Sperren. */
  regeln: readonly TodoRegel[];
  /** Der gelesene Regelsatz — gehört sichtbar an die Anzeige. */
  rolle: Rolle;
  /** Die Fassung führt keine To-do-Regeln. */
  ohneRegeln: boolean;
}

/**
 * Liegen alle Teilvorhaben einer Zeile außerhalb des Bestandslaufs? Eine leere
 * Liste ist KEIN „außerhalb" — sie hat nichts, worüber sie etwas sagen könnte.
 * Rein.
 */
export function alleNichtGerechnet(
  aktenzeichen: readonly string[], nichtGerechnet: ReadonlySet<string>,
): boolean {
  return aktenzeichen.length > 0 && aktenzeichen.every(az => nichtGerechnet.has(az));
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
  const nicht = bestand.nichtGerechnet;
  const ausserhalb = useCallback(
    (aktenzeichen: readonly string[]): boolean => alleNichtGerechnet(aktenzeichen, nicht),
    [nicht],
  );

  return {
    fuer,
    ausserhalb,
    // Ohne Fassung (kein `statusCockpit`) läuft gar nichts — dann ist die
    // Kaskade nicht „unterwegs", sie gibt es hier nicht. Ein gescheiterter Lauf
    // zählt genauso: beide Male ist der Rückfall die ehrliche Anzeige.
    laeuftNoch: start !== 'nie' && !bestand.bereit
      && bestand.version !== null && bestand.fehler === null,
    vorlaeufig: bestand.vorlaeufig,
    regeln: bestand.version?.todoRegeln ?? [],
    rolle,
    ohneRegeln,
  };
}

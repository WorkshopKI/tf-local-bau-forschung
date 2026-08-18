/**
 * Datenbeschaffung + Berechnung des Vorgangs-Boards.
 *
 * **Die Einheit ist das Teilvorhaben, nicht der Verbund.** Die AB-Mappe führt
 * eine Zeile je Antrag, und die Regeln lesen überwiegend TV-Spalten (`D_PC-`,
 * `D_AK4`). Der Kontext eines Antrags besteht deshalb aus den Verbund-Feldern
 * PLUS seinen eigenen — würde man alle Teilvorhaben eines Verbunds in einen Topf
 * werfen, bekäme ein fertiges TV das To-do seines Nachbarn.
 *
 * Der Stichtag wird EINMAL je Seitenaufruf gestempelt und in die reine Engine
 * injiziert — nie eine Uhr in der Berechnung.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { toVbPhaseNumber, VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { computeFristDatum, wirksamerEingang } from '@/core/services/csv/frist';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  ladeAktiveVersion, getAktiveVersion, jederVorgang,
  baueTodoKontext, ermittleTodosAlleRollen, todoWerte, findeStatusCode, leseStatusRolle,
  pruefeStillstand, SEED_CODE_ZU_ZAH_PHASE, zahPhaseLabel, REGELSATZ_DEFAULT,
  fassePlatzhalterZusammen, letzteAenderungJeAntrag, zahPhasenVon,
  type MappingVersion, type Rolle, type TodoErgebnis, type WaechterErgebnis, type ZahPhaseId,
  type RollenBilanz,
} from '@/core/status';
import {
  parseBearbeiterFilter, anzeigeTokensFuer, type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import {
  letzteDreiJahrgaenge, reichtInAltbestand, passtJahr, passtVariante, passtPhase, passtRest,
  zaehleNach, fristLaeuftFuer,
} from './boardFilter';
import {
  GRUPPE_FERTIG, GRUPPE_OHNE, ZUSTAENDIGKEIT_DEFAULT, zustaendigkeitVon,
  type Zustaendigkeit,
} from './zustaendigkeit';

/** Eine Zeile des Boards — ein Teilvorhaben mit seinem ermittelten To-do. */
export interface BoardZeile {
  aktenzeichen: string;
  verbundId: string | null;
  titel: string;
  statusRoh: string;
  zahPhase: ZahPhaseId | null;
  zahPhaseText: string;
  /** Jahr des Antragseingangs; leer, wenn kein Datum vorliegt. */
  jahr: string;
  /** Fördervariante (`VB_PHASE`) als Klartext — NICHT die Phase. */
  variante: string;
  /**
   * Das To-do **je Rolle** — eine Auswertung, mehrere Spuren.
   *
   * Welche davon die Karte zeigt, entscheidet die Rollenwahl über
   * {@link sichtVon}; berechnet werden sie in einem Durchgang. Das ist nicht nur
   * billiger als fünf Läufe, es behebt auch einen alten Fehler: `rolle` war keine
   * Dependency des Ladens, ein Rollenwechsel rechnete also gar nicht neu.
   *
   * Enthält auch die abgeleiteten Platzhalter (`quelle: 'abgeleitet'`) — die
   * geliehene Aussage für eine Rolle, die noch keinen eigenen Regelsatz hat.
   */
  todos: Record<Rolle, TodoErgebnis>;
  /** Urteil des Stillstands-Wächters (Stufe 1 + 2). */
  waechter: WaechterErgebnis;
  /** Späteres von Antragseingang und „alle Anträge da"; ISO oder null. */
  wirksamerEingang: string | null;
  /** Restfrist in Tagen ab wirksamem Eingang; negativ = überfällig. */
  restTage: number | null;
  /**
   * Läuft für diesen Vorgang überhaupt noch eine Frist?
   *
   * Die 90-Tage-Uhr rechnet für JEDEN Antrag weiter — auch für einen, der vor
   * zwei Jahren abgelehnt oder bewilligt wurde. Sie bedeutet dort nur nichts
   * mehr. Ohne diese Unterscheidung führte die nach Restfrist sortierte Liste
   * jahrelang geschlossene Vorgänge mit „853 T über" an (in der laufenden App
   * gesehen), gefolgt von bewilligten mit „830 T über".
   *
   * Kriterium ist die **ZAH-Phase**, nicht die alte Kategorie: die Antragsfrist
   * gehört zur Antragsphase (Eingang … Entscheidung). Danach gilt die
   * VN-Logik, und die greift erst, wenn ein Verwendungsnachweis da ist —
   * zwischen Bewilligung und VN läuft schlicht keine Frist. Kennt der Katalog
   * die Phase nicht, bleibt es beim alten Kriterium „nicht terminal"; geraten
   * wird nicht.
   */
  fristLaeuft: boolean;
  /** Rohsatz für den Kürzel-Filter (nur die Spalten, die er liest). */
  filterRecord: AntragListItem;
}

/**
 * Die drei **Fragen**, die das Board beantwortet — nicht mehr die Mischung aus
 * Partition, Teilmenge und Gesamtmenge, die bis v4.95 in einer Leiste stand.
 * Wer an diesem Vorgang dran ist, steht daneben als Filter ({@link Zustaendigkeit}).
 */
export type BoardTab = 'arbeit' | 'fristen' | 'auswertung';

/**
 * Das To-do, das die gewählte Sicht zeigt.
 *
 * „Alle Rollen" zeigt den **AB-Satz** und nicht etwa alle fünf übereinander: er
 * ist der einzige, der eine vollständige Kaskade führt, und die Sicht ohne
 * Rollenwahl soll dasselbe zeigen wie vor der Mehrspurigkeit. Wer die geliehene
 * FB-Sicht sehen will, wählt FB — das ist eine Frage, keine Voreinstellung.
 */
export function sichtVon(z: BoardZeile, rolle: Rolle | 'alle'): TodoErgebnis {
  return z.todos[rolle === 'alle' ? REGELSATZ_DEFAULT : rolle];
}

/**
 * Ampel-Schwellen der Bearbeiter-Sicht, in Tagen Restfrist.
 *
 * Bewusst hier als benannte Konstanten und nicht als Zahlen im JSX: sie sind
 * eine Setzung (rot ab zwei Wochen, gelb ab einem Monat) und keine Ableitung
 * aus den Daten — wer sie ändert, ändert eine Vereinbarung.
 */
export const AMPEL_ROT_TAGE = 14;
export const AMPEL_GELB_TAGE = 30;

/** Rot / gelb / grün — `null`, wenn keine Frist berechenbar ist. */
export function ampelVon(restTage: number | null): 'rot' | 'gelb' | 'gruen' | null {
  if (restTage === null) return null;
  if (restTage <= AMPEL_ROT_TAGE) return 'rot';
  if (restTage <= AMPEL_GELB_TAGE) return 'gelb';
  return 'gruen';
}

/**
 * Ein Menü-Eintrag einer Filter-Achse. Strukturgleich zu `MultiSelectOption` —
 * der Hook bleibt damit frei von einer Abhängigkeit auf das Anzeige-Bauteil.
 */
export interface FilterOption {
  wert: string;
  label: string;
  anzahl: number;
}

export interface VorgangsBoardApi {
  laden: boolean;
  fehler: string | null;
  version: MappingVersion | null;
  /** Alle Zeilen nach Filtern, vor der Tab-Aufteilung. */
  zeilen: BoardZeile[];
  /** Zeilen des aktiven Tabs, gruppiert in Kaskaden-Reihenfolge. */
  gruppen: { todo: string; zeilen: BoardZeile[] }[];
  zaehler: Record<BoardTab, number>;
  /**
   * Wer dran ist — die Vierteilung als Filter, mit Zahlen, die sich zur
   * Gesamtmenge addieren. Bis v4.95 waren drei davon eigene Reiter.
   */
  zustaendig: Zustaendigkeit[];
  setZustaendig: (v: Zustaendigkeit[]) => void;
  zustZaehler: Record<Zustaendigkeit, number>;
  /** Wie viele Anträge insgesamt geprüft wurden (vor Filtern). */
  gesamt: number;
  /** Die Fassung führt keine To-do-Regeln — dann kann das Board nichts zeigen. */
  ohneRegeln: boolean;
  tab: BoardTab;
  setTab: (t: BoardTab) => void;
  rolle: Rolle | 'alle';
  setRolle: (r: Rolle | 'alle') => void;
  nurMeine: boolean;
  setNurMeine: (v: boolean) => void;
  /**
   * Die drei Menü-Achsen als **Mehrfachauswahl**. Leere Liste = kein Filter
   * (alle Werte) — nicht „nichts anzeigen".
   */
  jahre: string[];
  setJahre: (v: string[]) => void;
  varianten: string[];
  setVarianten: (v: string[]) => void;
  phasen: string[];
  setPhasen: (v: string[]) => void;
  /** Nur Vorgänge zeigen, die der Wächter als hängend beurteilt. */
  nurHaengt: boolean;
  setNurHaengt: (v: boolean) => void;
  /** Stau je Rolle über die gefilterte Menge — plus die unbewerteten. */
  stau: { rolle: Rolle | 'ast' | 'offen'; anzahl: number }[];
  unbewertet: number;
  /**
   * Wie viele To-dos jede Rolle sieht und wie viele davon nur geliehen sind.
   *
   * Gehört in die Kopfzeile, weil „84 FB-To-dos" und „84 FB-To-dos, davon 61
   * abgeleitet" verschiedene Aussagen sind — die zweite sagt zusätzlich, wie
   * viel Regelarbeit noch aussteht.
   */
  rollenBilanz: RollenBilanz[];
  /**
   * Die Menü-Einträge je Achse, aus dem Bestand erzeugt — mit **Facetten-Zahl**:
   * gerechnet unter den JEWEILS ANDEREN Filtern, die eigene Achse ausgelassen.
   * Sonst zeigte „2023: 0", solange 2023 nicht angehakt ist, und die Zahl wäre
   * keine Zusage mehr, was ein Klick bringt.
   */
  jahrOptionen: FilterOption[];
  variantenOptionen: FilterOption[];
  phasenOptionen: FilterOption[];
  /** Die Jahre der Vorbelegung — für den Schnellweg „Letzte 3 Jahre". */
  letzteDrei: string[];
  /** Reicht die Auswahl in den Altbestand? Dann gehört der Hinweis daneben. */
  zeigtAltbestand: boolean;
  /** Kürzel-Modus für die Kopfzeile („Alle Bearbeiter" vs. „Kürzel MUE"). */
  kuerzelModus: BearbeiterFilterMode;
  /** Wie viele Anträge der Betrachtungsbereich weggenommen hat (für den Chip). */
  ausgeblendet: number;
  /** Rechenzeit des letzten Laufs über den Bestand, in Millisekunden. */
  ladeMs: number | null;
}

/**
 * Vorbelegung des Jahrgangs-Filters: **das laufende Jahr und die beiden davor**
 * ({@link letzteDreiJahrgaenge}).
 *
 * Kein kosmetischer Default, sondern eine fachliche Aussage. Gemessen am
 * Bestand: von 9 141 bewilligten Anträgen tragen nur 2 529 ein Datum in
 * `D_AZBE` (Zuwendungsbescheid). Über alle Jahrgänge gerechnet meldet die Regel
 * „bewilligt und kein ZuwB" deshalb 6 607 Aufgaben — für Vorgänge, die seit
 * Jahren abgeschlossen sind und die Spalte schlicht nie geführt haben. Der
 * Altbestand ist kein Rückstand, sondern unvollständig gepflegte Historie; die
 * AB-Mappe blendet ihn über ihren Jahres-Slicer ebenso aus.
 *
 * Erreichbar bleibt er über „Alle Jahrgänge" — mit Hinweis, nicht
 * stillschweigend. Seit der Mehrfachauswahl stehen die drei Jahre **angekreuzt**
 * im Menü, statt sich hinter einem Sammelwert zu verstecken: der Nutzer sieht,
 * welche gemeint sind, und kann einzeln dazu- oder abwählen.
 */

/** Fördervariante als Klartext; unbekannt → leer (nie geraten). */
function varianteVon(rec: Record<string, unknown>): string {
  const n = toVbPhaseNumber(rec.vb_phase);
  return n !== null ? (VB_PHASE_LABELS[n] ?? `Variante ${n}`) : '';
}

function jahrVon(rec: Record<string, unknown>): string {
  const roh = rec.antragsdatum;
  if (typeof roh !== 'string') return '';
  const iso = parseGermanDate(roh) ?? (/^\d{4}-/.test(roh) ? roh : null);
  return iso ? iso.slice(0, 4) : '';
}

export function useVorgangsBoard(): VorgangsBoardApi {
  const idb = useStorage().idb;
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  const heuteRef = useRef<string>(new Date().toISOString());

  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [version, setVersion] = useState<MappingVersion | null>(null);
  const [alle, setAlle] = useState<BoardZeile[]>([]);
  const [ausgeblendet, setAusgeblendet] = useState(0);
  /** Rechenzeit des letzten Laufs über den Bestand (ms) — für die Messung. */
  const [ladeMs, setLadeMs] = useState<number | null>(null);
  const bereich = useBereich();
  const bereichMenge = bereich.menge;

  /** Die Jahre der Vorbelegung — aus dem Stichtag, einmal je Seitenaufruf. */
  const letzteDrei = useMemo(() => letzteDreiJahrgaenge(heuteRef.current), []);

  const [tab, setTab] = useState<BoardTab>('arbeit');
  const [zustaendig, setZustaendig] = useState<Zustaendigkeit[]>([...ZUSTAENDIGKEIT_DEFAULT]);
  const [rolle, setRolle] = useState<Rolle | 'alle'>(() => leseStatusRolle(profile?.status_rolle));
  const [nurMeine, setNurMeine] = useState(true);
  const [jahre, setJahre] = useState<string[]>(letzteDrei);
  const [varianten, setVarianten] = useState<string[]>([]);
  const [phasen, setPhasen] = useState<string[]>([]);
  const [nurHaengt, setNurHaengt] = useState(false);

  const laden_ = useCallback(async (): Promise<void> => {
    setLaden(true);
    setFehler(null);
    try {
      const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      const regeln = v.todoRegeln ?? [];
      // Einmal fuer den ganzen Bestand statt einmal je Zeile: das Journal liegt
      // in Monatsdateien, und ein Lesevorgang je Antrag waere die teuerste Art,
      // dieselben Dateien zu lesen. `null` = kein Journal, dann bleibt es bei
      // der Naeherung aus `max(D_)`.
      const journal = await letzteAenderungJeAntrag(idb, heuteRef.current.slice(0, 10));
      const zeilen: BoardZeile[] = [];
      // Gemessen und angezeigt, nicht geschätzt: die Ladezeit über den Bestand
      // ist die Zahl, an der sich der Bereich rechtfertigen muss.
      const begonnen = performance.now();
      let uebergangen = 0;

      await jederVorgang(idb, v, (satz) => {
        const { aktenzeichen, unterprogrammId, verbundId: vbId, record: rec, vorkommen } = satz;
        const a = rec as unknown as AntragListItem;
        // Betrachtungsbereich vor der teuren Arbeit: `ermittleTodosAlleRollen`
        // und der Wächter laufen je Antrag über das ganze Feld-Ensemble. Was
        // nicht im Bereich liegt, wird gar nicht erst gerechnet — hier spart
        // der Bereich Zeit, nicht nur Zeilen.
        if (!istImBereich(unterprogrammId, bereichMenge)) { uebergangen += 1; return; }
        const todos = ermittleTodosAlleRollen(regeln, baueTodoKontext(vorkommen), heuteRef.current);
        const statusRoh = typeof a.status === 'string' ? a.status : '';
        const code = findeStatusCode(statusRoh)?.eintrag.code ?? null;
        // Der Wächter bekommt bewusst den AB-Satz und nicht die gewählte
        // Sicht: sein Urteil (ok/hängt/unbewertet) hängt gar nicht am To-do,
        // und die Rollen-Zuordnung des Staus soll sich nicht verschieben, nur
        // weil jemand die Anzeige umschaltet. Die Stau-Zahlen bleiben damit
        // vergleichbar mit denen vor der Mehrspurigkeit.
        const waechter = pruefeStillstand({
          version: v, vorkommen, statusCode: code, todo: todos[REGELSATZ_DEFAULT],
          journalAenderung: journal?.get(aktenzeichen) ?? null,
          stichtag: heuteRef.current,
        });
        // Der wirksame Eingang braucht `D_XTE` — custom gemappt und NICHT in
        // der Listen-Projektion. Hier ist er da, weil `sammleVorkommen` ihn
        // über das Schema aufgelöst hat (Bug-Klasse 5).
        const xte = vorkommen.find(x => x.feld.code === 'XTE');
        const eingang = wirksamerEingang(
          typeof rec.antragsdatum === 'string' ? rec.antragsdatum : null,
          xte ? (parseGermanDate(xte.wert) ?? xte.wert) : null,
        );
        const frist = eingang
          ? computeFristDatum({ status: a.status, antragsdatum: eingang, vn_eingang_datum: rec.vn_eingang_datum as string | undefined })
          : null;
        const restTage = frist
          ? Math.ceil((new Date(frist).getTime() - new Date(heuteRef.current).getTime()) / 86_400_000)
          : null;
        const zahPhase = code !== null
          ? v.werte.find(w => w.code === code)?.zahPhaseId
            ?? SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null
          : null;
        zeilen.push({
          aktenzeichen,
          verbundId: vbId,
          titel: typeof a.titel === 'string' ? a.titel : (a.akronym ?? ''),
          statusRoh,
          zahPhase,
          zahPhaseText: zahPhaseLabel(zahPhase, v.zahPhasen),
          jahr: jahrVon(rec),
          variante: varianteVon(rec),
          todos,
          waechter,
          wirksamerEingang: eingang,
          restTage,
          fristLaeuft: fristLaeuftFuer(zahPhase, a.status, v.zahPhasen),
          filterRecord: a,
        });
      });

      setVersion(v);
      setAlle(zeilen);
      const ms = Math.round(performance.now() - begonnen);
      setAusgeblendet(uebergangen);
      setLadeMs(ms);
      // Die Rechenzeit über den Bestand ist die Zahl, an der sich der Bereich
      // rechtfertigen muss — messbar statt behauptet.
      console.info(
        `[vorgangs-board] ${zeilen.length} Vorgänge in ${ms} ms gerechnet`
        + (uebergangen > 0 ? ` · ${uebergangen} außerhalb des Bereichs übersprungen` : ''),
      );
    } catch (err) {
      setFehler((err as Error).message ?? 'Board konnte nicht geladen werden.');
    } finally {
      setLaden(false);
    }
  }, [idb, bereichMenge]);

  useEffect(() => { void laden_(); }, [laden_]);

  const kuerzelModus = useMemo<BearbeiterFilterMode>(() => ({
    // `useMeinKuerzel` ist die einzige Lesestelle (Pitfall #27) — im
    // Login-Modus steht dort das Session-Kürzel, nicht das Profilfeld.
    ...parseBearbeiterFilter(
      nurMeine ? (meinKuerzel ?? undefined) : 'alle',
      profile?.bearbeiter_inkl_begleitung,
    ),
    // Der Rollen-Zuschnitt: ein AB sucht sich in BIB, ein FB in TIB. Ohne Rolle
    // bleibt es beim vollen Spaltensatz (unverändertes Verhalten).
    ...(rolle === 'alle' ? {} : { rolle }),
    // Beschriftung in der Schreibweise der Daten („Kürzel THü"). Gelesen aus den
    // EIGENEN Zeilen dieser Seite, nicht aus dem Anträge-Store: wer die Seite
    // direkt aufruft (Lesezeichen), hat den anderen Store gar nicht geladen und
    // bekäme die Großschreibung zurück.
    anzeigeTokens: nurMeine && meinKuerzel
      ? anzeigeTokensFuer(
          alle.map(z => z.filterRecord),
          parseBearbeiterFilter(meinKuerzel, false).tokens,
        )
      : undefined,
  }), [nurMeine, meinKuerzel, profile, rolle, alle]);

  /**
   * Die Menge OHNE die Menü-Achsen — Grundlage aller drei Facetten-Rechnungen.
   * „Hängt fest" und der Kürzel-Filter stehen darin, weil sie kein eigenes Menü
   * haben und ihre Wirkung sonst in keiner Zahl auftauchte.
   */
  const basis = useMemo(
    () => alle.filter(z => passtRest(z, nurHaengt, kuerzelModus)),
    [alle, nurHaengt, kuerzelModus],
  );

  const zeilen = useMemo(
    () => basis.filter(z => passtJahr(z, jahre) && passtVariante(z, varianten) && passtPhase(z, phasen)),
    [basis, jahre, varianten, phasen],
  );

  // Je Achse: alle ANDEREN Filter angewandt, die eigene ausgelassen. Drei
  // weitere Durchläufe über ~14 000 Zeilen — gegenüber der Ableitung je Antrag
  // (die im Ladelauf steckt) nicht messbar.
  const jahrZaehler = useMemo(
    () => zaehleNach(
      basis.filter(z => passtVariante(z, varianten) && passtPhase(z, phasen)),
      z => z.jahr,
    ),
    [basis, varianten, phasen],
  );
  const variantenZaehler = useMemo(
    () => zaehleNach(
      basis.filter(z => passtJahr(z, jahre) && passtPhase(z, phasen)),
      z => z.variante,
    ),
    [basis, jahre, phasen],
  );
  const phasenZaehler = useMemo(
    () => zaehleNach(
      basis.filter(z => passtJahr(z, jahre) && passtVariante(z, varianten)),
      z => z.zahPhase ?? '',
    ),
    [basis, jahre, varianten],
  );

  /**
   * Die drei Sichten desselben Regelsatzes (Konzept 6.5): was ICH tue, worauf
   * ich warte, und was keine Regel trifft. „Meine" ohne Rollenwahl heißt: alles
   * mit Zuständigkeit — sonst wäre der erste Tab für einen Nutzer ohne
   * gesetzte Rolle leer.
   */
  const zustVon = useCallback(
    (z: BoardZeile): Zustaendigkeit => zustaendigkeitVon(sichtVon(z, rolle), rolle),
    [rolle],
  );

  /**
   * Die vier Teile des Bestands — sie addieren sich zur Gesamtmenge, und genau
   * das ist der Gewinn gegenüber der alten Reiterleiste: dort standen eine
   * Partition, eine Risiko-Teilmenge und die Gesamtmenge nebeneinander, ohne
   * dass man sie gegeneinander lesen konnte.
   */
  const zustZaehler = useMemo(() => {
    const z: Record<Zustaendigkeit, number> = { meine: 0, warten: 0, ohne: 0, fertig: 0 };
    for (const zeile of zeilen) z[zustVon(zeile)] += 1;
    return z;
  }, [zeilen, zustVon]);

  const zaehler = useMemo((): Record<BoardTab, number> => ({
    // „Arbeit" zählt, was die Chips gerade zeigen — der Reiter verspricht damit
    // genau die Zeilenzahl, die darunter steht.
    arbeit: zustaendig.reduce((n, z) => n + zustZaehler[z], 0),
    // Fristen zählt, was ein Fristrisiko trägt; Auswertung die ganze Menge.
    fristen: zeilen.filter(x => x.fristLaeuft && (x.restTage ?? Infinity) <= AMPEL_GELB_TAGE).length,
    auswertung: zeilen.length,
  }), [zeilen, zustZaehler, zustaendig]);

  const gruppen = useMemo(() => {
    // Die beiden Cockpit-Sichten gruppieren nicht nach To-do — sie zeigen
    // dieselbe Menge unter einer anderen Frage.
    if (tab === 'fristen' || tab === 'auswertung') return [];
    const gewaehlt = new Set(zustaendig);
    const imTab = zeilen.filter(z => gewaehlt.has(zustVon(z)));
    // Zwei Sorten, zwei Gruppen: eine greifende Sperre ist ein ERGEBNIS
    // („Verfahren abgeschlossen"), kein fehlendes Urteil. Zusammengeworfen wäre
    // die Lücken-Anzeige unbrauchbar — hinter S0/S0b liegen tausende
    // abgeschlossene Vorgänge über den paar hundert echten Unbekannten.
    const ohneTodo = imTab.filter(z => zustVon(z) === 'ohne');
    const fertig = imTab.filter(z => zustVon(z) === 'fertig');
    // Kaskaden-Reihenfolge statt Häufigkeit: so steht das Board in derselben
    // Ordnung wie der Regelsatz, und ein Vergleich beider ist möglich.
    const regeln = version?.todoRegeln ?? [];
    const proTodo = new Map<string, BoardZeile[]>();
    for (const z of imTab) {
      // Nur Zeilen MIT To-do: die beiden anderen Sorten haben ihre eigenen
      // Gruppen. Über den Leerschlüssel zu gehen hätte funktioniert, solange
      // keine Regel ein leeres To-do trägt — eine stille Kopplung.
      const key = sichtVon(z, rolle).todo;
      if (!key) continue;
      const list = proTodo.get(key);
      if (list) list.push(z); else proTodo.set(key, [z]);
    }
    const eigene = todoWerte(regeln, rolle === 'alle' ? REGELSATZ_DEFAULT : rolle);
    // Geliehene Gruppen hinten anhängen: ihr Text stammt aus einem FREMDEN
    // Regelsatz und steht deshalb in `eigene` nicht drin. Sortiert nach der
    // Position der Herkunftsregel — dieselbe Ordnung wie dort, nicht nach
    // Häufigkeit.
    const position = new Map(regeln.map(r => [r.id, r.reihenfolge]));
    const geliehen = new Map<string, number>();
    for (const z of imTab) {
      const e = sichtVon(z, rolle);
      if (e.quelle !== 'abgeleitet' || !e.todo || eigene.includes(e.todo)) continue;
      const rang = position.get(e.abgeleitetAus ?? '') ?? Infinity;
      const bisher = geliehen.get(e.todo);
      if (bisher === undefined || rang < bisher) geliehen.set(e.todo, rang);
    }
    const reihenfolge = [
      ...eigene,
      ...[...geliehen].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([t]) => t),
    ];
    return [
      ...reihenfolge.filter(t => proTodo.has(t)).map(t => ({ todo: t, zeilen: proTodo.get(t)! })),
      // Die beiden To-do-losen Sorten stehen HINTEN — die Kaskade zuerst, dann
      // das, worüber sie nichts sagt.
      ...(ohneTodo.length > 0 ? [{ todo: GRUPPE_OHNE, zeilen: ohneTodo }] : []),
      ...(fertig.length > 0 ? [{ todo: GRUPPE_FERTIG, zeilen: fertig }] : []),
    ];
  }, [zeilen, tab, zustVon, zustaendig, version, rolle]);

  /**
   * Stau je Rolle: wie viele hängende Vorgänge auf wessen Schreibtisch liegen.
   * `offen` = hängt, aber ohne ableitbare Rolle — das ist eine eigene Aussage
   * und wird nicht unter eine Rolle geschoben.
   */
  const { stau, unbewertet } = useMemo(() => {
    const proRolle = new Map<Rolle | 'ast' | 'offen', number>();
    let ohneZiel = 0;
    for (const z of zeilen) {
      if (z.waechter.urteil === 'unbewertet') { ohneZiel += 1; continue; }
      if (z.waechter.urteil !== 'haengt') continue;
      const k = z.waechter.rolle ?? 'offen';
      proRolle.set(k, (proRolle.get(k) ?? 0) + 1);
    }
    return {
      stau: [...proRolle].map(([rolle, anzahl]) => ({ rolle, anzahl }))
        .sort((a, b) => b.anzahl - a.anzahl),
      unbewertet: ohneZiel,
    };
  }, [zeilen]);

  // Über die GEFILTERTE Menge: die Kopfzeile soll das beziffern, was darunter
  // steht, nicht den ungefilterten Bestand.
  const rollenBilanz = useMemo(
    () => fassePlatzhalterZusammen(zeilen, version?.todoRegeln ?? []).proRolle,
    [zeilen, version],
  );

  /**
   * Die Menü-Einträge. **Vorhandene Werte kommen aus dem Bestand, die Ordnung
   * aus dem Fach** — nicht aus der Reihenfolge des Auftretens (Phasen) und nicht
   * alphabetisch (Varianten, wo sonst „DL" vor „FuE" vor „NW 1" stünde).
   *
   * Ein gewählter Wert bleibt im Menü, auch wenn die anderen Filter ihn gerade
   * auf 0 drücken — sonst verschwände ein aktiver Filter aus seinem eigenen
   * Menü und ließe sich nicht mehr abwählen.
   */
  const jahrOptionen = useMemo<FilterOption[]>(() => {
    const werte = new Set([...alle.map(z => z.jahr).filter(Boolean), ...jahre]);
    return [...werte].sort().reverse()
      .map(wert => ({ wert, label: wert, anzahl: jahrZaehler.get(wert) ?? 0 }));
  }, [alle, jahre, jahrZaehler]);

  const variantenOptionen = useMemo<FilterOption[]>(() => {
    const vorhanden = new Set([...alle.map(z => z.variante).filter(Boolean), ...varianten]);
    // Reihenfolge der Fördervarianten = die der VB_PHASE-Nummern (NW 1, NW 2,
    // FuE, DL, DS, Irrläufer), nicht das Alphabet.
    const geordnet = Object.keys(VB_PHASE_LABELS)
      .map(Number).sort((a, b) => a - b)
      .map(n => VB_PHASE_LABELS[n])
      .filter((l): l is string => l !== undefined && vorhanden.has(l));
    // Werte, die das Mapping nicht kennt (`Variante N`), hinten anhängen statt
    // unterschlagen.
    const rest = [...vorhanden].filter(v => !geordnet.includes(v)).sort();
    return [...geordnet, ...rest]
      .map(wert => ({ wert, label: wert, anzahl: variantenZaehler.get(wert) ?? 0 }));
  }, [alle, varianten, variantenZaehler]);

  const phasenOptionen = useMemo<FilterOption[]>(() => {
    const vorhanden = new Set<string>([
      ...alle.map(z => z.zahPhase).filter((p): p is ZahPhaseId => p !== null),
      ...phasen,
    ]);
    return zahPhasenVon(version?.zahPhasen)
      .filter(p => vorhanden.has(p.id))
      .map(p => ({
        wert: p.id,
        label: p.label,
        anzahl: phasenZaehler.get(p.id) ?? 0,
      }));
  }, [alle, phasen, phasenZaehler, version]);

  return {
    laden, fehler, version, zeilen, gruppen, zaehler,
    zustaendig, setZustaendig, zustZaehler,
    gesamt: alle.length,
    ohneRegeln: version !== null && (version.todoRegeln ?? []).length === 0,
    tab, setTab, rolle, setRolle, nurMeine, setNurMeine,
    jahre, setJahre, varianten, setVarianten, phasen, setPhasen,
    jahrOptionen, variantenOptionen, phasenOptionen,
    letzteDrei, zeigtAltbestand: reichtInAltbestand(jahre, heuteRef.current),
    kuerzelModus, ausgeblendet, ladeMs,
    nurHaengt, setNurHaengt, stau, unbewertet, rollenBilanz,
  };
}

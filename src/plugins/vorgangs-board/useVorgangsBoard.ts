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
import { isBegleitungStatus, isTerminalStatus } from '@/core/utils/status-canonical';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import type { AntragListItem } from '@/core/services/csv/types';
import {
  ladeAktiveVersion, getAktiveVersion, jederVorgang,
  baueTodoKontext, ermittleTodosAlleRollen, todoWerte, findeStatusCode, leseStatusRolle,
  pruefeStillstand, SEED_CODE_ZU_ZAH_PHASE, zahPhaseLabel, REGELSATZ_DEFAULT,
  fassePlatzhalterZusammen,
  type MappingVersion, type Rolle, type TodoErgebnis, type WaechterErgebnis, type ZahPhaseId,
  type RollenBilanz,
} from '@/core/status';
import {
  parseBearbeiterFilter, antragMatchesBearbeiter, type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';

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

export type BoardTab = 'meine' | 'warten' | 'ohne' | 'fristen' | 'auswertung';

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

export interface VorgangsBoardApi {
  laden: boolean;
  fehler: string | null;
  version: MappingVersion | null;
  /** Alle Zeilen nach Filtern, vor der Tab-Aufteilung. */
  zeilen: BoardZeile[];
  /** Zeilen des aktiven Tabs, gruppiert in Kaskaden-Reihenfolge. */
  gruppen: { todo: string; zeilen: BoardZeile[] }[];
  zaehler: Record<BoardTab, number>;
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
  jahr: string;
  setJahr: (v: string) => void;
  variante: string;
  setVariante: (v: string) => void;
  phase: string;
  setPhase: (v: string) => void;
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
  /** Auswahllisten, aus dem Bestand erzeugt. */
  jahre: string[];
  /** Sind gerade ALLE Jahrgänge gewählt? Dann gehört ein Hinweis daneben. */
  alleJahrgaenge: boolean;
  varianten: string[];
  phasen: { id: string; label: string }[];
  /** Kürzel-Modus für die Kopfzeile („Alle Bearbeiter" vs. „Kürzel MUE"). */
  kuerzelModus: BearbeiterFilterMode;
  /** Wie viele Anträge der Betrachtungsbereich weggenommen hat (für den Chip). */
  ausgeblendet: number;
  /** Rechenzeit des letzten Laufs über den Bestand, in Millisekunden. */
  ladeMs: number | null;
}

const ALLE = 'alle';

/**
 * Vorbelegung des Jahrgangs-Filters: **das laufende Jahr und die beiden davor**.
 *
 * Kein kosmetischer Default, sondern eine fachliche Aussage. Gemessen am
 * Bestand: von 9 141 bewilligten Anträgen tragen nur 2 529 ein Datum in
 * `D_AZBE` (Zuwendungsbescheid). Über alle Jahrgänge gerechnet meldet die Regel
 * „bewilligt und kein ZuwB" deshalb 6 607 Aufgaben — für Vorgänge, die seit
 * Jahren abgeschlossen sind und die Spalte schlicht nie geführt haben. Der
 * Altbestand ist kein Rückstand, sondern unvollständig gepflegte Historie; die
 * AB-Mappe blendet ihn über ihren Jahres-Slicer ebenso aus.
 *
 * Erreichbar bleibt er über „Alle Jahre" — mit Hinweis, nicht stillschweigend.
 */
const LETZTE_3 = 'letzte3';
const JAHRGAENGE = 3;

/** ZAH-Phasen, in denen die Antragsfrist (90 Tage) überhaupt gilt. */
const ANTRAGSPHASE: ReadonlySet<ZahPhaseId> = new Set<ZahPhaseId>([
  'eingang', 'vollstaendigkeit', 'pruefung', 'entscheidung',
]);

/** Siehe {@link BoardZeile.fristLaeuft}. Rein. */
function fristLaeuftFuer(zahPhase: ZahPhaseId | null, statusRoh: unknown): boolean {
  if (isTerminalStatus(statusRoh)) return false;
  // Begleitphase mit Verwendungsnachweis: `computeFristDatum` liefert dort die
  // VN-Frist, die ist echt.
  if (isBegleitungStatus(statusRoh)) return true;
  if (zahPhase === null) return true;      // Phase unbekannt → altes Kriterium
  return ANTRAGSPHASE.has(zahPhase);
}

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

  const [tab, setTab] = useState<BoardTab>('meine');
  const [rolle, setRolle] = useState<Rolle | 'alle'>(() => leseStatusRolle(profile?.status_rolle));
  const [nurMeine, setNurMeine] = useState(true);
  const [jahr, setJahr] = useState(LETZTE_3);
  const [variante, setVariante] = useState(ALLE);
  const [phase, setPhase] = useState(ALLE);
  const [nurHaengt, setNurHaengt] = useState(false);

  const laden_ = useCallback(async (): Promise<void> => {
    setLaden(true);
    setFehler(null);
    try {
      const v = getAktiveVersion() ?? await ladeAktiveVersion(idb);
      const regeln = v.todoRegeln ?? [];
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
          fristLaeuft: fristLaeuftFuer(zahPhase, a.status),
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
  }), [nurMeine, meinKuerzel, profile, rolle]);

  /** Ältester Jahrgang der Vorbelegung — aus dem Stichtag, nie aus einer Uhr. */
  const grenzJahr = String(new Date(heuteRef.current).getUTCFullYear() - (JAHRGAENGE - 1));

  const zeilen = useMemo(() => alle.filter(z => {
    if (jahr === LETZTE_3) {
      // Ohne Antragsdatum lässt sich kein Jahrgang bestimmen — solche Vorgänge
      // gehören nicht in die Vorbelegung, sondern unter „Alle Jahre".
      if (z.jahr === '' || z.jahr < grenzJahr) return false;
    } else if (jahr !== ALLE && z.jahr !== jahr) return false;
    if (variante !== ALLE && z.variante !== variante) return false;
    if (phase !== ALLE && (z.zahPhase ?? '') !== phase) return false;
    if (nurHaengt && z.waechter.urteil !== 'haengt') return false;
    return antragMatchesBearbeiter(z.filterRecord, kuerzelModus);
  }), [alle, jahr, grenzJahr, variante, phase, nurHaengt, kuerzelModus]);

  /**
   * Die drei Sichten desselben Regelsatzes (Konzept 6.5): was ICH tue, worauf
   * ich warte, und was keine Regel trifft. „Meine" ohne Rollenwahl heißt: alles
   * mit Zuständigkeit — sonst wäre der erste Tab für einen Nutzer ohne
   * gesetzte Rolle leer.
   */
  const tabVon = useCallback((z: BoardZeile): BoardTab => {
    const e = sichtVon(z, rolle);
    if (!e.todo) return 'ohne';
    // Ein abgeleiteter Platzhalter trägt `zustaendig: [rolle]` — er landet also
    // unter „Meine Aufgaben". Das ist die Aussage: die Regel wartet auf DICH,
    // auch wenn dein Regelsatz sie noch nicht selbst beschreibt.
    if (rolle === 'alle') return e.zustaendig.length > 0 ? 'meine' : 'warten';
    return e.zustaendig.includes(rolle) ? 'meine' : 'warten';
  }, [rolle]);

  const zaehler = useMemo(() => {
    const z: Record<BoardTab, number> = {
      meine: 0, warten: 0, ohne: 0,
      // Fristen zählt, was ein Fristrisiko trägt; Auswertung die ganze Menge.
      fristen: zeilen.filter(x => x.fristLaeuft && (x.restTage ?? Infinity) <= AMPEL_GELB_TAGE).length,
      auswertung: zeilen.length,
    };
    for (const zeile of zeilen) {
      const t = tabVon(zeile);
      if (t === 'meine' || t === 'warten' || t === 'ohne') z[t] += 1;
    }
    return z;
  }, [zeilen, tabVon]);

  const gruppen = useMemo(() => {
    // Die beiden Cockpit-Sichten gruppieren nicht nach To-do — sie zeigen
    // dieselbe Menge unter einer anderen Frage.
    if (tab === 'fristen' || tab === 'auswertung') return [];
    const imTab = zeilen.filter(z => tabVon(z) === tab);
    if (tab === 'ohne') {
      // Zwei Sorten, zwei Gruppen: eine greifende Sperre ist ein ERGEBNIS
      // („Verfahren abgeschlossen"), kein fehlendes Urteil. Zusammengeworfen
      // wäre die Lücken-Anzeige unbrauchbar — seit S0/S0b liegen tausende
      // abgeschlossene Vorgänge über den paar hundert echten Unbekannten.
      const gesperrt = imTab.filter(z => sichtVon(z, rolle).gesperrtDurch.length > 0);
      const offen = imTab.filter(z => sichtVon(z, rolle).gesperrtDurch.length === 0);
      return [
        ...(offen.length > 0 ? [{ todo: 'Kein To-do ermittelt', zeilen: offen }] : []),
        ...(gesperrt.length > 0
          ? [{ todo: 'Keine Aufgabe mehr (Verfahren abgeschlossen)', zeilen: gesperrt }]
          : []),
      ];
    }
    // Kaskaden-Reihenfolge statt Häufigkeit: so steht das Board in derselben
    // Ordnung wie der Regelsatz, und ein Vergleich beider ist möglich.
    const regeln = version?.todoRegeln ?? [];
    const proTodo = new Map<string, BoardZeile[]>();
    for (const z of imTab) {
      const key = sichtVon(z, rolle).todo ?? '';
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
    return reihenfolge
      .filter(t => proTodo.has(t))
      .map(t => ({ todo: t, zeilen: proTodo.get(t)! }));
  }, [zeilen, tab, tabVon, version, rolle]);

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

  const jahre = useMemo(
    () => [...new Set(alle.map(z => z.jahr).filter(Boolean))].sort().reverse(),
    [alle],
  );
  const varianten = useMemo(
    () => [...new Set(alle.map(z => z.variante).filter(Boolean))].sort(),
    [alle],
  );
  const phasen = useMemo(() => {
    const ids = [...new Set(alle.map(z => z.zahPhase).filter((p): p is ZahPhaseId => p !== null))];
    return ids.map(id => ({ id, label: zahPhaseLabel(id, version?.zahPhasen) }));
  }, [alle, version]);

  return {
    laden, fehler, version, zeilen, gruppen, zaehler,
    gesamt: alle.length,
    ohneRegeln: version !== null && (version.todoRegeln ?? []).length === 0,
    tab, setTab, rolle, setRolle, nurMeine, setNurMeine,
    jahr, setJahr, variante, setVariante, phase, setPhase,
    jahre, alleJahrgaenge: jahr === ALLE, varianten, phasen, kuerzelModus,
    ausgeblendet, ladeMs,
    nurHaengt, setNurHaengt, stau, unbewertet, rollenBilanz,
  };
}

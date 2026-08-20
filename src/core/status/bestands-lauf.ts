/**
 * **Der Bestandslauf** — einmal über alle Vorgänge, mit dem Ergebnis der
 * To-do-Kaskade je Rolle, dem Urteil des Wächters und der Restfrist.
 *
 * Bis v4.132 stand dieser Lauf im Vorgangs-Board und sein Ergebnis in einem
 * plugin-lokalen Cache. Startseite und Förderanträge-Liste kamen nicht daran und
 * beantworteten „was ist zu tun?" deshalb mit einer **zweiten** Rechnung — einer
 * Tabelle über den rohen Status ({@link ../utils/naechsterSchritt.ts}), die die
 * gesetzten Kürzel gar nicht kennt. Gemessen am Bestand vom 20.08.2026 sagten
 * beide Motoren bei 262 von 845 offenen Vorgängen (31 %) etwas Verschiedenes:
 * 101 von 102 Vorgängen mit Status „Gutachten fertig" tragen `D_AT4` UND `D_AK4`
 * — die Kaskade sagt dort „in QS", die Startseite sagte „Gutachten freigeben".
 *
 * Deshalb steht der Lauf jetzt hier: **eine Rechnung, eine Ablage, drei Leser**
 * (Board, Startseite, Liste). Die Ablage samt Cache ist
 * [useBestandsAufgaben](../hooks/useBestandsAufgaben.ts) — dieses Modul rechnet
 * nur und kennt weder React noch einen Cache.
 *
 * **Die Einheit ist das Teilvorhaben, nicht der Verbund.** Die AB-Mappe führt
 * eine Zeile je Antrag, und die Regeln lesen überwiegend TV-Spalten (`D_PC-`,
 * `D_AK4`). Der Kontext eines Antrags besteht deshalb aus den Verbund-Feldern
 * PLUS seinen eigenen — würde man alle Teilvorhaben eines Verbunds in einen Topf
 * werfen, bekäme ein fertiges TV das To-do seines Nachbarn.
 *
 * Der Stichtag wird injiziert, nie eine Uhr in der Berechnung.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import { computeFristDatum, wirksamerEingang } from '@/core/services/csv/frist';
import { toVbPhaseNumber, VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { isBegleitungStatus, isTerminalStatus } from '@/core/utils/status-canonical';
import { istImBereich } from './betrachtungsbereich';
import { letzteAenderungJeAntrag } from './journal';
import { REGELSATZ_DEFAULT } from './regelsatz';
import { findeStatusCode } from './status-codes';
import { baueTodoKontext, ermittleTodosAlleRollen, type TodoErgebnis } from './todo-engine';
import { versionIndex } from './version-index';
import { jederVorgang } from './vorgangs-quelle';
import { pruefeStillstand, type WaechterErgebnis } from './waechter';
import { fristLaeuftVon, SEED_CODE_ZU_ZAH_PHASE, zahPhaseLabel } from './zah-phasen';
import type { MappingVersion, Rolle, ZahPhase, ZahPhaseId } from './typen';

/** Eine Zeile des Bestands — ein Teilvorhaben mit seinem ermittelten To-do. */
export interface BestandZeile {
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
   * Welche davon eine Anzeige zeigt, entscheidet ihre Rollenwahl; berechnet
   * werden sie in einem Durchgang. Enthält auch die abgeleiteten Platzhalter
   * (`quelle: 'abgeleitet'`) — die geliehene Aussage für eine Rolle, die noch
   * keinen eigenen Regelsatz hat.
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
   * jahrelang geschlossene Vorgänge mit „853 T über" an.
   */
  fristLaeuft: boolean;
  /** Rohsatz für den Kürzel-Filter (nur die Spalten, die er liest). */
  filterRecord: AntragListItem;
}

/** Was ein Lauf gekostet hat — für die Messung, nicht für die Fachlichkeit. */
export interface LaufTakt {
  gesamtMs: number;
  katalogMs: number;
  journalMs: number;
  bestandMs: number;
  idbMs: number;
  sammelnMs: number;
  todoMs: number;
  waechterMs: number;
}

export interface BestandLauf {
  zeilen: BestandZeile[];
  /** Vom Betrachtungsbereich übersprungen — GELESEN, nicht „übrig". */
  uebergangen: number;
  takt: LaufTakt;
}

/**
 * Die Kürzel-Spalten, die der Bearbeiter-Filter überhaupt anfasst
 * (`bearbeiterFilter.ts`: `BEARBEITER_FIELDS_LOWER` + `BEGLEITUNG_FIELDS_LOWER`
 * + die Rollen-Zuschnitte). Absichtlich hier dupliziert statt importiert: das
 * hielte dieses Modul sonst an einer Konstante fest, die dort privat ist — und
 * ein zusätzliches Kürzel hier zu viel kostet nichts, eines zu wenig meldet der
 * Convention-Test.
 */
const FILTER_SPALTEN: readonly string[] = [
  'status', 'tib_kuerz', 'bib_kuerz', 'bfm_kuerz', 'pfm_kuerz', 'ztp_kuerz',
];
const FILTER_SPALTEN_SET: ReadonlySet<string> = new Set(FILTER_SPALTEN);

/**
 * Der Antrags-Record, **auf die Filter-Spalten eingedampft**.
 *
 * Warum überhaupt: die Zeile trug bis v4.103 den vollen 461-Feld-Record
 * (~36 KB). Über 12 000 Zeilen hielt der Bestand damit sich selbst für die
 * Lebensdauer der Sitzung im Speicher fest — genau das, was `jederVorgang` mit
 * seinem Callback vermeiden wollte.
 *
 * **Gemischte Schreibweisen müssen mit.** `forEachKuerzelValue` durchsucht nicht
 * nur die Kleinbuchstaben-Keys, sondern läuft zusätzlich über ALLE Record-Keys
 * und prüft deren Kleinform — ein Mapping kann `ZTP_KUERZ` genauso ablegen wie
 * `ztp_kuerz`. Würde die Projektion nur die Kleinform kopieren, verschwänden
 * gemischt geschriebene Spalten still aus dem Filter.
 */
export function schmalerFilterSatz(rec: Record<string, unknown>): AntragListItem {
  const out: Record<string, unknown> = {};
  for (const k of FILTER_SPALTEN) {
    const v = rec[k];
    if (typeof v === 'string') out[k] = v;
  }
  for (const key in rec) {
    if (FILTER_SPALTEN_SET.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key || !FILTER_SPALTEN_SET.has(lk)) continue;
    const v = rec[key];
    if (typeof v === 'string') out[key] = v;
  }
  return out as unknown as AntragListItem;
}

/**
 * Läuft für diese Zeile die Antragsfrist?
 *
 * **Die Antwort steht im Katalog, nicht hier.** Bis v4.3 führte das Board eine
 * eigene Menge von vier Phasen-Ids — eine zweite Wahrheit neben `fristLaeuft`
 * an der Phase. Sobald die PL den Schnitt umhängt, traf die feste Menge daneben,
 * ohne dass irgendwo etwas fehlschlug.
 *
 * Die beiden Sonderfälle davor bleiben, weil sie am **Status** hängen und nicht
 * am Verfahrensschritt: terminal heißt fertig, und die Begleitphase hat ihre
 * eigene, echte VN-Frist (`computeFristDatum` liefert sie dort).
 *
 * Unbekannte oder verwaiste Phase → `true`, dieselbe Richtung wie
 * `fristLaeuftVon`: eine laufende Uhr ist sichtbar und korrigierbar, eine
 * stillschweigend angehaltene nimmt Arbeit aus jeder Liste.
 */
export function fristLaeuftFuer(
  zahPhase: ZahPhaseId | null, statusRoh: unknown, phasen?: readonly ZahPhase[],
): boolean {
  if (isTerminalStatus(statusRoh)) return false;
  if (isBegleitungStatus(statusRoh)) return true;
  return fristLaeuftVon(zahPhase, phasen);
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

/**
 * Den ganzen Bestand durchrechnen. Ein Durchgang, kein Cache — den führt
 * [useBestandsAufgaben](../hooks/useBestandsAufgaben.ts).
 *
 * @param bereichMenge Betrachtungsbereich; `null` = alles. Er wirkt **vor** der
 *   teuren Arbeit: was nicht im Bereich liegt, wird gar nicht erst gerechnet.
 * @param stichtag ISO — injiziert, nie eine Uhr in der Berechnung.
 */
export async function laufeBestand(
  idb: IDBStore,
  version: MappingVersion,
  bereichMenge: ReadonlySet<string> | null,
  stichtag: string,
): Promise<BestandLauf> {
  const begonnen = performance.now();
  const regeln = version.todoRegeln ?? [];
  const vIndex = versionIndex(version);
  const katalogMs = Math.round(performance.now() - begonnen);

  // Einmal fuer den ganzen Bestand statt einmal je Zeile: das Journal liegt
  // in Monatsdateien, und ein Lesevorgang je Antrag waere die teuerste Art,
  // dieselben Dateien zu lesen. `null` = kein Journal, dann bleibt es bei
  // der Naeherung aus `max(D_)`.
  const tJournal = performance.now();
  const journal = await letzteAenderungJeAntrag(idb, stichtag.slice(0, 10));
  const journalMs = Math.round(performance.now() - tJournal);

  const zeilen: BestandZeile[] = [];
  const tBestand = performance.now();
  let uebergangen = 0;
  let idbMs = 0;
  let sammelnMs = 0;
  let todoMs = 0;
  let waechterMs = 0;

  await jederVorgang(idb, version, (satz) => {
    const { aktenzeichen, unterprogrammId, verbundId: vbId, record: rec, vorkommen } = satz;
    const a = rec as unknown as AntragListItem;
    if (!istImBereich(unterprogrammId, bereichMenge)) { uebergangen += 1; return; }
    const tT = performance.now();
    const todos = ermittleTodosAlleRollen(regeln, baueTodoKontext(vorkommen), stichtag);
    todoMs += performance.now() - tT;
    const statusRoh = typeof a.status === 'string' ? a.status : '';
    const code = findeStatusCode(statusRoh)?.eintrag.code ?? null;
    // Der Wächter bekommt bewusst den AB-Satz und nicht die gewählte Sicht:
    // sein Urteil (ok/hängt/unbewertet) hängt gar nicht am To-do, und die
    // Rollen-Zuordnung des Staus soll sich nicht verschieben, nur weil jemand
    // die Anzeige umschaltet.
    const tW = performance.now();
    const waechter = pruefeStillstand({
      version, vorkommen, statusCode: code, todo: todos[REGELSATZ_DEFAULT],
      journalAenderung: journal?.get(aktenzeichen) ?? null,
      stichtag,
    });
    waechterMs += performance.now() - tW;
    // Der wirksame Eingang braucht `D_XTE` — custom gemappt und NICHT in der
    // Listen-Projektion. Hier ist er da, weil `sammleVorkommen` ihn über das
    // Schema aufgelöst hat (Bug-Klasse 5).
    const xte = vorkommen.find(x => x.feld.code === 'XTE');
    const eingang = wirksamerEingang(
      typeof rec.antragsdatum === 'string' ? rec.antragsdatum : null,
      xte ? (parseGermanDate(xte.wert) ?? xte.wert) : null,
    );
    // `VBE` genauso über die Auflösung statt über `rec.vn_eingang_datum`: die
    // Spalte `D_VBE` ist custom gemappt, der kanonische Key ist im ganzen
    // Bestand leer (v4.126).
    const vbe = vorkommen.find(x => x.feld.code === 'VBE');
    const vnEingang = vbe
      ? (parseGermanDate(vbe.wert) ?? vbe.wert)
      : (typeof rec.vn_eingang_datum === 'string' ? rec.vn_eingang_datum : undefined);
    const frist = eingang
      ? computeFristDatum({ status: a.status, antragsdatum: eingang, vn_eingang_datum: vnEingang })
      : null;
    const restTage = frist
      ? Math.ceil((new Date(frist).getTime() - new Date(stichtag).getTime()) / 86_400_000)
      : null;
    const zahPhase = code !== null
      ? vIndex.ersterWertNachCode.get(code)?.zahPhaseId
        ?? SEED_CODE_ZU_ZAH_PHASE.get(code) ?? null
      : null;
    zeilen.push({
      aktenzeichen,
      verbundId: vbId,
      titel: typeof a.titel === 'string' ? a.titel : (a.akronym ?? ''),
      statusRoh,
      zahPhase,
      zahPhaseText: zahPhaseLabel(zahPhase, version.zahPhasen),
      jahr: jahrVon(rec),
      variante: varianteVon(rec),
      todos,
      waechter,
      wirksamerEingang: eingang,
      restTage,
      fristLaeuft: fristLaeuftFuer(zahPhase, a.status, version.zahPhasen),
      filterRecord: schmalerFilterSatz(rec),
    });
  }, (t) => {
    idbMs += t.ioMs;
    sammelnMs += t.sammelMs;
  });

  const bestandMs = Math.round(performance.now() - tBestand);
  const gesamtMs = Math.round(performance.now() - begonnen);
  // Die Ladezeit ist die Zahl, an der sich der Bereich rechtfertigen muss —
  // messbar statt behauptet. In Phasen, weil eine Summe niemandem sagt, wo die
  // Zeit hingeht: `idb` ist Deserialisierung, `journal` ist SMB,
  // `sammeln`/`todo`/`wächter` sind reines Rechnen.
  const r = (x: number): number => Math.round(x);
  console.info(
    `[bestands-lauf] gesamt ${gesamtMs} ms | katalog ${katalogMs} | journal ${journalMs}`
    + ` | bestand ${bestandMs} (idb ${r(idbMs)} · sammeln ${r(sammelnMs)}`
    + ` · todo ${r(todoMs)} · wächter ${r(waechterMs)})`
    + ` | ${zeilen.length} Vorgänge`
    + (uebergangen > 0 ? ` · ${uebergangen} außerhalb des Bereichs übersprungen` : ''),
  );

  return {
    zeilen,
    uebergangen,
    takt: {
      gesamtMs, katalogMs, journalMs, bestandMs,
      idbMs: r(idbMs), sammelnMs: r(sammelnMs), todoMs: r(todoMs), waechterMs: r(waechterMs),
    },
  };
}

/**
 * Reine Aggregations-Funktion fuer die Dashboard-Counts.
 *
 * Wurde aus `useDashboardData()` heraus-extrahiert, damit der Aggregat-Loop
 * unit-testbar ist (ohne Zustand-Stores zu mocken). Der Hook ist jetzt ein
 * duenner Wrapper, der die Store-Werte einliest und diese Funktion ruft.
 *
 * Status-Vergleiche laufen ueber die Kategorie-Helper aus `status-canonical`,
 * d.h. sowohl Welt-A (Seed-Werte wie `genehmigt`/`in_pruefung`) als auch Welt-B
 * (CSV-Rohwerte wie `bewilligt`/`VN geprüft`/`NF gestellt`) werden korrekt
 * gezaehlt.
 *
 * **Zwei Ergebnis-Arten, zwei Grundmengen.** Die `stats` zaehlen den gesamten
 * eigenen Bestand und weisen die Begleitphase eigens aus. Alle Listen- und
 * Frist-Felder darunter rechnen dagegen die **Antragsphase**: sie bucketen nach
 * `antragsdatum`, und die Begleitphase laeuft nach einer anderen Uhr
 * (`vn_eingang_datum + 6 Monate` statt `antragsdatum + 90 Tage`, 3–4 Jahre statt
 * 3–9 Monate). Beides in einer Zahl zu addieren ergibt kein Arbeitssignal.
 */
import type { AntragListItem, Verbund } from '@/core/services/csv/types';
import type { FristZustand } from '@/core/services/csv/frist-ergebnis';
import { criticalFristErgebnis } from '@/plugins/antraege/groupAggregates';
import type { Vorgang } from '@/core/types/vorgang';
import {
  antragMatchesBearbeiter,
  type BearbeiterFilterMode,
} from '@/plugins/antraege/bearbeiterFilter';
import { isIrrlaeufer } from '@/core/utils/vb-phase-mappings';
import { getStatusCategory, type StatusCategory } from '@/core/utils/status-canonical';
import { precheckUrteilVonZeile } from '@/core/utils/naechsterSchritt';

export type AntragVorgang = Vorgang & {
  _isAntrag: true;
  vb_phase?: number;
  /** Akronym aus dem CSV (z.B. "CALYPSO"). Wird auf der Home-Liste
   *  als bold-prefix vom restlichen Titel separat gerendert, um den
   *  Render-Stil der Antraege-Seite zu spiegeln. */
  acronym?: string;
  /** Verbund-ID des Antrags (leer / undefined bei Solo-Antraegen). Wird auf
   *  der Home fuer das Verbund-Clustering der `meineAntraege`-Liste genutzt. */
  verbund_id?: string;
  /** Verbund-Titel aus dem `Verbund`-Store (CSV-Spalte `VB_TITEL`). Wird in
   *  der Home-Liste bevorzugt vor dem TV-Titel angezeigt — sowohl bei Verbund-
   *  Clustern (mehrere TVs gleicher verbund_id) als auch bei Einzelprojekten
   *  (dort ist VB_TITEL meist identisch mit TV-Titel). Fallback auf TV-Titel
   *  wenn `verbund_titel` leer ist. */
  verbund_titel?: string;
  /** Anzahl Teilvorhaben im Verbund-Cluster. Bei Solo-Antraegen 1, bei
   *  Verbund-Lead-TVs = Anzahl aller TVs (inkl. Lead). Die Liste rendert daraus
   *  die Marke „N TV" (wie die Kanban-Karte), der Balken die TV-Summe. Wird nur
   *  in `meineAntraege` gesetzt. */
  tv_count?: number;
  /** Laut Kürzeln erledigt, der amtliche Status sagt noch offen (eine Sperre
   *  der Kaskade griff). Genau die Menge, die „Meine Anträge" als Zählzeile
   *  nennt — der Tagesbrief liest sie hier, statt sie ein zweites Mal
   *  herzuleiten. Nur gesetzt, wenn wahr. */
  erledigtLautKuerzeln?: true;
  /** Die Aktenzeichen des Clusters (bei Solo-Anträgen genau eines). Grundlage
   *  für die Aufgabe der Zeile — sie wird über diese Teilvorhaben gefaltet. */
  tv_aktenzeichen?: string[];
  /**
   * Frist-ZUSTAND aus derselben Engine wie die Förderanträge-Tabelle
   * (`berechneFrist` über `criticalFristErgebnis`). Die Startseite rechnete bis
   * v4.131 selbst (`antragsdatum + 90`) und ließ die Uhr damit auch dort laufen,
   * wo die Zielseite „angehalten" sagt — abgelehnte und zurückgezogene Vorgänge
   * standen mit dreistelligem Rückstand an der Spitze einer Karte, die
   * „Sortierung: Frist" verspricht.
   */
  fristZustand?: FristZustand;
  /** Tage bis zur Frist; `null`, wo keine Uhr läuft (angehalten, unberechenbar).
   *  Sortier- und Aggregat-Grundlage — exakt wie `fristTageVon` in der Liste. */
  fristTage?: number | null;
  /** Wiedereinreicher-Hinweis aus der CSV-Spalte `T_XSW` (custom-Feld
   *  `t_xsw`). Wird in „Meine Anträge" rot/fett hinter dem Titel gerendert. */
  t_xsw?: string;
  /** TIB-Bearbeiter-Kürzel (Roh-`tib_kuerz`). Wird in der Home-„Alle Anträge"-
   *  Übersicht (alle-Modus, pl/dev) je Zeile als MA-Badge angezeigt. */
  tib_kuerz?: string;
  /** Antragseingangs-Datum (CSV `antragsdatum`), roh. Für den Ampel-Punkt +
   *  das Eingangsalter („vor N T") in der Home-„Meine Anträge"-Liste. */
  antragsdatum?: string;
  /** Bewilligungsdatum (CSV `bewilligung_datum`), roh. Nur für den Ampel-Null-
   *  Guard (gesetzt ⇒ keine Ampel). */
  bewilligung_datum?: string;
  /**
   * Das **ausschlaggebende** PreCheck-Label (`precheckUrteil`), z.B. „pre-check
   * negativ". Speist die PreCheck-Regeln der Handlungs-Formel `naechsterSchritt`
   * in „Meine Anträge".
   *
   * Seit v6.65 zusammengeführt aus den zwei Teilen `precheck_tv_status_label`
   * (AB) und `precheck_vb_status_label` (FB) — vorher trug die Projektion die
   * eine gemeinsame Spalte, in der das jüngere Verbund-Urteil ein negatives
   * TV-Urteil überschrieb. Der Name sagt deshalb „Urteil", nicht „Status": es
   * ist keine Spalte mehr, sondern die Zusammenführung zweier.
   */
  precheck_urteil_label?: string;
};

export interface DashboardStats {
  total: number;
  offen: number;
  inPruefung: number;
  nachforderung: number;
  /** Antraege in Begleit-Phase (VN/ZB-Pruefung, nach Bewilligung). */
  begleitung: number;
  bewilligt: number;
}

export interface DashboardAggregateResult {
  /** Eigene Vorgänge der Antragsphase (offen ohne Begleitung). */
  offeneVorgaenge: Vorgang[];
  dringend: Array<Vorgang & { daysLeft: number }>;
  naechsterSchritt: (Vorgang & { daysLeft: number }) | null;
  fristenDieseWoche: number;
  letzteAenderungen: Vorgang[];
  /** Alle eigenen Förderanträge der Antragsphase, sortiert nach Frist asc,
   *  dann vb_phase asc. Die UI (HomePage/MeineAntraegeSection) schneidet selbst
   *  ab — initial nach `profile.home_meine_antraege_count` (Default 5),
   *  optional erweiterbar via "+10 mehr"-Button. */
  meineAntraege: AntragVorgang[];
  stats: DashboardStats;
  /** Wurde mindestens ein Antrag mit einem nicht-leeren KUERZ-Feld gesehen?
   *  Wird gebraucht, um die "Bearbeiter-Filter ohne KUERZ-Daten"-Warnung
   *  korrekt zu setzen. */
  anyKuerzelSeen: boolean;
  /**
   * Wie viele Vorgänge einen offenen Status tragen, laut Kürzeln aber erledigt
   * sind. Ein Befund für das Fachsystem, kein Anzeigefehler — deshalb wird er
   * gezählt und genannt, statt still weggeräumt zu werden.
   */
  erledigtLautKuerzeln: number;
}

export interface AggregateOptions {
  /** Optional: Verbund-Lookup (verbund_id → Verbund). Wird in
   *  `antragToVorgangLike` genutzt um `verbund_titel` an die MeineAntraege-
   *  Liste anzuhaengen. Wenn nicht uebergeben, bleibt `verbund_titel`
   *  undefined und das UI faellt auf den TV-Titel zurueck. */
  verbundById?: Map<string, Verbund>;
  includeAntraege: boolean;
  /** Erlaubt Tests mit einem fixen Heute-Datum. Default `Date.now()`. */
  nowMs?: number;
  /**
   * Aktenzeichen, deren To-do-Kaskade **wegen einer greifenden Sperre** schweigt
   * — Schlussvermerk oder Zuwendungsbescheid liegen vor
   * ([bestands-lauf.ts](../../core/status/bestands-lauf.ts)).
   *
   * Sie zählen nicht als offen, tragen keine Frist und stehen nicht im
   * Rückstandsbalken; **sichtbar bleiben sie** (ans Ende sortiert, mit „Keine
   * Aufgabe mehr"). Gemessen am 20.08.2026 traf das drei Vorgänge im ganzen
   * Bestand — und zwar die beiden ältesten einer einzigen Kürzel-Liste, wo sie
   * mit „vor 240 Tagen" ganz oben standen.
   *
   * Fehlt die Menge (Lauf noch nicht durch, kein Vorgangssystem), verhält sich
   * alles exakt wie vorher.
   */
  gesperrt?: ReadonlySet<string>;
}

const KUERZ_KEYS_CANONICAL: readonly string[] = [
  'tib_kuerz', 'bib_kuerz', 'ztp_kuerz', 'pfm_kuerz',
];
const KUERZ_KEYS_CANONICAL_SET: ReadonlySet<string> = new Set(KUERZ_KEYS_CANONICAL);

/** Inline-Variante von hasAnyKuerzelData(single-record). Spart eine separate
 *  Full-Scan-Pass über die Antrag-Liste — wir checken im Aggregations-Loop
 *  parallel, ob irgendein Antrag eine der KUERZ-Spalten gesetzt hat. */
function antragHasAnyKuerzel(antrag: AntragListItem): boolean {
  const rec = antrag as unknown as Record<string, unknown>;
  for (const k of KUERZ_KEYS_CANONICAL) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  for (const key in rec) {
    if (KUERZ_KEYS_CANONICAL_SET.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key) continue;
    if (!KUERZ_KEYS_CANONICAL_SET.has(lk)) continue;
    const v = rec[key];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  return false;
}

/** Minimal-Projektion eines Antrags auf eine Vorgang-aehnliche Shape. */
function antragToVorgangLike(
  a: AntragListItem,
  nowMs: number,
  verbundById?: Map<string, Verbund>,
  verbundAllTvs?: Map<string, AntragListItem[]>,
  /** Ergebnis-Cache je `verbund_id` — die Verbund-Frist ist für alle TVs
   *  desselben Verbundes dieselbe. Ohne ihn rechnete ein Verbund mit N TVs sie
   *  N² mal (jeder TV über alle Geschwister). */
  fristCache?: Map<string, ReturnType<typeof criticalFristErgebnis>>,
): AntragVorgang {
  const antragsdatum = typeof a.antragsdatum === 'string' ? a.antragsdatum : undefined;
  const verbundId = typeof a.verbund_id === 'string' && a.verbund_id.length > 0 ? a.verbund_id : undefined;
  // **Die Frist kommt aus DERSELBEN Engine wie die Zielseite** (v4.131):
  // `criticalFristErgebnis` ist die Verbund-Fassung von `berechneFrist` und
  // beantwortet dieselbe Frage wie die Frist-Zelle der Fördertabelle — ein
  // Verbund ist so dringend wie sein knappster TV, und wo keine Uhr läuft, gibt
  // es keine Restzeit. Für einen Solo-Antrag (`tvs = [a]`) ist das Ergebnis
  // identisch zu `fristErgebnisVon(a)`.
  //
  // Vorher rechnete die Startseite selbst (Verbund-Frist ab spätestem `D_AAE`
  // + eigene `daysUntil`-Formel; der Helfer dafür entfiel mit v6.52). Zwei Rechnungen, zwei Ergebnisse: die eigene
  // kannte weder den wirksamen Eingang (`D_XTE`) noch das Haltekriterium der
  // ZAH-Phase (`fristLaeuft`) und ließ die 90-Tage-Uhr auch für abgelehnte
  // Vorgänge weiterlaufen. `deadline` trägt deshalb nur noch ein Datum, wo
  // wirklich eine Frist läuft — sonst rutscht die Zeile ans Ende, genau wie in
  // der Liste (`compareFristAsc`, sort.ts).
  const verbundTvs = verbundId && verbundAllTvs ? (verbundAllTvs.get(verbundId) ?? [a]) : [a];
  const gecacht = verbundId ? fristCache?.get(verbundId) : undefined;
  const fristErgebnis = gecacht ?? criticalFristErgebnis(verbundTvs, nowMs);
  if (verbundId && !gecacht) fristCache?.set(verbundId, fristErgebnis);
  const laeuft = fristErgebnis.zustand === 'laeuft';
  const deadline = laeuft ? fristErgebnis.zielDatum : undefined;
  const fristTage = laeuft ? (fristErgebnis.tageRest ?? null) : null;
  const created = antragsdatum ?? a._updated_at;
  // Verbund-Titel (VB_TITEL) bevorzugt aus dem Verbund-Store ziehen. Wenn der
  // Verbund nicht gefunden wird oder das Titel-Feld leer ist, bleibt es
  // undefined und das UI faellt auf den TV-Titel zurueck.
  const verbundTitel = verbundId && verbundById
    ? (() => {
        const vb = verbundById.get(verbundId);
        const t = typeof vb?.titel === 'string' ? vb.titel.trim() : '';
        return t.length > 0 ? t : undefined;
      })()
    : undefined;
  return {
    id: a.aktenzeichen,
    title: a.titel ?? a.aktenzeichen,
    // Roher CSV-Wert, unverändert durchgereicht. Fehlt er, bleibt er leer —
    // `getStatusCategory('')` sagt `sonstige` („wir wissen es nicht"), was
    // ehrlicher ist als ein erfundener Anfangsstatus.
    status: a.status ?? '',
    priority: 'normal',
    assignee: a.antragsteller ?? '',
    created,
    modified: a._updated_at,
    deadline,
    fristZustand: fristErgebnis.zustand,
    fristTage,
    tags: [],
    notes: '',
    _isAntrag: true,
    vb_phase: typeof a.vb_phase === 'number' ? a.vb_phase : undefined,
    acronym: typeof a.akronym === 'string' && a.akronym.trim().length > 0 ? a.akronym.trim() : undefined,
    verbund_id: verbundId,
    verbund_titel: verbundTitel,
    t_xsw: typeof a.t_xsw === 'string' && a.t_xsw.trim().length > 0 ? a.t_xsw.trim() : undefined,
    tib_kuerz: typeof a.tib_kuerz === 'string' && a.tib_kuerz.trim().length > 0 ? a.tib_kuerz.trim() : undefined,
    antragsdatum,
    bewilligung_datum: typeof a.bewilligung_datum === 'string' ? a.bewilligung_datum : undefined,
    precheck_urteil_label: precheckUrteilVonZeile(a).label || undefined,
  };
}

interface MutableStats {
  total: number;
  offen: number;
  inPruefung: number;
  nachforderung: number;
  begleitung: number;
  bewilligt: number;
}

/** Zaehlt eine Status-Kategorie in das Stats-Objekt und gibt zurueck, ob der
 *  Status final entschieden ist (closed = nicht mehr in `offen`). Nimmt die
 *  Kategorie statt des Rohwerts: der Aufrufer braucht sie ohnehin fuer die
 *  Phasen-Trennung und normalisiert den Rohwert so nur einmal. */
function tallyKategorie(cat: StatusCategory, stats: MutableStats): boolean {
  if (cat === 'in_pruefung') stats.inPruefung++;
  else if (cat === 'nachforderung') stats.nachforderung++;
  else if (cat === 'begleitung') stats.begleitung++;
  else if (cat === 'bewilligt') stats.bewilligt++;
  return cat === 'bewilligt' || cat === 'abgelehnt' || cat === 'abgeschlossen';
}

export function computeDashboardAggregate(
  antraege: readonly AntragListItem[],
  bearbeiterMode: BearbeiterFilterMode,
  options: AggregateOptions,
): DashboardAggregateResult {
  const nowMs = options.nowMs ?? Date.now();
  const stats: MutableStats = {
    total: 0, offen: 0, inPruefung: 0, nachforderung: 0, begleitung: 0, bewilligt: 0,
  };
  let anyKuerzelSeen = false;
  const offeneVorgaenge: Vorgang[] = [];
  const fristKandidaten: Array<Vorgang & { daysLeft: number }> = [];

  // Alle TVs pro verbund_id (ueber den GESAMTEN Antrags-Bestand, inkl. nicht
  // offener) — Basis fuer die Verbund-Frist (max antragsdatum = zuletzt
  // eingegangenes TV). Wird in `antragToVorgangLike` durchgereicht.
  const verbundAllTvs = new Map<string, AntragListItem[]>();
  if (options.includeAntraege) {
    for (const a of antraege) {
      const vid = typeof a.verbund_id === 'string' && a.verbund_id.length > 0 ? a.verbund_id : null;
      if (!vid) continue;
      let arr = verbundAllTvs.get(vid);
      if (!arr) { arr = []; verbundAllTvs.set(vid, arr); }
      arr.push(a);
    }
  }

  // Pro Verbund nur EIN Frist-Kandidat: alle TVs eines Verbundes teilen jetzt
  // dieselbe (vom letzten TV abgeleitete) Frist — ohne Dedupe wuerde ein Verbund
  // in `fristenDieseWoche`/`dringend` mehrfach gezaehlt. Solo-Antraege bleiben
  // einzeln.
  const seenFristVerbund = new Set<string>();
  const fristCache = new Map<string, ReturnType<typeof criticalFristErgebnis>>();
  const offeneAntraege: AntragVorgang[] = [];
  /** Offener Status, aber die Kaskade schweigt wegen einer Sperre. */
  const erledigteAntraege: AntragVorgang[] = [];
  let erledigtLautKuerzeln = 0;
  if (options.includeAntraege) {
    for (const a of antraege) {
      if (!anyKuerzelSeen && antragHasAnyKuerzel(a)) anyKuerzelSeen = true;
      if (isIrrlaeufer(a.vb_phase)) continue;
      if (bearbeiterMode.active && !antragMatchesBearbeiter(a, bearbeiterMode)) continue;
      const v = antragToVorgangLike(a, nowMs, options.verbundById, verbundAllTvs, fristCache);
      const kategorie = getStatusCategory(v.status);
      stats.total++;
      if (tallyKategorie(kategorie, stats)) continue;
      // Ab hier rechnet die Startseite die Antragsphase — genau wie die
      // SLA-Sichten `diese_woche_faellig`/`ueberfaellig` in `views.ts`. Liste,
      // Rueckstands-Balken und Fristen bucketen nach `antragsdatum`; ein
      // Begleit-Vorgang ist dort seit 3–4 Jahren eingegangen und faende sich
      // geschlossen im aeltesten Segment wieder. Der Ausschluss haengt am
      // Lebenszyklus und ist bedingungslos — NICHT am Profil-Haken
      // `bearbeiter_inkl_begleitung`, der genau deshalb entkoppelt wurde. Die
      // Zaehler oben weisen die Begleitung weiter aus (`stats.begleitung`).
      if (kategorie === 'begleitung') { stats.offen++; continue; }
      // **Die Kürzel sind der jüngere Stand als der amtliche Status**: liegt ein
      // Schlussvermerk vor, ist das Verfahren durch — auch wenn `STATUS_TV` noch
      // „Stellungnahme zur Rücknahmeempfehlung" sagt.
      //
      // Erst HIER, nach dem Begleitungs-Ausstieg: ein Vorgang in der VN-Prüfung
      // trägt naturgemäß einen Zuwendungsbescheid, und der sperrt die Kaskade
      // (S0b). Weiter oben gefragt zählte die Meldung 13 statt 3 — zehn davon
      // Begleit-Vorgänge, die in dieser Liste nie standen (gemessen 20.08.2026).
      if (options.gesperrt?.has(a.aktenzeichen) === true) {
        erledigtLautKuerzeln++;
        erledigteAntraege.push({ ...v, erledigtLautKuerzeln: true });
        continue;
      }
      stats.offen++;
      offeneVorgaenge.push(v);
      offeneAntraege.push(v);
      // Nur laufende Uhren sind Frist-Kandidaten. Ein angehaltener Vorgang hat
      // keine Restzeit — eine erfundene sortierte ihn mitten unter die
      // dringenden (dieselbe Regel wie `fristTageVon` in der Liste).
      const dl = v.fristTage ?? null;
      if (dl !== null) {
        const fkKey = v.verbund_id ?? `solo:${a.aktenzeichen}`;
        if (!seenFristVerbund.has(fkKey)) {
          seenFristVerbund.add(fkKey);
          fristKandidaten.push({ ...v, daysLeft: dl });
        }
      }
    }
  }

  fristKandidaten.sort((x, y) => x.daysLeft - y.daysLeft);
  const dringend = fristKandidaten.filter(v => v.daysLeft <= 7);
  const naechster = fristKandidaten[0] ?? null;
  let fristenDieseWoche = 0;
  for (const v of fristKandidaten) {
    if (v.daysLeft >= 0 && v.daysLeft <= 7) fristenDieseWoche++;
  }

  const letzteAenderungen = [...offeneVorgaenge]
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, 8);

  // Sortierung: Restlaufzeit aufsteigend (knappste Frist oben), VB-Phase als
  // Tie-Breaker. **Byte-gleich zu `compareFristAsc` der Liste** (sort.ts):
  // Zeilen ohne laufende Uhr sinken ans Ende, statt mit einer errechneten
  // Überfälligkeit die Spitze zu besetzen. Vier der zehn sichtbaren Zeilen
  // waren bis v4.131 genau solche — abgelehnte und zurückgezogene Vorgänge, die
  // die Zielseite nach dem Klick auf „Alle →" ganz unten führt.
  const nachFrist = (a: AntragVorgang, b: AntragVorgang): number => {
    const da = a.fristTage ?? null;
    const db = b.fristTage ?? null;
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    }
    const pa = a.vb_phase ?? Number.POSITIVE_INFINITY;
    const pb = b.vb_phase ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  };
  // Was laut Kürzeln erledigt ist, steht HINTEN — sichtbar, aber nicht mehr an
  // der Spitze einer Karte, die „Sortierung: Frist" verspricht. Es aus der Liste
  // zu nehmen wäre die bequemere, aber unehrlichere Antwort: der amtliche Status
  // widerspricht, und genau das soll auffallen.
  const sortedMeineAntraege = [
    ...[...offeneAntraege].sort(nachFrist),
    ...[...erledigteAntraege].sort(nachFrist),
  ];

  // Verbund-Clustering: pro `verbund_id` nur den ersten TV behalten (= TV mit
  // der kritischsten Frist, weil die Liste schon sortiert ist). Solo-Antraege
  // ohne verbund_id bleiben einzeln. `tv_count` zaehlt die Geschwister inkl.
  // Lead, damit die UI einen "+N"-Indikator rendern kann.
  // Begruendung: die Home soll nur signalisieren *dass* an einem Antrag etwas
  // offen ist — der User klickt darauf und sieht den vollen Cluster in der
  // Antrags-Liste. TVs einzeln auflisten blaehte die Home auf (Beispiel
  // KOMPaSS mit 3 TVs = 3 fast identische Zeilen). Kein Slice — UI schneidet
  // selbst ab, damit "+10 mehr"-Erweiterung in-page funktioniert.
  const verbundTvs = new Map<string, string[]>();
  for (const tv of sortedMeineAntraege) {
    if (!tv.verbund_id) continue;
    const liste = verbundTvs.get(tv.verbund_id);
    if (liste) liste.push(tv.id); else verbundTvs.set(tv.verbund_id, [tv.id]);
  }
  const seenVerbund = new Set<string>();
  const meineAntraege: AntragVorgang[] = [];
  for (const tv of sortedMeineAntraege) {
    if (tv.verbund_id) {
      if (seenVerbund.has(tv.verbund_id)) continue;
      seenVerbund.add(tv.verbund_id);
      // Die Aktenzeichen des Clusters wandern mit: die Aufgabe der Zeile wird
      // über GENAU diese Teilvorhaben gefaltet (`aufgabeAusBestand`) — nicht
      // über alle TVs des Verbunds. Sonst bekäme die Zeile das To-do eines
      // Teilvorhabens, das gar nicht in dieser Liste steht.
      const tvs = verbundTvs.get(tv.verbund_id) ?? [tv.id];
      meineAntraege.push({ ...tv, tv_count: tvs.length, tv_aktenzeichen: tvs });
    } else {
      meineAntraege.push({ ...tv, tv_count: 1, tv_aktenzeichen: [tv.id] });
    }
  }

  return {
    offeneVorgaenge,
    dringend,
    naechsterSchritt: naechster,
    fristenDieseWoche,
    letzteAenderungen,
    meineAntraege,
    stats: { ...stats },
    anyKuerzelSeen,
    erledigtLautKuerzeln,
  };
}

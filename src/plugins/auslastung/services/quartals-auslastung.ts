/**
 * Quartals-Auslastung — Single-Source-of-Truth-Modell (v2.4).
 *
 * Ersetzt die bisherige Aufteilung in "Zuweisungs-Store + externe Zuweisungen":
 *
 *  - **Festgebucht** (`fest`): pro MA die TVs aus der Master-CSV mit
 *    passendem `tib_kuerz` + `antragsdatum` im Quartal. Das ist die einzige
 *    Quelle fuer "harte" Kapazitaets-Buchungen. PL traegt das Kuerzel direkt
 *    in die CSV ein — App liest es beim Reimport.
 *  - **Pending** (`pending`): Selbsteintragungen aus dem Auslastungs-Store
 *    (`Zuweisung` mit `status='selbst'|'freigegeben'`), die NOCH NICHT im
 *    `fest`-Bucket stehen. Werden separat angezeigt und nachher (beim
 *    CSV-Eintrag durch den PL) durch Dedup automatisch in `fest` ueberfuehrt.
 *
 * Verbund-Behandlung: 1 Verbund-Anteil pro MA = 1 "Antrag" fuer die
 * User-Anzeige. Die Stunden ergeben sich aus der ECHTEN TV-Anzahl, die
 * dem MA gehoert: `tvCount × stundenProTV` (kein Durchschnitts-Faktor
 * mehr). Beispiel: 4-TV-Verbund mit allen TVs auf MUE → MUE bekommt
 * `antraege=1, tvs=4, stunden=4×9=36h`.
 *
 * Pending-Dedup: eine Zuweisung gilt nur als pending, wenn das Aktenzeichen
 * nicht bereits im festen Bucket desselben MAs steht. Sobald die CSV das
 * Kuerzel "sieht", wandert der Antrag nach `fest`, der Pending-Marker
 * verschwindet automatisch.
 */
import type { Antrag } from '@/core/services/csv/types';
import { getKategorieLabel } from '@/plugins/antraege/filter/kategorieQuickfilter';
import { stundenProTVFor, type AntragstypBucket, type Zuweisung } from '../types';
import { dateToQuartal } from './externe-zuweisungen';

/** Ein logisch zusammengehoeriger Antrag (Verbund mit N TVs oder
 *  Einzel-Antrag mit 1 TV), aus Sicht eines bestimmten MAs.
 *  `aktenzeichen[]` enthaelt nur die TVs, die diesem MA gehoeren —
 *  ein 4-TV-Verbund mit TV1/TV2 auf MUE und TV3/TV4 auf SCH liefert fuer
 *  MUE einen Eintrag mit `aktenzeichen=[TV1, TV2], tvCount=2`. */
export interface AuslastungVerbund {
  verbundId: string | null;        // null bei Einzel-Antrag
  aktenzeichen: string[];          // TVs, die diesem MA gehoeren
  akronym?: string;
  titel?: string;
  antragsdatum?: string;
  /** Roh-Status des (ersten) Teilantrags der Gruppe. Heute nur von
   *  `computeAltlasten` gesetzt (Altanträge-Liste zeigt ihn an); im
   *  fest/pending-Pfad `undefined`. Anzeige via `getStatusLabel`. */
  status?: string;
  tvCount: number;                 // = aktenzeichen.length
  stunden: number;                 // tvCount × stundenProTV
}

/** Ein Bucket pro MA — entweder `fest` (aus CSV) oder `pending` (aus Store). */
export interface MaQuartalsBucket {
  antraege: number;                // Anzahl Verbund-Anteile (1 Verbund = 1)
  tvs: number;                     // echte TV-Anzahl
  stunden: number;                 // tvs × stundenProTV
  /** Aktenzeichen aller zugeordneten TVs — fuer Pool-Filter UND fuer den
   *  Dedup zwischen fest und pending. */
  aktenzeichenSet: Set<string>;
  verbuende: AuslastungVerbund[];
  /** v2.16: Anzahl Verbund-Anteile je Antragstyp (FuE/DS/DL/NW), via
   *  `getKategorieLabel(vb_phase)`. Speist die „(N)"-Anträge-Zahl in der
   *  AKTUELL-Spalte (1 pro Verbund-Anteil, wie `antraege`). */
  antraegeProTyp: Partial<Record<AntragstypBucket, number>>;
  /** TV-Anzahl je Antragstyp (FuE/DS/DL/NW) — Σ `tvCount` je Bucket. Speist das
   *  per-Typ-Kapazitaetsmodell (Verbrauch in TVs) + den Matcher-Kontingent-
   *  Verbrauch, damit „verbraucht/Kapazität" in derselben TV-Währung steht wie
   *  FREI/AKTUELL. Summe über Buckets ≈ `tvs` (Irrläufer ohne Bucket fehlen). */
  tvsProTyp: Partial<Record<AntragstypBucket, number>>;
}

/** Gesamt-Sicht pro MA fuer ein Quartal. */
export interface MaQuartalsAuslastung {
  fest: MaQuartalsBucket;
  pending: MaQuartalsBucket;
}

/** Liefert die TV-Anzahl eines Antrags fuer die in-App-Selbsteintragung:
 *  bei Verbund → Anzahl Eintraege in `antraege` mit derselben `verbund_id`,
 *  sonst 1. Mindestens 1 (defensiv gegen leere Verbund-Listen).
 *
 *  `fallbackAktenzeichen` ist heute nicht benutzt — kann aber spaeter fuer
 *  alternative TV-Erkennung (Aktenzeichen-Prefix) genutzt werden. Bewusst
 *  in der API gelassen, damit Aufrufer den Antrag-Pointer nicht neu mappen
 *  muessen.
 */
export function getTVCount(
  antraege: readonly Antrag[],
  verbundId: string | undefined | null,
  _fallbackAktenzeichen?: string,
): number {
  if (!verbundId) return 1;
  let count = 0;
  for (const a of antraege) {
    if ((a as { verbund_id?: string }).verbund_id === verbundId) count++;
  }
  return count > 0 ? count : 1;
}

function emptyBucket(): MaQuartalsBucket {
  return {
    antraege: 0,
    tvs: 0,
    stunden: 0,
    aktenzeichenSet: new Set<string>(),
    verbuende: [],
    antraegeProTyp: {},
    tvsProTyp: {},
  };
}

interface GroupState {
  verbundId: string | null;
  aktenzeichen: string[];
  akronym?: string;
  titel?: string;
  antragsdatum?: string;
  /** vb_phase des Lead-TV (verbund-weit gleich) → Antragstyp-Bucket. */
  vbPhase?: unknown;
}

function readField(a: Antrag, key: string): string | undefined {
  const v = (a as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : undefined;
}

/** Hauptberechnung — gibt eine Map `anonId → {fest, pending}` zurueck. MAs
 *  ohne Eintraege erscheinen NICHT in der Map (Konsumenten muessen mit
 *  `Map.get(anonId) ?? leerer-Auslastung` arbeiten).
 */
export function computeQuartalsAuslastung(
  antraege: readonly Antrag[],
  zuweisungen: readonly Zuweisung[],
  toAnon: ReadonlyMap<string, string>,
  quartal: string,
  stundenProTV: number,
  stundenProTVProTyp?: Partial<Record<AntragstypBucket, number>>,
): Map<string, MaQuartalsAuslastung> {
  // v2.31: pro Verbund-Anteil wird der Antragstyp-spezifische Stunden-Faktor
  // benutzt (z.B. DS 4,5 h statt 9 h). Ohne `stundenProTVProTyp` → Standard fuer
  // alle Typen (= altes Verhalten).
  const stundenFor = (bucket: AntragstypBucket | null): number =>
    stundenProTVFor({ stundenProTV, stundenProTVProTyp }, bucket);
  const result = new Map<string, MaQuartalsAuslastung>();

  // Lookup fuer Pass 2 (pending): aktenzeichen → Antrag.
  const antraegeByAktenzeichen = new Map<string, Antrag>();
  for (const a of antraege) antraegeByAktenzeichen.set(a.aktenzeichen, a);

  // Hilfs-Map: pro (anonId, groupKey) sammeln wir die TVs, dann am Ende in
  // verbuende[] giessen. groupKey = verbund_id || aktenzeichen.
  const collectFest = new Map<string, Map<string, GroupState>>();
  // Selbe Struktur fuer pending.
  const collectPending = new Map<string, Map<string, GroupState>>();

  // ─── Pass 1: fest (aus CSV) ──────────────────────────────────────────────
  for (const a of antraege) {
    const rawKuerzel = (a as { tib_kuerz?: unknown }).tib_kuerz;
    if (typeof rawKuerzel !== 'string') continue;
    const kuerzel = rawKuerzel.trim().toUpperCase();
    if (!kuerzel) continue;
    const anonId = toAnon.get(kuerzel);
    if (!anonId) continue;
    const datum = (a as { antragsdatum?: unknown }).antragsdatum;
    if (dateToQuartal(typeof datum === 'string' ? datum : undefined) !== quartal) continue;

    const verbundId = readField(a, 'verbund_id') ?? null;
    const groupKey = verbundId ?? a.aktenzeichen;

    let perAnon = collectFest.get(anonId);
    if (!perAnon) {
      perAnon = new Map();
      collectFest.set(anonId, perAnon);
    }
    let group = perAnon.get(groupKey);
    if (!group) {
      group = {
        verbundId,
        aktenzeichen: [],
        akronym: readField(a, 'akronym'),
        titel: readField(a, 'verbund_titel') ?? readField(a, 'titel'),
        antragsdatum: typeof datum === 'string' ? datum : undefined,
        vbPhase: (a as Record<string, unknown>).vb_phase,
      };
      perAnon.set(groupKey, group);
    }
    group.aktenzeichen.push(a.aktenzeichen);
    // Spaetere TVs mit gepflegten Feldern bekommen die Chance, fehlende
    // Lead-Felder zu fuellen (z.B. wenn der erste TV ein Akronym leer hat).
    if (!group.akronym) group.akronym = readField(a, 'akronym');
    if (!group.titel) group.titel = readField(a, 'verbund_titel') ?? readField(a, 'titel');
  }

  // ─── Pass 2: pending (aus Store, deduped vs. fest) ───────────────────────
  for (const z of zuweisungen) {
    if (z.quartal !== quartal) continue;
    if (z.status !== 'selbst' && z.status !== 'freigegeben') continue;
    const antrag = antraegeByAktenzeichen.get(z.antragId);
    if (!antrag) continue;  // orphan Zuweisung (Antrag wurde geloescht/umbenannt)

    // Dedup: ist dieser Antrag schon im fest-Bucket dieses MAs?
    const festFuerMa = collectFest.get(z.anonId);
    if (festFuerMa) {
      // Schauen, ob der Antrag in irgendeiner fest-Gruppe dieses MAs ist.
      let alreadyFest = false;
      for (const g of festFuerMa.values()) {
        if (g.aktenzeichen.includes(z.antragId)) {
          alreadyFest = true;
          break;
        }
      }
      if (alreadyFest) continue;
    }

    const verbundId = readField(antrag, 'verbund_id') ?? null;
    const groupKey = verbundId ?? antrag.aktenzeichen;

    let perAnon = collectPending.get(z.anonId);
    if (!perAnon) {
      perAnon = new Map();
      collectPending.set(z.anonId, perAnon);
    }
    let group = perAnon.get(groupKey);
    if (!group) {
      const datum = (antrag as { antragsdatum?: unknown }).antragsdatum;
      group = {
        verbundId,
        aktenzeichen: [],
        akronym: readField(antrag, 'akronym'),
        titel: readField(antrag, 'verbund_titel') ?? readField(antrag, 'titel'),
        antragsdatum: typeof datum === 'string' ? datum : undefined,
        vbPhase: (antrag as Record<string, unknown>).vb_phase,
      };
      perAnon.set(groupKey, group);
    }
    if (!group.aktenzeichen.includes(z.antragId)) {
      group.aktenzeichen.push(z.antragId);
    }
  }

  // ─── Build Buckets aus den Hilfs-Maps ────────────────────────────────────
  const allAnonIds = new Set<string>();
  for (const k of collectFest.keys()) allAnonIds.add(k);
  for (const k of collectPending.keys()) allAnonIds.add(k);

  for (const anonId of allAnonIds) {
    const fest = collectFest.has(anonId)
      ? buildBucket(collectFest.get(anonId)!, stundenFor)
      : emptyBucket();
    const pending = collectPending.has(anonId)
      ? buildBucket(collectPending.get(anonId)!, stundenFor)
      : emptyBucket();
    result.set(anonId, { fest, pending });
  }

  return result;
}

function buildBucket(
  groupsByKey: Map<string, GroupState>,
  stundenFor: (bucket: AntragstypBucket | null) => number,
): MaQuartalsBucket {
  const verbuende: AuslastungVerbund[] = [];
  const aktenzeichenSet = new Set<string>();
  const antraegeProTyp: Partial<Record<AntragstypBucket, number>> = {};
  const tvsProTyp: Partial<Record<AntragstypBucket, number>> = {};
  let totalTvs = 0;
  let totalStunden = 0;
  for (const g of groupsByKey.values()) {
    const tvCount = g.aktenzeichen.length;
    if (tvCount === 0) continue;
    for (const az of g.aktenzeichen) aktenzeichenSet.add(az);
    totalTvs += tvCount;
    // 1 Verbund-Anteil = 1 "Antrag" je Typ (konsistent mit `antraege`); die
    // TVs des Verbund-Anteils fliessen zusätzlich in `tvsProTyp` (Kapazität).
    const bucket = getKategorieLabel(g.vbPhase);
    if (bucket) {
      antraegeProTyp[bucket] = (antraegeProTyp[bucket] ?? 0) + 1;
      tvsProTyp[bucket] = (tvsProTyp[bucket] ?? 0) + tvCount;
    }
    // v2.31: Stunden mit dem Antragstyp-spezifischen Faktor (bucket null →
    // Standard via `stundenFor`).
    const gStunden = tvCount * stundenFor(bucket);
    totalStunden += gStunden;
    verbuende.push({
      verbundId: g.verbundId,
      aktenzeichen: g.aktenzeichen.slice(),
      akronym: g.akronym,
      titel: g.titel,
      antragsdatum: g.antragsdatum,
      tvCount,
      stunden: gStunden,
    });
  }
  // Sortierung: antragsdatum desc (juengste oben). Eintraege ohne Datum nach
  // unten — sind selten, aber sollen nicht prominent sein.
  verbuende.sort((a, b) => {
    const da = a.antragsdatum ?? '';
    const db = b.antragsdatum ?? '';
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });
  return {
    antraege: verbuende.length,
    tvs: totalTvs,
    stunden: totalStunden,
    aktenzeichenSet,
    verbuende,
    antraegeProTyp,
    tvsProTyp,
  };
}

/** Leerer Bucket fuer Konsumenten, die `Map.get(anonId)` ohne Match haben.
 *  Wird intern als Fallback in `computeKapazitaet` genutzt. */
export const EMPTY_BUCKET: MaQuartalsBucket = Object.freeze({
  antraege: 0,
  tvs: 0,
  stunden: 0,
  aktenzeichenSet: new Set<string>(),
  verbuende: [],
  antraegeProTyp: Object.freeze({}),
  tvsProTyp: Object.freeze({}),
}) as MaQuartalsBucket;

export const EMPTY_AUSLASTUNG: MaQuartalsAuslastung = Object.freeze({
  fest: EMPTY_BUCKET,
  pending: EMPTY_BUCKET,
}) as MaQuartalsAuslastung;

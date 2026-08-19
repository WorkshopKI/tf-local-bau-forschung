/**
 * Persistenz des Meilenstein-Plans — Muster
 * [textbausteine/storage.ts](../services/skills/textbausteine/storage.ts).
 *
 * Ablage: eigene Sidecar `_intern/meilensteine.json` auf dem Daten-Share. Der Plan
 * ist **kuratierte Team-Daten**: die PL pflegt ihn einmal, alle lesen ihn — eine
 * Frist-Definition, die auf jedem Rechner anders lautet, wäre wertlos.
 *
 * Der Status-Katalog nebenan (`_intern/status-katalog.json`) ist seit v2.332
 * ebenfalls Team-Sidecar; der Unterschied liegt nicht im Speicherort, sondern im
 * **Freigabemodell**: der Katalog wirkt mit dem Speichern, dieser Plan erst mit
 * der Freigabe (`freigegebeneFassung`).
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite mit Backup-Rotation. Schreiben
 * self-gated über `queryPermission` — nur Rollen mit readwrite (PL/Kurator/dev)
 * schreiben tatsächlich, alle anderen laufen als No-op.
 *
 * IDB-Cache im generischen `kv`-Store, KEIN dedizierter Object-Store und kein
 * DB-Version-Bump (ein Bump triggert unter `file://` mit parallel offenen Varianten
 * ein `onblocked`-Upgrade).
 *
 * Tolerante Normalisierung: unbekannte Felder fallen weg, fehlende bekommen
 * Defaults, kaputte Knoten werden übersprungen. Ein von Hand editiertes JSON darf
 * das Monitoring nicht lahmlegen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import type { Bedingung } from '@/core/status';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import type {
  AntragstypBucket, MeilensteinKnoten, MeilensteinPlan, MeilensteinPlanSnapshot,
  MeilensteinPlanStatus,
} from './typen';
import { baueSeedPlan, SEED_GESAMTFRIST_TAGE, SEED_STAND } from './seed';

export const MEILENSTEIN_PLAN_PATH = '_intern/meilensteine.json';
export const MEILENSTEIN_PLAN_CACHE_KEY = 'meilenstein-plan:cache';

/* -------------------------------------------------------------------------- */
/* Tolerante Normalisierung                                                    */
/* -------------------------------------------------------------------------- */

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asBool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function asZahl(v: unknown, fallback: number, min = 0): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;
}

/** Fail-safe: alles Unbekannte gilt als `entwurf` — nie versehentlich freigegeben. */
function asPlanStatus(v: unknown): MeilensteinPlanStatus {
  return v === 'freigegeben' ? 'freigegeben' : 'entwurf';
}

function asTypen(v: unknown): AntragstypBucket[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is AntragstypBucket =>
    typeof x === 'string' && (ANTRAGSTYP_BUCKETS as readonly string[]).includes(x));
}

/**
 * Bedingungs-Baum tolerant lesen. Unbekannte Operatoren oder fehlende Feld-IDs
 * ergeben `null`; auf Gruppen-Ebene fallen solche Zweige weg. Ein komplett
 * unlesbarer Baum wird zum leeren ODER — also „nie erfüllt", nie „immer erfüllt".
 * Die sichere Richtung ist hier eindeutig: ein falsch-positiver Meilenstein
 * täuscht Fortschritt vor, ein falsch-negativer fällt sofort auf.
 *
 * **Alle neun Operatoren müssen hier stehen.** Bis v4.3 kannte die Funktion nur
 * sechs — `tageSeit`, `datumNachFeld` und `foerdervarianteIn` bot der
 * `BedingungEditor` an, aber sie überlebten den Neustart nicht: der Verlust trat
 * nicht beim Schreiben ein (das schreibt roh), sondern beim nächsten Lesen. Die
 * Regel war in der Sitzung sichtbar und am Folgetag weg. Der Round-Trip-Test
 * über `Bedingung['op']` hält die Liste vollständig — ein zehnter Operator
 * bricht den Typecheck, statt still zu verschwinden.
 */
export function normalisiereBedingung(raw: unknown): Bedingung | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as Record<string, unknown>;

  if (Array.isArray(b.alle)) {
    const kinder = b.alle.map(normalisiereBedingung).filter((x): x is Bedingung => x !== null);
    // Ein Verlust in einer UND-Gruppe LOCKERT die Bedingung: ein Zweig weniger
    // heißt „leichter erfüllt", und die leer gewordene Gruppe heißt sogar
    // `[].every(…) === true` — der Meilenstein gälte für JEDEN Verbund als
    // erreicht. Deshalb dieselbe sichere Richtung wie oben: nie erfüllt.
    // (`{alle: []}` als ECHTE Eingabe bleibt erlaubt und heißt weiter „immer
    // erfüllt"; der Editor sagt das an seiner leeren Gruppe auch so.)
    if (kinder.length < b.alle.length) return { einige: [] };
    return { alle: kinder };
  }
  if (Array.isArray(b.einige)) {
    // Umgekehrte Richtung: ein verlorener ODER-Zweig macht die Aussage STRENGER.
    // Durchfallen ist hier die sichere Wahl.
    const kinder = b.einige.map(normalisiereBedingung).filter((x): x is Bedingung => x !== null);
    return { einige: kinder };
  }

  const feldId = asString(b.feldId).trim();
  if (!feldId) return null;
  const op = b.op;
  if (op === 'ist' || op === 'istNicht') {
    const wert = asString(b.wert).trim();
    // Ohne Wert behauptet das Blatt nichts — und `istNicht` ohne Wert ist für
    // JEDEN Vorgang wahr, auch für den, dem das Feld ganz fehlt
    // (`!werte.some(v => v === '')` über einer leeren Liste). Der Meilenstein
    // stand damit portfolioweit auf „erreicht", während das Wertfeld im Editor
    // sichtbar leer war. Dieselbe Richtung wie bei `datumNachFeld` und
    // `foerdervarianteIn`: `null` statt eines Blattes, das etwas anderes tut,
    // als es zeigt. Wer „Feld ist leer" meint, hat dafür `leer`/`gefuellt`.
    return wert ? { feldId, op, wert } : null;
  }
  if (op === 'gefuellt' || op === 'leer') {
    return { feldId, op };
  }
  if (op === 'datumVor' || op === 'datumNach') {
    return { feldId, op, tageRelativHeute: asZahl(b.tageRelativHeute, 0, -100_000) };
  }
  if (op === 'tageSeit') {
    return { feldId, op, tage: asZahl(b.tage, 0) };
  }
  if (op === 'datumNachFeld') {
    const vergleichFeldId = asString(b.vergleichFeldId).trim();
    // Ohne zweites Feld ist der Vergleich nicht formulierbar — `null` statt
    // eines Blattes, das nie zutrifft und trotzdem im Editor steht.
    return vergleichFeldId ? { feldId, op, vergleichFeldId } : null;
  }
  if (op === 'foerdervarianteIn') {
    const varianten = (Array.isArray(b.varianten) ? b.varianten : [])
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
    return varianten.length > 0 ? { feldId, op, varianten } : null;
  }
  return null;
}

/** Ein Knoten; `null` bei fehlender `id` (ohne stabile ID ist er nicht referenzierbar). */
export function normalisiereKnoten(raw: unknown): MeilensteinKnoten | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const k = raw as Record<string, unknown>;
  const id = asString(k.id).trim();
  if (!id) return null;

  const elternId = asString(k.elternId).trim();
  const knoten: MeilensteinKnoten = {
    id,
    elternId: elternId || null,
    nummer: asString(k.nummer, id),
    label: asString(k.label, id),
    sollWoche: asZahl(k.sollWoche, 1, 0),
    relevantFuerFrist: asBool(k.relevantFuerFrist, true),
    nurTypen: asTypen(k.nurTypen),
    aktiv: asBool(k.aktiv, true),
    bedingung: normalisiereBedingung(k.bedingung) ?? { einige: [] },
    sortierung: asZahl(k.sortierung, 0, -100_000),
  };
  const beschreibung = asString(k.beschreibung).trim();
  if (beschreibung) knoten.beschreibung = beschreibung;
  const istDatumFeld = asString(k.istDatumFeld).trim();
  if (istDatumFeld) knoten.istDatumFeld = istDatumFeld;
  if (k.unbestaetigt === true) knoten.unbestaetigt = true;
  return knoten;
}

/**
 * Entfernt Eltern-Verweise, die ins Leere zeigen oder einen Zyklus bilden. Die
 * Engine ist zwar zyklen-sicher, aber ein Baum, der sich beim Rendern selbst
 * enthält, wäre in der Oberfläche nicht darstellbar — also hier einmal begradigen.
 */
function begradigeBaum(knoten: MeilensteinKnoten[]): MeilensteinKnoten[] {
  const ids = new Set(knoten.map(k => k.id));
  const byId = new Map(knoten.map(k => [k.id, k]));
  return knoten.map(k => {
    if (k.elternId === null) return k;
    if (!ids.has(k.elternId)) return { ...k, elternId: null };
    const gesehen = new Set<string>([k.id]);
    let cursor: string | null = k.elternId;
    while (cursor !== null) {
      if (gesehen.has(cursor)) return { ...k, elternId: null };
      gesehen.add(cursor);
      cursor = byId.get(cursor)?.elternId ?? null;
    }
    return k;
  });
}

function normalisiereSnapshot(raw: unknown): MeilensteinPlanSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.knoten)) return null;
  const snap: MeilensteinPlanSnapshot = {
    version: asZahl(s.version, 1, 1),
    stand: asString(s.stand, SEED_STAND),
    autor: typeof s.autor === 'string' ? s.autor : null,
    status: asPlanStatus(s.status),
    gesamtfristTage: asZahl(s.gesamtfristTage, SEED_GESAMTFRIST_TAGE, 1),
    knoten: begradigeBaum(
      s.knoten.map(normalisiereKnoten).filter((k): k is MeilensteinKnoten => k !== null),
    ),
  };
  const kommentar = asString(s.kommentar).trim();
  if (kommentar) snap.kommentar = kommentar;
  return snap;
}

/** Validiert + normalisiert einen rohen Datei-Inhalt; `null` bei Strukturfehler. */
export function normalisierePlan(raw: unknown): MeilensteinPlan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (!Array.isArray(p.knoten)) return null;

  const plan: MeilensteinPlan = {
    version: asZahl(p.version, 1, 1),
    stand: asString(p.stand, SEED_STAND),
    autor: typeof p.autor === 'string' ? p.autor : null,
    status: asPlanStatus(p.status),
    gesamtfristTage: asZahl(p.gesamtfristTage, SEED_GESAMTFRIST_TAGE, 1),
    knoten: begradigeBaum(
      p.knoten.map(normalisiereKnoten).filter((k): k is MeilensteinKnoten => k !== null),
    ),
    historie: Array.isArray(p.historie)
      ? p.historie.map(normalisiereSnapshot).filter((s): s is MeilensteinPlanSnapshot => s !== null)
      : [],
  };
  const kommentar = asString(p.kommentar).trim();
  if (kommentar) plan.kommentar = kommentar;
  return plan;
}

/* -------------------------------------------------------------------------- */
/* Share-IO + IDB-Cache                                                        */
/* -------------------------------------------------------------------------- */

/** Liest den Plan vom Daten-Share (`null` wenn fehlend/offline/kaputt). */
export async function readPlanVomShare(idb: IDBStore): Promise<MeilensteinPlan | null> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return null;
  const text = await readText(handle, MEILENSTEIN_PLAN_PATH);
  if (text == null) return null;
  try {
    return normalisierePlan(JSON.parse(text));
  } catch (err) {
    console.warn('[meilensteine] readPlanVomShare parse failed:', err);
    return null;
  }
}

/**
 * Schreibt den Plan atomar auf den Share. Self-gated: ohne readwrite-Berechtigung
 * ein No-op (`false`) statt eines NotAllowedError. Der Cache wird nur bei
 * erfolgreichem Share-Write nachgezogen — sonst liefe der lokale Stand der
 * Wahrheit auf dem Share davon.
 */
export async function schreibePlanAufShare(idb: IDBStore, plan: MeilensteinPlan): Promise<boolean> {
  const handle = await getDatenShareHandle(idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    await atomicWrite(handle, MEILENSTEIN_PLAN_PATH, JSON.stringify(plan, null, 2));
    await cachePlan(idb, plan);
    return true;
  } catch (err) {
    console.error('[meilensteine] schreibePlanAufShare failed:', err);
    return false;
  }
}

export async function cachePlan(idb: IDBStore, plan: MeilensteinPlan): Promise<void> {
  await idb.set(MEILENSTEIN_PLAN_CACHE_KEY, plan);
}

export async function readCachedPlan(idb: IDBStore): Promise<MeilensteinPlan | null> {
  const cached = await idb.get<MeilensteinPlan>(MEILENSTEIN_PLAN_CACHE_KEY);
  return cached ? normalisierePlan(cached) : null;
}

export interface GeladenerPlan {
  plan: MeilensteinPlan;
  /** Woher der Stand kommt. `seed` = noch nie jemand gepflegt. */
  quelle: 'share' | 'cache' | 'seed';
  /** Stand kommt aus dem IDB-Cache, der Share war nicht erreichbar. */
  stale: boolean;
}

/**
 * Lädt den Plan: Share → bei Treffer cachen; sonst IDB-Cache (stale); sonst der
 * Auslieferungs-Plan. Der Seed wird bewusst NICHT beim Laden geschrieben — der
 * erste Share-Write ist die erste bewusste Speicherung der PL (Muster
 * `useTextbausteinKatalog`).
 */
export async function ladePlan(idb: IDBStore): Promise<GeladenerPlan> {
  const share = await readPlanVomShare(idb);
  if (share) {
    await cachePlan(idb, share);
    return { plan: share, quelle: 'share', stale: false };
  }
  const cached = await readCachedPlan(idb);
  if (cached) return { plan: cached, quelle: 'cache', stale: true };
  return { plan: baueSeedPlan(), quelle: 'seed', stale: false };
}

/**
 * Der für die Auswertung maßgebliche Plan. Ein Entwurf wird NICHT ausgewertet —
 * sonst sähen alle anderen Zahlen, die auf einem halbfertigen Stand beruhen. In
 * dem Fall gilt die jüngste freigegebene Fassung aus der Historie; gibt es keine,
 * liefert die Funktion `null` und die Oberfläche zeigt „noch nicht freigegeben".
 */
export function freigegebeneFassung(plan: MeilensteinPlan): MeilensteinPlan | null {
  if (plan.status === 'freigegeben') return plan;
  const letzte = plan.historie.find(h => h.status === 'freigegeben');
  if (!letzte) return null;
  return { ...letzte, historie: [] };
}

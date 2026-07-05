/**
 * Lokales Arbeitskontext-Log (Journey — „Weitermachen"-Karte).
 *
 * DATENSCHUTZ (HART): Dieses Log ist REIN LOKAL auf diesem Gerät (IndexedDB).
 * Es wird NIE auf den Daten-Share oder in den persönlichen Ordner gespiegelt und
 * NIE exportiert. Präzedenz: embedding-caches-machine-local (machine-lokale
 * Caches). Deshalb nutzt dieser Service ausschließlich `idb.get/set/delete` —
 * KEIN `mirrorJsonToPersonal`, KEIN `atomicWrite`, KEIN Persönlich-Handle.
 * Maschinell erzwungen durch den Guard `arbeitskontext-log-idb-only`
 * (src/__tests__/codebase-conventions.test.ts).
 *
 * Es speichert AUSSCHLIESSLICH Metadaten: Artefakt-Typ, Verbund-Key (= Deep-Link-
 * Ziel), optional der zuletzt berührte Gutachten-Abschnitt und der Zeitstempel.
 * NIE Textinhalte, Prompts oder Entwürfe.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/** Artefakt-Familie eines Arbeitskontext-Eintrags. */
export type ArbeitskontextTyp = 'gutachten' | 'nachforderung' | 'kurzfassung';

export interface ArbeitskontextEintrag {
  typ: ArbeitskontextTyp;
  /** Verbund-Key (= KurzfassungContext.key: Verbund-ID oder Solo-Aktenzeichen).
   *  Zugleich Dedupe-Identität und Deep-Link-Ziel. */
  verbundKey: string;
  /** Nur bei `typ==='gutachten'`: zuletzt berührter Abschnitt (StepId A–G). */
  abschnittId?: string;
  /** ISO-Zeitstempel des Ereignisses. */
  ts: string;
}

/** IDB-Key (kv-Store). NICHT Teil eines Sync-/Mirror-Sets — rein lokal. */
export const ARBEITSKONTEXT_LOG_IDB_KEY = 'arbeitskontext-log';

/** Maximale Zahl behaltener Einträge (älteste fallen raus). */
export const ARBEITSKONTEXT_LOG_CAP = 200;

/**
 * Reine Kernlogik (IDB-frei, testbar): fügt `eintrag` ein und liefert die neue
 * Liste — dedupliziert pro `(typ, verbundKey)` (nur der jüngste bleibt), jüngste
 * zuerst, gekappt auf `cap`.
 */
export function mergeArbeitskontext(
  bestehend: ArbeitskontextEintrag[],
  eintrag: ArbeitskontextEintrag,
  cap = ARBEITSKONTEXT_LOG_CAP,
): ArbeitskontextEintrag[] {
  const gefiltert = bestehend.filter(
    e => !(e.typ === eintrag.typ && e.verbundKey === eintrag.verbundKey),
  );
  const zusammen = [eintrag, ...gefiltert];
  zusammen.sort((a, b) => b.ts.localeCompare(a.ts));
  return zusammen.slice(0, cap);
}

function isEintrag(v: unknown): v is ArbeitskontextEintrag {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return typeof e.typ === 'string'
    && typeof e.verbundKey === 'string'
    && typeof e.ts === 'string';
}

async function readLog(idb: IDBStore): Promise<ArbeitskontextEintrag[]> {
  const raw = await idb.get<unknown>(ARBEITSKONTEXT_LOG_IDB_KEY);
  return Array.isArray(raw) ? raw.filter(isEintrag) : [];
}

/**
 * Hängt einen Eintrag an (dedupe + cap). Fire-and-forget-tauglich: Aufrufer sollen
 * `.catch(() => {})` nutzen — ein Log-Fehler darf NIE die eigentliche
 * Arbeitsaktion (Generieren/Freigeben) brechen.
 */
export async function logArbeitskontext(
  idb: IDBStore, eintrag: ArbeitskontextEintrag,
): Promise<void> {
  const bestehend = await readLog(idb);
  await idb.set(ARBEITSKONTEXT_LOG_IDB_KEY, mergeArbeitskontext(bestehend, eintrag));
}

/** Jüngste Einträge zuerst, optional gekappt (`limit`). */
export async function listeArbeitskontext(
  idb: IDBStore, limit?: number,
): Promise<ArbeitskontextEintrag[]> {
  const list = await readLog(idb);
  list.sort((a, b) => b.ts.localeCompare(a.ts));
  return typeof limit === 'number' ? list.slice(0, limit) : list;
}

/** Löscht das gesamte Log (Einstellungen → Speicher → „Verlauf löschen"). */
export async function clearArbeitskontextLog(idb: IDBStore): Promise<void> {
  await idb.delete(ARBEITSKONTEXT_LOG_IDB_KEY);
}

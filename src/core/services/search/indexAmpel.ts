/**
 * Ein Satz ueber den Zustand des Suchindex — und nur einer.
 *
 * Bis v4.33 stand die Ampel-Logik in `IndexManager` und war damit nur zu sehen,
 * wer die Suchindex-Seite aufsuchte. Die Kuration-Uebersicht sagt jetzt
 * dasselbe; sie leitet es nicht neu her, sondern liest hier. Zwei Herleitungen
 * derselben Aussage sind zwei Wahrheiten, sobald eine von beiden gepflegt wird.
 *
 * Die REIHENFOLGE der Faelle ist Teil der Aussage: „kein Index" schlaegt
 * „Modell gewechselt" schlaegt „Worttrennung" schlaegt „nicht indexiert".
 * Wer sie umstellt, aendert, was der Nutzer zuerst erfaehrt.
 *
 * **Jedes Label nennt seinen Gegenstand: den DOKUMENTEN-Index** (v4.128). Seit
 * der Vektorindex der Aehnlichkeitssuche mit v4.127 auf dieselbe Seite gezogen
 * ist, stehen dort zwei Dinge, die „Index" heissen. „Kein Index vorhanden"
 * stand oben auf der Seite und las sich als Urteil ueber sie — direkt nachdem
 * jemand die Vektoren gebaut hatte. Beide Aussagen waren wahr und widersprachen
 * sich trotzdem, weil keine sagte, wovon sie spricht.
 */
import type { IDBStore } from '@/core/services/storage';
import { getActiveModelId } from './model-registry';
import { indexSpracheVeraltet } from './orama-store';

export type IndexAmpelTon = 'fehler' | 'warnung' | 'ok';

export interface IndexAmpelEingabe {
  /** Textabschnitte im geladenen Index. 0 = es gibt keinen. */
  chunkCount: number;
  /** Der Index wurde mit einem anderen Embedding-Modell gebaut als dem aktiven. */
  modellGewechselt: boolean;
  /** Der Index stammt aus einer Fassung mit anderer Worttrennung. */
  alteWorttrennung: boolean;
  /** Dokumente in der IDB, die in keinem Index-Manifest stehen. */
  neueDokumente: number;
}

export interface IndexAmpel {
  ton: IndexAmpelTon;
  label: string;
}

export function indexAmpel(e: IndexAmpelEingabe): IndexAmpel {
  if (e.chunkCount === 0)
    return { ton: 'fehler', label: 'Kein Dokumenten-Index — bitte indexieren' };
  if (e.modellGewechselt)
    return { ton: 'warnung', label: 'Modell gewechselt — Dokumente neu indexieren' };
  if (e.alteWorttrennung)
    return { ton: 'warnung', label: 'Worttrennung geändert — Dokumente neu indexieren' };
  if (e.neueDokumente > 0)
    return { ton: 'warnung', label: `${e.neueDokumente} Dokumente nicht indexiert` };
  return { ton: 'ok', label: 'Dokumenten-Index aktuell' };
}

export interface IndexKennzahlen extends IndexAmpelEingabe {
  /** Dokumente in der IDB (`doc:`-Schluessel). */
  docCount: number;
  /** ISO-Zeitpunkt des letzten Index-Laufs, oder null. */
  lastUpdate: string | null;
  /** Modell-Id, mit der der Index gebaut wurde (null = nie gebaut). */
  indexModelId: string | null;
  activeModelId: string;
}

/**
 * Liest die Kennzahlen, aus denen die Ampel entsteht. Gemeinsame Ladestelle der
 * Suchindex-Seite und der Kuration-Uebersicht.
 *
 * `alteWorttrennung` kommt aus dem GELADENEN Index, nicht aus einem Merkschluessel
 * daneben — der Wert steht also erst, wenn der Such-Provider durch ist.
 */
export async function ladeIndexKennzahlen(idb: IDBStore): Promise<IndexKennzahlen> {
  const [docKeys, chunkCount, indexModelId, lastUpdate, manifest, activeModelId] = await Promise.all([
    idb.keys('doc:'),
    idb.get<number>('index-chunk-count'),
    idb.get<string>('index-model-id'),
    idb.get<string>('index-last-update'),
    idb.get<Record<string, string>>('index-manifest'),
    getActiveModelId(idb),
  ]);
  const m = manifest ?? {};
  return {
    chunkCount: chunkCount ?? 0,
    docCount: docKeys.length,
    lastUpdate: lastUpdate ?? null,
    indexModelId: indexModelId ?? null,
    activeModelId,
    modellGewechselt: indexModelId != null && indexModelId !== activeModelId,
    alteWorttrennung: indexSpracheVeraltet(),
    neueDokumente: docKeys.filter(k => !m[k.replace('doc:', '')]).length,
  };
}

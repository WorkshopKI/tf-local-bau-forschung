/**
 * Verbund-Aggregation fuer den Klassifizierungs-Tab.
 *
 * Hintergrund: Die Klassifizierungs-Entscheidung wird fachlich pro Verbund
 * getroffen (alle Teilvorhaben (TVs) eines Verbundes gehen an denselben
 * Bearbeiter und gehoeren zur gleichen Themengruppe). Die UI bündelt
 * deshalb TVs unter ihrem Verbund-Header; das Datenmodell der Klassifizierung
 * bleibt pro `antragId` (= aktenzeichen) — beim Freigeben werden alle TVs
 * eines Verbundes mit identischen Kategorien upgesertet.
 *
 * Solo-TVs (kein `verbund_id`) werden als 1er-Verbund behandelt, damit die
 * Liste eine einheitliche Render-Logik hat.
 */
import type { Antrag } from '@/core/services/csv/types';
import {
  CANONICAL_AKRONYM,
  CANONICAL_VERBUND_ID,
  CANONICAL_VERBUND_TITEL,
  CANONICAL_TITEL,
  type Klassifizierung,
  type UeberKategorie,
} from '../types';
import { klassifiziereAntrag } from './klassifizierung-engine';

export interface VerbundKlassifizierungsView {
  /** Stabile ID — `verbund_id` bei Verbund-Antraegen, sonst `aktenzeichen` als
   *  Pseudo-ID (Solo-TV als 1er-Verbund). */
  verbundId: string;
  isSolo: boolean;
  akronym: string;
  verbundTitel: string;
  /** TVs in FKZ-Reihenfolge (alphanumerisch aufsteigend). */
  tvs: Antrag[];
  /** Klassifizierung des repraesentativen (ersten) TVs — alle TVs eines
   *  Verbundes teilen denselben Stand. */
  klassifizierung: Klassifizierung;
  confidence: 'high' | 'medium' | 'low';
}

function readString(antrag: Antrag, key: string): string {
  const v = (antrag as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
}

function confidenceFor(kl: Klassifizierung): 'high' | 'medium' | 'low' {
  if (kl.vorgeschlageneKategorien.length === 0) return 'low';
  const top = kl.vorgeschlageneKategorien.reduce((a, b) => a.confidence > b.confidence ? a : b);
  if (top.confidence >= 0.7) return 'high';
  if (top.confidence >= 0.4) return 'medium';
  return 'low';
}

/** Eindeutige Verbund-Key fuer Bucketing — `verbund_id` falls gesetzt,
 *  sonst Solo-ID = `aktenzeichen`. */
export function verbundKeyOf(antrag: Antrag): string {
  const vid = readString(antrag, CANONICAL_VERBUND_ID);
  return vid.length > 0 ? vid : antrag.aktenzeichen;
}

export function buildVerbundClassificationViews(
  antraege: Antrag[],
  kategorien: UeberKategorie[],
  persisted: Klassifizierung[],
  verbundEmbeddings?: Map<string, number[]>,
  stage2Aktiv?: boolean,
): VerbundKlassifizierungsView[] {
  // 1) Bucket nach Verbund-Key, Reihenfolge der ersten Sichtung beibehalten.
  const persistedById = new Map(persisted.map(k => [k.antragId, k]));
  const buckets = new Map<string, Antrag[]>();
  const order: string[] = [];
  for (const a of antraege) {
    const key = verbundKeyOf(a);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.push(a);
  }

  // 2) Pro Bucket einen VerbundView bauen.
  const out: VerbundKlassifizierungsView[] = [];
  for (const key of order) {
    const tvs = buckets.get(key)!;
    // FKZ-Sortierung innerhalb des Verbundes (lexikografisch).
    tvs.sort((a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen, 'de'));
    const rep = tvs[0]!;
    const verbundIdValue = readString(rep, CANONICAL_VERBUND_ID);
    const isSolo = verbundIdValue.length === 0;
    const akronym = readString(rep, CANONICAL_AKRONYM);
    const verbundTitel = readString(rep, CANONICAL_VERBUND_TITEL) || readString(rep, CANONICAL_TITEL);

    // Persistierte Klassifizierung — pruefe alle TVs (sollten gleich sein,
    // nimm den ersten Treffer).
    let kl: Klassifizierung | undefined;
    for (const tv of tvs) {
      const found = persistedById.get(tv.aktenzeichen);
      if (found) { kl = found; break; }
    }

    if (!kl) {
      // Live klassifizieren auf Basis des repraesentativen TVs. Stage 2 nutzt
      // das Verbund-Titel-Embedding (NICHT das pro-TV-Embedding), damit der
      // Verbund-Titel maximale Gewichtung bekommt.
      const queryEmbedding = verbundEmbeddings?.get(key);
      kl = klassifiziereAntrag({
        antrag: rep,
        kategorien,
        queryEmbedding,
        stage2Aktiv: stage2Aktiv === true,
      });
      // Re-Identify auf Verbund-Key — die persistierten Records bleiben pro
      // antragId, aber der live-Vorschlag braucht keine valide antragId.
      kl = { ...kl, antragId: rep.aktenzeichen };
    }

    out.push({
      verbundId: key,
      isSolo,
      akronym,
      verbundTitel,
      tvs,
      klassifizierung: kl,
      confidence: confidenceFor(kl),
    });
  }

  return out;
}

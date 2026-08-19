/**
 * Aus WELCHEM Vektorraum stammen die Vektoren, die hier liegen?
 *
 * Der Embedding-Korpus hatte darauf bis v4.113 keine Antwort — und das war die
 * teuerste Luecke der Bug-Jagd an der Aehnlichkeitsstufe. Sein IDB-Schluessel ist
 * das Aktenzeichen, sonst nichts; `incremental` filterte allein ueber die
 * EXISTENZ dieses Schluessels. Praefix, `dtype`, Pooling, Normalisierung und die
 * Textzusammensetzung gingen in keinen Schluessel, keinen Hash, keinen
 * Merkschluessel ein. Wer eines davon aenderte, liess alle 14 065 alten Vektoren
 * liegen, legte neue aus einem ANDEREN Raum daneben — und nichts wurde rot, weil
 * `checkCompat` nur `modellId` und `dim` verglich, die beide gleich blieben.
 *
 * Ein Kosinus-Vergleich zwischen zwei Vektorraeumen liefert Zahlen, die nach
 * Aehnlichkeit AUSSEHEN. Deshalb fuehrt der Korpus jetzt eine Signatur mit, und
 * ein Lauf, dessen Signatur abweicht, baut VOLL statt zu mischen.
 *
 * Eigenes Modul, weil es eine eigene Frage ist: `storage.ts` legt Vektoren ab,
 * `mirror.ts` tauscht sie mit dem Share, `wrapper.ts` erzeugt sie — hier steht,
 * WELCHE es sind. Rein bis auf zwei IDB-Zugriffe.
 */
import type { EmbeddingModelConfig } from '@/core/services/search/model-registry';

/**
 * Inhaltliche Build-Version des Embedding-TEXTS. Zu erhoehen, sobald
 * `buildEmbeddingTextForAntrag` andere Felder aufnimmt.
 *
 *  - v1 — Titel + VB-Titel + Abstract
 *  - v2 — zusaetzlich Deskriptoren (TECHN/BRANCHE/ANWEND + ZT-Klartexte)
 *  - v3 — die Quell-Spalten werden aus dem CSV-Schema AUFGELOEST statt geraten
 *    (v4.113). Bis dahin las der Text `projektbeschreibung_text`, am echten
 *    Bestand in 0 von 14 225 Saetzen gefuellt: der Vektor kannte den Inhalt eines
 *    Vorhabens nie, nur seinen Titel.
 */
export const CORPUS_BUILD_VERSION = 3;

/**
 * Was einen Vektorraum ausmacht. Alles hier drin aendert die Zahlen, die beim
 * Kosinus-Vergleich herauskommen — also darf nichts davon stillschweigend
 * wechseln.
 */
export interface KorpusSignatur {
  modellId: string;
  dim: number;
  /**
   * Der Praefix, mit dem die DOKUMENT-Vektoren erzeugt wurden. `null` = unbekannt
   * (alte Manifests fuehren das Feld nicht) — dann macht dieses Feld keine
   * Aussage, statt eine falsche zu machen.
   */
  documentPrefix: string | null;
  /** Siehe {@link CORPUS_BUILD_VERSION}. */
  buildVersion: number;
}

const IDB_SIGNATUR_KEY = 'auslastung-emb-signatur';

/** Die Signatur, die ein Lauf mit dieser Modell-Config ERZEUGT. */
export function aktuelleKorpusSignatur(config: EmbeddingModelConfig): KorpusSignatur {
  return {
    modellId: config.id,
    dim: config.dimensions,
    documentPrefix: config.documentPrefix,
    buildVersion: CORPUS_BUILD_VERSION,
  };
}

/**
 * Zwei Signaturen beschreiben denselben Raum.
 *
 * Toleranter Leser beim Praefix: ein `null` auf einer der beiden Seiten heisst
 * „nicht ueberliefert" und darf deshalb keinen Unterschied begruenden. Alles
 * andere muss uebereinstimmen.
 */
export function signaturenGleich(a: KorpusSignatur, b: KorpusSignatur): boolean {
  if (a.modellId !== b.modellId) return false;
  if (a.dim !== b.dim) return false;
  if (a.buildVersion !== b.buildVersion) return false;
  if (a.documentPrefix !== null && b.documentPrefix !== null
      && a.documentPrefix !== b.documentPrefix) return false;
  return true;
}

/** Kurzform fuer Log + UI. */
export function signaturText(s: KorpusSignatur): string {
  const prefix = s.documentPrefix === null ? 'Praefix unbekannt' : `„${s.documentPrefix}"`;
  return `${s.modellId}/${s.dim}d/Text v${s.buildVersion}/${prefix}`;
}

/**
 * Die Signatur, die ein Share-Manifest behauptet.
 *
 * Strukturell getippt statt gegen `EmbeddingCorpusManifest` — sonst importierten
 * sich `mirror.ts` und dieses Modul gegenseitig.
 */
export function signaturAusManifest(manifest: {
  modellId: string;
  dim: number;
  documentPrefix?: string;
  corpusBuildVersion?: number;
}): KorpusSignatur {
  return {
    modellId: manifest.modellId,
    dim: manifest.dim,
    documentPrefix: manifest.documentPrefix ?? null,
    // Manifests vor dem Deskriptoren-Update fuehren das Feld nicht.
    buildVersion: manifest.corpusBuildVersion ?? 1,
  };
}

/** Die Signatur des Korpus, der lokal liegt. `null` = nie gemerkt (vor v4.113)
 *  — der Aufrufer behandelt den vorhandenen Korpus dann als fremden Raum. */
export async function ladeKorpusSignatur(
  idb: { get: <T>(key: string) => Promise<T | null> },
): Promise<KorpusSignatur | null> {
  const roh = await idb.get<KorpusSignatur>(IDB_SIGNATUR_KEY);
  if (!roh || typeof roh.modellId !== 'string' || typeof roh.dim !== 'number') return null;
  return {
    modellId: roh.modellId,
    dim: roh.dim,
    documentPrefix: typeof roh.documentPrefix === 'string' ? roh.documentPrefix : null,
    buildVersion: typeof roh.buildVersion === 'number' ? roh.buildVersion : 1,
  };
}

export async function merkeKorpusSignatur(
  idb: { set: (key: string, value: unknown) => Promise<void> },
  signatur: KorpusSignatur,
): Promise<void> {
  await idb.set(IDB_SIGNATUR_KEY, signatur);
}

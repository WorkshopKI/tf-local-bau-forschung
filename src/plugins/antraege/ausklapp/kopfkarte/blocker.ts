/**
 * **Woran es hängt** — die eine Stufe, die den Vorgang aufhält, und die Stufen,
 * die deshalb mitwarten. Rein: kein React, keine IO, keine Uhr.
 *
 * **Warum genau eine.** Eine Liste aller gerissenen Meilensteine beantwortet die
 * Frage nicht, die jemand stellt, der eine überfällige Zeile aufklappt. Er will
 * wissen, wo er ansetzt — und das ist die früheste gerissene Stufe, an der
 * tatsächlich gearbeitet wird (ein Blatt), nicht der Sammel-Knoten darüber, der
 * nur die Summe seiner Kinder ist.
 *
 * **Die Abhängigkeit ist eine Annahme, keine Tatsache.** Der Meilenstein-Plan
 * kennt Hierarchie (`elternId`) und Soll-Wochen, aber KEINE Vorgänger-Relation.
 * „Blockiert" heißt hier deshalb genau zweierlei und nichts darüber hinaus:
 * die Sammel-Knoten über dem Blocker können nicht fertig werden, solange er
 * offen ist (das ist die Roll-up-Regel der Engine, keine Vermutung), und die
 * übrigen gerissenen Stufen stehen ebenfalls aus. Wer eine echte Reihenfolge
 * braucht, muss sie im Plan pflegen — geraten wird sie hier nicht.
 *
 * **`satz` ist immer gefüllt.** Auch wenn ein Blocker gefunden wurde, und für
 * jeden der sechs Gründe, warum keiner gefunden werden konnte. Eine Karte, die
 * an dieser Stelle schweigt, liest sich als „alles in Ordnung" (Pitfall #44).
 */
import { tageZwischen } from '@/core/status/waechter';
import { baueStufen, vergleicheNummer, type MeilensteinLage, type Stufe } from '../meilensteinLage';

/** Wie viele blockierte Stufen die Karte nennt, bevor sie zählt statt aufzählt. */
export const BLOCKIERT_MAX = 6;

export interface BlockerStufe {
  knotenId: string;
  nummer: string;
  label: string;
}

export interface BlockerBefund {
  /** Die früheste gerissene Blatt-Stufe; `null`, wenn es keine gibt. */
  blocker: (BlockerStufe & { sollDatum: string | null; offenTage: number | null }) | null;
  /** Erst die gerissenen Sammel-Knoten darüber (innen → außen), dann die übrigen gerissenen. */
  blockiert: BlockerStufe[];
  /** Über {@link BLOCKIERT_MAX} hinaus weggelassen — gezählt, nie verschwiegen. */
  weitere: number;
  /** Gerissene Blätter. */
  gerissen: number;
  /** Relevante Blätter — der Nenner zu {@link gerissen}. */
  relevant: number;
  /**
   * Knoten der obersten Ebene — die Zahl der Gliederungs-Überschrift.
   *
   * Zählt bewusst AUCH die nicht relevanten: die Gliederung zeigt sie (sonst
   * bekämen die Nummern Lücken), und eine Überschrift, die weniger nennt, als
   * darunter steht, ist ein Rechenfehler für den Leser.
   */
  stufenOben: number;
  /** Warum das Ergebnis so aussieht. Nie leer. */
  satz: string;
}

const LEER = { blocker: null, blockiert: [], weitere: 0, gerissen: 0, relevant: 0, stufenOben: 0 };

const GRUND: Record<Exclude<MeilensteinLage['art'], 'da'>, string> = {
  flagAus: 'Meilenstein-Monitoring ist in dieser Fassung nicht enthalten.',
  ohneVerbund: 'Kein Verbund — ohne ihn gibt es keinen Meilenstein-Plan.',
  laedt: 'Meilensteine werden geladen …',
  ohnePlan: 'Kein freigegebener Meilenstein-Plan.',
};

function alsBlockerStufe(s: Stufe): BlockerStufe {
  return { knotenId: s.knoten.id, nummer: s.knoten.nummer, label: s.knoten.label };
}

/** Nach Soll-Datum, Fehlendes ans Ende; bei Gleichstand nach der Nummer. */
function nachSollDannNummer(a: Stufe, b: Stufe): number {
  const x = a.ergebnis.sollDatum;
  const y = b.ergebnis.sollDatum;
  if (x !== y) {
    if (x === null) return 1;
    if (y === null) return -1;
    const d = x.localeCompare(y);
    if (d !== 0) return d;
  }
  return vergleicheNummer(a.knoten.nummer, b.knoten.nummer);
}

/** Die Kette der Sammel-Knoten über einer Stufe, innen → außen. Zyklen-sicher. */
function vorfahren(stufen: readonly Stufe[], id: string): Stufe[] {
  const nachId = new Map(stufen.map(s => [s.knoten.id, s]));
  const gesehen = new Set<string>([id]);
  const kette: Stufe[] = [];
  let cursor = nachId.get(id)?.knoten.elternId ?? null;
  while (cursor !== null && !gesehen.has(cursor)) {
    gesehen.add(cursor);
    const s = nachId.get(cursor);
    if (s) kette.push(s);
    cursor = s?.knoten.elternId ?? null;
  }
  return kette;
}

export function findeBlocker(lage: MeilensteinLage, stichtag: string): BlockerBefund {
  if (lage.art !== 'da') return { ...LEER, satz: GRUND[lage.art] };

  const stufen = baueStufen(lage);
  const relevanteBlaetter = stufen.filter(s => s.blatt && s.zustand !== 'nichtRelevant');
  const gerisseneBlaetter = relevanteBlaetter.filter(s => s.zustand === 'gerissen');
  const zaehler = {
    gerissen: gerisseneBlaetter.length,
    relevant: relevanteBlaetter.length,
    stufenOben: stufen.filter(s => s.knoten.elternId === null).length,
  };

  if (relevanteBlaetter.length === 0) {
    return { ...LEER, ...zaehler, blockiert: [], satz: 'Für diesen Antragstyp ist kein Meilenstein hinterlegt.' };
  }
  if (lage.bewertung.antragsdatum === null) {
    return {
      ...LEER, ...zaehler, blockiert: [],
      satz: 'Ohne Antragseingang gibt es keinen Soll-Termin — die Stufen sind nicht datierbar.',
    };
  }
  if (gerisseneBlaetter.length === 0) {
    return {
      ...LEER, ...zaehler, blockiert: [],
      satz: relevanteBlaetter.every(s => s.zustand === 'erreicht')
        ? 'Alle Stufen erreicht.'
        : 'Keine gerissene Stufe — der Verzug hängt an keinem einzelnen Meilenstein.',
    };
  }

  const blocker = [...gerisseneBlaetter].sort(nachSollDannNummer)[0]!;
  const kette = vorfahren(stufen, blocker.knoten.id).filter(s => s.zustand === 'gerissen');
  const inKette = new Set([blocker.knoten.id, ...kette.map(s => s.knoten.id)]);
  const uebrige = stufen
    .filter(s => s.zustand === 'gerissen' && !inKette.has(s.knoten.id))
    // Nachfahren des Blockers gehören ihm, nicht in die Liste der Mitwartenden.
    .filter(s => !vorfahren(stufen, s.knoten.id).some(v => v.knoten.id === blocker.knoten.id))
    .sort(nachSollDannNummer);

  const alle = [...kette, ...uebrige].map(alsBlockerStufe);
  return {
    ...zaehler,
    blocker: {
      ...alsBlockerStufe(blocker),
      sollDatum: blocker.ergebnis.sollDatum,
      offenTage: tageZwischen(blocker.ergebnis.sollDatum ?? '', stichtag),
    },
    blockiert: alle.slice(0, BLOCKIERT_MAX),
    weitere: Math.max(0, alle.length - BLOCKIERT_MAX),
    satz: `Früheste gerissene Stufe. ${zaehler.gerissen} von ${zaehler.relevant} Stufen sind gerissen.`,
  };
}

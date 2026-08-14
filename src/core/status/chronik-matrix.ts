/**
 * Die Chronik als **Matrix**: eine Zeile je Schritt, eine Spalte je Träger.
 *
 * Das löst den Grund, aus dem heute im Fachsystem der Verbund und dann jedes
 * Teilvorhaben einzeln geöffnet wird: der Vergleich „wer hat wann, und wer noch
 * nicht" entsteht dort im Kopf des Lesers. Hier **ist** er die Ansicht.
 *
 * Die Daten dafür liegen längst vor — jeder {@link ChronikEintrag} führt seine
 * Träger in `tvIds`. Die chronologische Ansicht faltet sie zu „3 Teilvorhaben"
 * zusammen, weil sie nach der Zeit fragt; diese hier fragt nach dem Schritt und
 * braucht sie einzeln.
 *
 * **Eine Zeile je Katalog-Feld — nichts wird zusammengezogen.**
 * Die Verbund-Codes (`X`-Präfix) und ihre Teilvorhaben-Geschwister sind
 * verschiedene Felder mit verschiedenen Bezeichnungen: `AAE` ist der Eingang
 * *eines* Antrags, `XTE` „alle Anträge eingegangen". Der Katalog verbietet
 * ausdrücklich, dass zwei Einträge auf derselben Spalte stehen
 * (`KANONISCHE_CODE_FELDER`), und eine Paarung Verbund↔TV gibt es nirgends als
 * Daten — `KUERZEL_PAARE` paart AB gegen FB, nicht Ebene gegen Ebene. Eine Zeile
 * mit gefüllter Verbund- *und* TV-Hälfte wäre also erfunden. Stattdessen füllt
 * ein Verbund-Feld nur die Verbund-Spalte, ein TV-Feld nur die TV-Spalten — und
 * die zwei Zeilen nebeneinander sagen mehr als eine: wann die einzelnen Anträge
 * kamen **und** wann der Verbund vollzählig war.
 *
 * Geroutet wird dabei nach den **Daten** (`tvIds`), nicht nach `feld.ebene`: die
 * Ebene sagt, worüber ein Eintrag spricht, `tvIds`, wer ihn trägt. Fällt beides
 * einmal auseinander, gewinnt der Beleg.
 *
 * **Fehlende Kürzel sind Zellen, keine Fußnote.** Ein halb offenes Paar gehört
 * genau einem Teilvorhaben ({@link OffenesPaarJeTv}) — also genau einer Zelle.
 * Damit steht die Lücke dort, wo man sie sucht: in der Spalte des Teilvorhabens,
 * neben den Geschwistern, die gesetzt haben.
 *
 * Rein: keine Uhr (die Standzeiten stecken in den Paaren), kein IDB, kein React.
 */
import { normKey } from './normalisierung';
import { tageZwischen } from './waechter';
import type { ChronikEintrag } from './chronik';
import type { OffenesPaarJeTv } from './waechter';
import type { MappingVersion, StatusFeldEintrag, ZahPhaseId } from './typen';
import { BEREICH_VERBUND, bereicheVon } from './verlauf-filter';

/** Eine Spalte der Matrix: der Verbund oder ein Teilvorhaben. */
export interface MatrixSpalte {
  /** `verbund` oder das Aktenzeichen. */
  id: string;
  /** Kopfzeile: „Verbund" / „TV 1". */
  kurz: string;
  /** Zweite Kopfzeile: „4 Teilvorhaben" / das Aktenzeichen. */
  lang: string;
}

/** Was in einer Zelle steht. Fehlt der Eintrag ganz, ist die Zelle leer. */
export type MatrixZelle =
  | { art: 'datum'; tag: string }
  | { art: 'fehlt'; seit: string; tage: number };

/** Eine Zeile der Matrix — ein Schritt über alle Träger. */
export interface SchrittZeile {
  feld: StatusFeldEintrag;
  /** Die ZAH-Phase des Feldes; `undefined` = keine gepflegt. */
  phase?: ZahPhaseId;
  /** Zellen je Spalten-Id; fehlende Schlüssel sind leere Zellen. */
  zellen: ReadonlyMap<string, MatrixZelle>;
  /** Frühestes Datum über die **TV**-Spalten; `null` = keines. */
  fruehestesTv: string | null;
  /** Spätestes Datum über die TV-Spalten; `null` = keines. */
  spaetestesTv: string | null;
  /**
   * Streuung zwischen den Teilvorhaben in Tagen; `null` = weniger als zwei
   * TV-Daten, also nichts zu vergleichen. `0` heißt „gleichzeitig".
   */
  streuungTage: number | null;
  /** Wie viele Träger dieses Kürzel schulden. */
  fehlt: number;
  /** Frühester Beleg der Zeile (Datum, sonst Standzeit-Beginn) — Sortierschlüssel. */
  ankerTag: string;
}

/** Meilenstein zuerst — dieselbe Rangfolge wie in der chronologischen Ansicht. */
const PROMINENZ_RANG: Record<string, number> = { meilenstein: 0, normal: 1, nebensaechlich: 2 };

/** Baut die Spaltenachse: Verbund zuerst, dann die Teilvorhaben in Reihenfolge. */
export function baueSpalten(tvIds: readonly string[]): MatrixSpalte[] {
  return [
    {
      id: BEREICH_VERBUND,
      kurz: 'Verbund',
      lang: tvIds.length === 1 ? '1 Teilvorhaben' : `${tvIds.length} Teilvorhaben`,
    },
    ...tvIds.map((id, i) => ({ id, kurz: `TV ${i + 1}`, lang: id })),
  ];
}

/** Interner Zeilen-Rohbau, bevor die abgeleiteten Zahlen entstehen. */
interface Rohzeile {
  feld: StatusFeldEintrag;
  zellen: Map<string, MatrixZelle>;
}

/**
 * Baut die Matrix aus der bereits gefilterten Chronik und den offenen Paaren.
 *
 * Die Zeilenmenge ist die **Vereinigung**: Felder mit mindestens einem Datum
 * plus Felder, die irgendwo geschuldet werden. Ein Kürzel, das nirgends gesetzt
 * und nirgends fällig ist, erscheint nicht — der Katalog führt 505 davon, und
 * eine Matrix mit 505 leeren Zeilen beantwortet nichts.
 */
export function baueSchrittMatrix(
  chronik: readonly ChronikEintrag[],
  offenePaare: readonly OffenesPaarJeTv[],
  spalten: readonly MatrixSpalte[],
  version: MappingVersion,
): SchrittZeile[] {
  const bekannteSpalten = new Set(spalten.map(s => s.id));
  const roh = new Map<string, Rohzeile>();

  const zeile = (feld: StatusFeldEintrag): Rohzeile => {
    const da = roh.get(feld.feldId);
    if (da) return da;
    const neu: Rohzeile = { feld, zellen: new Map() };
    roh.set(feld.feldId, neu);
    return neu;
  };

  for (const e of chronik) {
    const z = zeile(e.feld);
    for (const bereich of bereicheVon(e.tvIds)) {
      if (!bekannteSpalten.has(bereich)) continue;
      const vorhanden = z.zellen.get(bereich);
      // Kollision kann nur entstehen, wenn dieselbe Spalte zweimal beliefert
      // wird; dann gilt der frühere Termin — nie der zuletzt gelesene.
      if (vorhanden?.art === 'datum' && vorhanden.tag <= e.tag) continue;
      z.zellen.set(bereich, { art: 'datum', tag: e.tag });
    }
  }

  // Die Paare tragen den fehlenden CODE, nicht die Feld-Id — aufgelöst über den
  // Katalog, denselben Weg wie `findeOffenePaare` ihn hinein gefunden hat.
  const felderNachCode = new Map<string, StatusFeldEintrag>();
  for (const f of version.felder) {
    if (f.code) felderNachCode.set(normKey(f.code), f);
  }
  for (const p of offenePaare) {
    const feld = felderNachCode.get(normKey(p.fehlt));
    if (!feld || !bekannteSpalten.has(p.tvId)) continue;
    const z = zeile(feld);
    // Ein gesetzter Termin schlägt die Lücke: die Zelle ist dann kein Schuldner.
    if (z.zellen.has(p.tvId)) continue;
    z.zellen.set(p.tvId, { art: 'fehlt', seit: p.seit, tage: p.tage });
  }

  const tvSpalten = spalten.filter(s => s.id !== BEREICH_VERBUND).map(s => s.id);
  const zeilen = [...roh.values()].map(r => leiteAb(r, tvSpalten));

  return zeilen.sort((a, b) =>
    a.ankerTag.localeCompare(b.ankerTag)
    || (PROMINENZ_RANG[a.feld.prominenzDefault] ?? 1) - (PROMINENZ_RANG[b.feld.prominenzDefault] ?? 1)
    || a.feld.label.localeCompare(b.feld.label, 'de'));
}

/** Die abgeleiteten Zahlen einer Zeile: Streuung, Schuldner, Anker. */
function leiteAb(r: Rohzeile, tvSpalten: readonly string[]): SchrittZeile {
  const tvTage: string[] = [];
  let fehlt = 0;
  let ankerTag: string | null = null;
  let fruehesteLuecke: string | null = null;

  for (const [id, zelle] of r.zellen) {
    if (zelle.art === 'fehlt') {
      fehlt += 1;
      if (fruehesteLuecke === null || zelle.seit < fruehesteLuecke) fruehesteLuecke = zelle.seit;
      continue;
    }
    if (tvSpalten.includes(id)) tvTage.push(zelle.tag);
    if (ankerTag === null || zelle.tag < ankerTag) ankerTag = zelle.tag;
  }

  tvTage.sort();
  const fruehestesTv = tvTage[0] ?? null;
  const spaetestesTv = tvTage[tvTage.length - 1] ?? null;
  const streuungTage = tvTage.length < 2 || fruehestesTv === null || spaetestesTv === null
    ? null
    : tageZwischen(fruehestesTv, spaetestesTv);

  return {
    feld: r.feld,
    ...(r.feld.zahPhaseId ? { phase: r.feld.zahPhaseId } : {}),
    zellen: r.zellen,
    fruehestesTv,
    spaetestesTv,
    streuungTage,
    fehlt,
    // Eine Zeile ohne jeden Termin hängt an der Standzeit ihrer ältesten Lücke;
    // ganz ohne Anker gäbe es sie nicht (sie entsteht nur aus einem von beiden).
    ankerTag: ankerTag ?? fruehesteLuecke ?? '',
  };
}

/**
 * Welche Phase in der linken Rinne steht — je Zeile die Phase oder `null`.
 *
 * Beschriftet wird nur der **Beginn eines Laufs**: die Gliederung ist eine
 * Randnotiz neben der ersten Zeile ihrer Gruppe, keine eigene Zeile (das war
 * bei 17 Schritten fast ein Drittel der Höhe). Wechselt die Phase zurück, steht
 * sie erneut da — die Matrix sortiert nach Zeit, und die Zeit hält sich nicht
 * an die Reihenfolge des Verfahrens. Sie danach zu gruppieren wäre eine
 * Ordnung, die die Daten nicht hergeben.
 */
export function phasenRinne(zeilen: readonly SchrittZeile[]): (ZahPhaseId | null)[] {
  let letzte: ZahPhaseId | undefined;
  return zeilen.map(z => {
    if (z.phase === undefined) { letzte = undefined; return null; }
    if (z.phase === letzte) return null;
    letzte = z.phase;
    return z.phase;
  });
}

/**
 * Der Abgleich einer Meldungszeile gegen den Antragsbestand — zwei Stufen, ein
 * Urteil.
 *
 * **Stufe A, Wortlaut: ein Lauf JE SCHLAGWORT, nicht ein ODER-Lauf über alle
 * drei.** Die Vereinigung der drei Ergebnismengen ist dasselbe wie ein
 * ODER-Lauf — aber nur die getrennten Läufe sagen, WELCHE Schlagworte einen
 * Treffer getragen haben. Genau das ist die Zahl, an der das Urteil hängt. In
 * der App gegen den echten Bestand gemessen (Betrachtungsbereich 4.327
 * Vorhaben, 23.08.2026) findet das weite Trio „Digitalisierung / Künstliche
 * Intelligenz / Mittelstand":
 *
 *   ODER (≥1 von 3)  1.150 Vorhaben — ein Viertel des Bereichs
 *   ≥2 von 3           103
 *   alle 3               1
 *
 * Ohne die Abdeckung wäre „Übereinstimmung" bei fast jeder Zeile wahr und damit
 * wertlos. Der Preis ist klein: drei Läufe über 4.327 Einträge kosten zusammen
 * 45–65 ms.
 *
 * **Stufe B, Ähnlichkeit**, beantwortet die Frage, die die Schlagworte nicht
 * können: dasselbe Vorhaben mit anderen Worten. Sie ist optional — ohne
 * geladenes Embedding-Modell entfällt sie mit sichtbarem Hinweis, nicht die
 * Prüfung.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import {
  searchAntraegeSubstring, searchAntraegeVector,
} from '@/plugins/antraege/services/antraege-search-service';
import type { TrefferBefund, TrefferQuelle, UrteilGrund } from '../types';

/**
 * Ab wie vielen Schlagworten ein Treffer als Übereinstimmung gilt — Vorbelegung.
 *
 * Zwei von drei, gemessen begründet (siehe Kopfkommentar): beim weiten
 * Beispiel-Trio fällt die Trefferzahl von 1.150 auf 103, bei drei von drei auf
 * 1. Der Wert ist in der Oberfläche umstellbar; die Anforderung nennt das reine
 * ODER, und das bleibt über den Regler erreichbar.
 *
 * Die Schwelle ersetzt **nicht** den Prompt: ein spezifisches Trio derselben
 * Zeile („Mobile Fabrik / Demonstrationsinfrastruktur / Erfolgskontrolle")
 * kommt schon ODER-verknüpft auf 2 Treffer. Die Schwelle rettet ein schlechtes
 * Schlagwort, sie macht kein gutes überflüssig.
 */
export const SCHWELLE_VORGABE = 2;

/**
 * Ab welcher Kosinus-Ähnlichkeit ein Vorhaben OHNE Schlagworttreffer allein
 * durch inhaltliche Nähe eine Übereinstimmung auslöst.
 *
 * `searchAntraegeVector` liefert bereits nur, was über seiner eigenen Schwelle
 * liegt (Top 50 mit relativem Cutoff) — diese Zahl hier ist die zweite, engere
 * Hürde für den Fall, dass KEIN Schlagwort traf. Sie ist bewusst hoch: ein
 * Ähnlichkeitswert um 0,6 findet bei ZIM-Anträgen schon „auch Maschinenbau".
 *
 * TODO(Abnahme): an den neun Zeilen der Beispieldatei messen und die gemessene
 * Trefferzahl als Kommentar hinter die Zahl schreiben, bevor sie als gesetzt
 * gilt. Bis dahin ist sie eine begründete Vorbelegung, kein Messwert.
 */
export const AEHNLICHKEIT_SCHWELLE = 0.75;

/** So viele Befunde zeigt die Zeile eingeklappt. */
export const BEFUNDE_SICHTBAR = 10;

/** Was ein Abgleich braucht, um überhaupt laufen zu können. */
export interface AbgleichKontext {
  /** Der auf den Betrachtungsbereich geschnittene Suchkorpus. */
  korpus: Map<string, AntragTextEntry>;
  /** Stammdaten je Aktenzeichen — Status, Datum, Antragsteller für die Anzeige. */
  listeNachAkz: ReadonlyMap<string, AntragListItem>;
  /** Alle Embeddings; leer = Stufe B entfällt. */
  embeddings: Map<string, number[]>;
}

/**
 * Stufe A: je Schlagwort einmal suchen und zählen, wie viele Schlagworte ein
 * Aktenzeichen tragen. Rein bis auf den Suchaufruf, synchron.
 */
export function wortlautAbdeckung(
  schlagworte: readonly string[],
  korpus: Map<string, AntragTextEntry>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const wort of schlagworte) {
    if (wort.trim().length === 0) continue;
    // `stammSuche` an, damit „Beschichtung" auch „Beschichtungen" findet — dieselbe
    // Einstellung, mit der die Suchseite standardmäßig läuft.
    //
    // **`und`, nicht `oder`** — und das ist keine Feinheit. Die Suchstufe zerlegt
    // eine mehrwortige Anfrage in ihre Wörter; mit `oder` zerfiele das Schlagwort
    // „Mobile Fabrik" in „mobile ODER fabrik" und träfe am echten Bestand 535
    // Vorhaben statt 2. Die ODER-Verknüpfung der Anforderung gilt ZWISCHEN den
    // drei Schlagworten (das leistet die Vereinigung der drei Läufe hier),
    // nicht INNERHALB eines Schlagworts. Am Betrachtungsbereich gemessen
    // (4.327 Vorhaben, 23.08.2026):
    //   „Mobile Fabrik"           oder 535 · und   2 · wortfolge 0
    //   „Digitale Transformation" oder 1688 · und 38 · wortfolge 3
    //   „Digitalisierung"         oder 177 · und 177 (einwortig — kein Unterschied)
    // `wortfolge` wäre die dritte Möglichkeit und ist zu streng: sie verlangt die
    // Wörter nebeneinander und verlöre „Transformation der digitalen Prozesse".
    for (const akz of searchAntraegeSubstring(wort, korpus, { verknuepfung: 'und', stammSuche: true })) {
      const bisher = out.get(akz);
      if (bisher) bisher.push(wort);
      else out.set(akz, [wort]);
    }
  }
  return out;
}

/** Aus welcher Stufe (oder aus beiden) ein Befund stammt. */
function quelleAus(hatWortlaut: boolean, hatVektor: boolean): TrefferQuelle {
  if (hatWortlaut && hatVektor) return 'beide';
  return hatWortlaut ? 'wortlaut' : 'aehnlichkeit';
}

/** Einen Befund aus Korpus- und Stammdaten zusammensetzen. */
function baueBefund(
  aktenzeichen: string,
  getroffeneWorte: readonly string[],
  aehnlichkeit: number | null,
  ctx: AbgleichKontext,
): TrefferBefund | null {
  const eintrag = ctx.korpus.get(aktenzeichen);
  // Kein Korpus-Eintrag heisst: ausserhalb des Betrachtungsbereichs. Die
  // Ähnlichkeitsstufe läuft über ALLE Embeddings, weil sie den Korpus nicht
  // kennt — hier fällt heraus, was der Bereich nicht mehr trägt.
  if (!eintrag) return null;
  const item = ctx.listeNachAkz.get(aktenzeichen);
  return {
    aktenzeichen,
    verbundId: item?.verbund_id ?? '',
    verbundTitel: eintrag.vb,
    titel: eintrag.tv,
    kurzbeschreibung: eintrag.abstract,
    getroffeneWorte: [...getroffeneWorte],
    abdeckung: getroffeneWorte.length,
    aehnlichkeit,
    quelle: quelleAus(getroffeneWorte.length > 0, aehnlichkeit !== null),
    status: item?.status ?? '',
    antragsdatum: item?.antragsdatum ?? '',
    antragsteller: item?.antragsteller ?? '',
  };
}

/**
 * Die Befunde beider Stufen zu einer Liste vereinen.
 *
 * Sortierung: Abdeckung absteigend, bei Gleichstand Ähnlichkeit absteigend,
 * zuletzt das Aktenzeichen — damit dieselbe Eingabe immer dieselbe Reihenfolge
 * liefert und ein Export zweier Läufe vergleichbar bleibt.
 */
export function vereineBefunde(
  wortlaut: ReadonlyMap<string, string[]>,
  vektor: ReadonlyMap<string, number>,
  ctx: AbgleichKontext,
): TrefferBefund[] {
  const akzListe = new Set<string>([...wortlaut.keys(), ...vektor.keys()]);
  const out: TrefferBefund[] = [];
  for (const akz of akzListe) {
    const befund = baueBefund(akz, wortlaut.get(akz) ?? [], vektor.get(akz) ?? null, ctx);
    if (befund) out.push(befund);
  }
  out.sort((a, b) => (
    b.abdeckung - a.abdeckung
    || (b.aehnlichkeit ?? 0) - (a.aehnlichkeit ?? 0)
    || a.aktenzeichen.localeCompare(b.aktenzeichen)
  ));
  return out;
}

export interface Urteil {
  uebereinstimmung: boolean;
  grund: UrteilGrund;
}

/**
 * Das Urteil einer Zeile.
 *
 * Die Schlagwort-Achse hat Vorrang vor der Ähnlichkeit: sie ist die belegbare
 * von beiden — der Nutzer kann nachlesen, welches Wort wo stand. Löst nur die
 * Ähnlichkeit aus, sagt das Badge auch das, statt beide Wege gleich zu benennen.
 */
export function faelleUrteil(
  befunde: readonly TrefferBefund[],
  schwelle: number,
  aehnlichkeitSchwelle = AEHNLICHKEIT_SCHWELLE,
): Urteil {
  if (befunde.some(b => b.abdeckung >= schwelle)) {
    return { uebereinstimmung: true, grund: 'schlagworte' };
  }
  if (befunde.some(b => (b.aehnlichkeit ?? 0) >= aehnlichkeitSchwelle)) {
    return { uebereinstimmung: true, grund: 'aehnlichkeit' };
  }
  return { uebereinstimmung: false, grund: 'keine' };
}

/**
 * Stufe B: die Zeile einbetten und die ähnlichsten Vorhaben holen.
 *
 * `embedden` kommt von aussen herein, damit dieses Modul weder das
 * Embedding-Modell noch die IndexedDB kennt — und damit der Test es ohne beides
 * fahren kann. `null` heisst „Stufe entfällt", nicht „keine Treffer".
 */
export async function aehnlichkeitsStufe(
  text: string,
  ctx: AbgleichKontext,
  embedden: (text: string) => Promise<number[] | null>,
  bekannt: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<Map<string, number> | null> {
  if (ctx.embeddings.size === 0) return null;
  const vec = await embedden(text);
  if (!vec) return null;
  const erg = await searchAntraegeVector(vec, ctx.embeddings, signal, bekannt);
  return new Map(erg.treffer.map(t => [t.akz, t.score]));
}

/** Der Text, den die Ähnlichkeitsstufe einbettet. */
export function aehnlichkeitsText(thema: string, aufgabenbeschreibung: string): string {
  return [thema.trim(), aufgabenbeschreibung.trim()].filter(s => s.length > 0).join('\n\n');
}

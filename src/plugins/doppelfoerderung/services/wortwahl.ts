/**
 * Welcher Vorschlag einer Achse das Urteil trägt — entschieden am Bestand,
 * nicht am Modell.
 *
 * **Warum diese Stufe überhaupt existiert.** An 87 Läufen gegen die interne KI
 * gemessen (24.08.2026, `gpt-oss-120b`, dreimal dieselbe 72er-Liste) hält das
 * Modell alles ein, was es am eigenen Text prüfen kann — Form (87/87 mit genau
 * drei parsebaren Schlagworten) und die drei Achsen (nur 6 von 87 Zeilen
 * doppelten eine). Was ausserhalb seines Textes liegt, rät es:
 *
 *   119 von 261 Schlagworten (45,6 %) trafen im Bestand NICHTS
 *   35 (13,4 %) lagen über einem Prozent des Bereichs — „Metall" 526, „Pflanzen" 374
 *   Median 1 Treffer — die Verteilung ist zweigipflig, nicht breit
 *
 * Das ist kein Prompt-Mangel, sondern eine Wissensgrenze: das Modell sieht den
 * Bestand nicht. Die App sieht ihn — sie sucht ohnehin je Schlagwort einmal
 * (`wortlautAbdeckung`). Also liefert das Modell je Achse eine Staffel
 * eng → weit, und **diese Stufe schlägt nach, bevor das Urteil fällt**.
 *
 * **Die Regel ist rangbasiert, nicht trefferoptimierend.** Das Wort mit den
 * meisten Treffern zu nehmen wäre genau der Fehler, den die Abdeckung schon hat
 * (sie zählt Schlagworte, statt sie zu wiegen). Gewählt wird der Vorschlag mit
 * dem besten RANG, bei Gleichstand der frühere — also der engere, den das Modell
 * selbst vorn sah.
 *
 * **Sie kann eine Zeile nicht verschlechtern.** Findet sich nichts Besseres,
 * bleibt der erste Vorschlag des Modells stehen — das ist genau das Wort, das
 * vor dieser Stufe verwendet worden wäre.
 */
import type { AchsenWahl, SchlagwortTreffer } from '../types';
import { istZuWeit, zaehltNicht, type WortlautErgebnis } from './abgleich';

/**
 * Wie gut ein Vorschlag als Beleg taugt — kleiner ist besser.
 *
 * Die vier Ränge sind die vier Zustände, in denen ein Schlagwort sein kann;
 * dass `tot` VOR `flutet` steht, ist die einzige Stelle mit Ermessen: für die
 * Abdeckung sind beide wertlos (ein Wort über der Zwei-Prozent-Schwelle zählt
 * nicht mit), aber das flutende schleppt zusätzlich hunderte Befunde in die
 * Trefferliste — und lässt eine Zeile als „keine Übereinstimmung" erscheinen,
 * die in Wahrheit „nicht beurteilbar" ist.
 */
export const RANG = {
  /** Trifft etwas und bleibt unter einem Prozent des Bereichs — der Normalfall. */
  traegt: 1,
  /** Zählt noch zur Abdeckung, ist aber als „zu weit" markiert (1–2 %). */
  markiert: 2,
  /** Trifft nichts: kein Beleg, aber auch kein Lärm. */
  tot: 3,
  /** Über zwei Prozent: zählt nicht mehr mit und flutet die Trefferliste. */
  flutet: 4,
} as const;

export function rangVon(treffer: number, bereichsGroesse: number | null): number {
  if (treffer === 0) return RANG.tot;
  if (zaehltNicht(treffer, bereichsGroesse)) return RANG.flutet;
  return istZuWeit(treffer, bereichsGroesse) ? RANG.markiert : RANG.traegt;
}

/** Das Ergebnis der Wahl: je Achse ein Wort, und was daneben lag. */
export interface WortWahl {
  /** Die Schlagworte, die das Urteil tragen — eines je Achse, in Achsenreihenfolge. */
  gewaehlt: string[];
  /** Je gewähltem Wort seine Achse: die Alternativen und ob nachgeschlagen wurde. */
  achsen: AchsenWahl[];
}

function trefferVon(wort: string, treffer: ReadonlyMap<string, number>): number {
  return treffer.get(wort.toLowerCase()) ?? 0;
}

/**
 * Je Achse den tragfähigsten Vorschlag wählen.
 *
 * `treffer` kommt aus einem `wortlautAbdeckung`-Lauf über **alle**
 * Vorschläge — die Suche ist damit schon bezahlt, diese Funktion rechnet nicht
 * nach, sie liest ab.
 *
 * Ein Wort, das eine frühere Achse schon gewählt hat, scheidet aus: zwei gleiche
 * Schlagworte wären ein Beleg, würden aber als zwei gezählt. Bleibt einer Achse
 * danach nichts, fällt sie weg — die Zeile läuft dann mit zwei Schlagworten,
 * genau wie bisher, wenn das Modell nur zwei lieferte.
 */
export function waehleSchlagworte(
  achsen: readonly (readonly string[])[],
  treffer: readonly SchlagwortTreffer[],
  bereichsGroesse: number | null,
): WortWahl {
  const nachWort = new Map(treffer.map(t => [t.wort.toLowerCase(), t.treffer]));
  const vergeben = new Set<string>();
  const gewaehlt: string[] = [];
  const ausgabe: AchsenWahl[] = [];

  for (const achse of achsen) {
    const frei = achse.filter(w => !vergeben.has(w.toLowerCase()));
    if (frei.length === 0) continue;

    // Der erste Vorschlag des Modells — das Wort, das ohne diese Stufe gälte.
    // VOR der Wahl festgehalten, damit die Marke nicht davon abhängt, was gerade
    // in `vergeben` steht.
    const ersterNochFrei = achse[0] !== undefined && !vergeben.has(achse[0].toLowerCase());

    let sieger = frei[0] as string;
    let bester = rangVon(trefferVon(sieger, nachWort), bereichsGroesse);
    for (const wort of frei.slice(1)) {
      const rang = rangVon(trefferVon(wort, nachWort), bereichsGroesse);
      if (rang < bester) { bester = rang; sieger = wort; }
    }

    vergeben.add(sieger.toLowerCase());
    gewaehlt.push(sieger);
    ausgabe.push({
      wort: sieger,
      alternativen: achse
        .filter(w => w !== sieger)
        .map(w => ({ wort: w, treffer: trefferVon(w, nachWort) })),
      // Nicht schon `sieger !== frei[0]`: hat eine frühere Achse den ersten
      // Vorschlag weggenommen, ist der Nachrücker keine Entscheidung DIESER
      // Stufe — dann wäre die Marke eine Falschaussage.
      nachgeschlagen: ersterNochFrei && sieger !== achse[0],
    });
  }

  return { gewaehlt, achsen: ausgabe };
}

/**
 * Warum an dieser Achse nicht der erste Vorschlag steht — oder `null`, wenn er
 * es tut.
 *
 * **Der Grund ist ableitbar, nicht geraten.** Verliert der erste Vorschlag, hat
 * der Sieger den besseren Rang; bei Gleichstand gewinnt der frühere. Ein erster
 * Vorschlag MIT Treffern kann also nur an Rang 2 oder 4 gestanden haben — beides
 * heisst „zu weit". Ohne Treffer war er tot. Mehr Fälle gibt es nicht, und
 * deshalb darf der Satz sie beim Namen nennen.
 *
 * Er stand einmal als eine Zeichenkette in der Komponente und sagte in beiden
 * Fällen „trug im Bestand nichts aus" — für ein Wort mit 46 Treffern war das
 * schlicht falsch.
 */
export function warumGewaehlt(achse: AchsenWahl): string | null {
  if (!achse.nachgeschlagen) return null;
  const erster = achse.alternativen[0];
  if (!erster) return null;
  return erster.treffer === 0
    ? `Der erste Vorschlag „${erster.wort}" kommt im Betrachtungsbereich nicht vor — gewählt wurde deshalb „${achse.wort}".`
    : `Der erste Vorschlag „${erster.wort}" trifft ${erster.treffer} Vorhaben und ist damit zu weit — gewählt wurde deshalb „${achse.wort}".`;
}

/**
 * Ein Wortlaut-Ergebnis über alle Vorschläge auf die gewählten Worte einengen.
 *
 * Ohne diesen Schnitt trügen die Befunde die verworfenen Vorschläge als Belege
 * mit — die Abdeckung zählte dann Worte, die gar nicht im Urteil stehen.
 */
export function beschraenkeAuf(
  wortlaut: WortlautErgebnis,
  gewaehlt: readonly string[],
): WortlautErgebnis {
  const behalten = new Set(gewaehlt);
  const proAktenzeichen = new Map<string, string[]>();
  for (const [akz, worte] of wortlaut.proAktenzeichen) {
    const uebrig = worte.filter(w => behalten.has(w));
    if (uebrig.length > 0) proAktenzeichen.set(akz, uebrig);
  }
  // Reihenfolge der Wahl, nicht der Suche: die Chips stehen in Achsenreihenfolge.
  const treffer = gewaehlt.map(w => wortlaut.treffer.find(t => t.wort === w) ?? { wort: w, treffer: 0 });
  return { proAktenzeichen, treffer };
}

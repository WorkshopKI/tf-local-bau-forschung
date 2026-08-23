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
 * rund 18 ms; eine ganze Zeile mit beiden Stufen (inkl. Query-Embedding auf
 * WebGPU) 145 ms — gemessen über 45 Zeilen am Stück, 6,5 s für die ganze Liste.
 * Die Wartezeit einer Prüfung liegt damit vollständig beim KI-Lauf.
 *
 * **Was die Abdeckung NICHT kann.** Sie zählt Schlagworte, sie wiegt sie nicht.
 * An der 72er-Liste gemessen bevorzugt sie damit systematisch die weiten Trios:
 * „Übereinstimmung ab 2 von 3" trifft dort vor allem Zeilen, deren Abdeckung von
 * einem Wort wie „Automatisierung" (852 Vorhaben) oder „Maschinenbau" (672)
 * getragen wird, während eine Zeile mit einem einzigen, sehr engen Treffer
 * („Wasserstoffversprödung", 2 Vorhaben) als „keine Übereinstimmung" durchfällt —
 * obwohl gerade sie den Blick lohnt. Die Oberfläche zeigt deshalb an jedem
 * Schlagwort seine Trefferzahl und markiert die zu weiten
 * ({@link WORT_ZU_WEIT_ANTEIL}); die Trefferliste steht in jeder Zeile offen, auch
 * wenn das Urteil nein sagt.
 *
 * **Stufe B, Ähnlichkeit**, beantwortet die Frage, die die Schlagworte nicht
 * können: dasselbe Vorhaben mit anderen Worten. Sie ist optional — ohne
 * geladenes Embedding-Modell entfällt sie mit sichtbarem Hinweis, nicht die
 * Prüfung. Sie ist auch die Stufe, die den engen Einzeltreffer oben wieder
 * einfängt: die acht Zeilen, die der Wortlaut nicht zu fassen bekam, hebt sie
 * ab 0,52 hervor.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import type { AntragTextEntry } from '@/plugins/antraege/services/search-corpus';
import {
  searchAntraegeSubstring, searchAntraegeVector,
} from '@/plugins/antraege/services/antraege-search-service';
import type {
  AehnlichkeitAus, AehnlichkeitsAusfall, SchlagwortTreffer, TraegerBezug, TrefferBefund,
  TrefferQuelle, UrteilGrund,
} from '../types';
import { TRAEGER_NAEHE_SCHWELLE, type TraegerIndex } from './traeger';

/**
 * Was an der Oberfläche steht, wenn die Ähnlichkeitsstufe nichts beitrug.
 *
 * Die Sätze stehen hier und nicht in den Komponenten, weil zwei Stellen sie
 * brauchen (Seitenkopf und Zeilenkarte) und sie an beiden dasselbe sagen
 * müssen. Jeder nennt den Zustand UND den Weg heraus — „keine Ähnlichkeit"
 * allein war genau die Meldung, die nichts erklärte.
 */
export const AEHNLICHKEIT_AUS_TEXT: Record<AehnlichkeitAus, string> = {
  'modell-fehlt': 'Ohne Ähnlichkeitsstufe gelaufen: das Embedding-Modell war nicht geladen. Geurteilt wurde allein nach Wortlaut und Träger. Laden Sie das Modell einmal über die Suche, dann greift die Stufe beim nächsten Lauf.',
  'vektoren-fehlen': 'Ohne Ähnlichkeitsstufe gelaufen: der Bestand trägt keine Einbettungen. Der Suchindex muss dafür einmal gebaut sein.',
  'vektoren-unlesbar': 'Ohne Ähnlichkeitsstufe gelaufen: die Einbettungen des Bestands liessen sich nicht lesen.',
  'einbetten-schlug-fehl': 'Die Ähnlichkeit konnte für diese Zeile nicht gerechnet werden — das Modell war zwischenzeitlich nicht mehr bereit. Geurteilt wurde allein nach Wortlaut und Träger.',
};

/** Eine Ausnahme in den Satz verwandeln, der sie beschreibt. */
function alsMeldung(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
 *
 * **An einer ganzen Liste gemessen** (45 Meldungen über der Betragsschwelle aus
 * `Auszug_72_Zeilen_ 20260818`, 23.08.2026): bei „1 von 3" tragen **40 von 45**
 * Zeilen ein „Übereinstimmung" — das reine ODER der Anforderung sagt also fast
 * immer ja. Bei „2 von 3" sind es 10, bei „3 von 3" **keine einzige**. Die
 * dritte Stufe des Reglers ist damit an echten Listen leer; sie bleibt als
 * Grenzfall stehen, aber wer sie wählt, sieht nichts mehr.
 */
export const SCHWELLE_VORGABE = 2;

/**
 * Ab welcher Kosinus-Ähnlichkeit ein Vorhaben OHNE Schlagworttreffer allein
 * durch inhaltliche Nähe eine Übereinstimmung auslöst.
 *
 * `searchAntraegeVector` liefert bereits nur, was über seiner eigenen Schwelle
 * liegt (Top 50 mit relativem Cutoff) — diese Zahl hier ist die zweite, engere
 * Hürde für den Fall, dass KEIN Schlagwort traf.
 *
 * **Gemessen** an allen 45 Meldungen der Liste `Auszug_72_Zeilen_ 20260818`, die
 * über der Betragsschwelle liegen (Betrachtungsbereich 4.327 Vorhaben,
 * EmbeddingGemma-300M, WebGPU, 23.08.2026). Je Zeile der höchste Wert eines
 * Vorhabens, das KEIN Schlagwort getroffen hatte:
 *
 *   höchster Wert der ganzen Liste  0,621 · Median rund 0,47 · niedrigster 0,391
 *   ab 0,45 → 34 von 45 Zeilen · ab 0,50 → 15 · ab 0,52 → 10 · ab 0,55 → 4
 *   ab 0,60 →  1 · ab 0,65 →  0 · ab 0,75 →  0
 *
 * Die frühere Vorbelegung 0,75 lag damit **über dem gesamten beobachteten
 * Wertebereich**: die Ähnlichkeitsstufe lief, rechnete und trug zu keinem
 * einzigen Urteil bei. 0,52 ist der Punkt, an dem die Stufe die Zeilen aufgreift,
 * die der Wortlaut nicht sehen kann (26, 42, 44, 49, 51, 69, 70, 71) — darunter
 * mit `Multi-POCT-vet → VetDx/ZytoVet` (0,523) die inhaltlich nächste Paarung der
 * ganzen Liste — ohne die MDZ-Zeilen mitzureissen, die alle unter 0,51 bleiben.
 *
 * Die Zahl gilt für dieses Modell. Ein Modellwechsel verschiebt die Skala und
 * verlangt dieselbe Messung erneut (Pitfall #19).
 */
export const AEHNLICHKEIT_SCHWELLE = 0.52;

/** So viele Befunde zeigt die Zeile eingeklappt. */
export const BEFUNDE_SICHTBAR = 10;

/**
 * Ab welchem Anteil am Betrachtungsbereich ein Schlagwort als „zu weit" gilt.
 *
 * Ein Prozent, an der 72er-Liste abgelesen: darüber liegen ausschliesslich
 * Sammelbegriffe, die nicht das Vorhaben benennen, sondern seine Branche oder
 * seine Methodenfamilie — Automatisierung 19,7 %, Maschinenbau 15,5 %,
 * Medizintechnik 8,2 %, Additive Fertigung 7,9 %, Logistik 2,4 %, Maschinelles
 * Lernen 2,0 %, Demonstrator 1,9 %, Kreislaufwirtschaft 1,8 %, Robotik 1,1 %.
 * Direkt darunter beginnen die Begriffe, die wirklich unterscheiden
 * (Qualifizierung 0,8 %, Lieferketten 0,7 %, Computer Vision 0,3 %).
 *
 * Die Marke urteilt nicht — sie beschriftet. Ein zu weites Schlagwort zählt
 * weiter zur Abdeckung; der Nutzer sieht nur, welches der drei Wörter die Liste
 * aufgerissen hat, und kann es an Ort und Stelle ersetzen.
 */
export const WORT_ZU_WEIT_ANTEIL = 0.01;

/**
 * Ab welchem Anteil ein Schlagwort gar nicht mehr zur Abdeckung zählt.
 *
 * Zwei Prozent, und damit bewusst **über** der Marke: die Marke beschriftet,
 * diese Schwelle greift ein, und einzugreifen verlangt den grösseren Abstand.
 * An der 72er-Liste liegen darüber genau die Wörter, die eine Branche nennen —
 * Automatisierung 19,7 %, Maschinenbau 15,5 %, Medizintechnik 8,2 %, Additive
 * Fertigung 7,9 %, Logistik 2,4 %. Direkt darunter stehen Begriffe, die eine
 * Sache benennen und deshalb weiter zählen sollen: Maschinelles Lernen 2,0 %,
 * Demonstrator 1,9 %, Kreislaufwirtschaft 1,8 %, Robotik 1,1 %.
 *
 * Wirkung an derselben Liste: die Zeilen, deren „Übereinstimmung" allein an
 * einem Sammelbegriff hing (7 · 17 · 55), verlieren ihre Wortlaut-Begründung;
 * die Zeilen mit engen Treffern behalten ihre.
 */
export const WORT_ZAEHLT_NICHT_ANTEIL = 0.02;

/** Trägt dieses Schlagwort so viele Treffer, dass es nichts mehr unterscheidet? */
export function istZuWeit(treffer: number, bereichsGroesse: number | null): boolean {
  if (!bereichsGroesse) return false;
  return treffer / bereichsGroesse >= WORT_ZU_WEIT_ANTEIL;
}

/** Ist das Schlagwort so weit, dass es nicht einmal mehr mitgezählt wird? */
export function zaehltNicht(treffer: number, bereichsGroesse: number | null): boolean {
  if (!bereichsGroesse) return false;
  return treffer / bereichsGroesse >= WORT_ZAEHLT_NICHT_ANTEIL;
}

/** Was ein Abgleich braucht, um überhaupt laufen zu können. */
export interface AbgleichKontext {
  /** Der auf den Betrachtungsbereich geschnittene Suchkorpus. */
  korpus: Map<string, AntragTextEntry>;
  /** Stammdaten je Aktenzeichen — Status, Datum, Antragsteller für die Anzeige. */
  listeNachAkz: ReadonlyMap<string, AntragListItem>;
  /** Alle Embeddings; leer = Stufe B entfällt. */
  embeddings: Map<string, number[]>;
  /** Trägernamen des Bereichs; fehlt = Träger-Achse entfällt. */
  traegerIndex?: TraegerIndex;
  /**
   * Warum `embeddings` leer ist — der Grund, den der Lauf beim Laden erfahren hat.
   *
   * Er wird hier durchgereicht, statt an der leeren Map geraten zu werden: eine
   * leere Map heisst „das Modell fehlte", „der Index ist nicht gebaut" oder „das
   * Lesen scheiterte", und das sind drei verschiedene Auskünfte an den Nutzer.
   */
  aehnlichkeitAusfall?: AehnlichkeitsAusfall | null;
}

/** Was die Wortlaut-Stufe herausgefunden hat. */
export interface WortlautErgebnis {
  /** Je Aktenzeichen die Schlagworte, die darin wörtlich vorkamen. */
  proAktenzeichen: Map<string, string[]>;
  /** Je Schlagwort, wie viele Anträge des Bereichs es trifft. */
  treffer: SchlagwortTreffer[];
}

/**
 * Stufe A: je Schlagwort einmal suchen und zählen, wie viele Schlagworte ein
 * Aktenzeichen tragen. Rein bis auf den Suchaufruf, synchron.
 *
 * Liefert die Trefferzahl **je Schlagwort** mit, weil sowohl die Anzeige (Marke
 * „zu weit") als auch das Urteil (zu weite Wörter zählen nicht) sie brauchen —
 * und ein zweiter Lauf über den Korpus nur dieselbe Zahl noch einmal kostete.
 */
export function wortlautAbdeckung(
  schlagworte: readonly string[],
  korpus: Map<string, AntragTextEntry>,
): WortlautErgebnis {
  const out = new Map<string, string[]>();
  const treffer: SchlagwortTreffer[] = [];
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
    const gefunden = searchAntraegeSubstring(wort, korpus, { verknuepfung: 'und', stammSuche: true });
    treffer.push({ wort, treffer: gefunden.length });
    for (const akz of gefunden) {
      const bisher = out.get(akz);
      if (bisher) bisher.push(wort);
      else out.set(akz, [wort]);
    }
  }
  return { proAktenzeichen: out, treffer };
}

/** Aus welcher Stufe (oder aus beiden) ein Befund stammt. */
function quelleAus(hatWortlaut: boolean, hatVektor: boolean): TrefferQuelle {
  if (hatWortlaut && hatVektor) return 'beide';
  if (hatWortlaut) return 'wortlaut';
  return hatVektor ? 'aehnlichkeit' : 'traeger';
}

/** Einen Befund aus Korpus- und Stammdaten zusammensetzen. */
function baueBefund(
  aktenzeichen: string,
  getroffeneWorte: readonly string[],
  aehnlichkeit: number | null,
  ctx: AbgleichKontext,
  zuWeiteWorte: ReadonlySet<string>,
  traeger: TraegerBezug | null,
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
    abdeckung: getroffeneWorte.filter(w => !zuWeiteWorte.has(w)).length,
    abdeckungRoh: getroffeneWorte.length,
    aehnlichkeit,
    traeger,
    vbPhase: typeof item?.vb_phase === 'number' ? item.vb_phase : null,
    quelle: quelleAus(getroffeneWorte.length > 0, aehnlichkeit !== null),
    status: item?.status ?? '',
    antragsdatum: item?.antragsdatum ?? '',
    antragsteller: item?.antragsteller ?? '',
  };
}

/** Die Schlagworte, die für die Abdeckung nicht mehr zählen. */
export function zuWeiteSchlagworte(
  treffer: readonly SchlagwortTreffer[],
  bereichsGroesse: number | null,
): Set<string> {
  return new Set(treffer.filter(t => zaehltNicht(t.treffer, bereichsGroesse)).map(t => t.wort));
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
  zuWeiteWorte: ReadonlySet<string> = new Set(),
  traeger: ReadonlyMap<string, TraegerBezug> = new Map(),
): TrefferBefund[] {
  // Die Träger-Menge geht MIT in die Vereinigung: ein Vorhaben desselben Hauses
  // gehört in die Liste, auch wenn weder ein Schlagwort noch die Einbettung es
  // gefunden hat — es ist der einzige Beleg, der keine Schätzung ist.
  const akzListe = new Set<string>([...wortlaut.keys(), ...vektor.keys(), ...traeger.keys()]);
  const out: TrefferBefund[] = [];
  for (const akz of akzListe) {
    const befund = baueBefund(
      akz, wortlaut.get(akz) ?? [], vektor.get(akz) ?? null, ctx,
      zuWeiteWorte, traeger.get(akz) ?? null,
    );
    if (befund) out.push(befund);
  }
  out.sort((a, b) => (
    // Träger zuerst: derselbe Zuwendungsempfänger ist die einzige Tatsache in
    // dieser Liste, alles andere ist gemessene Nähe.
    Number(b.traeger !== null) - Number(a.traeger !== null)
    || b.abdeckung - a.abdeckung
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
 * **Reihenfolge nach Beweiskraft, nicht nach Rechenweg.** Der Träger-Bezug
 * steht vorn, weil er als einziger eine Tatsache feststellt (dieselbe
 * Einrichtung hier wie dort) statt Nähe zu schätzen; er braucht dafür eine
 * inhaltliche Mindestnähe, sonst träfe ein Haus mit 88 Vorhaben immer zu. Dann
 * die Schlagworte — nachlesbar, welches Wort wo stand. Zuletzt die reine
 * Ähnlichkeit, die keinen Beleg zum Vorzeigen hat.
 *
 * **`unklar` statt „keine Übereinstimmung"**, wenn kein einziges Schlagwort im
 * Bereich vorkam: dann hat die Wortlaut-Achse nichts geprüft, und ein Nein wäre
 * eine Behauptung. An der 72er-Liste betraf das fünf Meldungen.
 */
export function faelleUrteil(
  befunde: readonly TrefferBefund[],
  schwelle: number,
  aehnlichkeitSchwelle = AEHNLICHKEIT_SCHWELLE,
  schlagwortTreffer: readonly SchlagwortTreffer[] = [],
): Urteil {
  const traegerNah = befunde.some(
    b => b.traeger !== null && (b.aehnlichkeit ?? 0) >= TRAEGER_NAEHE_SCHWELLE,
  );
  if (traegerNah) return { uebereinstimmung: true, grund: 'traeger' };
  if (befunde.some(b => b.abdeckung >= schwelle)) {
    return { uebereinstimmung: true, grund: 'schlagworte' };
  }
  if (befunde.some(b => (b.aehnlichkeit ?? 0) >= aehnlichkeitSchwelle)) {
    return { uebereinstimmung: true, grund: 'aehnlichkeit' };
  }
  const wortlautStumm = schlagwortTreffer.length > 0
    && schlagwortTreffer.every(t => t.treffer === 0);
  return { uebereinstimmung: false, grund: wortlautStumm ? 'unklar' : 'keine' };
}

/** Was Stufe B herausgefunden hat — und, wenn nichts, warum nicht. */
export interface AehnlichkeitsLauf {
  /** Die ähnlichsten Vorhaben je Aktenzeichen; leer, wenn die Stufe nicht lief. */
  treffer: Map<string, number>;
  /** `null` = die Stufe lief. Sonst der Grund, mitsamt roher Meldung. */
  ausfall: AehnlichkeitsAusfall | null;
}

/**
 * Stufe B: die Zeile einbetten und die ähnlichsten Vorhaben holen.
 *
 * `embedden` kommt von aussen herein, damit dieses Modul weder das
 * Embedding-Modell noch die IndexedDB kennt — und damit der Test es ohne beides
 * fahren kann.
 *
 * **`embedden` darf werfen, und der Wurf wird hier klassifiziert, nicht
 * verschluckt.** Vorher gab die Hülle im Hook bei jedem Fehler `null` zurück;
 * die Stufe meldete dann „keine Ähnlichkeit" — dasselbe Bild wie bei einem
 * ehrlichen Nulltreffer. Ein Modell, das zwischen Laufbeginn und Klick
 * unbereit wurde (HMR-Reload, Seitenwechsel), sah damit aus wie ein kaputtes
 * Feature; beim Abnehmen von v6.25.1 kostete genau das drei Fehlversuche.
 * Ein leeres Ergebnis MIT Grund ist ein Befund, ohne Grund ist es ein Rätsel.
 */
export async function aehnlichkeitsStufe(
  text: string,
  ctx: AbgleichKontext,
  embedden: (text: string) => Promise<number[]>,
  bekannt: ReadonlySet<string>,
  signal: AbortSignal,
): Promise<AehnlichkeitsLauf> {
  if (ctx.embeddings.size === 0) {
    // Der Grund kommt vom Lauf, der die Einbettungen zu laden versuchte — hier
    // ist nur noch bekannt, DASS keine da sind.
    return {
      treffer: new Map(),
      ausfall: ctx.aehnlichkeitAusfall ?? { aus: 'vektoren-fehlen', meldung: null },
    };
  }
  let vec: number[];
  try {
    vec = await embedden(text);
  } catch (err) {
    return { treffer: new Map(), ausfall: { aus: 'einbetten-schlug-fehl', meldung: alsMeldung(err) } };
  }
  const erg = await searchAntraegeVector(vec, ctx.embeddings, signal, bekannt);
  return { treffer: new Map(erg.treffer.map(t => [t.akz, t.score])), ausfall: null };
}

/** Der Text, den die Ähnlichkeitsstufe einbettet. */
export function aehnlichkeitsText(thema: string, aufgabenbeschreibung: string): string {
  return [thema.trim(), aufgabenbeschreibung.trim()].filter(s => s.length > 0).join('\n\n');
}

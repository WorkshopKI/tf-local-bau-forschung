/**
 * **Ruhende Kürzel** — welche Einträge des Code-Katalogs die App überhaupt noch
 * beschäftigen dürfen.
 *
 * Der Katalog führt gut 500 Kürzel; gemessen an Fassung 22 und den drei
 * Import-Quellen sind davon **243 in keiner einzigen `D_`/`T_`-Spalte gemappt**
 * und weitere 15 seit der vorletzten Richtlinie nicht mehr gesetzt worden. Sie
 * verstopfen die Kürzel-Tabelle, die Auswahlliste des Regel-Editors und den
 * Klärfragen-Bogen — und zwar mit Arbeit, die nirgends ankommen kann: 85 der 243
 * trugen ein von Hand gesetztes Relevanz-Häkchen, sieben sogar eine ZAH-Phase.
 *
 * **Ruhe ist Sichtbarkeit, nicht Wahrheit.** Sie steuert Aufmerksamkeit —
 * Tabelle, Auswahl, Fragebogen. Sie darf **nie** Chronik, Zeitstrahl, Navigator,
 * Wächter oder `reconcile` filtern: ein Altantrag von 2017 mit `D_INFOB` behält
 * seinen Eintrag, auch wenn das Kürzel heute ruht (Pitfall #53). Und sie ist
 * **nicht** `aktiv`: dieser Schalter stoppt das Event-Schreiben beim Import
 * (`reconcile.ts`) und hat damit Datenwirkung, die Ruhe gerade nicht hat.
 *
 * **Abgeleitet, kuriert nur die Ausnahme.** `StatusFeldEintrag.ruht` ist
 * dreiwertig: fehlt es, entscheidet die Beobachtbarkeit; `true`/`false` sind die
 * beiden Ausnahmerichtungen. Damit wacht ein neu gemapptes Kürzel von selbst auf,
 * und kein abgeleiteter Wert liegt neben der Wahrheit (Pitfall #45).
 *
 * **Maßstab ist eine feste Generationenzahl, nicht der Betrachtungsbereich**
 * (Pitfall #46): Evidenz folgt dem persönlichen Bereich nicht, sonst sähe jede
 * Person eine andere Liste und der Termin stritte über die Zahl statt über das
 * Kürzel.
 *
 * Rein: keine IO, kein React.
 */
import { RICHTLINIEN_GENERATIONEN, bereichsMenge } from './betrachtungsbereich';
import type { StatusFeldEintrag } from './typen';

/**
 * Wie viele Richtlinien-Generationen als „aktueller Einsatz" gelten — die
 * laufende und die davor. Zwei, nicht drei wie beim Betrachtungsbereich: der
 * bemisst den Arbeitsvorrat, dies hier misst, ob ein Kürzel noch benutzt wird.
 */
export const EINSATZ_GENERATIONEN = 2;

/**
 * Die Programme der jüngsten {@link EINSATZ_GENERATIONEN} Generationen.
 *
 * Abgeleitet über `slice(-N)` — dieselbe Mechanik wie `BETRACHTUNGSBEREICH_SEED`.
 * Ein Richtlinienwechsel ist damit ein Listeneintrag in
 * `RICHTLINIEN_GENERATIONEN`; die älteste Generation rollt von selbst aus dem
 * Einsatz-Fenster, ohne dass hier etwas nachgepflegt wird.
 */
export function aktuelleProgramme(): ReadonlySet<string> {
  return bereichsMenge(
    RICHTLINIEN_GENERATIONEN.slice(-EINSATZ_GENERATIONEN).flatMap(g => g.programme),
  );
}

/** Die Jahre der jüngsten Generationen — für die Beschriftung („seit 2020"). */
export function einsatzJahre(): readonly number[] {
  return RICHTLINIEN_GENERATIONEN.slice(-EINSATZ_GENERATIONEN).map(g => g.jahr);
}

/**
 * Warum ein Kürzel ruht. `null` = es ruht nicht.
 *
 * `nicht-im-export` und `kuratiert` bleiben getrennt, weil sie **verschiedene
 * Aussagen** sind: das eine heißt „C16 setzt es vielleicht, wir sehen es nur
 * nie", das andere „die PL hat entschieden". In einen Topf geworfen läse sich
 * die Sektion als „nicht mehr in Gebrauch", und das wäre für die
 * Kommunikations-Kürzel schlicht falsch.
 */
export type RuheGrund = 'kuratiert' | 'nicht-im-export' | null;

/** Trägt dieses Feld irgendwo eine gemappte CSV-Spalte? */
export type HatSpalte = (feld: StatusFeldEintrag) => boolean;

/**
 * Prüft die Beobachtbarkeit gegen die Spalten-Herkunft des Cockpits
 * (`csvSpaltenJeFeld`).
 *
 * **Kanonische Felder gelten immer als beobachtbar**: sie tragen keinen `code`
 * und werden nicht über das Spalten-Mapping aufgelöst, sondern stehen direkt im
 * Record (`status`, `verbund_status`). Ohne diese Ausnahme ruhten die vier
 * wichtigsten Felder des Katalogs.
 */
export function hatSpalteAus(csvSpalten: ReadonlyMap<string, string[]>): HatSpalte {
  return feld => {
    if (feld.code === undefined || feld.code === '') return true;
    return (csvSpalten.get(feld.feldId)?.length ?? 0) > 0;
  };
}

/** Warum dieses Feld ruht — Kuration schlägt Ableitung, in beide Richtungen. */
export function ruheGrund(feld: StatusFeldEintrag, hatSpalte: boolean): RuheGrund {
  if (feld.ruht === true) return 'kuratiert';
  if (feld.ruht === false) return null;
  return hatSpalte ? null : 'nicht-im-export';
}

/** Ruht dieses Feld? Die eine Lesestelle für alle Konsumenten. */
export function ruhtFeld(feld: StatusFeldEintrag, hatSpalte: boolean): boolean {
  return ruheGrund(feld, hatSpalte) !== null;
}

/**
 * Die Codes der ruhenden Felder, NFC-normalisiert (Pitfall #22).
 *
 * Codes statt `feldId`, weil die Konsumenten jenseits des Katalogs mit Kürzeln
 * arbeiten: die Klärfragen kennen `alleKuerzel()`, nicht die Feld-Ids.
 */
export function ruhendeCodes(
  felder: readonly StatusFeldEintrag[], hatSpalte: HatSpalte,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const f of felder) {
    if (f.code === undefined || f.code === '') continue;
    if (ruhtFeld(f, hatSpalte(f))) out.add(f.code.normalize('NFC'));
  }
  return out;
}

/** Die `feldId` der ruhenden Felder — für die Auswahlliste des Regel-Editors. */
export function ruhendeFeldIds(
  felder: readonly StatusFeldEintrag[], hatSpalte: HatSpalte,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const f of felder) {
    if (!ruhtFeld(f, hatSpalte(f))) continue;
    out.add(f.feldId);
    // Die Begleit-Textspalte gehört zum selben Ereignis und hat keinen eigenen
    // Katalog-Eintrag; ohne sie bliebe `T_INFOB` in der Liste stehen, während
    // `D_INFOB` verschwindet.
    if (f.textSpalte) out.add(f.textSpalte);
  }
  return out;
}

/** Was ein Bestandslauf je Kürzel gezählt hat. */
export interface EinsatzTreffer {
  /** Vorgänge in den jüngsten {@link EINSATZ_GENERATIONEN} Generationen. */
  aktuell: number;
  /** Vorgänge in älteren Generationen — trennt „schlief ein" von „nie benutzt". */
  frueher: number;
}

/** Ein Kürzel, das der Bestand zum Ruhen vorschlägt. */
export interface SchlafendesKuerzel {
  feldId: string;
  code: string;
  label: string;
  /** Wie oft es früher gesetzt wurde; 0 = im ganzen Bestand nie. */
  frueher: number;
}

/**
 * Welche **beobachtbaren** Kürzel der Bestand als eingeschlafen ausweist.
 *
 * **Vorgeschlagen wird nur, was der Lauf WIRKLICH GESEHEN hat** — ein Kürzel
 * ohne jeden Treffer-Eintrag bleibt außen vor. Das sieht nach einer verpassten
 * Gelegenheit aus („nie gesetzt" wäre doch der klarste Fall"), ist aber die
 * einzige belegbare Lesart: ein fehlender Eintrag heißt „die Auflösung hat das
 * Feld nie erreicht", nicht „die Spalte war überall leer. Beides ist von hier
 * aus nicht zu unterscheiden.
 *
 * Belegt an `QS` und `AQ4`, zwei Kernkürzeln der Fachprüfung: `normCode` streift
 * `-` und `_`, also fallen `D_QS`/`D_QS-` im Spalten-Index zusammen, und der
 * Kollisionsschutz in `feld-aufloesung.ts` wirft eines der beiden aus der
 * Auflösung. Es trägt danach nie einen Wert — obwohl der Export es in fast jedem
 * aktuellen Antrag führt. Mit der freundlicheren Lesart hätte der Vorschlag
 * ausgerechnet diese Kürzel schlafen gelegt (gemessen: 24 statt 11 Vorschläge,
 * darunter `QS`, `AQ4`, `ARQ`, `ABLQ`).
 *
 * Der Preis sind vier Kürzel mit Spalte, die im ganzen Bestand nie gesetzt sind
 * (`VRM`, `P2M`, `WZBS`, `WZBTS`) und trotzdem im Blick bleiben. Vier zu viel
 * sehen ist besser, als ein laufendes Kürzel stillzulegen.
 *
 * Nur wer eine Spalte hat, kann hier auftauchen — bei den übrigen sagt der
 * Bestand nichts über den Einsatz; sie ruhen ohnehin schon aus dem anderen
 * Grund. Wer schon ruht, wird nicht noch einmal vorgeschlagen; wer ausdrücklich
 * `ruht: false` trägt, bleibt verschont — die Ausnahme soll eine Messung
 * überleben, sonst müsste die PL sie nach jedem Lauf neu setzen.
 *
 * Absteigend nach früheren Treffern: `INFOB` mit über 300 Vorgängen ist die
 * Entscheidung, über die man reden will; ein Kürzel mit einem einzigen Treffer
 * von 2016 nicht.
 */
export function schlafendeKuerzel(
  felder: readonly StatusFeldEintrag[],
  treffer: ReadonlyMap<string, EinsatzTreffer>,
  hatSpalte: HatSpalte,
): readonly SchlafendesKuerzel[] {
  const out: SchlafendesKuerzel[] = [];
  for (const f of felder) {
    if (f.code === undefined || f.code === '') continue;
    if (f.ruht !== undefined) continue;
    if (!hatSpalte(f)) continue;
    const t = treffer.get(f.code.normalize('NFC'));
    if (t === undefined || t.aktuell > 0) continue;
    out.push({ feldId: f.feldId, code: f.code, label: f.label, frueher: t.frueher });
  }
  return out.sort((a, b) => b.frueher - a.frueher || a.code.localeCompare(b.code, 'de'));
}

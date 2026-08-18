/**
 * Die Zeilen der Katalog-Tabelle als aufgelöstes Anzeige-Modell.
 *
 * Der `StatusWertEintrag` allein trägt nur Schlüssel: `feldId` statt Feldname,
 * `zahPhaseId` statt Beschriftung, gar nichts über Vorkommen. Solange die
 * Tabelle das je Zelle nachschlug, war Sortieren nicht möglich — ein
 * `SortableColumn.accessor` bekommt nur die Zeile. Diese Datei löst einmal auf,
 * was die Tabelle zeigt, sortiert und exportiert; danach ist jede Spalte ein
 * Feldzugriff.
 *
 * Zwei Ränge kommen dazu, die es in den Daten nicht gibt: Arbeitsliste und
 * Verfahrensschritt werden **in Verfahrensreihenfolge** sortiert, nicht
 * alphabetisch. „Abgeschlossen" vor „Eingang" wäre eine Liste, die niemand
 * liest.
 *
 * Rein: keine IO, keine Uhr, kein React.
 */
import {
  kategorieFuerCode, zahPhasenVon, SEED_CODE_ZU_ZAH_PHASE, ZAH_MARKER_LABEL,
} from '@/core/status';
import type { StatusWertEintrag, StatusCategory, ZahPhase } from '@/core/status';
import { wertId } from './useStatusCockpit';
import { KATEGORIE_WERTE } from './labels';

/**
 * Eine Tabellenzeile: **ein Status-Code**, nicht eine Katalogzeile.
 *
 * Derselbe Code steht im Katalog zweimal — unter `status` (TV) und unter
 * `verbund_status`. Bis v4.96 stand er deshalb auch zweimal in der Tabelle, mit
 * identischen Werten in jeder kuratierten Spalte: 60 Zeilen für 30 Status, und
 * der Reiterzähler sagte 60, während der Baum daneben 30 zeigte. Gemessen über
 * 25 Fassungen wich kein einziges Paar in irgendeinem Feld voneinander ab.
 *
 * Gefaltet wird die ANZEIGE, nicht die Ablage: geschrieben werden weiter beide
 * Zeilen (`aendereCodeWerte`). Wo zwei Zeilen doch einmal auseinanderlaufen,
 * sagt {@link KatalogZeile.abweichend} welche Felder — verschwiegen würde daraus
 * sonst eine stille Halbwahrheit.
 */
export interface KatalogZeile {
  /**
   * Der führende Eintrag — Quelle der Anzeige. Bei einem Code mit zwei Zeilen
   * die TV-Zeile; Änderungen laufen über den CODE, nicht über diese Id.
   */
  w: StatusWertEintrag;
  /** Alle Katalogzeilen dieses Codes (1 oder 2). */
  eintraege: readonly StatusWertEintrag[];
  /** Auf welchen Ebenen der Status geführt wird — `['TV', 'Verbund']`. */
  ebenen: readonly string[];
  /**
   * Kuratierte Felder, in denen die beiden Zeilen NICHT dasselbe sagen.
   * Regelfall ist die leere Menge; ein Eintrag hier ist ein Befund.
   */
  abweichend: readonly string[];
  /** Kuratierter Feldname (angezeigt). */
  feldName: string;
  /** Rohe CSV-Spalte(n) — im Tooltip, im Export eine eigene Spalte. */
  csvSpalte: string;
  /** Die Arbeitsliste, die für diesen Wert wirklich gilt. */
  effektiveKategorie: StatusCategory;
  /** Position der Arbeitsliste in der Taxonomie (Sortier-Rang). */
  kategorieRang: number;
  /** Beschriftung des Verfahrensschritts; `—` für Werte ohne amtlichen Code. */
  phaseLabel: string;
  /** Position des Schritts im Verfahren; ohne Schritt ans Ende. */
  phaseRang: number;
  vorkommen: number;
  /** Jüngstes Vorkommen als ISO-Stempel (leer = nie gesehen). */
  zuletzt: string;
  /** Median-Liegezeit dieses Status aus dem Bestand, falls messbar. */
  vorschlag: { median: number; n: number } | undefined;
}

/** Kein Verfahrensschritt: hinter jeden echten, aber vor nichts. */
const RANG_OHNE_SCHRITT = 999;

/**
 * Die Phase eines Wert-Eintrags, wie die Fassung sie führt: kuratiert schlägt
 * Auslieferung, `null` heißt bewusst Marker. Dieselbe dreiwertige Lesung wie in
 * `schnittVon` und `baueHerleitung`.
 */
export function phaseVon(w: StatusWertEintrag): string | null {
  if (w.zahPhaseId !== undefined) return w.zahPhaseId;
  return w.code !== undefined ? SEED_CODE_ZU_ZAH_PHASE.get(w.code) ?? null : null;
}

/**
 * Die Arbeitsliste, die für diesen Wert **wirklich gilt** — dieselbe Regel wie
 * `kategorieAusFassung` in `snapshot.ts`: Werte mit amtlichem Code nehmen die
 * Arbeitsliste des Codes, alle anderen tragen das gepflegte Feld.
 *
 * Exportiert, weil Anzeige **und** Filter dieselbe Kategorie lesen müssen.
 * Solange der Chip-Filter `w.kategorie` prüfte, während die Zelle die abgeleitete
 * zeigte, zählte die Auswahl ein anderes Vokabular als die Tabelle darunter —
 * sichtbar wurde das erst, als 36/37 die Kategorie wechselten und unter „Wartet
 * auf Antragsteller" stehen blieben.
 *
 * Der Verfahrensschritt geht seit v4.87 nicht mehr ein; deshalb braucht die
 * Funktion die Phasen der Fassung nicht.
 */
export function effektiveKategorieVon(w: StatusWertEintrag): StatusCategory {
  return w.code === undefined ? w.kategorie : kategorieFuerCode(w.code);
}

/** Was die Zeilen aus ihrer Umgebung brauchen — alles als reine Eingabe. */
export interface ZeilenKontext {
  /** feldId → kuratierter Feldname. */
  feldName: (feldId: string) => string;
  /** feldId → CSV-Spalte(n), ungemappt `—`. */
  csvSpalte: (feldId: string) => string;
  /** Die Phasen der Fassung; fehlt sie, gilt die Auslieferung. */
  phasen: readonly ZahPhase[] | undefined;
  vorkommen: ReadonlyMap<string, number>;
  zuletzt: ReadonlyMap<string, string>;
  liegezeitVorschlag: ReadonlyMap<number, { median: number; n: number }>;
}

/**
 * Die kuratierten Felder, die zwischen TV- und Verbund-Zeile übereinstimmen
 * müssen — genau die, die die gefaltete Tabelle anzeigt und schreibt.
 *
 * `id`, `feldId` und `wert` stehen NICHT dabei: das ist die Identität der
 * Zeile, dort ist der Unterschied gewollt.
 */
const GEFALTETE_FELDER = [
  ['label', 'Label'], ['kurzLabel', 'Kurzform'], ['kategorie', 'Arbeitsliste'],
  ['prominenz', 'Prominenz'], ['zieltage', 'Zieltage'], ['aktiv', 'aktiv'],
  ['zahPhaseId', 'Verfahrensschritt'],
] as const;

/** Welche der gefalteten Felder zwischen den Zeilen eines Codes auseinanderlaufen. */
function abweichungen(eintraege: readonly StatusWertEintrag[]): string[] {
  if (eintraege.length < 2) return [];
  const [erste, ...rest] = eintraege;
  return GEFALTETE_FELDER
    .filter(([feld]) => rest.some(w => w[feld] !== erste![feld]))
    .map(([, label]) => label);
}

/** Die Ebene einer Katalogzeile, in der Sprache der Oberfläche. */
function ebeneVon(w: StatusWertEintrag): string {
  return w.feldId.startsWith('verbund') ? 'Verbund' : 'TV';
}

export function baueKatalogZeilen(
  werte: readonly StatusWertEintrag[],
  ctx: ZeilenKontext,
): KatalogZeile[] {
  const phasen = zahPhasenVon(ctx.phasen);
  const rangVonPhase = new Map(phasen.map((p, i) => [p.id, i]));
  const labelVonPhase = new Map(phasen.map(p => [p.id, p.label]));

  // Eine Zeile je CODE. Werte ohne Code (es gibt sie im Modell, nicht im
  // heutigen Bestand) bleiben für sich — dort gibt es nichts zu falten.
  const gruppen: StatusWertEintrag[][] = [];
  const jeCode = new Map<number, StatusWertEintrag[]>();
  for (const w of werte) {
    if (w.code === undefined) { gruppen.push([w]); continue; }
    const vorhanden = jeCode.get(w.code);
    if (vorhanden) { vorhanden.push(w); continue; }
    const neu = [w];
    jeCode.set(w.code, neu);
    gruppen.push(neu);
  }

  return gruppen.map(eintraege => {
    // Die TV-Zeile führt, wo es sie gibt: sie trägt den Status, den die Regeln
    // überwiegend lesen.
    const w = eintraege.find(e => ebeneVon(e) === 'TV') ?? eintraege[0]!;
    const phase = phaseVon(w);
    const effektiveKategorie = effektiveKategorieVon(w);
    // Ohne amtlichen Code gibt es keinen Schritt — nicht „Marker", sondern gar
    // keine Aussage. Deshalb `—` und nicht die Marker-Beschriftung.
    const phaseLabel = w.code === undefined
      ? '—'
      : (phase !== null ? labelVonPhase.get(phase) ?? ZAH_MARKER_LABEL : ZAH_MARKER_LABEL);
    return {
      w,
      eintraege,
      ebenen: eintraege.map(ebeneVon),
      abweichend: abweichungen(eintraege),
      feldName: eintraege.map(e => ctx.feldName(e.feldId)).join(' · '),
      csvSpalte: eintraege.map(e => ctx.csvSpalte(e.feldId)).join(' · '),
      effektiveKategorie,
      kategorieRang: KATEGORIE_WERTE.indexOf(effektiveKategorie),
      phaseLabel,
      phaseRang: (phase !== null ? rangVonPhase.get(phase) : undefined) ?? RANG_OHNE_SCHRITT,
      // Summiert bzw. das jüngste: die Zahl gilt jetzt für den Status, nicht
      // für eine seiner beiden Katalogzeilen.
      vorkommen: eintraege.reduce((n, e) => n + (ctx.vorkommen.get(wertId(e.feldId, e.wert)) ?? 0), 0),
      zuletzt: eintraege
        .map(e => ctx.zuletzt.get(wertId(e.feldId, e.wert)) ?? '')
        .reduce((a, b) => (b > a ? b : a), ''),
      vorschlag: w.code !== undefined ? ctx.liegezeitVorschlag.get(w.code) : undefined,
    };
  });
}

/**
 * Wie viele **Status** die Fassung führt — nicht wie viele Katalogzeilen.
 *
 * Der Reiterzähler sagte bis v4.95 „60", während der Baum daneben 30 zeigte und
 * die Drift-Zeile ausdrücklich „gezählt werden Status, keine Katalogzeilen"
 * schrieb. Drei Stellen, zwei Vokabulare. Das hier ist das eine.
 */
export function zaehleStatus(werte: readonly StatusWertEintrag[]): number {
  const codes = new Set<number>();
  let ohneCode = 0;
  for (const w of werte) {
    if (w.code === undefined) ohneCode += 1; else codes.add(w.code);
  }
  return codes.size + ohneCode;
}

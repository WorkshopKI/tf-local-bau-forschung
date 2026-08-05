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
  kategorieFuerPhase, zahPhasenVon, SEED_CODE_ZU_ZAH_PHASE, ZAH_MARKER_LABEL,
} from '@/core/status';
import type { StatusWertEintrag, StatusCategory, ZahPhase } from '@/core/status';
import { wertId } from './useStatusCockpit';
import { KATEGORIE_WERTE } from './labels';

/** Eine Tabellenzeile: der Eintrag plus alles, was die Anzeige daraus macht. */
export interface KatalogZeile {
  /** Der kuratierte Eintrag — Quelle jeder Änderung (`api.setWert`). */
  w: StatusWertEintrag;
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
 * Die Arbeitsliste, die für diesen Wert **wirklich gilt** — dieselbe dreiwertige
 * Regel wie `kategorieAusFassung` in `snapshot.ts`: Werte mit amtlichem Code
 * leiten sie aus Verfahrensschritt + Code ab, alle anderen tragen das gepflegte
 * Feld.
 *
 * Exportiert, weil Anzeige **und** Filter dieselbe Kategorie lesen müssen.
 * Solange der Chip-Filter `w.kategorie` prüfte, während die Zelle die abgeleitete
 * zeigte, zählte die Auswahl ein anderes Vokabular als die Tabelle darunter —
 * sichtbar wurde das erst, als 36/37 die Kategorie wechselten und unter „Wartet
 * auf Antragsteller" stehen blieben.
 */
export function effektiveKategorieVon(
  w: StatusWertEintrag,
  phasen: readonly ZahPhase[] | undefined,
): StatusCategory {
  return w.code === undefined ? w.kategorie : kategorieFuerPhase(phaseVon(w), w.code, phasen);
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

export function baueKatalogZeilen(
  werte: readonly StatusWertEintrag[],
  ctx: ZeilenKontext,
): KatalogZeile[] {
  const phasen = zahPhasenVon(ctx.phasen);
  const rangVonPhase = new Map(phasen.map((p, i) => [p.id, i]));
  const labelVonPhase = new Map(phasen.map(p => [p.id, p.label]));

  return werte.map(w => {
    const key = wertId(w.feldId, w.wert);
    const phase = phaseVon(w);
    const effektiveKategorie = effektiveKategorieVon(w, ctx.phasen);
    // Ohne amtlichen Code gibt es keinen Schritt — nicht „Marker", sondern gar
    // keine Aussage. Deshalb `—` und nicht die Marker-Beschriftung.
    const phaseLabel = w.code === undefined
      ? '—'
      : (phase !== null ? labelVonPhase.get(phase) ?? ZAH_MARKER_LABEL : ZAH_MARKER_LABEL);
    return {
      w,
      feldName: ctx.feldName(w.feldId),
      csvSpalte: ctx.csvSpalte(w.feldId),
      effektiveKategorie,
      kategorieRang: KATEGORIE_WERTE.indexOf(effektiveKategorie),
      phaseLabel,
      phaseRang: (phase !== null ? rangVonPhase.get(phase) : undefined) ?? RANG_OHNE_SCHRITT,
      vorkommen: ctx.vorkommen.get(key) ?? 0,
      zuletzt: ctx.zuletzt.get(key) ?? '',
      vorschlag: w.code !== undefined ? ctx.liegezeitVorschlag.get(w.code) : undefined,
    };
  });
}

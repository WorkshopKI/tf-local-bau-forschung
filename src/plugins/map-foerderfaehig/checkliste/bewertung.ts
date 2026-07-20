/**
 * Bewertungslogik der Checkliste — die einzige Stelle, die Punkte, Gates und
 * Vollständigkeit entscheidet. Die Oberfläche zeigt nur an, was hier herauskommt.
 *
 * Drei Regeln aus der Papiervorlage, die man leicht falsch implementiert:
 *
 * 1. **Eine einzige B0-Stufe setzt die Gesamtpunktzahl auf 0.** Die
 *    Entscheidungshilfe rechnet nicht einfach die Summe: fällt eine der drei
 *    Kategorien auf „unzureichend", ist der Innovationsgrad unzureichend,
 *    unabhängig von den anderen beiden.
 * 2. **Bedingte Blöcke entfallen ganz.** Ein Item, dessen Bedingung nicht
 *    zutrifft, ist weder offen noch unvollständig — es existiert für diese
 *    Prüfung nicht und darf den Abschluss nicht blockieren.
 * 3. **„n. z." senkt die erreichbare Punktzahl**, statt als erfüllt zu zählen.
 *    Ein nicht zutreffendes Kriterium ist kein bestandenes Kriterium.
 *
 * Ausserdem: `nf-notwendig` blockiert den Abschluss (die Nachforderung steht
 * noch aus), `nf-erfuellt` zählt wie erfüllt (sie ist erledigt).
 */
import type { MapEinreichung, RechenBefund } from '../types';
import type {
  MapChecklistenDefinition, MapChecklistenItem, MapItemBewertung, MapItemStatus,
  MapPruefung, MapStufe,
} from './typen';

/** Status, die als abgeschlossen gelten. */
const ERLEDIGT: readonly MapItemStatus[] = ['erfuellt', 'nicht-erfuellt', 'nicht-zutreffend', 'nf-erfuellt'];

/** Status, die eine Pflicht-Bemerkung verlangen. */
export const BEMERKUNG_PFLICHT: readonly MapItemStatus[] = ['nicht-erfuellt', 'nf-notwendig'];

const STUFEN_PUNKTE: Record<MapStufe, number> = { B0: 0, B1: 1, B2: 2, B3: 3 };

export interface MapItemZustand {
  item: MapChecklistenItem;
  /** Trifft die Bedingung zu? Ohne Bedingung immer `true`. */
  anwendbar: boolean;
  bewertung: MapItemBewertung | null;
  status: MapItemStatus;
  /** Rechenbefunde, die dieses Item betreffen (Vorbelegung, nie Automatik). */
  befunde: RechenBefund[];
  /** Fehlt eine Pflicht-Bemerkung? */
  bemerkungFehlt: boolean;
}

export interface MapInnoScore {
  /** Effektive Punktzahl — 0, sobald eine Kategorie auf B0 steht. */
  punkte: number;
  /** Summe der Einzelstufen, ohne die B0-Regel. */
  rohSumme: number;
  maxPunkte: number;
  /** Wurde die Punktzahl durch die B0-Regel auf 0 gesetzt? */
  nullWegenB0: boolean;
  b0Items: string[];
  /** Alle drei Kategorien bewertet? */
  vollstaendig: boolean;
  /** Punktzahl unterhalb des Kurzpfads → vertiefte Einzelprüfung nötig. */
  vertiefungNoetig: boolean;
}

export interface MapBewertungsErgebnis {
  zustaende: MapItemZustand[];
  innoScore: MapInnoScore;
  /** Anwendbare Items ohne abschliessende Bewertung. */
  offen: string[];
  /** Items mit ausstehender Nachforderung. */
  nfOffen: string[];
  /** Items mit „nicht erfüllt" — die Ablehnungsgründe. */
  nichtErfuellt: string[];
  /** Items, denen die Pflicht-Bemerkung fehlt. */
  bemerkungFehlt: string[];
  /** Abschluss möglich? */
  abschlussbereit: boolean;
  fortschritt: { erledigt: number; gesamt: number };
}

/** Trifft die Bedingung eines Items zu? Rein. */
export function istAnwendbar(
  item: MapChecklistenItem,
  pruefung: Pick<MapPruefung, 'bedingungen'>,
  einreichung: MapEinreichung | null,
  innoPunkte: number,
  innoVollstaendig: boolean,
): boolean {
  const b = item.bedingung;
  if (!b) return true;

  if (b.art === 'manuell') return pruefung.bedingungen[item.id] === true;

  if (b.art === 'innoScoreUnter') {
    // Solange der Innovationsgrad nicht vollständig bewertet ist, bleibt der
    // vertiefte Block eingeblendet — sonst verschwänden Pflichtitems, nur weil
    // die Bewertung noch aussteht.
    return !innoVollstaendig || innoPunkte < b.schwelle;
  }

  // Aus dem Import ableitbar: sind Kosten für Aufträge an Dritte geplant?
  const dritte = einreichung?.kosten.dritte ?? null;
  return dritte !== null && dritte > 0;
}

/** Rechnet den Innovationsgrad aus den Skala-Items. Rein. */
export function rechneInnoScore(
  definition: MapChecklistenDefinition, pruefung: Pick<MapPruefung, 'bewertungen'>,
): MapInnoScore {
  const skalaItems = definition.items.filter(i => i.art === 'skala' && i.aktiv);
  const stufen = skalaItems.map(i => ({
    id: i.id,
    stufe: pruefung.bewertungen[i.id]?.stufe ?? null,
  }));

  const bewertet = stufen.filter((s): s is { id: string; stufe: MapStufe } => s.stufe !== null);
  const rohSumme = bewertet.reduce((a, s) => a + STUFEN_PUNKTE[s.stufe], 0);
  const b0Items = bewertet.filter(s => s.stufe === 'B0').map(s => s.id);
  const nullWegenB0 = b0Items.length > 0;
  const vollstaendig = bewertet.length === skalaItems.length && skalaItems.length > 0;
  const punkte = nullWegenB0 ? 0 : rohSumme;

  return {
    punkte,
    rohSumme,
    maxPunkte: skalaItems.length * 3,
    nullWegenB0,
    b0Items,
    vollstaendig,
    vertiefungNoetig: punkte < definition.innoScoreKurzpfad,
  };
}

/** Befunde, die zu einem Item gehören (Präfix-Vergleich auf der Befund-ID). Rein. */
export function befundeFuerItem(
  item: MapChecklistenItem, befunde: readonly RechenBefund[],
): RechenBefund[] {
  const praefixe = item.vorbelegung?.befundPraefixe;
  if (!praefixe || praefixe.length === 0) return [];
  return befunde.filter(b => praefixe.some(p => b.id === p || b.id.startsWith(`${p}:`)));
}

/**
 * Wertet die gesamte Prüfung aus. Rein — alles, was die Oberfläche über
 * Fortschritt, Punkte und Abschlussfähigkeit anzeigt, kommt von hier.
 */
export function bewerte(
  definition: MapChecklistenDefinition,
  pruefung: MapPruefung,
  einreichung: MapEinreichung | null,
  befunde: readonly RechenBefund[],
): MapBewertungsErgebnis {
  const innoScore = rechneInnoScore(definition, pruefung);

  const zustaende: MapItemZustand[] = definition.items
    .filter(i => i.aktiv)
    .map(item => {
      const anwendbar = istAnwendbar(
        item, pruefung, einreichung, innoScore.punkte, innoScore.vollstaendig,
      );
      const bewertung = pruefung.bewertungen[item.id] ?? null;
      const status = bewertung?.status ?? 'offen';
      const bemerkungFehlt = anwendbar
        && BEMERKUNG_PFLICHT.includes(status)
        && (bewertung?.bemerkung ?? '').trim().length === 0;

      return {
        item,
        anwendbar,
        bewertung,
        status,
        befunde: befundeFuerItem(item, befunde),
        bemerkungFehlt,
      };
    });

  const anwendbare = zustaende.filter(z => z.anwendbar);
  const skalaOffen = anwendbare
    .filter(z => z.item.art === 'skala' && (z.bewertung?.stufe ?? null) === null)
    .map(z => z.item.id);

  const offen = [
    ...anwendbare
      .filter(z => z.item.art === 'binaer' && !ERLEDIGT.includes(z.status))
      .map(z => z.item.id),
    ...skalaOffen,
  ];

  const nfOffen = anwendbare.filter(z => z.status === 'nf-notwendig').map(z => z.item.id);
  const nichtErfuellt = anwendbare.filter(z => z.status === 'nicht-erfuellt').map(z => z.item.id);
  const bemerkungFehlt = anwendbare.filter(z => z.bemerkungFehlt).map(z => z.item.id);

  return {
    zustaende,
    innoScore,
    offen,
    nfOffen,
    nichtErfuellt,
    bemerkungFehlt,
    abschlussbereit: offen.length === 0 && nfOffen.length === 0 && bemerkungFehlt.length === 0,
    fortschritt: {
      erledigt: anwendbare.length - offen.length,
      gesamt: anwendbare.length,
    },
  };
}

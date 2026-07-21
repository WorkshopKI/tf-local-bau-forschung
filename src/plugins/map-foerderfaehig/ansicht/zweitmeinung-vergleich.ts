/**
 * „Urteil zuerst": Die KI-Zweitmeinung wird erst sichtbar, nachdem der Mensch
 * seine eigene Stufe gespeichert hat.
 *
 * Die Regel steht bewusst HIER und nicht in der Komponente. Zwei Gründe:
 *
 * 1. In diesem Plugin rechnet kein `.tsx` — die Vitest-Umgebung ist node-only
 *    ohne jsdom, eine Regel im JSX wäre nicht prüfbar.
 * 2. `baueVergleich` **redigiert** das Ergebnis, statt nur ein Flag zu setzen:
 *    Ohne menschliche Stufe sind `kiStufe`, `begruendung` und `sektionIds` leer.
 *    Die Komponente bekommt die KI-Einstufung gar nicht erst in die Hand, also
 *    kann ein versehentliches `{v.kiStufe}` im JSX die Regel nicht brechen.
 *
 * Reine Funktionen.
 */
import type { MapItemZustand } from '../checkliste/bewertung';
import type { MapStufe } from '../checkliste/typen';
import { stufenAbstand, type ZweitmeinungEintrag } from '../infografik/zweitmeinung';

/**
 * `verborgen` = der Mensch hat noch nicht bewertet (oder es gibt keine
 * Zweitmeinung zu diesem Item). Alles andere setzt eine eigene Stufe voraus.
 */
export type VergleichLage = 'verborgen' | 'treffer' | 'nachbar' | 'abweichung';

export interface ZweitmeinungVergleich {
  itemId: string;
  menschStufe: MapStufe | null;
  /** `null`, solange `lage === 'verborgen'`. */
  kiStufe: MapStufe | null;
  /** `''`, solange `lage === 'verborgen'`. */
  begruendung: string;
  /** Leer, solange `lage === 'verborgen'`. */
  sektionIds: readonly string[];
  lage: VergleichLage;
  /** Stufenabstand Mensch↔KI, `null` solange verborgen. */
  abstand: number | null;
}

/** Das redigierte Ergebnis — die einzige Form, in der ein verborgener Vergleich existiert. */
function verborgen(itemId: string, menschStufe: MapStufe | null): ZweitmeinungVergleich {
  return {
    itemId,
    menschStufe,
    kiStufe: null,
    begruendung: '',
    sektionIds: [],
    lage: 'verborgen',
    abstand: null,
  };
}

function lageFuer(abstand: number): VergleichLage {
  if (abstand === 0) return 'treffer';
  return abstand === 1 ? 'nachbar' : 'abweichung';
}

/**
 * Baut den Vergleich für genau ein Item. Rein.
 *
 * Ohne menschliche Stufe ODER ohne Eintrag des Modells kommt ein redigiertes
 * Objekt zurück. Der zweite Fall bleibt bewusst ununterscheidbar dargestellt:
 * eine Meldung „die KI hat sich hier nicht geäussert" wäre Rauschen.
 */
export function baueVergleich(
  itemId: string,
  menschStufe: MapStufe | null,
  eintrag: ZweitmeinungEintrag | undefined,
): ZweitmeinungVergleich {
  if (menschStufe === null || eintrag === undefined) return verborgen(itemId, menschStufe);

  const abstand = stufenAbstand(menschStufe, eintrag.stufe);
  return {
    itemId,
    menschStufe,
    kiStufe: eintrag.stufe,
    begruendung: eintrag.begruendung,
    sektionIds: eintrag.sektionIds,
    lage: lageFuer(abstand),
    abstand,
  };
}

/**
 * Baut die Vergleiche für alle Skala-Items eines Prüfstands. Rein.
 *
 * Nicht-Skala-Items werden übersprungen — sie haben keine Stufe, gegen die sich
 * vergleichen liesse.
 */
export function baueVergleiche(
  zustaende: readonly MapItemZustand[],
  eintraege: readonly ZweitmeinungEintrag[],
): Map<string, ZweitmeinungVergleich> {
  const nachId = new Map(eintraege.map(e => [e.itemId, e]));
  const vergleiche = new Map<string, ZweitmeinungVergleich>();

  for (const z of zustaende) {
    if (z.item.art !== 'skala') continue;
    vergleiche.set(
      z.item.id,
      baueVergleich(z.item.id, z.bewertung?.stufe ?? null, nachId.get(z.item.id)),
    );
  }
  return vergleiche;
}

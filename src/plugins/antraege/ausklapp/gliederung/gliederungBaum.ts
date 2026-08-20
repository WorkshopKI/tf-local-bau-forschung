/**
 * Die **Meilenstein-Gliederung** als Baum-Bestand für `TfTree` — rein, ohne React.
 *
 * Jede Zeile beantwortet drei Fragen in einer Zeile: welche Stufe (Nummer +
 * Name), wie sie steht (erreicht / N T über / nicht relevant) und wann
 * (Ist-Datum bzw. Soll-Termin).
 *
 * **Eigener Adapter, nicht `baueMeilensteinBaum`.** Der des Konfigurations-Tabs
 * setzt `isFolder: true` für JEDEN Knoten — dort richtig, weil jeder ein
 * Drop-Ziel ist. Hier bekäme damit jedes Blatt ein Chevron, das nichts
 * aufklappt.
 *
 * **Nicht relevante Stufen bleiben stehen.** Sie sagen „für diesen Antragstyp
 * nicht vorgesehen" — weggelassen wären sie von „noch offen" nicht zu
 * unterscheiden, und die Nummern bekämen Lücken.
 */
import { kinderVon } from '@/core/meilensteine/knoten-edit';
import type { MstZustand } from '@/core/meilensteine/typen';
import { ZUSTAND_FARBE, ZUSTAND_LABEL, ZUSTAND_TEXT_FARBE, formatDatum } from '@/plugins/meilensteine/labels';
import { tageZwischen } from '@/core/status/waechter';
import type { TfTreeItems } from '@/components/tree';
import type { MeilensteinLage, Stufe } from '../meilensteinLage';

/** Wurzel-Id des Bestands — nie gerendert, nur Aufhänger der obersten Ebene. */
export const GLIEDERUNG_ROOT = 'mst-gliederung-wurzel';

/** Form des Statuspunktes links in der Zeile. */
export type PunktForm = 'gefuellt' | 'offen' | 'gestrichelt';

export interface GliederungsZeile {
  nummer: string;
  label: string;
  zustand: MstZustand;
  /** „erreicht" · „326 T über" · „nicht relevant". */
  statusText: string;
  statusFarbe: string;
  /** „02.10.2025" · „Soll 17.09.25" · „—". */
  datumText: string;
  punktForm: PunktForm;
  punktFarbe: string;
  titel: string;
}

export interface Gliederung {
  items: TfTreeItems<GliederungsZeile>;
  rootId: string;
  /** Ids der obersten Ebene — der Startzustand zeigt nur sie. */
  obersteEbene: string[];
}

const PUNKT_FORM: Record<MstZustand, PunktForm> = {
  erreicht: 'gefuellt',
  gerissen: 'gefuellt',
  faellig: 'gefuellt',
  offen: 'offen',
  nichtRelevant: 'gestrichelt',
};

/** „17.09.2025" → „17.09.25" — der Soll-Termin steht klein und zweistellig. */
function kurzesJahr(iso: string | null): string {
  const lang = formatDatum(iso);
  return lang.length === 10 ? `${lang.slice(0, 6)}${lang.slice(8)}` : lang;
}

function statusText(s: Stufe, stichtag: string): string {
  if (s.zustand !== 'gerissen') return ZUSTAND_LABEL[s.zustand].toLowerCase();
  const tage = tageZwischen(s.ergebnis.sollDatum ?? '', stichtag);
  return tage === null ? 'gerissen' : `${tage} T über`;
}

function datumText(s: Stufe): string {
  if (s.zustand === 'erreicht') return formatDatum(s.ergebnis.istDatum);
  if (s.zustand === 'nichtRelevant' || s.ergebnis.sollDatum === null) return '—';
  return `Soll ${kurzesJahr(s.ergebnis.sollDatum)}`;
}

function titelText(s: Stufe, statusWort: string, hatKinder: boolean): string {
  const kopf = `${s.knoten.nummer} ${s.knoten.label}`;
  if (s.zustand === 'erreicht') {
    // Erreicht OHNE Datum ist der Normalfall bei Bedingungen ohne Datumsfeld
    // (`bewertung.ts`: „gilt als erreicht ohne Datum"). Ein Strich allein läse
    // sich als Lücke — hier steht, dass keine gemeint ist.
    return s.ergebnis.istDatum === null
      ? `${kopf} — erreicht; die erfüllende Spalte trägt kein Datum`
      : `${kopf} — erreicht ${formatDatum(s.ergebnis.istDatum)}`;
  }
  if (s.zustand === 'nichtRelevant') return `${kopf} — für diesen Antragstyp nicht vorgesehen`;
  if (s.ergebnis.sollDatum === null) return `${kopf} — ohne Antragseingang kein Soll-Termin`;
  const lage = s.zustand === 'gerissen'
    ? `Soll ${formatDatum(s.ergebnis.sollDatum)}, offen seit ${statusWort.replace(' über', '')}`
    : `Soll ${formatDatum(s.ergebnis.sollDatum)}, ${statusWort}`;
  return `${kopf} — ${lage}${hatKinder && s.zustand === 'gerissen' ? ' (Ursache in der Unterebene)' : ''}`;
}

export function baueGliederung(lage: MeilensteinLage, stufen: readonly Stufe[], stichtag: string): Gliederung {
  const knoten = lage.art === 'da' ? lage.knoten : [];
  const nachId = new Map(stufen.map(s => [s.knoten.id, s]));
  const items: Record<string, TfTreeItems<GliederungsZeile>[string]> = {};

  const kindIds = (elternId: string | null): string[] =>
    kinderVon(knoten, elternId).filter(k => nachId.has(k.id)).map(k => k.id);

  for (const s of stufen) {
    const kinder = kindIds(s.knoten.id);
    const wort = statusText(s, stichtag);
    items[s.knoten.id] = {
      id: s.knoten.id,
      name: `${s.knoten.nummer} ${s.knoten.label}`,
      isFolder: kinder.length > 0,
      ...(kinder.length > 0 ? { children: kinder } : {}),
      data: {
        nummer: s.knoten.nummer,
        label: s.knoten.label,
        zustand: s.zustand,
        statusText: wort,
        // Schrift NICHT aus der Marken-Palette: `ZUSTAND_FARBE` sind Rahmen-Tokens
        // (Punkte, Ringe). Als Text gemessen kamen `offen` auf 1,41:1 und
        // `nichtRelevant` auf 1,20:1 — AA verlangt 4,5:1, die Spalte sah leer aus,
        // obwohl sie beschriftet war. Dafür gibt es `ZUSTAND_TEXT_FARBE` (v4.124).
        statusFarbe: ZUSTAND_TEXT_FARBE[s.zustand],
        datumText: datumText(s),
        punktForm: PUNKT_FORM[s.zustand],
        punktFarbe: ZUSTAND_FARBE[s.zustand],
        titel: titelText(s, wort, kinder.length > 0),
      },
    };
  }

  const oben = kindIds(null);
  items[GLIEDERUNG_ROOT] = {
    id: GLIEDERUNG_ROOT,
    name: 'Meilensteine',
    isFolder: true,
    children: oben,
    data: {
      nummer: '', label: 'Meilensteine', zustand: 'offen',
      statusText: '', statusFarbe: '', datumText: '', punktForm: 'offen', punktFarbe: '', titel: '',
    },
  };

  return { items, rootId: GLIEDERUNG_ROOT, obersteEbene: oben };
}

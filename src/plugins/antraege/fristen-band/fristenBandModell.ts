/**
 * Das Anzeigemodell des **FristenBands** — rein, ohne React.
 *
 * **Hier wird nichts gerechnet, was schon gerechnet ist.** Frist, Haltedatum
 * und Zieltage kommen fertig herein (`fristFuerVorkommen`, `pruefeStillstand`,
 * `zieltageFuer`); dieses Modul übersetzt sie in Zeilen, Marken und Sätze. Ein
 * Renderer, der nachrechnet, ist die zweite Ableitung, die irgendwann
 * auseinanderläuft — genau die Regel, die `fristAnzeige.ts` seit v3.6 trägt.
 *
 * **Die Zahl soll nachvollziehbar sein, nicht behauptet.** Deshalb steht das
 * gewinnende Basisfeld sichtbar da, das Haltedatum mit seiner Quelle, der
 * Grund bei `nicht_berechenbar` im Klartext — und die Ampel-Schwellen als
 * Herleitung des Punktes, den die Tabellenspalte zeichnet.
 */
import { FRIST_GRUND, type FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import type { FristBezug } from '@/core/status/frist-bezug';
import type { WaechterErgebnis } from '@/core/status/waechter';
import type { MstErgebnis, VerbundMeilensteine } from '@/core/meilensteine/typen';
import {
  FRIST_AMPEL_STUFEN, HALT_HERKUNFT, HALT_OHNE, fristAnzeigeVon, haltBelastbar,
} from '../fristAnzeige';
import type { EingangAmpel } from '../eingangAmpel';

/** Wie viele Meilensteine je Richtung das Band nennt. */
export const MEILENSTEIN_SPITZE = 3;

/** Ein beschrifteter Punkt auf der Achse. */
export interface BandMarke {
  /** `0…1` — Anteil der Achsenbreite. */
  anteil: number;
  label: string;
  /** ISO-Tag. */
  tag: string;
  art: 'basis' | 'bezug' | 'ziel';
}

/** Eine Zeile der Herleitung unter der Achse. */
export interface BandZeile {
  label: string;
  wert: string;
  hinweis?: string;
  /** Hergeleitet statt belegt — die Anzeige setzt sie leiser. */
  weich?: true;
}

export interface FristenBandModell {
  /** „noch 26 T", „12 T über", „34 T bis Entscheidung", „—". */
  kopf: string;
  /** Ampel des Kopfes; `null` = kein Punkt, weil nichts läuft. */
  ampel: EingangAmpel | null;
  zustand: FristErgebnis['zustand'];
  /** Bei `nicht_berechenbar` der Grund im Klartext — nie nur ein Strich. */
  grund: string | null;
  /** Die Achse; leer, wo es keine Spanne gibt. */
  marken: BandMarke[];
  zeilen: BandZeile[];
  /** Zieltag des laufenden Schritts; `null` = keine gepflegt. */
  zieltage: number | null;
  waechter: WaechterErgebnis | null;
  kommend: MstErgebnis[];
  verstrichen: MstErgebnis[];
  /** Warum der Punkt in der Frist-Spalte so aussieht. */
  ampelErklaerung: string;
}

function tagVon(iso: string | undefined): number | null {
  if (iso === undefined) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Der Kopf in der Sprache des jeweiligen Zustands.
 *
 * `laeuft` bekommt Vorzeichen als Wort, nicht als Minuszeichen: „12 T über"
 * liest sich als Zustand, „-12 T" als Rechenfehler.
 */
function kopfText(e: FristErgebnis, stichtagMs: number): string {
  if (e.zustand === 'laeuft') {
    const rest = e.tageRest;
    if (rest === undefined) return '—';
    if (rest === 0) return 'heute fällig';
    return rest > 0 ? `noch ${rest} T` : `${-rest} T über`;
  }
  if (e.zustand === 'angehalten') {
    return fristAnzeigeVon(e, stichtagMs).text;
  }
  return '—';
}

/** Die Achse: Basis → Bezugszeitpunkt → Ziel, proportional zur Zeit. */
function marken(e: FristErgebnis, stichtag: string): BandMarke[] {
  const basis = tagVon(e.basisDatum);
  const ziel = tagVon(e.zielDatum);
  if (basis === null || ziel === null || ziel <= basis) return [];
  const bezug = tagVon(e.bezugsZeitpunkt) ?? tagVon(stichtag) ?? basis;
  const anteil = (ms: number): number => Math.min(1, Math.max(0, (ms - basis) / (ziel - basis)));
  return [
    { anteil: 0, label: 'Basis', tag: e.basisDatum!, art: 'basis' },
    {
      anteil: anteil(bezug),
      label: e.zustand === 'angehalten' ? 'angehalten' : 'heute',
      tag: (e.bezugsZeitpunkt ?? stichtag).slice(0, 10),
      art: 'bezug',
    },
    { anteil: 1, label: 'Ziel', tag: e.zielDatum!, art: 'ziel' },
  ];
}

/** Die Herleitung: welches Eingangsdatum gewonnen hat, und woher das Haltedatum kam. */
function zeilen(bezug: FristBezug, zieltage: number | null): BandZeile[] {
  const { ergebnis: e, antragsdatum, alleAntraegeDa, halt } = bezug;
  const out: BandZeile[] = [
    {
      label: 'Antragseingang',
      wert: antragsdatum ?? '—',
      hinweis: 'D_AAE',
      ...(e.basisFeld === 'D_AAE' ? {} : { weich: true as const }),
    },
    {
      label: 'Alle Anträge da',
      wert: alleAntraegeDa ?? '—',
      hinweis: alleAntraegeDa === null
        ? 'D_XTE nicht gesetzt oder nicht gemappt'
        : 'D_XTE',
      ...(e.basisFeld === 'D_XTE' ? {} : { weich: true as const }),
    },
  ];

  if (e.basisFeld !== undefined) {
    out.push({
      label: 'Maßgeblich',
      wert: e.basisDatum ?? '—',
      hinweis: `${e.basisFeld} — das spätere von beiden trägt die Uhr`,
    });
  }
  if (e.zielDatum !== undefined) {
    out.push({ label: 'Ziel', wert: e.zielDatum, hinweis: 'Basis + Bearbeitungsfrist' });
  }
  if (e.zustand === 'angehalten') {
    out.push({
      label: 'Haltedatum',
      wert: halt?.tag ?? 'unbekannt',
      hinweis: halt ? HALT_HERKUNFT[halt.herkunft] : HALT_OHNE,
      ...(halt && haltBelastbar(halt.herkunft) ? {} : { weich: true as const }),
    });
  }
  out.push({
    label: 'Zieltage des Schritts',
    wert: zieltage === null ? '—' : `${zieltage} T`,
    hinweis: zieltage === null
      ? 'für diesen Status sind keine gepflegt'
      : 'aus dem Statuskatalog',
    ...(zieltage === null ? { weich: true as const } : {}),
  });
  return out;
}

/**
 * Die Herleitung des Punktes in der Frist-Spalte.
 *
 * Liest {@link FRIST_AMPEL_STUFEN} — dieselbe Tabelle, aus der
 * `fristAmpelFromDays` seine Antwort zieht. Eine zweite Aufzählung hier wäre
 * genau die Doppelung, die diese Erklärung eigentlich auflösen soll.
 */
/** Die Ampelstufe als Wort — `gruen` ist ein Enum-Wert, kein Deutsch. */
const AMPEL_WORT: Readonly<Record<EingangAmpel, string>> = {
  rot: 'rot', orange: 'orange', gelb: 'gelb', gruen: 'grün',
};

function ampelErklaerung(e: FristErgebnis): string {
  const stufen = FRIST_AMPEL_STUFEN.map(s => `${AMPEL_WORT[s.ampel]} ${s.text}`).join(' · ');
  if (e.zustand !== 'laeuft' || e.tageRest === undefined) {
    return `Kein Punkt: ${e.zustand === 'angehalten' ? 'angehalten' : 'nicht berechenbar'} — `
      + `es gibt nichts zu ampeln, wo keine Uhr läuft. Sonst gilt: ${stufen}.`;
  }
  const treffer = FRIST_AMPEL_STUFEN.find(s => e.tageRest! <= s.bis);
  const wort = treffer ? AMPEL_WORT[treffer.ampel] : '—';
  return `${stufen}. Hier ${wort} (${e.tageRest} T).`;
}

export interface BandEingabe {
  bezug: FristBezug;
  /** ISO-Tag. */
  stichtag: string;
  zieltage: number | null;
  waechter: WaechterErgebnis | null;
  meilensteine: VerbundMeilensteine | null;
}

/**
 * Kommende und verstrichene Meilensteine.
 *
 * Verstrichen ist alles, was `gerissen` ist — vollständig, nicht gedeckelt: ein
 * gerissener Meilenstein ist der Grund, warum jemand hinschaut. Kommend sind
 * die nächsten `faellig`/`offen` nach Soll-Datum, gedeckelt.
 */
function meilensteine(b: VerbundMeilensteine | null): { kommend: MstErgebnis[]; verstrichen: MstErgebnis[] } {
  if (b === null) return { kommend: [], verstrichen: [] };
  const nachSoll = (x: MstErgebnis, y: MstErgebnis): number =>
    (x.sollDatum ?? '').localeCompare(y.sollDatum ?? '');
  return {
    verstrichen: b.ergebnisse.filter(m => m.zustand === 'gerissen').sort(nachSoll),
    kommend: b.ergebnisse
      .filter(m => m.zustand === 'faellig' || m.zustand === 'offen')
      .sort(nachSoll)
      .slice(0, MEILENSTEIN_SPITZE),
  };
}

export function baueFristenBandModell(e: BandEingabe): FristenBandModell {
  const erg = e.bezug.ergebnis;
  const stichtagMs = new Date(e.stichtag).getTime();
  const anzeige = fristAnzeigeVon(erg, stichtagMs);
  const { kommend, verstrichen } = meilensteine(e.meilensteine);
  return {
    kopf: kopfText(erg, stichtagMs),
    ampel: anzeige.ampel,
    zustand: erg.zustand,
    grund: erg.zustand === 'nicht_berechenbar'
      ? (erg.grund ?? FRIST_GRUND.ohneEingang)
      : null,
    marken: marken(erg, e.stichtag),
    zeilen: zeilen(e.bezug, e.zieltage),
    zieltage: e.zieltage,
    waechter: e.waechter,
    kommend,
    verstrichen,
    ampelErklaerung: ampelErklaerung(erg),
  };
}

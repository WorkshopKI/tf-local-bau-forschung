/**
 * Der Verfahrensschnitt als `TfTree`-Knoten: Phasen mit ihren Status-Codes.
 *
 * **Ein Blatt je CODE, nicht je Wert-Eintrag.** Der Katalog führt dasselbe
 * Status-Vokabular unter zwei Feldern (`status` = TV, `verbund_status` =
 * Verbund) — 30 Codes werden so zu 60 Einträgen. Als 60 Blätter stünde jeder
 * Status zweimal im Baum, und ein Zug auf nur eine der beiden Zeilen erzeugte
 * genau die Doppeldeutigkeit, gegen die `schnittVon` mit „erster Wert mit dem
 * Code gewinnt" geschrieben ist. Die Blätter tragen deshalb den Code; die
 * Store-Aktion schreibt beide Zeilen (`setzeCodePhasen`).
 *
 * **Werte ohne Code kommen nicht vor.** Unkuratierte Funde und katalogfremde
 * Rohwerte haben keine Position im Verfahren — sie werden in der Tabelle
 * kuratiert, nicht hier einsortiert.
 *
 * Rein: keine IO, keine Uhr, kein React.
 */
import { zahPhasenVon, type GeltendeZahPhase, type MappingVersion } from '@/core/status';
import type { TfTreeItem, TfTreeItems } from '@/components/tree';

/** Die Wurzel wird nie gerendert, ist aber das Drop-Ziel „oberste Ebene". */
export const WURZEL_ID = 'wurzel:phasen';

/**
 * Die Gruppe der Codes ohne Phase. Ein eigener Knoten statt einer fehlenden
 * Zuordnung, weil „läuft neben dem Verfahren" ein **gültiger Zustand** ist
 * (Marker-Codes) und kein Mangel — der Baum muss ihn als Ziel anbieten können.
 */
export const OHNE_PHASE_ID = 'gruppe:ohne-phase';

export type PhasenBaumKnoten =
  | { art: 'wurzel' }
  | { art: 'phase'; phase: GeltendeZahPhase; codeAnzahl: number; vorkommen: number }
  | { art: 'ohne-phase'; codeAnzahl: number; vorkommen: number }
  | {
    art: 'code';
    code: number;
    /** Anzeige-Rohwert (der amtliche Text, wie ihn der Katalog führt). */
    wert: string;
    /** Kuratiertes Label, falls gesetzt. */
    label?: string;
    /** Die Wert-Ids beider Felder — was eine Aktion anfassen müsste. */
    wertIds: readonly string[];
    zieltage: number | null;
    vorkommen: number;
    /** Zeigt auf eine Phase, die die Fassung nicht (mehr) führt. */
    verwaist: boolean;
  };

export interface PhasenBaum {
  items: TfTreeItems<PhasenBaumKnoten>;
  rootId: string;
  /** Wie viele Codes auf eine nicht mehr geführte Phase zeigen. */
  verwaiste: number;
}

/** Knoten-Id eines Code-Blatts. Präfix, damit sie nie mit einer Phasen-Id kollidiert. */
export const codeKnotenId = (code: number): string => `code:${code}`;

/** Der Code aus einer Knoten-Id; `null` für Phasen- und Gruppen-Knoten. */
export function codeAusKnotenId(id: string): number | null {
  if (!id.startsWith('code:')) return null;
  const n = Number(id.slice(5));
  return Number.isFinite(n) ? n : null;
}

/** Ein Code, zusammengezogen aus den Wert-Einträgen beider Felder. */
interface CodeZeile {
  code: number;
  wert: string;
  label?: string;
  wertIds: string[];
  zieltage: number | null;
  vorkommen: number;
  /** Phase laut Fassung; `null` = Marker, `undefined` = Auslieferung entscheidet. */
  phase: string | null | undefined;
}

/**
 * Faltet die Wert-Einträge auf eine Zeile je Code.
 *
 * **Erster Eintrag gewinnt** — dieselbe Regel wie `schnittVon` und `statusKurz`.
 * Die Vorkommen werden dagegen SUMMIERT: ein Status, den TV- und Verbund-Feld
 * je 40-mal tragen, liegt 80-mal im Bestand, und die Zahl an der Phase soll das
 * Gewicht der Entscheidung zeigen, nicht die Hälfte davon.
 */
function falteCodes(
  version: MappingVersion,
  vorkommen: ReadonlyMap<string, number>,
  wertSchluessel: (feldId: string, wert: string) => string,
): CodeZeile[] {
  const jeCode = new Map<number, CodeZeile>();
  for (const w of version.werte) {
    if (w.code === undefined || w.unkuratiert) continue;
    const treffer = vorkommen.get(wertSchluessel(w.feldId, w.wert)) ?? 0;
    const bestand = jeCode.get(w.code);
    if (bestand) {
      bestand.wertIds.push(w.id);
      bestand.vorkommen += treffer;
      continue;
    }
    jeCode.set(w.code, {
      code: w.code,
      wert: w.wert,
      ...(w.label ? { label: w.label } : {}),
      wertIds: [w.id],
      zieltage: w.zieltage ?? null,
      vorkommen: treffer,
      phase: w.zahPhaseId,
    });
  }
  return [...jeCode.values()].sort((a, b) => a.code - b.code);
}

/**
 * Baut den Baum aus der Fassung.
 *
 * @param seedPhaseVon Auslieferungs-Zuordnung für Codes, die die Fassung noch
 *   nicht entschieden hat (`zahPhaseId === undefined`) — hereingereicht, damit
 *   diese Datei rein bleibt.
 */
export function bauePhasenBaum(
  version: MappingVersion,
  vorkommen: ReadonlyMap<string, number>,
  wertSchluessel: (feldId: string, wert: string) => string,
  seedPhaseVon: (code: number) => string | null,
): PhasenBaum {
  const phasen = zahPhasenVon(version.zahPhasen);
  const bekannt = new Set(phasen.map(p => p.id));
  const zeilen = falteCodes(version, vorkommen, wertSchluessel);

  const kinderJePhase = new Map<string, string[]>(phasen.map(p => [p.id, []]));
  const ohnePhase: string[] = [];
  const items: Record<string, TfTreeItem<PhasenBaumKnoten>> = {};
  const summeJePhase = new Map<string, number>();
  let verwaiste = 0;

  for (const z of zeilen) {
    const gemeint = z.phase !== undefined ? z.phase : seedPhaseVon(z.code);
    // Verwaist heißt: die Fassung nennt eine Phase, die sie nicht mehr führt.
    // Angezeigt wird der Code dann unter „ohne Phase" — aber sichtbar markiert,
    // damit ihn niemand für einen gepflegten Marker hält.
    const verwaist = gemeint !== null && !bekannt.has(gemeint);
    if (verwaist) verwaiste++;
    const zielId = gemeint !== null && !verwaist ? gemeint : null;

    const id = codeKnotenId(z.code);
    items[id] = {
      id,
      name: z.label ?? z.wert,
      isFolder: false,
      data: {
        art: 'code',
        code: z.code,
        wert: z.wert,
        ...(z.label ? { label: z.label } : {}),
        wertIds: z.wertIds,
        zieltage: z.zieltage,
        vorkommen: z.vorkommen,
        verwaist,
      },
    };
    if (zielId === null) ohnePhase.push(id);
    else kinderJePhase.get(zielId)!.push(id);
    const schluessel = zielId ?? OHNE_PHASE_ID;
    summeJePhase.set(schluessel, (summeJePhase.get(schluessel) ?? 0) + z.vorkommen);
  }

  for (const p of phasen) {
    const kinder = kinderJePhase.get(p.id)!;
    items[p.id] = {
      id: p.id,
      name: p.label,
      // Auch eine leere Phase bleibt Ordner: sie ist ein gültiges Drop-Ziel.
      isFolder: true,
      children: kinder,
      data: {
        art: 'phase', phase: p,
        codeAnzahl: kinder.length,
        vorkommen: summeJePhase.get(p.id) ?? 0,
      },
    };
  }

  items[OHNE_PHASE_ID] = {
    id: OHNE_PHASE_ID,
    name: 'Ohne Phase',
    isFolder: true,
    children: ohnePhase,
    data: {
      art: 'ohne-phase',
      codeAnzahl: ohnePhase.length,
      vorkommen: summeJePhase.get(OHNE_PHASE_ID) ?? 0,
    },
  };

  items[WURZEL_ID] = {
    id: WURZEL_ID,
    name: 'Verfahrensschnitt',
    isFolder: true,
    // „Ohne Phase" steht am Ende — neben dem Verfahren, nicht darin.
    children: [...phasen.map(p => p.id), OHNE_PHASE_ID],
    data: { art: 'wurzel' },
  };

  return { items, rootId: WURZEL_ID, verwaiste };
}

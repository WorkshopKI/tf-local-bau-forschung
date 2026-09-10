/**
 * Fixtures für die Meilenstein-Bausteine des Ausklapp-Bereichs.
 *
 * Anker durchgehend der 05.01.2026 (ein Montag), wie in den Engine-Tests:
 * Woche 1 = 12.01., Woche 2 = 19.01., Woche 4 = 02.02.
 */
import type {
  MeilensteinKnoten, MstErgebnis, MstZustand, VerbundMeilensteine,
} from '@/core/meilensteine/typen';
import type { MeilensteinLage } from '@/plugins/antraege/ausklapp/meilensteinLage';

export const ANKER = '2026-01-05';

export function knoten(
  p: Partial<MeilensteinKnoten> & { id: string; nummer: string },
): MeilensteinKnoten {
  return {
    elternId: null,
    label: `Stufe ${p.nummer}`,
    sollWoche: 1,
    relevantFuerFrist: true,
    nurTypen: [],
    aktiv: true,
    bedingung: { einige: [] },
    sortierung: 10,
    ...p,
  };
}

export function ergebnis(
  knotenId: string, zustand: MstZustand, p: Partial<MstErgebnis> = {},
): MstErgebnis {
  return {
    knotenId, zustand, sollDatum: null, istDatum: null, abweichungTage: null, ...p,
  };
}

export function lageDa(
  knotenListe: MeilensteinKnoten[],
  ergebnisse: MstErgebnis[],
  p: Partial<VerbundMeilensteine> = {},
): MeilensteinLage {
  return {
    art: 'da',
    knoten: knotenListe,
    bewertung: {
      verbundId: 'VB-1',
      antragsdatum: ANKER,
      anker: ANKER,
      typ: null,
      wocheAktuell: 5,
      fristDatum: '2026-04-05',
      restTage: 40,
      ergebnisse,
      prognose: 'gefaehrdet',
      ...p,
    },
  };
}

/**
 * Ansichtszustand des Boards an EINER Stelle (v3.12).
 *
 * Bis v3.11 hielt die Seite sechs localStorage-Schlüssel mit je einer eigenen
 * try/catch-Ladefunktion — sechsmal dasselbe Muster, verteilt über achtzig
 * Zeilen Seitenkopf. Hier ist es ein Hook, und die Seite kümmert sich um
 * Darstellung.
 *
 * Alles hier ist gerätelokal und Komfort: schlägt localStorage fehl (privater
 * Modus, volle Quota), fällt jeder Wert still auf den Default zurück. Ein
 * kaputter Eintrag darf die Seite nie kippen.
 *
 * Bewusst NICHT persistiert: Smart View, Facetten und Suchtext. Die Seite soll
 * mit der Rollen-Startsicht aufmachen, nicht mit dem Filter von vorgestern.
 */
import { useCallback, useState } from 'react';
import { FEEDBACK_SORT_VALUES, type FeedbackSort } from '@/components/feedback/FeedbackSortSelect';
import {
  loadBoardKanbanConfig, saveBoardKanbanConfig, type BoardKanbanConfig,
} from '@/components/feedback/boardKanbanConfig';
import { istDichte, type Dichte } from './ticket/dichte';

export type Ansicht = 'board' | 'liste';

// Key-Bump `_v4` (v3.12): die Sortier-Werte heißen anders (`bewegt`/`stimmen`/
// `aufwand` sind neu) und der Default ist jetzt „Zuletzt bewegt". Ein alter
// `_v3`-Wert wäre entweder ungültig oder würde stillschweigend die frühere
// Ordnung erzwingen.
const KEY_ANSICHT = 'tf-feedback-board-view-v4';
const KEY_SORT = 'tf-feedback-board-sort-v4';
// `_v2`: aus zwei Dichte-Stufen sind drei geworden, und der alte Wert war ein
// boolesches 'dense'/'comfort'.
const KEY_DICHTE = 'tf-feedback-board-density-v2';
const KEY_FACETTEN = 'tf-feedback-board-facetten-v1';
const KEY_ROLLE_VORSCHAU = 'tf-feedback-board-nutzersicht-v1';
// Derselbe Key wie bisher — die Vorliebe zieht unverändert mit.
const KEY_ARCHIV = 'teamflow_feedback_show_archived';

function lies(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function schreib(key: string, wert: string): void {
  try { localStorage.setItem(key, wert); } catch { /* Komfort, kein Datenverlust */ }
}

export interface BoardAnsicht {
  ansicht: Ansicht;
  setAnsicht: (a: Ansicht) => void;
  sort: FeedbackSort;
  setSort: (s: FeedbackSort) => void;
  dichte: Dichte;
  setDichte: (d: Dichte) => void;
  facettenOffen: boolean;
  toggleFacetten: () => void;
  /** Verwalter schaut sich die Nutzer-Sicht an (Vorschau-Umschalter). */
  nutzerVorschau: boolean;
  setNutzerVorschau: (v: boolean) => void;
  zeigeArchiv: boolean;
  setZeigeArchiv: (v: boolean) => void;
  kanban: BoardKanbanConfig;
  setKanban: (c: BoardKanbanConfig) => void;
}

export function useBoardAnsicht(): BoardAnsicht {
  const [ansicht, setAnsichtState] = useState<Ansicht>(
    () => (lies(KEY_ANSICHT) === 'liste' ? 'liste' : 'board'),
  );
  const [sort, setSortState] = useState<FeedbackSort>(() => {
    const roh = lies(KEY_SORT);
    return roh && (FEEDBACK_SORT_VALUES as readonly string[]).includes(roh)
      ? (roh as FeedbackSort)
      : 'bewegt';
  });
  const [dichte, setDichteState] = useState<Dichte>(() => {
    const roh = lies(KEY_DICHTE);
    return istDichte(roh) ? roh : 'dicht';
  });
  const [facettenOffen, setFacetten] = useState<boolean>(() => lies(KEY_FACETTEN) !== '0');
  const [nutzerVorschau, setNutzerVorschauState] = useState<boolean>(
    () => lies(KEY_ROLLE_VORSCHAU) === '1',
  );
  const [zeigeArchiv, setZeigeArchivState] = useState<boolean>(() => lies(KEY_ARCHIV) === '1');
  const [kanban, setKanbanState] = useState<BoardKanbanConfig>(loadBoardKanbanConfig);

  const setAnsicht = useCallback((a: Ansicht) => { setAnsichtState(a); schreib(KEY_ANSICHT, a); }, []);
  const setSort = useCallback((s: FeedbackSort) => { setSortState(s); schreib(KEY_SORT, s); }, []);
  const setDichte = useCallback((d: Dichte) => { setDichteState(d); schreib(KEY_DICHTE, d); }, []);
  const toggleFacetten = useCallback(() => {
    setFacetten(v => { schreib(KEY_FACETTEN, v ? '0' : '1'); return !v; });
  }, []);
  const setNutzerVorschau = useCallback((v: boolean) => {
    setNutzerVorschauState(v); schreib(KEY_ROLLE_VORSCHAU, v ? '1' : '0');
  }, []);
  const setZeigeArchiv = useCallback((v: boolean) => {
    setZeigeArchivState(v); schreib(KEY_ARCHIV, v ? '1' : '0');
  }, []);
  const setKanban = useCallback((c: BoardKanbanConfig) => {
    setKanbanState(c); saveBoardKanbanConfig(c);
  }, []);

  return {
    ansicht, setAnsicht,
    sort, setSort,
    dichte, setDichte,
    facettenOffen, toggleFacetten,
    nutzerVorschau, setNutzerVorschau,
    zeigeArchiv, setZeigeArchiv,
    kanban, setKanban,
  };
}

/**
 * Das Anträge-Kanban im eigenen Fenster — alle Bahnen mit Karten, ungekappt.
 *
 * **Reine Props, keine App-Hooks.** Diese Komponente läuft in einer ZWEITEN
 * React-Wurzel (`components/fenster/appFenster.ts`), und dort gibt es weder
 * Router- noch Storage-Kontext: `useNavigation()` liefe ins Leere. Alles, was
 * nach draußen wirkt, kommt als Callback aus dem Widget.
 *
 * Unterschiede zur Widget-Fassung, alle aus dem Platz begründet:
 *  - `layout="gedeckelt"` statt `geteilt` — neun Bahnen à 228 px Boden passen in
 *    kein Fenster; die Spur scrollt waagerecht, dafür gibt es die Form.
 *  - `bahnScrollt` — die Bahn füllt die Höhe und scrollt ihren Inhalt selbst.
 *  - `nachladen` als DOM-Budget: „alle Anträge" heißt nicht „alle auf einmal in
 *    den Baum". Bei „Alle Bearbeiter" wären das sonst Tausende Knoten in einem
 *    Rutsch. Der Knopf verbirgt nichts, er beziffert den Rest.
 */
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn } from '@/components/kanban/tf-board-types';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { KATEGORIE_ICON } from './kanbanIcons';
import { KanbanKarteView } from './KanbanKarteView';
import { laneAccent, type KanbanKarte, type KanbanLaneDaten } from './kanbanLanes';
import type { KanbanWidgetConfig } from './types';
import './kanban-vollbild.css';

/** Startbudget je Bahn. 50 × 9 Bahnen = 450 Karten im Baum — reichlich für
 *  jeden realen Arbeitsvorrat und weit unter dem, was den Aufbau spürbar macht. */
const NACHLADEN = { start: 50, schritt: 100 } as const;

export interface KanbanVollbildProps {
  titel: string;
  /** Bearbeiter-Scope · Quelle · Filtername — dieselbe Zeile wie im Widget. */
  meta: string;
  lanes: KanbanLaneDaten[];
  gesamt: number;
  farbmodus: KanbanWidgetConfig['farbmodus'];
  /** Öffnet den Antrag in der App (im Opener-Fenster). */
  onOpenAntrag: (aktenzeichen: string) => void;
  /**
   * Gesetzt, sobald die Startseite verlassen wurde: das Fenster bekommt keine
   * neuen Daten mehr. Es sagt das, statt einen alten Stand als aktuellen
   * auszugeben — und verschwindet wieder, sobald die Startseite zurück ist.
   */
  verwaist?: boolean;
}

export function KanbanVollbild({
  titel, meta, lanes, gesamt, farbmodus, onOpenAntrag, verwaist,
}: KanbanVollbildProps): React.ReactElement {
  return (
    <div className="kv-seite">
      <header className="kv-kopf">
        <h1>{titel}</h1>
        <span className="kv-meta">{meta}</span>
        <span className="kv-zahl">
          {gesamt.toLocaleString('de-DE')} {gesamt === 1 ? 'Vorgang' : 'Vorgänge'}
        </span>
      </header>

      {verwaist ? (
        <p className="kv-verwaist">
          Die Startseite wurde verlassen — dieser Stand wird nicht mehr
          aktualisiert. Zurück auf die Startseite, und das Fenster läuft weiter.
        </p>
      ) : null}

      {lanes.length === 0 ? (
        <p className="kv-leer">Keine Anträge in der aktuellen Datenbasis.</p>
      ) : (
        <TfBoard
          className="kv-board"
          label="Anträge nach Status-Kategorie"
          layout="gedeckelt"
          features={{ einklappbar: true, bahnScrollt: true }}
          nachladen={NACHLADEN}
          bahnen={lanes.map((lane, i): TfBoardBahn<KanbanKarte> => ({
            key: lane.kategorie,
            label: getStatusCategoryLabel(lane.kategorie),
            icon: KATEGORIE_ICON[lane.kategorie],
            accent: laneAccent(farbmodus, lane.kategorie, i),
            items: lane.karten,
            gesamt: lane.gesamt,
            spalten: lane.spalten,
          }))}
          renderCard={k => (
            <KanbanKarteView
              key={k.aktenzeichen}
              karte={k}
              onOpen={() => onOpenAntrag(k.aktenzeichen)}
            />
          )}
        />
      )}
    </div>
  );
}

/**
 * Das Anträge-Kanban im eigenen Fenster — mit einer EIGENEN Bahnen-Anordnung.
 *
 * **Reine Props, keine App-Hooks.** Diese Komponente läuft in einer ZWEITEN
 * React-Wurzel (`components/fenster/appFenster.ts`), und dort gibt es weder
 * Router- noch Storage-Kontext: `useNavigation()` liefe ins Leere. Alles, was
 * nach draußen wirkt, kommt als Callback aus dem Widget.
 *
 * **Warum das Fenster selbst projiziert** (v4.26): Bis dahin rechnete das Widget
 * die Bahnen aus und schickte sie fertig herüber. Sobald die Einstellung im
 * Fenster wirkt, trägt das nicht mehr — eine wieder eingeblendete Bahn braucht
 * ihre Karten auch dann, wenn die Startseite längst ausgehängt ist (ein
 * Karten-Klick tut genau das, siehe `verwaist`). Das Widget liefert deshalb die
 * DATEN (`kartenProKategorie`), die Anordnung liegt hier.
 *
 * Unterschiede zur Widget-Fassung, alle aus dem Platz begründet:
 *  - `layout="gedeckelt"` statt `geteilt` — neun Bahnen à 228 px Boden passen in
 *    kein Fenster; die Spur scrollt waagerecht, dafür gibt es die Form.
 *  - `bahnScrollt` — die Bahn füllt die Höhe und scrollt ihren Inhalt selbst.
 *  - `nachladen` als DOM-Budget: „alle Anträge" heißt nicht „alle auf einmal in
 *    den Baum". Bei „Alle Bearbeiter" wären das sonst Tausende Knoten in einem
 *    Rutsch. Der Knopf verbirgt nichts, er beziffert den Rest.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { TfBoard } from '@/components/kanban/TfBoard';
import type { TfBoardBahn } from '@/components/kanban/tf-board-types';
import {
  eingeklappteBahnen,
  wunschAusEingeklappten,
  type TfBahnWuensche,
} from '@/components/kanban/tfBoardBahn';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { KATEGORIE_ICON } from './kanbanIcons';
import { KanbanKarteView } from './KanbanKarteView';
import {
  laneAccent,
  projiziereVollbildLanes,
  type KanbanKarte,
  type KartenProKategorie,
} from './kanbanLanes';
import { VollbildEinstellungen } from './VollbildEinstellungen';
import type { KanbanWidgetConfig, VollbildLane } from './types';
import './kanban-vollbild.css';

/** Startbudget je Bahn. 50 × 9 Bahnen = 450 Karten im Baum — reichlich für
 *  jeden realen Arbeitsvorrat und weit unter dem, was den Aufbau spürbar macht. */
const NACHLADEN = { start: 50, schritt: 100 } as const;

export interface KanbanVollbildProps {
  titel: string;
  /** Bearbeiter-Scope · Quelle · Filtername — dieselbe Zeile wie im Widget. */
  meta: string;
  /** Die Karten ALLER Kategorien — auch der gerade ausgeblendeten. Nur so kann
   *  eine Bahn hier wieder eingeblendet werden, ohne die Startseite zu fragen. */
  karten: KartenProKategorie;
  /**
   * Die Bahnen-Anordnung beim Öffnen (gespeicherter Stand oder Startvorschlag).
   * Wird NUR beim Aufbau gelesen: von da an gehört sie dem Fenster — sonst
   * überschriebe ein Nachzeichnen aus der Startseite gerade das, was man eben
   * eingestellt hat.
   */
  lanesInitial: VollbildLane[];
  /** Meldet die neue Anordnung nach oben (dort wird sie persistiert). */
  onLanes?: (lanes: VollbildLane[]) => void;
  /** Frisch gerechneter Startvorschlag für „Zurücksetzen"; fehlt er, gibt es den
   *  Knopf nicht (das Widget ist weg und kann keinen rechnen). */
  seed?: VollbildLane[];
  farbmodus: KanbanWidgetConfig['farbmodus'];
  onFarbmodus?: (farbmodus: KanbanWidgetConfig['farbmodus']) => void;
  /** Öffnet den Antrag in der App (im Opener-Fenster). */
  onOpenAntrag: (aktenzeichen: string) => void;
  /**
   * Beim Öffnen eingeklappte Bahnen (aus der Widget-Config). Wird NUR beim
   * Aufbau gelesen: von da an gehört der Zustand dem Fenster — sonst überschriebe
   * ein Nachzeichnen aus der Startseite gerade das, was man eben geklickt hat.
   */
  eingeklappt?: readonly string[];
  /** Meldet den neuen Stand nach oben (dort wird er geprüft und persistiert). */
  onEinklapp?: (bahnen: string[]) => void;
  /**
   * Gesetzt, sobald die Startseite verlassen wurde: das Fenster bekommt keine
   * neuen Daten mehr. Es sagt das, statt einen alten Stand als aktuellen
   * auszugeben — und verschwindet wieder, sobald die Startseite zurück ist.
   */
  verwaist?: boolean;
}

export function KanbanVollbild({
  titel, meta, karten, farbmodus, onFarbmodus, onOpenAntrag,
  lanesInitial, onLanes, seed, eingeklappt, onEinklapp, verwaist,
}: KanbanVollbildProps): React.ReactElement {
  // Der Einklapp-Zustand lebt HIER und nicht im Widget: ein Klick auf eine Karte
  // hängt die Startseite aus, und ab da zeichnet niemand mehr nach. Läge der
  // Zustand drüben, ließe sich danach keine Bahn mehr klappen.
  const [wuensche, setWuensche] = useState<TfBahnWuensche>(
    () => wunschAusEingeklappten(eingeklappt ?? []),
  );
  // Aus demselben Grund gehört die Anordnung dem Fenster — und aus einem
  // zweiten: sie wirkt sofort, statt auf den Rückweg über die Persistenz und ein
  // Nachzeichnen aus dem Widget zu warten.
  const [bahnenConfig, setBahnenConfig] = useState<VollbildLane[]>(lanesInitial);
  const setzeBahnen = (next: VollbildLane[]): void => {
    setBahnenConfig(next);
    onLanes?.(next);
  };
  const { lanes, gesamt } = useMemo(
    () => projiziereVollbildLanes(karten, bahnenConfig),
    [karten, bahnenConfig],
  );
  const [zeigeEinstellungen, setZeigeEinstellungen] = useState(false);
  const seite = useRef<HTMLDivElement>(null);

  // `Escape` schließt sonst das GANZE Fenster (Zuhörer am Dokument, gesetzt in
  // `appFenster`). Steht das Panel offen, ist es gemeint.
  //
  // Warum am Dokument und in der EINFANG-Phase statt als `onKeyDown` am Rahmen:
  // React hängt seine Zuhörer an den Wurzel-Container, und ein Tastendruck ohne
  // Fokus im Baum landet bei `<body>` — er käme dort nie an (gemessen: das
  // Fenster ging zu). Die Einfang-Phase läuft vor jedem Blasen-Zuhörer, also
  // auch vor dem des Fensters. `ownerDocument`, weil `document` in diesem Modul
  // das HAUPTdokument meint, nicht das des Fensters.
  useEffect(() => {
    if (!zeigeEinstellungen) return;
    const doc = seite.current?.ownerDocument;
    if (!doc) return;
    const fange = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setZeigeEinstellungen(false);
    };
    doc.addEventListener('keydown', fange, true);
    return () => doc.removeEventListener('keydown', fange, true);
  }, [zeigeEinstellungen]);

  return (
    <div className="kv-seite" ref={seite}>
      <header className="kv-kopf">
        <h1>{titel}</h1>
        <span className="kv-meta">{meta}</span>
        <span className="kv-zahl">
          {gesamt.toLocaleString('de-DE')} {gesamt === 1 ? 'Vorgang' : 'Vorgänge'}
        </span>
        <button
          type="button"
          className="kv-zahnrad"
          aria-expanded={zeigeEinstellungen}
          aria-label="Bahnen dieses Fensters einstellen"
          title="Bahnen dieses Fensters einstellen"
          onClick={() => setZeigeEinstellungen(o => !o)}
        >
          <Settings2 size={14} strokeWidth={1.75} />
        </button>
      </header>

      {zeigeEinstellungen ? (
        <div className="kv-einst" role="dialog" aria-label="Einstellungen dieses Fensters">
          <div className="kv-einst-kopf">
            <span>Kanban-Einstellungen</span>
            <button
              type="button"
              aria-label="Einstellungen schließen"
              onClick={() => setZeigeEinstellungen(false)}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
          <VollbildEinstellungen
            lanes={bahnenConfig}
            onLanes={setzeBahnen}
            seed={seed}
            farbmodus={farbmodus}
            onFarbmodus={m => onFarbmodus?.(m)}
          />
        </div>
      ) : null}

      {verwaist ? (
        <p className="kv-verwaist">
          Die Startseite wurde verlassen — dieser Stand wird nicht mehr
          aktualisiert. Zurück auf die Startseite, und das Fenster läuft weiter.
        </p>
      ) : null}

      {/* Zwei verschiedene Leeren, zwei verschiedene Sätze: alles abgewählt ist
          eine Einstellung (mit einem Weg zurück), keine Anträge ist eine Datenlage. */}
      {lanes.length === 0 ? (
        <p className="kv-leer">
          Alle Bahnen sind ausgeblendet — im Zahnrad oben rechts wieder einblenden.
        </p>
      ) : gesamt === 0 ? (
        <p className="kv-leer">Keine Anträge in der aktuellen Datenbasis.</p>
      ) : (
        <TfBoard
          className="kv-board"
          label="Anträge nach Status-Kategorie"
          layout="gedeckelt"
          features={{ einklappbar: true, bahnScrollt: true }}
          einklapp={{
            wuensche,
            onWunsch: (key, wunsch) => {
              const naechste: TfBahnWuensche = { ...wuensche, [key]: wunsch };
              setWuensche(naechste);
              onEinklapp?.(eingeklappteBahnen(naechste));
            },
          }}
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

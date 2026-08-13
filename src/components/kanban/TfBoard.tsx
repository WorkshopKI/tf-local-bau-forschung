/**
 * Das Board-Primitiv der App — die einzige Stelle, an der eine Kanban-Bahn
 * entsteht (Guard `no-parallel-board-geometry`).
 *
 * Es gab dieses Bauteil schon einmal: `KanbanBoard.tsx` wurde mit v2.228 aus dem
 * Feedback-Kanban extrahiert und war von beiden Seiten genutzt. Mit v3.17 baute
 * das Feedback-Board sein Lane-Layout in CSS nach; danach standen dieselben
 * Zahlen zweimal in zwei Sprachen (46 vs. 44 px Schiene), die „+ N weitere"-
 * Fußzeile dreimal, und der 1|2-Spalten-Schalter des Boards war ein totes
 * Versprechen: angeboten, persistiert, durchgereicht, nie gelesen. `TfBoard`
 * führt beide Fassungen zusammen.
 *
 * Aufbau nach dem Muster von `TfTree`:
 *  - Der Aufrufer reicht Bahnen mit `key`/`label`/`accent`/`items` herein und
 *    bekommt Geometrie, Schmalschiene, Einklappen, Kappung und die Drop-Naht.
 *  - Fähigkeiten sind Feature-Flags, und es steht nur drin, was verdrahtet ist.
 *  - Karten-Inhalt kommt über `renderCard`; das Primitiv schreibt keiner Karte
 *    vor, wie sie aussieht.
 *  - Die Fallen des HTML5-Ziehens (preventDefault, dropEffect, dragleave je
 *    Kind, aufsteigende dragstart/dragend) sind hier EINMAL erledigt statt je
 *    Aufrufer — und `zieh` ist opak, damit ein späterer Bibliotheks-Einzug
 *    (Touch, Tastatur, Auto-Scroll) keinen Aufrufer anfasst.
 *
 * Was das Primitiv NICHT tut: persistieren, sortieren, bucketen, Status kennen.
 */
import { useEffect, useState } from 'react';
import { bahnAnsicht, istSchiene, type TfBahnWunsch } from './tfBoardBahn';
import type {
  TfBoardBahn,
  TfBoardDnd,
  TfBoardEinklapp,
  TfBoardFeatures,
  TfBoardNachladen,
  TfBoardProps,
  TfBoardZiehProps,
} from './tf-board-types';
import './tf-board.css';

/** Stabile Identität, damit ein `renderCard` ohne Ziehen nicht bei jedem Rendern
 *  ein neues Objekt gespreizt bekommt. */
const OHNE_ZIEHEN: TfBoardZiehProps = Object.freeze({});

export function TfBoard<T>({
  bahnen,
  renderCard,
  label,
  layout = 'gedeckelt',
  features,
  einklapp,
  nachladen,
  dnd,
  className,
}: TfBoardProps<T>): React.ReactElement {
  // Ein Ziehen irgendwo im Board faltet die Schienen auf. `dragstart` und
  // `dragend` steigen auf — der Zustand gehört deshalb hierher und nicht in
  // jede einzelne Karte.
  const [zieht, setZieht] = useState(false);
  const klassen = [
    'tf-board',
    layout === 'geteilt' ? 'geteilt' : '',
    features?.bahnScrollt ? 'scrollt' : '',
    zieht ? 'zieht' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={klassen}
      role="group"
      aria-label={label}
      onDragStart={dnd ? () => setZieht(true) : undefined}
      onDragEnd={dnd ? () => setZieht(false) : undefined}
      onDrop={dnd ? () => setZieht(false) : undefined}
    >
      {bahnen.map(bahn => (
        <Bahn
          key={bahn.key}
          bahn={bahn}
          features={features}
          einklapp={einklapp}
          nachladen={nachladen}
          dnd={dnd}
          renderCard={renderCard}
        />
      ))}
    </div>
  );
}

function Bahn<T>({ bahn, features, einklapp, nachladen, dnd, renderCard }: {
  bahn: TfBoardBahn<T>;
  features: TfBoardFeatures | undefined;
  einklapp: TfBoardEinklapp | undefined;
  nachladen: TfBoardNachladen | undefined;
  dnd: TfBoardDnd<T> | undefined;
  renderCard: TfBoardProps<T>['renderCard'];
}): React.ReactElement {
  const [limit, setLimit] = useState(nachladen?.start ?? 0);
  const [ueber, setUeber] = useState(false);
  // Gesteuert ODER selbst gehalten — der lokale Zustand bleibt bestehen, damit
  // die Naht optional bleibt (und die Hook-Reihenfolge unabhängig von der Prop).
  const [eigenerWunsch, setEigenenWunsch] = useState<TfBahnWunsch>('auto');
  const wunsch = einklapp ? (einklapp.wuensche[bahn.key] ?? 'auto') : eigenerWunsch;
  const setWunsch = (w: TfBahnWunsch): void => {
    if (einklapp) einklapp.onWunsch(bahn.key, w);
    else setEigenenWunsch(w);
  };

  const bestand = bahn.items.length;
  // Beim Wechsel der Sicht/Filter wieder oben anfangen — sonst zeigt eine frisch
  // gefilterte Bahn mit drei Treffern noch das aufgeklappte Limit von vorhin.
  const start = nachladen?.start ?? 0;
  useEffect(() => { setLimit(start); }, [bestand, start]);

  const einklappbar = features?.einklappbar ?? false;
  const anzahl = bahn.gesamt ?? bestand;
  // Eine Bahn mit Fußzeile ist nie „leer": im Widget hängt dort der Weg zur
  // vollen Liste, und der verschwände mit der Schiene.
  const leer = bestand === 0 && !bahn.fuss;
  const ansicht = bahnAnsicht({
    leer,
    unerreichbar: !!bahn.unerreichbar,
    wunsch: einklappbar ? wunsch : 'auto',
  });
  const schiene = istSchiene(ansicht);
  const zu = ansicht === 'voll-schiene';

  const sichtbar = nachladen ? bahn.items.slice(0, limit) : bahn.items;
  const rest = nachladen ? bestand - limit : 0;

  // Klick auf die Schiene: die von Hand eingeklappte Bahn geht zurück auf
  // Automatik, die erreichbar-leere klappt auf, und die unerreichbare wechselt
  // in eine Sicht, die ihren Inhalt zeigt — das ist die Frage, die sie auslöst.
  const beiSchienenKlick = bahn.unerreichbar
    ? bahn.unerreichbar.onKlick
    : (einklappbar ? (): void => setWunsch(zu ? 'auto' : 'offen') : undefined);

  // Was die Schiene über sich sagt: die unerreichbare nennt die Sicht, die
  // eingeklappte und die leere nennen den Ausweg. Die Zahl steht sichtbar
  // daneben und wird im Titel nicht wiederholt.
  let schienenTitel = bahn.leerTitel ?? `${bahn.label} — leer`;
  if (bahn.unerreichbar) schienenTitel = bahn.unerreichbar.titel;
  else if (zu) schienenTitel = `${bahn.label} — eingeklappt, zum Aufklappen klicken`;
  else if (einklappbar) schienenTitel = `${bahn.label} — leer, zum Aufklappen klicken`;

  const bedienbar = schiene && !!beiSchienenKlick;
  const Icon = bahn.icon;
  const kopfInhalt = (
    <>
      {Icon
        ? <Icon size={18} strokeWidth={1.5} className="tfb-icon" />
        : <span className="tfb-punkt" aria-hidden />}
      <span className="tfb-nm" title={bahn.label}>{bahn.label}</span>
      <span className="tfb-n">{anzahl}</span>
    </>
  );

  const zieh = (item: T): TfBoardZiehProps => {
    if (!dnd) return OHNE_ZIEHEN;
    const id = dnd.idOf(item);
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
      },
    };
  };

  const klassen = [
    'tfb-bahn',
    schiene ? 'schmal' : '',
    zu ? 'zu' : '',
    bahn.unerreichbar ? 'ausserhalb' : '',
    ueber ? 'ueber' : '',
    (bahn.spalten ?? 1) === 2 ? 'zwei' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={klassen}
      style={{ '--tfb-c': bahn.accent } as React.CSSProperties}
      role={bedienbar ? 'button' : undefined}
      tabIndex={bedienbar ? 0 : undefined}
      title={schiene ? schienenTitel : undefined}
      onClick={bedienbar ? beiSchienenKlick : undefined}
      onKeyDown={bedienbar
        ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beiSchienenKlick?.(); } }
        : undefined}
      onDragOver={dnd
        ? e => {
          // Ohne preventDefault lehnt der Browser den Drop ab — das ist die
          // Zusage „hier darf abgelegt werden", nicht bloß Kosmetik.
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setUeber(true);
        }
        : undefined}
      onDragLeave={dnd
        ? e => {
          // Nur reagieren, wenn der Zeiger die Bahn wirklich verlässt: das
          // Überfahren einer Karte darin feuert sonst ein dragleave je Kind.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setUeber(false);
        }
        : undefined}
      onDrop={dnd
        ? e => {
          e.preventDefault();
          setUeber(false);
          const id = e.dataTransfer.getData('text/plain');
          if (id) dnd.onDrop(id, bahn.key);
        }
        : undefined}
    >
      {/* Die Schiene sitzt im SELBEN Knoten wie die volle Bahn — sonst hinge das
          Drop-Ziel an zwei Stellen und liefe auseinander. */}
      {schiene && (
        <span className="tfb-schiene">
          {Icon
            ? <Icon size={14} strokeWidth={1.5} className="tfb-icon" />
            : <span className="tfb-punkt" aria-hidden />}
          {bahn.label}
          {/* Kein „0" an der unerreichbaren Bahn: die Zahl beantwortete die
              Frage „wie viele sind es?" mit der Antwort auf eine andere. Die von
              Hand eingeklappte Bahn trägt hier ihren echten Bestand — schmal
              heißt nicht leer. */}
          {bahn.unerreichbar
            ? <span className="tfb-aus">{bahn.unerreichbar.hinweis}</span>
            : <span className="tfb-n">{anzahl}</span>}
        </span>
      )}

      {/* Der Kopf IST der Einklapp-Schalter, wo es einen gibt: ein Ziel statt
          eines zusätzlichen Knopfs neben der Zahl, und dieselbe Geste wie auf
          der Schiene — dort klickt man die ganze Fläche, hier die ganze Zeile. */}
      {!schiene && (einklappbar ? (
        <button
          type="button"
          className="tfb-kopf schalter"
          title={`${bahn.label} — einklappen`}
          onClick={() => setWunsch('zu')}
        >
          {kopfInhalt}
        </button>
      ) : (
        <div className="tfb-kopf">{kopfInhalt}</div>
      ))}

      {!schiene && bahn.zusatz ? <div className="tfb-zusatz">{bahn.zusatz}</div> : null}

      <div className="tfb-karten">
        {/* Nur die von Hand aufgeklappte leere Bahn kommt hier an — und sie ist
            die einzige, aus der ohne diesen Knopf kein Weg zurückführt. */}
        {ansicht === 'leer-offen' && (
          <button
            type="button"
            className="tfb-leer"
            title={`${bahn.label} — leer, zum Einklappen klicken`}
            onClick={() => setWunsch('auto')}
          >
            leer — einklappen
          </button>
        )}
        {/* Auf der Schiene bleiben die Karten aus dem DOM — sonst stünden bei
            einer eingeklappten Bahn 15 Karten in 44px Breite. */}
        {!schiene && sichtbar.map(item => renderCard(item, bahn, zieh(item)))}
      </div>

      {!schiene && (nachladen && rest > 0 ? (
        <button
          type="button"
          className="tfb-fuss"
          onClick={() => setLimit(l => l + nachladen.schritt)}
        >
          + {rest} weitere
        </button>
      ) : bahn.fuss)}
    </div>
  );
}

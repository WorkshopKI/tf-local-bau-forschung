/**
 * Die Kanban-Einstellungen IM eigenen Fenster — dasselbe Formular wie auf der
 * Startseite, nicht dessen Zwilling.
 *
 * Zwei Dinge macht diese Hülle, und nur die:
 *
 * 1. **Sie reicht den Storage-Kontext nach.** Der zweite React-Baum hängt an
 *    einer eigenen Wurzel (`components/fenster/appFenster.ts`) und sieht die
 *    Provider der App nicht — `useStorage()` fände dort nichts und würfe.
 *    `StorageService` kommt deshalb als schlichter Wert aus dem Widget herein und
 *    wird hier neu bereitgestellt. Das geht, weil beide Bäume im SELBEN Realm
 *    laufen: es ist dasselbe React-Modul und damit dasselbe Kontext-Objekt.
 * 2. **Sie liest die Instanz aus dem Store statt aus einer Prop.** Zustand-Stores
 *    brauchen keinen Kontext, also ist das Formular hier von sich aus lebendig —
 *    auch dann noch, wenn die Startseite längst ausgehängt ist und das Fenster
 *    keine neuen Daten mehr bekommt (siehe `verwaist` in `KanbanVollbild`).
 *
 * Was hier NICHT steht: eine zweite Fassung der Regler. `WidgetConfigForm` ist
 * die eine Wahrheit für Startseiten-Menü, Einstellungs-Sektion und dieses
 * Fenster.
 */
import { StorageContext } from '@/core/hooks/useStorage';
import type { StorageService } from '@/core/services/storage';
import { useHomeWidgets } from './useHomeWidgets';
import { WidgetConfigForm } from './WidgetConfigForm';

export function VollbildEinstellungen({ instanzId, storage }: {
  instanzId: string;
  storage: StorageService;
}): React.ReactElement {
  return (
    <StorageContext.Provider value={storage}>
      <Formular instanzId={instanzId} />
    </StorageContext.Provider>
  );
}

/** Eigene Komponente, weil `useHomeWidgets` seinerseits `useStorage()` ruft —
 *  der Provider muss ÜBER dem Hook stehen, nicht daneben. */
function Formular({ instanzId }: { instanzId: string }): React.ReactElement {
  const api = useHomeWidgets();
  const instanz = api.alleInstanzen.find(w => w.id === instanzId);

  if (!instanz) {
    return (
      <p className="kv-einst-hinweis">
        Dieses Widget gibt es nicht mehr — die Einstellungen sind damit gegenstandslos.
      </p>
    );
  }

  return (
    <>
      <WidgetConfigForm
        instanz={instanz}
        // Bewusst der Popover-Umfang (Bahnen + Farben) und nicht der volle:
        // „Quelle" und „Datenbasis" hängen an einem Radix-`Select`, dessen Liste
        // in den Body des HAUPTfensters portaliert würde — sie erschiene hinter
        // dem Fenster, in dem man sie geöffnet hat.
        kontext="popover"
        onUpdateConfig={cfg => api.updateConfig(instanzId, cfg)}
      />
      {/* Was hier wirkt und was nicht — ohne den Satz sähe die Spaltenzahl aus
          wie ein Schalter, der in diesem Fenster nichts tut. */}
      <p className="kv-einst-hinweis">
        Die Auswahl gilt dem Widget auf der Startseite. In diesem Fenster stehen
        <strong> alle </strong>
        Bahnen mit Karten — die gewählten zuerst —, und ob eine Bahn zwei Spalten
        bekommt, entscheidet ihr Bestand. Die Farben wirken hier sofort.
      </p>
    </>
  );
}

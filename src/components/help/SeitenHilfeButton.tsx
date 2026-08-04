/**
 * „Hilfe"-Knopf für den Seitenkopf: zeigt das Bildschirmseiten-Kontext-Doc der
 * Seite als Kurzanleitung — für alle, die nachlesen statt fragen wollen.
 *
 * Einbau je Seite eine Zeile:
 *   <PageHeader … actions={<SeitenHilfeButton pluginId="meilensteine" />} />
 *
 * Fehlt ein Doc (oder bleibt nach dem Technik-Strip nichts übrig), rendert die
 * Komponente NICHTS — kein toter Knopf. Inhalt + Strip-Regeln: screenContext.ts.
 *
 * Der Dialog bündelt alles, was die App erklärt oder korrigiert — verteilt auf zwei
 * Zeilen, weil die drei Wege verschieden dringlich sind:
 *  - KOPFZEILE (neben dem Titel): „Einführungs-Tour" startet die App-Tour (bis v2.359
 *    ein eigener Knopf in der Sidebar-Fußzeile; die vertagten Seiten-Touren hängen
 *    später an derselben Stelle — ein Einstiegspunkt statt zweier) und „Über die App"
 *    öffnet Überblick + Version + Änderungsliste. Beide standen bis v2.369 unten
 *    rechts: bei einem `h-[92vh]`-Dialog also unter einer Textwand am Bildschirmrand,
 *    wo sie niemand suchte. Wege, die man beim LESEN sieht, gehören nach oben.
 *  - FUSSZEILE: „Text stimmt nicht" öffnet das Feedback-Panel mit vorgewähltem Typ +
 *    Titel. Der Coverage-Guard erzwingt die EXISTENZ eines Docs, nicht seine
 *    Aktualität — Drift fällt nur auf, wenn Lesende sie melden, und das darf kein
 *    Suchspiel sein. Bleibt unten: sie beurteilt den gelesenen Text.
 */

import { useMemo, useState } from 'react';
import { BookOpen, Compass, HelpCircle, MessageSquarePlus, PanelRight } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Tooltip } from '@/components/ui/Tooltip';
import { getSeitenHilfe } from '@/core/services/feedback/screenContext';
import { oeffneHilfeFenster } from '@/components/help/hilfeFenster';
import { useTourContext } from '@/core/hooks/useTour';
import { useUeberAppDialog } from '@/core/components/changelog/useUeberAppDialog';
// Direkt am Quellmodul statt am Feedback-Barrel: das Barrel zieht `FeedbackPanel`
// mit, und das lädt `@/plugins.config` — die Plugin-Liste führt zurück auf jede
// Seite, die diesen Knopf einbaut (Laufzeit-Zyklus).
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';

/** `FeedbackItem.title` ist auf 90 Zeichen begrenzt (siehe FeedbackInputStep). */
const MAX_TITEL = 90;

const FENSTER_DETAIL =
  'Öffnet dieselbe Anleitung als eigenes Fenster, das Sie neben die App stellen können — ' +
  'so lesen Sie mit und probieren die Schritte direkt aus, statt den Dialog dafür zu ' +
  'schließen. Das Fenster läuft beim Seitenwechsel mit und lässt sich festhalten.';

const TOUR_DETAIL =
  'Die Einführungs-Tour zeigt den Rahmen der App — Startseite, Navigation, Suche, ' +
  'Vorgangsliste. Touren durch die einzelnen Seiten kommen, sobald sich die Seiten ' +
  'nicht mehr laufend ändern: eine Tour hält die Reihenfolge der Klicks fest und ' +
  'veraltet sonst schneller, als sie geschrieben ist. Bis dahin ist dieser Text die ' +
  'Anleitung.';

export function SeitenHilfeButton({ pluginId }: { pluginId: string }): React.ReactElement | null {
  const hilfe = useMemo(() => getSeitenHilfe(pluginId), [pluginId]);
  const tour = useTourContext();
  const ueberAppOeffnen = useUeberAppDialog(s => s.openDialog);
  const [offen, setOffen] = useState(false);
  const [fensterBlockiert, setFensterBlockiert] = useState(false);

  // Hooks stehen VOR dem Early-Return — sonst kippt die Hook-Reihenfolge (React #310).
  if (hilfe === null) return null;

  const titel = hilfe.titel !== '' ? hilfe.titel : 'Hilfe';
  // Der Puls-Punkt hing bis v2.359 an „Neu hier?" in der Fußzeile. Nur auf der
  // Startseite, sonst blinkte er auf jeder Seite der App.
  const tourAnbieten = pluginId === 'home' && !tour.hasCompleted;
  // Der Punkt allein sagte nicht, wofür er blinkt: er ist `aria-hidden`, hatte
  // keinen Tooltip, und der Knopf versprach nur eine Kurzanleitung. Die Tour lag
  // damit zwei Klicks tief hinter einem Wort, das sie nicht nennt (v2.372.4).
  const knopfTitel = tourAnbieten
    ? 'Kurzanleitung zu dieser Seite — und die Einführungs-Tour, die Sie noch nicht gemacht haben'
    : 'Kurzanleitung zu dieser Seite';

  /** Dialog zu, Feedback auf — mit Typ „Problem" und fertiger Überschrift. */
  const melden = (): void => {
    setOffen(false);
    useFeedbackDialog.getState().openDialog({
      vorbelegung: {
        kategorie: 'problem',
        titel: `Hilfetext „${titel}" stimmt nicht`.slice(0, MAX_TITEL),
      },
    });
  };

  /** Erst schließen, dann starten: das Tour-Overlay darf nicht gegen den Dialog arbeiten. */
  const tourStarten = (): void => {
    setOffen(false);
    tour.start();
  };

  /**
   * SYNCHRON — kein `await`, kein `useAsyncAction`: `window.open` überlebt nur
   * innerhalb der User-Geste, alles danach fängt der Popup-Blocker (vgl.
   * services/ai/connect-ki.ts). Blockiert der Browser trotzdem, bleibt der
   * Dialog offen und sagt es; der Nutzer verliert den Text nicht.
   */
  const fensterOeffnen = (): void => {
    if (oeffneHilfeFenster(pluginId, titel)) {
      setFensterBlockiert(false);
      setOffen(false);
      return;
    }
    setFensterBlockiert(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={HelpCircle}
        onClick={() => setOffen(true)}
        title={knopfTitel}
      >
        Hilfe
        {tourAnbieten && (
          <>
            <span
              aria-hidden="true"
              className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse"
            />
            {/* Der Punkt ist rein visuell — ohne diesen Text hört eine
                Screenreader-Nutzerin nichts von der offenen Tour. */}
            <span className="sr-only">Einführungs-Tour noch offen</span>
          </>
        )}
      </Button>
      <Dialog
        open={offen}
        onClose={() => setOffen(false)}
        title={titel}
        description="Kurzanleitung zu dieser Seite"
        // Breit + fast bildschirmhoch, damit die Seite ohne Scrollen lesbar ist.
        // `center` statt `top`: bei dieser Höhe bleiben oben und unten je ~4vh —
        // näher am oberen Rand als das feste `pt-[8vh]` von `align="top"`.
        // Bewusst NICHT `resizable`: eine gemerkte (kleinere) Größe würde die
        // Höhe hier dauerhaft überstimmen.
        size="xl"
        className="h-[92vh]"
        headerActions={
          <>
            <Tooltip text={FENSTER_DETAIL} maxWidth={340} wrapperClassName="flex items-center">
              <Button variant="ghost" size="sm" icon={PanelRight} onClick={fensterOeffnen}>
                Eigenes Fenster
              </Button>
            </Tooltip>
            {/* Der Erklärtext hängt am Knopf selbst statt an einem ⓘ daneben: das
                Icon war ein zweites Ziel für dieselbe Auskunft und hat die Zeile
                nur verlängert. */}
            <Tooltip text={TOUR_DETAIL} maxWidth={340} wrapperClassName="flex items-center">
              <Button variant="ghost" size="sm" icon={Compass} onClick={tourStarten}>
                Einführungs-Tour
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              icon={BookOpen}
              onClick={() => { setOffen(false); ueberAppOeffnen(); }}
            >
              Über die App
            </Button>
          </>
        }
        footer={
          // `w-full` gegen das `justify-end` der Dialog-Fußzeile: der einzelne Knopf
          // bleibt links, wo er bis v2.368 auch stand.
          <div className="flex w-full items-center">
            <Button variant="secondary" size="sm" icon={MessageSquarePlus} onClick={melden}>
              Text stimmt nicht
            </Button>
          </div>
        }
      >
        {fensterBlockiert && (
          <Alert variant="warning" className="mb-3">
            Der Browser hat das eigene Fenster blockiert. Rechts in der Adressleiste
            erscheint ein Symbol für blockierte Pop-ups — dort „Pop-ups von dieser Seite
            immer zulassen" wählen und erneut klicken. Bis dahin bleibt die Anleitung hier
            im Dialog lesbar.
          </Alert>
        )}
        <MarkdownRenderer content={hilfe.markdown} />
      </Dialog>
    </>
  );
}

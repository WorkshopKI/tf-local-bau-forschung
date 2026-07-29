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
 * Die Fußzeile bündelt alles, was die App erklärt oder korrigiert:
 *  - „Text stimmt nicht" öffnet das Feedback-Panel mit vorgewähltem Typ + Titel.
 *    Der Coverage-Guard erzwingt die EXISTENZ eines Docs, nicht seine Aktualität —
 *    Drift fällt nur auf, wenn Lesende sie melden, und das darf kein Suchspiel sein.
 *  - „Einführungs-Tour" startet die App-Tour (bis v2.359 ein eigener Knopf in der
 *    Sidebar-Fußzeile). Hier, weil die vertagten Seiten-Touren später an derselben
 *    Stelle hängen — ein Einstiegspunkt statt zweier.
 *  - „Über die App" öffnet Überblick + Version + Änderungsliste.
 */

import { useMemo, useState } from 'react';
import { HelpCircle, Info, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Tooltip } from '@/components/ui/Tooltip';
import { getSeitenHilfe } from '@/core/services/feedback/screenContext';
import { useTourContext } from '@/core/hooks/useTour';
import { useUeberAppDialog } from '@/core/components/changelog/useUeberAppDialog';
// Direkt am Quellmodul statt am Feedback-Barrel: das Barrel zieht `FeedbackPanel`
// mit, und das lädt `@/plugins.config` — die Plugin-Liste führt zurück auf jede
// Seite, die diesen Knopf einbaut (Laufzeit-Zyklus).
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';

/** `FeedbackItem.title` ist auf 90 Zeichen begrenzt (siehe FeedbackInputStep). */
const MAX_TITEL = 90;

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

  // Hooks stehen VOR dem Early-Return — sonst kippt die Hook-Reihenfolge (React #310).
  if (hilfe === null) return null;

  const titel = hilfe.titel !== '' ? hilfe.titel : 'Hilfe';
  // Der Puls-Punkt hing bis v2.359 an „Neu hier?" in der Fußzeile. Nur auf der
  // Startseite, sonst blinkte er auf jeder Seite der App.
  const tourAnbieten = pluginId === 'home' && !tour.hasCompleted;

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

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={HelpCircle}
        onClick={() => setOffen(true)}
        title="Kurzanleitung zu dieser Seite"
      >
        Hilfe
        {tourAnbieten && (
          <span
            aria-hidden="true"
            className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--tf-primary)] animate-pulse"
          />
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
        footer={
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2">
            <Button variant="secondary" size="sm" icon={MessageSquarePlus} onClick={melden}>
              Text stimmt nicht
            </Button>
            <div className="ml-auto flex items-center gap-2 text-[11.5px]">
              <button
                type="button"
                onClick={tourStarten}
                className="rounded-[var(--tf-radius)] px-1.5 py-1 text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer"
              >
                Einführungs-Tour
              </button>
              <Tooltip text={TOUR_DETAIL} maxWidth={340}>
                <span className="flex items-center text-[var(--tf-text-tertiary)]">
                  <Info size={13} aria-label="Was zeigt die Tour?" />
                </span>
              </Tooltip>
              <span className="text-[var(--tf-text-tertiary)]">·</span>
              <button
                type="button"
                onClick={() => { setOffen(false); ueberAppOeffnen(); }}
                className="rounded-[var(--tf-radius)] px-1.5 py-1 text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] cursor-pointer"
              >
                Über die App
              </button>
            </div>
          </div>
        }
      >
        <MarkdownRenderer content={hilfe.markdown} />
      </Dialog>
    </>
  );
}

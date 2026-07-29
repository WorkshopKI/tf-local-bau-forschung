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
 * Die Fußzeile trägt den Rückkanal: „Text stimmt nicht" öffnet das Feedback-Panel
 * mit vorgewähltem Typ + Titel. Der Coverage-Guard erzwingt die EXISTENZ eines
 * Docs, nicht seine Aktualität — Drift fällt nur auf, wenn Lesende sie melden,
 * und das darf kein Suchspiel sein.
 */

import { useMemo, useState } from 'react';
import { HelpCircle, Info, MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Tooltip } from '@/components/ui/Tooltip';
import { getSeitenHilfe } from '@/core/services/feedback/screenContext';
// Direkt am Quellmodul statt am Feedback-Barrel: das Barrel zieht `FeedbackPanel`
// mit, und das lädt `@/plugins.config` — die Plugin-Liste führt zurück auf jede
// Seite, die diesen Knopf einbaut (Laufzeit-Zyklus).
import { useFeedbackDialog } from '@/components/feedback/useFeedbackDialog';

/** `FeedbackItem.title` ist auf 90 Zeichen begrenzt (siehe FeedbackInputStep). */
const MAX_TITEL = 90;

const TOUR_DETAIL =
  'Eine Tour klickt die Seite Schritt für Schritt durch. Sie kommt, sobald sich die ' +
  'Seite nicht mehr laufend ändert: eine Tour hält die Reihenfolge der Klicks fest ' +
  'und veraltet sonst schneller, als sie geschrieben ist. Bis dahin ist dieser Text ' +
  'die Anleitung.';

export function SeitenHilfeButton({ pluginId }: { pluginId: string }): React.ReactElement | null {
  const hilfe = useMemo(() => getSeitenHilfe(pluginId), [pluginId]);
  const [offen, setOffen] = useState(false);

  if (hilfe === null) return null;

  const titel = hilfe.titel !== '' ? hilfe.titel : 'Hilfe';

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
          <div className="flex w-full items-center gap-3">
            <Button variant="secondary" size="sm" icon={MessageSquarePlus} onClick={melden}>
              Text stimmt nicht
            </Button>
            <Tooltip text={TOUR_DETAIL} maxWidth={340} wrapperClassName="ml-auto inline-block">
              <span className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
                Geführte Tour ist geplant
                <Info size={13} />
              </span>
            </Tooltip>
          </div>
        }
      >
        <MarkdownRenderer content={hilfe.markdown} />
      </Dialog>
    </>
  );
}

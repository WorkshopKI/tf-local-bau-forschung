/**
 * „Hilfe"-Knopf für den Seitenkopf: zeigt das Bildschirmseiten-Kontext-Doc der
 * Seite als Kurzanleitung — für alle, die nachlesen statt fragen wollen.
 *
 * Einbau je Seite eine Zeile:
 *   <PageHeader … actions={<SeitenHilfeButton pluginId="meilensteine" />} />
 *
 * Fehlt ein Doc (oder bleibt nach dem Technik-Strip nichts übrig), rendert die
 * Komponente NICHTS — kein toter Knopf. Inhalt + Strip-Regeln: screenContext.ts.
 */

import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getSeitenHilfe } from '@/core/services/feedback/screenContext';

export function SeitenHilfeButton({ pluginId }: { pluginId: string }): React.ReactElement | null {
  const hilfe = useMemo(() => getSeitenHilfe(pluginId), [pluginId]);
  const [offen, setOffen] = useState(false);

  if (hilfe === null) return null;

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
        title={hilfe.titel !== '' ? hilfe.titel : 'Hilfe'}
        description="Kurzanleitung zu dieser Seite"
        // Breit + fast bildschirmhoch, damit die Seite ohne Scrollen lesbar ist.
        // `center` statt `top`: bei dieser Höhe bleiben oben und unten je ~4vh —
        // näher am oberen Rand als das feste `pt-[8vh]` von `align="top"`.
        // Bewusst NICHT `resizable`: eine gemerkte (kleinere) Größe würde die
        // Höhe hier dauerhaft überstimmen.
        size="xl"
        className="h-[92vh]"
      >
        <MarkdownRenderer content={hilfe.markdown} />
        <p className="mt-4 border-t border-[var(--tf-border)] pt-3 text-[12px] text-[var(--tf-text-tertiary)]">
          Beschreibt das nicht, was du auf dem Bildschirm siehst? Dann ist der Text
          veraltet — bitte über den Feedback-Knopf melden.
        </p>
      </Dialog>
    </>
  );
}

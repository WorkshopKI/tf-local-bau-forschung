// Floating Action Button + Panel-Toggle.
// Wird global in App.tsx montiert (außer während Onboarding/Tour).
// Sitzt in der abgerundeten Ecke des „Blatts": dessen Desk-Rand ist 10px, sein
// Radius 14px (ShellLayout <main>), der Knopf 40px. `bottom-1.5`/`right-6` legt
// ihn nahezu konzentrisch auf den Eckbogen — rechts und unten gleich weit über
// die Blattkante (je ~4px), statt darüber zu schweben (v4.75.1).
// Strg+Alt+S öffnet das Panel mit fokussierter Screenshot-Paste-Fläche (v2.42).
// Öffnen-Zustand liegt im geteilten `useFeedbackDialog`-Store, damit auch der
// Feedback-Icon-Button im Sidebar-Footer denselben Dialog öffnet.

import { useEffect } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { keyboardService } from '@/core/services/keyboard';
import { FeedbackPanel } from './FeedbackPanel';
import { useFeedbackDialog } from './useFeedbackDialog';

export function FeedbackButton(): React.ReactElement {
  const open = useFeedbackDialog(s => s.open);
  const focusScreenshot = useFeedbackDialog(s => s.focusScreenshot);
  const vorbelegung = useFeedbackDialog(s => s.vorbelegung);
  const openDialog = useFeedbackDialog(s => s.openDialog);
  const close = useFeedbackDialog(s => s.close);

  useEffect(() => {
    keyboardService.register('mod+alt+s', () => openDialog({ focusScreenshot: true }), {
      description: 'Feedback mit Screenshot',
      category: 'Feedback',
    });
    return () => keyboardService.unregister('mod+alt+s');
  }, [openDialog]);

  return (
    <>
      <button
        type="button"
        onClick={() => openDialog()}
        title="Feedback geben (Strg+Alt+S für Screenshot)"
        className="fixed bottom-1.5 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] transition-colors duration-200 cursor-pointer"
        style={{ border: '1px solid var(--tf-border)' }}
        aria-label="Feedback geben"
      >
        <MessageSquarePlus size={16} />
      </button>
      <FeedbackPanel
        open={open}
        onClose={close}
        focusScreenshot={focusScreenshot}
        vorbelegung={vorbelegung}
      />
    </>
  );
}

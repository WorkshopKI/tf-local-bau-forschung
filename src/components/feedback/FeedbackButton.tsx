// Floating Action Button + Panel-Toggle.
// Wird global in App.tsx montiert (außer während Onboarding/Tour).
// Strg+Alt+S öffnet das Panel mit fokussierter Screenshot-Paste-Fläche (v2.42).

import { useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { keyboardService } from '@/core/services/keyboard';
import { FeedbackPanel } from './FeedbackPanel';

export function FeedbackButton(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [viaShortcut, setViaShortcut] = useState(false);

  useEffect(() => {
    keyboardService.register('mod+alt+s', () => { setViaShortcut(true); setOpen(true); }, {
      description: 'Feedback mit Screenshot',
      category: 'Feedback',
    });
    return () => keyboardService.unregister('mod+alt+s');
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => { setViaShortcut(false); setOpen(true); }}
        title="Feedback geben (Strg+Alt+S für Screenshot)"
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] transition-colors duration-200 cursor-pointer"
        style={{ border: '1px solid var(--tf-border)' }}
        aria-label="Feedback geben"
      >
        <MessageSquarePlus size={16} />
      </button>
      <FeedbackPanel open={open} onClose={() => { setOpen(false); setViaShortcut(false); }} focusScreenshot={viaShortcut} />
    </>
  );
}

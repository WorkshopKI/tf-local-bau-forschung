// Floating Action Button + Panel-Toggle.
// Wird global in App.tsx montiert (außer während Onboarding/Tour).

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { FeedbackPanel } from './FeedbackPanel';

export function FeedbackButton(): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Feedback geben"
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] hover:bg-[var(--tf-hover)] transition-colors duration-200 cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
        aria-label="Feedback geben"
      >
        <MessageSquarePlus size={16} />
      </button>
      <FeedbackPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

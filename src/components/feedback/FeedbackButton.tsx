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
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-[var(--tf-primary)] text-white shadow-lg opacity-60 hover:opacity-100 transition-all duration-200 hover:scale-105 cursor-pointer"
        aria-label="Feedback geben"
      >
        <MessageSquarePlus size={20} />
      </button>
      <FeedbackPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

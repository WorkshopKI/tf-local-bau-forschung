// Vollansicht eines Feedback-Bildes (v4.39.1). Eine Implementierung für beide
// Seiten: die persistierten Ticket-Screenshots (FeedbackScreenshots) und die
// noch nicht gespeicherten Anhänge im Erfassungs-Formular
// (FeedbackScreenshotInput) — wer annotiert hat, will das Ergebnis groß sehen,
// bevor er absendet.
//
// Zwei Eigenheiten, die hier wohnen statt bei jedem Aufrufer:
// - **Portal an den Body**: das Feedback-Panel trägt einen `backdrop-filter` und
//   ist damit Bezugsrahmen für `position: fixed`. Ohne Portal klebte die
//   Vollansicht im 420-px-Panel statt im Fenster.
// - **Escape in der Einfang-Phase**: der ESC-Handler des Panels hängt am `window`
//   (Bubble) und schlösse sonst das ganze Fenster samt Entwurf.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  /** Object-URL des anzuzeigenden Bildes. */
  src: string;
  caption?: string;
  onClose: () => void;
}

export function FeedbackBildLightbox({ src, caption, onClose }: Props): React.ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-label="Screenshot-Vollansicht" // allow-raw-modal: Lightbox, eigene Interaktionsmechanik
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-full bg-[var(--tf-bg)] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
        aria-label="Schließen"
      >
        <X size={16} />
      </button>
      <div className="flex flex-col items-center gap-2 max-w-[92vw] max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <img src={src} alt={caption || 'Screenshot'} className="max-w-full max-h-[82vh] object-contain rounded-[var(--tf-radius)]" />
        {caption && <p className="text-[12px] text-white/90">{caption}</p>}
      </div>
    </div>,
    document.body,
  );
}

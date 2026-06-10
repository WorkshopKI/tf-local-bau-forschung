import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';

interface CopyButtonProps {
  /** Roh-Markdown der Antwort. */
  text: string;
}

/** Kopiert die Antwort in die Zwischenablage; kurzes Check-Feedback. */
export function CopyButton({ text }: CopyButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = useAsyncAction(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });

  return (
    <button
      onClick={() => copy.run()}
      title={copy.error ? `Kopieren fehlgeschlagen: ${copy.error}` : 'In Zwischenablage kopieren'}
      className="p-1.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] rounded-[var(--tf-radius)] cursor-pointer"
    >
      {copied ? <Check size={13} className="text-[var(--tf-success-text)]" /> : <Copy size={13} />}
    </button>
  );
}

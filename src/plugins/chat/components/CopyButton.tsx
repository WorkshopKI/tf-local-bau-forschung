import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { kopiereText } from '@/core/utils/kopieren';

interface CopyButtonProps {
  /** Roh-Markdown der Antwort. */
  text: string;
  size?: number;
  title?: string;
}

/** Kopiert Text in die Zwischenablage (.act-Stil); kurzes Check-Feedback. */
export function CopyButton({ text, size = 15, title = 'Kopieren' }: CopyButtonProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = useAsyncAction(async () => {
    await kopiereText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });

  return (
    <button className="act" title={copy.error ? `Kopieren fehlgeschlagen: ${copy.error}` : title} onClick={() => copy.run()}>
      {copied ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

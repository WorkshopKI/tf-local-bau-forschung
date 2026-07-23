import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';

interface CopyButtonProps {
  /** Roh-Markdown der Antwort. */
  text: string;
  size?: number;
  title?: string;
}

/** Kopiert Text in die Zwischenablage (.act-Stil); kurzes Check-Feedback. */
export function CopyButton({ text, size = 15, title = 'Kopieren' }: CopyButtonProps): React.ReactElement {
  const copy = useKopierAktion(text, title);

  return (
    <button className="act" title={copy.titel} onClick={() => copy.run()}>
      {/* Fehler schlaegt Erfolg — sonst sieht ein gescheitertes Kopieren aus wie ein gelungenes. */}
      {copy.fehler
        ? <AlertTriangle size={size} className="text-[var(--tf-danger-text)]" />
        : copy.kopiert ? <Check size={size} /> : <Copy size={size} />}
    </button>
  );
}

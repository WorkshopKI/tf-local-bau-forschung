import { Dialog as CanonicalDialog } from '@/components/ui/dialog';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Breite der Dialog-Karte. `md` (Default) = bisheriges Verhalten, `lg` für inhaltsreiche Dialoge. */
  size?: 'md' | 'lg';
}

/**
 * Kompat-Adapter (P1b): bildet die ehemalige TF-Dialog-API auf den kanonischen
 * Dialog aus @/components/ui/dialog ab — keine eigene DOM-Struktur mehr.
 * Höhen-Cap + interner Scroll + fixer Kopf/Fuß kommen vom kanonischen Dialog.
 * Neuer Code importiert direkt `@/components/ui/dialog`.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps): React.ReactElement {
  return (
    <CanonicalDialog open={open} onClose={onClose} title={title} footer={footer} size={size}>
      {children}
    </CanonicalDialog>
  );
}

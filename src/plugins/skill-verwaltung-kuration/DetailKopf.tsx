/**
 * Kopfzeile des Detail-Panels der Skill-Verwaltung — Kontext-Label links,
 * optionale Bedienelemente in der Mitte, Schließen-X rechts.
 *
 * Bewusst VOM AUFRUFER (SkillVerwaltungPage) gerendert, nicht von den Editoren:
 * so sitzt sie außerhalb des scrollenden Editor-Bereichs und bleibt beim Scrollen
 * stehen. Die Editoren behalten ihren eigenen (editierbaren) Titel im Rumpf.
 *
 * Ersetzt die früheren „← Skill-Verwaltung"-Links, die in drei Editoren einzeln
 * gebaut waren — Konvention der App ist das Schließen-X oben rechts (siehe
 * `AnfrageDetail`).
 */
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailKopfProps {
  /** Kontext-Label links (z.B. „Skill", „Qualitätsregel"). */
  label: string;
  /** Optionale Bedienelemente zwischen Label und Schließen (z.B. Team|Persönlich). */
  children?: React.ReactNode;
  onClose: () => void;
}

export function DetailKopf({ label, children, onClose }: DetailKopfProps): React.ReactElement {
  return (
    <div
      className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-[var(--tf-bg)]"
      style={{ borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 min-w-0" />
      {children}
      <Button variant="ghost" size="icon-sm" onClick={onClose} title="Schließen" aria-label="Schließen">
        <X />
      </Button>
    </div>
  );
}

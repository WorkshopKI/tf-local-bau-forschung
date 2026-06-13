import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  label: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  label,
  subtitle,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-2 w-full py-3 cursor-pointer text-left"
      >
        <ChevronRight
          size={14}
          className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{label}</span>
        {subtitle && (
          <span className="text-[13px] text-[var(--tf-text-tertiary)] ml-auto">{subtitle}</span>
        )}
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

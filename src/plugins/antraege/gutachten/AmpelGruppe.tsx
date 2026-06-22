/**
 * Einklappbare Gruppe mit Ampel-Kopf (gutachten-scoped). Kopf zeigt einen
 * Ampel-Punkt (Roll-up-Level), Label, Kurz-Summary, Anzahl und Chevron; der
 * Inhalt klappt per Grid-Animation auf/zu. Default-Offen-State kommt vom
 * Aufrufer (initial aus dem Roll-up: grün → zu, gelb/rot → auf).
 *
 * Wiederverwendet von der gruppierten Prüfung (`KontextPanel` Checks) UND dem
 * beratenden QS-Block. Bewusst KEINE tf-ui-Datei — eng an „Quelle & Prüfung".
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { AmpelLevel } from '@/core/services/skills';

function dotClass(level: AmpelLevel): string {
  if (level === 'ok') return 'text-[var(--tf-success-text)]';
  if (level === 'hinweis') return 'text-[var(--tf-warning-text)]';
  return 'text-[var(--tf-danger-text)]';
}

interface Props {
  label: string;
  level: AmpelLevel;
  summary: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function AmpelGruppe({
  label,
  level,
  summary,
  count,
  defaultOpen = false,
  children,
}: Props): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b-[0.5px] border-[var(--tf-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-expanded={open}
        className="flex items-center gap-2 w-full py-2.5 cursor-pointer text-left"
      >
        <span className={`shrink-0 text-[10px] leading-none ${dotClass(level)}`} aria-hidden>●</span>
        <span className="text-[13px] font-medium text-[var(--tf-text)]">{label}</span>
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">{summary}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[var(--tf-text-tertiary)]">
          <span className="text-[11px] font-mono">{count}</span>
          <ChevronRight
            size={14}
            className="shrink-0 transition-transform duration-200"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pb-3 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

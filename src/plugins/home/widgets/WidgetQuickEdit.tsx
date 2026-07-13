/**
 * Stift-Popover am Widget-Kopf (Phase 3): Schnellanpassung der Widget-Config
 * über die GEMEINSAME Formular-Komponente (WidgetConfigForm — eine Wahrheit
 * mit der Einstellungs-Sektion). Fußzeile: Lokal-Hinweis + Sprung in die
 * Einstellungen (`?sektion=sec-widgets`-Deep-Link).
 */
import { useNavigate } from 'react-router-dom';
import { Lock, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHomeWidgets } from './useHomeWidgets';
import { WIDGET_KATALOG } from './widgetCatalog';
import { WidgetConfigForm } from './WidgetConfigForm';
import type { WidgetInstanz } from './types';

export function WidgetQuickEdit({ instanz }: { instanz: WidgetInstanz }): React.ReactElement {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const eintrag = WIDGET_KATALOG[instanz.typ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Widget anpassen"
          title="Widget anpassen"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-[var(--tf-radius-sm)] text-[var(--tf-text-tertiary)] cursor-pointer hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)]"
        >
          <Pencil size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-4">
        <p className="text-[13px] font-semibold text-[var(--tf-text)] mb-3">
          Widget anpassen — {eintrag.label}
        </p>
        <WidgetConfigForm
          instanz={instanz}
          kontext="popover"
          onUpdateConfig={cfg => api.updateConfig(instanz.id, cfg)}
        />
        <div
          className="mt-4 pt-3 flex items-center justify-between gap-3"
          style={{ borderTop: '0.5px solid var(--tf-border)' }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
            <Lock size={11} className="shrink-0" aria-hidden />
            nur lokal auf diesem Gerät
          </span>
          <button
            type="button"
            onClick={() => navigate('/einstellungen?sektion=sec-widgets')}
            className="text-[12px] text-[var(--tf-primary)] hover:underline cursor-pointer whitespace-nowrap"
          >
            Alle Einstellungen →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Einstellungs-Sektion „Widgets auf der Startseite" (Panel Darstellung &
 * Bedienung, Anker `sec-widgets`): Positionsliste (Hoch/Runter — bewusst KEIN
 * Drag&Drop in v1), Sichtbar/Ausgeblendet-Toggle, aufklappbare Detail-Config
 * über die GEMEINSAME WidgetConfigForm (eine Wahrheit mit dem Stift-Popover).
 * Nicht verfügbare Katalog-Typen (v1.1/v1.2) erscheinen ausgegraut darunter.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useHomeWidgets } from '@/plugins/home/widgets/useHomeWidgets';
import { WIDGET_KATALOG, listeKatalog } from '@/plugins/home/widgets/widgetCatalog';
import { WidgetConfigForm } from '@/plugins/home/widgets/WidgetConfigForm';
import type { WidgetInstanz } from '@/plugins/home/widgets/types';
import { SettingsSectionHeader } from './_shared/settings-primitives';

export function WidgetsSettingsSection(): React.ReactElement {
  const api = useHomeWidgets();
  const [aufgeklappt, setAufgeklappt] = useState<string | null>(null);
  const aktion = useAsyncAction(async (fn: () => Promise<void>) => { await fn(); });

  const instanzen = api.alleInstanzen.filter(w => {
    const eintrag = WIDGET_KATALOG[w.typ];
    return !!eintrag && eintrag.verfuegbar && eintrag.sichtbarWenn();
  });
  const zukunft = listeKatalog().filter(e => !e.verfuegbar && e.sichtbarWenn());

  return (
    <section id="sec-widgets" className="scroll-mt-20">
      <SettingsSectionHeader label="Widgets auf der Startseite" />
      <p className="text-[12px] text-[var(--tf-text-tertiary)] -mt-2 mb-3">
        Reihenfolge, Sichtbarkeit und Inhalt der Startseiten-Widgets. Gilt nur für dieses Gerät.
      </p>
      <div
        className="rounded-[var(--tf-radius-lg)] overflow-hidden"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {instanzen.map((w, i) => (
          <WidgetZeile
            key={w.id}
            instanz={w}
            erste={i === 0}
            hochMoeglich={i > 0}
            runterMoeglich={i < instanzen.length - 1}
            busy={aktion.busy}
            onMove={richtung => aktion.run(() => api.move(w.id, richtung))}
            onToggleSichtbar={() => aktion.run(() => api.setSichtbar(w.id, !w.sichtbar))}
            aufgeklappt={aufgeklappt === w.id}
            onToggleAufklappen={() => setAufgeklappt(a => (a === w.id ? null : w.id))}
            onUpdateConfig={cfg => api.updateConfig(w.id, cfg)}
          />
        ))}
        {zukunft.map(e => (
          <div
            key={e.typ}
            className="flex items-center gap-3 px-3 py-2.5"
            style={{ borderTop: '0.5px solid var(--tf-border)' }}
            title="Folgt in einer späteren Version"
          >
            <span className="w-[44px]" aria-hidden />
            <e.icon size={15} className="shrink-0 text-[var(--tf-text-tertiary)]" />
            <span className="flex-1 min-w-0 text-[13px] text-[var(--tf-text-tertiary)] truncate">{e.label}</span>
            {e.hinweisBadge ? <Badge variant="info">{e.hinweisBadge}</Badge> : null}
            <span
              className="shrink-0 text-[11px] px-2 py-0.5 rounded-full text-[var(--tf-text-tertiary)]"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              Bald verfügbar
            </span>
          </div>
        ))}
      </div>
      {aktion.error ? (
        <p className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler beim Speichern: {aktion.error}</p>
      ) : null}
    </section>
  );
}

function WidgetZeile({
  instanz,
  erste,
  hochMoeglich,
  runterMoeglich,
  busy,
  onMove,
  onToggleSichtbar,
  aufgeklappt,
  onToggleAufklappen,
  onUpdateConfig,
}: {
  instanz: WidgetInstanz;
  erste: boolean;
  hochMoeglich: boolean;
  runterMoeglich: boolean;
  busy: boolean;
  onMove: (richtung: 'hoch' | 'runter') => Promise<void>;
  onToggleSichtbar: () => Promise<void>;
  aufgeklappt: boolean;
  onToggleAufklappen: () => void;
  onUpdateConfig: Parameters<typeof WidgetConfigForm>[0]['onUpdateConfig'];
}): React.ReactElement {
  const eintrag = WIDGET_KATALOG[instanz.typ];
  const Icon = eintrag.icon;
  // Detail-Config nur für Typen mit eigenem Formular (kanban/ampel).
  const hatDetail = instanz.config.art === 'kanban' || instanz.config.art === 'ampel';

  const pfeil = (richtung: 'hoch' | 'runter', moeglich: boolean): React.ReactElement => (
    <button
      type="button"
      disabled={!moeglich || busy}
      aria-label={richtung === 'hoch' ? `${eintrag.label} nach oben` : `${eintrag.label} nach unten`}
      onClick={() => { void onMove(richtung); }}
      className={`inline-flex items-center justify-center w-5 h-4 rounded-[4px] ${
        moeglich && !busy
          ? 'text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer'
          : 'text-[var(--tf-text-tertiary)] opacity-40 cursor-default'
      }`}
    >
      {richtung === 'hoch' ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
    </button>
  );

  return (
    <div style={erste ? undefined : { borderTop: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex flex-col shrink-0 w-[44px] items-start">
          <span className="flex flex-col">
            {pfeil('hoch', hochMoeglich)}
            {pfeil('runter', runterMoeglich)}
          </span>
        </span>
        <Icon size={15} className="shrink-0 text-[var(--tf-text-secondary)]" />
        <button
          type="button"
          onClick={hatDetail ? onToggleAufklappen : undefined}
          className={`flex-1 min-w-0 flex items-center gap-1.5 text-left ${hatDetail ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={hatDetail ? aufgeklappt : undefined}
        >
          <span className="text-[13px] text-[var(--tf-text)] truncate">{eintrag.label}</span>
          {hatDetail ? (
            <ChevronRight
              size={12}
              className="shrink-0 text-[var(--tf-text-tertiary)]"
              style={{
                transform: aufgeklappt ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform var(--tf-duration-med) var(--tf-ease)',
              }}
            />
          ) : null}
        </button>
        {eintrag.hinweisBadge ? <Badge variant="info">{eintrag.hinweisBadge}</Badge> : null}
        <button
          type="button"
          onClick={() => { void onToggleSichtbar(); }}
          disabled={busy}
          aria-pressed={instanz.sichtbar}
          title={instanz.sichtbar ? 'Auf der Startseite ausblenden' : 'Auf der Startseite einblenden'}
          className={`shrink-0 text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${
            instanz.sichtbar
              ? 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]'
              : 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)]'
          }`}
          style={instanz.sichtbar ? undefined : { border: '0.5px solid var(--tf-border)' }}
        >
          {instanz.sichtbar ? 'Sichtbar' : 'Ausgeblendet'}
        </button>
      </div>
      {hatDetail && aufgeklappt ? (
        <div className="px-3 pb-3 pl-[76px]">
          <WidgetConfigForm instanz={instanz} kontext="settings" onUpdateConfig={onUpdateConfig} />
        </div>
      ) : null}
    </div>
  );
}

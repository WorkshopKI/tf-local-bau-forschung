/**
 * Gruppe „Startseiten-Widgets" (Design-Handoff
 * `_design/handoff/einstellungen-zweispaltig`, Screenshot 06).
 *
 * Die eigentliche Konfiguration passiert per Rechtsklick auf der Startseite —
 * hier steht der Verweis darauf und, eingeklappt, die vollständige Liste mit
 * „N von M sichtbar". Je Zeile EIN Schalter (bis v4.29 eine Pille mit zwei
 * Zuständen); ausgeschaltete Zeilen sind gedimmt.
 *
 * Die Reihenfolge bleibt bei den Hoch/Runter-Pfeilen: Der Prototyp zeigt ein
 * Griff-Symbol, aber die Startseiten-Konfiguration kennt kein Ziehen — ein
 * Griff, der nicht zieht, wäre eine Falschaussage.
 *
 * Rollen: Widgets, die dem Nutzer nicht zustehen (z.B. „Registry-Änderungen"
 * mit `Nur Kurator`), stehen gar nicht erst in der Liste — `sichtbarWenn()`
 * filtert sie, und der Zähler zählt entsprechend nur das Schaltbare.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useHomeWidgets } from '@/plugins/home/widgets/useHomeWidgets';
import { widgetAnzeigbar } from '@/plugins/home/widgets/homeWidgetsStore';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { widgetId } from '@/core/sichtbarkeit';
import { WIDGET_KATALOG, listeKatalog } from '@/plugins/home/widgets/widgetCatalog';
import { WidgetConfigForm } from '@/plugins/home/widgets/WidgetConfigForm';
import { hatWidgetDetailConfig, type WidgetInstanz } from '@/plugins/home/widgets/types';
import { SettingsGruppe, SettingsKlappe, SettingsOption } from '@/components/settings';

export function WidgetsGruppe(): React.ReactElement {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const angezeigt = useSichtbar();
  const [aufgeklappt, setAufgeklappt] = useState<string | null>(null);
  const aktion = useAsyncAction(async (fn: () => Promise<void>) => { await fn(); });

  // Ein von Beta/Experte verborgenes Widget steht hier NICHT — sonst böte die
  // Liste ein Häkchen an, das auf der Startseite ohne Wirkung bliebe.
  const instanzen = api.alleInstanzen.filter(w => widgetAnzeigbar(w.typ, undefined, angezeigt));
  const zukunft = listeKatalog().filter(
    e => !e.verfuegbar && e.sichtbarWenn() && angezeigt(widgetId(e.typ)),
  );
  const sichtbare = instanzen.filter(w => w.sichtbar).length;

  // Zwei Spalten wie auf der Startseite — je Bereich eine EIGENE Reihenfolge.
  // Die Pfeile bewegen nur innerhalb der Spalte (`move` ist bereich-begrenzt).
  const gruppen: { bereich: 'haupt' | 'seite'; label: string; items: WidgetInstanz[] }[] = [
    { bereich: 'haupt', label: 'Hauptspalte · breit, links', items: instanzen.filter(w => w.bereich === 'haupt') },
    { bereich: 'seite', label: 'Seitenspalte · schmal, rechts', items: instanzen.filter(w => w.bereich === 'seite') },
  ];

  return (
    <SettingsGruppe
      titel="Startseiten-Widgets"
      unterzeile="Reihenfolge und Sichtbarkeit lassen sich direkt auf der Startseite per Rechtsklick ändern — hier ist die vollständige Liste."
    >
      <SettingsOption
        label="Startseite anpassen"
        kurzzeile="Rechtsklick auf eine freie Fläche öffnet das Menü"
      >
        <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => navigate('/')}>
          Startseite öffnen
        </Button>
      </SettingsOption>

      <SettingsKlappe
        id="sec-widgets"
        label="Alle Widgets verwalten"
        // Key-Bump gegenüber `…_widgets_collapsed`: der alte Abschnitt war
        // standardmäßig OFFEN und hat das beim ersten Anzeigen persistiert —
        // ein persistierter Wert schlägt den Code-Default, die Klappe stünde
        // sonst bei jedem Bestandsnutzer weiter offen.
        storageKey="teamflow_settings_widgets_zu_v2"
        zaehler={`${sichtbare} von ${instanzen.length} sichtbar`}
      >
        <div className="flex flex-col gap-3">
          {gruppen.map(g => (
            g.items.length === 0 ? null : (
              <div key={g.bereich}>
                <p className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--tf-text-tertiary)] mb-1">
                  {g.label}
                </p>
                {g.items.map((w, i) => (
                  <WidgetZeile
                    key={w.id}
                    instanz={w}
                    hochMoeglich={i > 0}
                    runterMoeglich={i < g.items.length - 1}
                    busy={aktion.busy}
                    onMove={richtung => aktion.run(() => api.move(w.id, richtung))}
                    onToggleSichtbar={() => aktion.run(() => api.setSichtbar(w.id, !w.sichtbar))}
                    aufgeklappt={aufgeklappt === w.id}
                    onToggleAufklappen={() => setAufgeklappt(a => (a === w.id ? null : w.id))}
                    onUpdateConfig={cfg => api.updateConfig(w.id, cfg)}
                  />
                ))}
              </div>
            )
          ))}

          {zukunft.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] font-medium text-[var(--tf-text-tertiary)] mb-1">
                Bald verfügbar
              </p>
              {zukunft.map(e => (
                <div
                  key={e.typ}
                  className="flex items-center gap-2.5 py-[7px] border-t first:border-t-0"
                  style={{ borderTopColor: 'var(--tf-border-hover)', borderTopWidth: '0.5px' }}
                  title="Folgt in einer späteren Version"
                >
                  <span className="w-4" aria-hidden />
                  <e.icon size={14} className="shrink-0 text-[var(--tf-text-tertiary)]" />
                  <span className="flex-1 min-w-0 text-[13px] text-[var(--tf-text-tertiary)] truncate">{e.label}</span>
                  {e.hinweisBadge && <Badge variant="info">{e.hinweisBadge}</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
        {aktion.error && (
          <p className="mt-2 text-[12px] text-[var(--tf-danger-text)]">Fehler beim Speichern: {aktion.error}</p>
        )}
      </SettingsKlappe>
    </SettingsGruppe>
  );
}

function WidgetZeile({
  instanz,
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
  // Detail-Config nur für Typen mit eigenem Formular (kanban/ampel) — dieselbe
  // Wahrheit, die auch den Widget-Kopf-Stift steuert (WidgetShell).
  const hatDetail = hatWidgetDetailConfig(instanz.config);
  const aus = !instanz.sichtbar;

  const pfeil = (richtung: 'hoch' | 'runter', moeglich: boolean): React.ReactElement => (
    <button
      type="button"
      disabled={!moeglich || busy}
      aria-label={richtung === 'hoch' ? `${eintrag.label} nach oben` : `${eintrag.label} nach unten`}
      onClick={() => onMove(richtung)}
      className={`inline-flex items-center justify-center w-4 h-3.5 rounded-[3px] ${
        moeglich && !busy
          ? 'text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer'
          : 'text-[var(--tf-text-tertiary)] opacity-30 cursor-default'
      }`}
    >
      {richtung === 'hoch' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  );

  return (
    <div
      className="border-t first:border-t-0"
      style={{ borderTopColor: 'var(--tf-border-hover)', borderTopWidth: '0.5px' }}
    >
      <div className="flex items-center gap-2.5 py-[6px]">
        <span className="flex flex-col shrink-0">
          {pfeil('hoch', hochMoeglich)}
          {pfeil('runter', runterMoeglich)}
        </span>
        <Icon
          size={14}
          className={`shrink-0 ${aus ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text-secondary)]'}`}
        />
        <button
          type="button"
          onClick={hatDetail ? onToggleAufklappen : undefined}
          className={`flex-1 min-w-0 flex items-center gap-1.5 text-left ${hatDetail ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={hatDetail ? aufgeklappt : undefined}
        >
          <span className={`text-[13px] truncate ${aus ? 'text-[var(--tf-text-tertiary)]' : 'text-[var(--tf-text)]'}`}>
            {eintrag.label}
          </span>
          {hatDetail && (
            <ChevronRight
              size={11}
              className="shrink-0 text-[var(--tf-text-tertiary)]"
              style={{
                transform: aufgeklappt ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform var(--tf-duration-med) var(--tf-ease)',
              }}
            />
          )}
        </button>
        {eintrag.hinweisBadge && <Badge variant="info">{eintrag.hinweisBadge}</Badge>}
        <Switch
          size="sm"
          checked={instanz.sichtbar}
          disabled={busy}
          onCheckedChange={() => onToggleSichtbar()}
          aria-label={`${eintrag.label} auf der Startseite anzeigen`}
        />
      </div>
      {hatDetail && aufgeklappt && (
        <div className="pb-2.5 pl-[34px]">
          <WidgetConfigForm instanz={instanz} kontext="settings" onUpdateConfig={onUpdateConfig} />
        </div>
      )}
    </div>
  );
}

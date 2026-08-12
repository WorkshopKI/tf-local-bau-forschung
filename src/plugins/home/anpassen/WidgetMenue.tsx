/**
 * Menü eines einzelnen Widgets (Rechtsklick auf die Karte oder `⋯` im Kopf).
 *
 * „Nach oben/unten" trägt die Position als „2 / 5" und ist am Spaltenrand
 * ausgegraut statt versteckt (Handoff §2.2) — sonst sprängen die Einträge unter
 * dem Zeiger weg, je nachdem, wo das Widget gerade steht. Verschieben hält das
 * Menü offen: wer eine Karte zwei Plätze hochholt, klickt zweimal.
 *
 * „Widget-Einstellungen" erscheint nur bei Widgets mit echtem Formular
 * (`hatWidgetDetailConfig`) und tauscht den Panel-Inhalt im selben Menü, statt
 * ein zweites Popover zu öffnen (Muster aus `TicketMenue`).
 */
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Columns3, EyeOff, Settings2, SunMoon } from 'lucide-react';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import { hatWidgetDetailConfig } from '../widgets/types';
import { MenueTrenner, MenueZeile } from './menueZeilen';
import { useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore, type UntermenueId } from './useStartseiteMenue';

export function WidgetMenue({ instanzId, oeffneUnter }: {
  instanzId: string;
  oeffneUnter: (id: UntermenueId, el: HTMLElement) => void;
}): React.ReactElement | null {
  const api = useHomeWidgets();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const zeigeAnsicht = useStartseiteMenueStore(s => s.zeigeAnsicht);
  const untermenue = useStartseiteMenueStore(s => s.untermenue);
  const merke = useRueckgaengigStore(s => s.merke);

  const instanz = api.alleInstanzen.find(w => w.id === instanzId);
  if (!instanz) return null;
  const label = WIDGET_KATALOG[instanz.typ].label;

  // Position innerhalb der eigenen Spalte, nur unter den SICHTBAREN — die Zahl
  // muss zählen, was man auf dem Bildschirm sieht.
  const spalte = instanz.bereich === 'haupt' ? api.haupt : api.seite;
  const i = spalte.findIndex(w => w.id === instanzId);
  const n = spalte.length;

  return (
    <>
      <div className="px-2.5 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--tf-text-tertiary)] truncate">
        {label}
      </div>
      <MenueZeile
        label="Ausblenden"
        icon={EyeOff}
        onClick={() => {
          merke(`${label} ausgeblendet`, api.config);
          void api.setSichtbar(instanzId, false);
          schliesse();
        }}
      />
      <MenueZeile
        label={instanz.eingeklappt ? 'Aufklappen' : 'Einklappen'}
        icon={instanz.eingeklappt ? ChevronRight : ChevronDown}
        onClick={() => { void api.setEingeklappt(instanzId, !instanz.eingeklappt); schliesse(); }}
      />
      <MenueTrenner />
      <MenueZeile
        label="Nach oben"
        icon={ArrowUp}
        kuerzel={i >= 0 ? `${i + 1} / ${n}` : undefined}
        deaktiviert={i <= 0}
        onClick={() => { void api.move(instanzId, 'hoch'); }}
      />
      <MenueZeile
        label="Nach unten"
        icon={ArrowDown}
        deaktiviert={i < 0 || i >= n - 1}
        onClick={() => { void api.move(instanzId, 'runter'); }}
      />
      <MenueTrenner />
      {hatWidgetDetailConfig(instanz.config) ? (
        <MenueZeile
          label="Widget-Einstellungen"
          icon={Settings2}
          onClick={() => zeigeAnsicht('einstellungen')}
        />
      ) : null}
      <MenueZeile
        label="Widgets"
        icon={Columns3}
        untermenue
        aktiv={untermenue === 'widgets'}
        onHover={el => oeffneUnter('widgets', el)}
      />
      <MenueZeile
        label="Darstellung"
        icon={SunMoon}
        untermenue
        aktiv={untermenue === 'darstellung'}
        onHover={el => oeffneUnter('darstellung', el)}
      />
    </>
  );
}

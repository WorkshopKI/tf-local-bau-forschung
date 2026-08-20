/**
 * Menü eines einzelnen Widgets — Auslöser ist allein das `⋯` in seinem Kopf.
 *
 * **Nur widget-eigene Punkte** (v4.40.2): „Widgets ▸" und „Darstellung ▸" standen
 * bis dahin auch hier und wiederholten in jeder Karte, was die ganze Seite
 * betrifft. Sie leben jetzt ausschließlich im Menü der freien Fläche
 * (`FlaechenMenue`) — ein Ort je Zuständigkeit statt derselben Punkte an sieben
 * Stellen. Aus demselben Grund öffnet der Rechtsklick auf eine Karte gar kein
 * Menü mehr (`darfMenueOeffnen`).
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
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, EyeOff, Settings2 } from 'lucide-react';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import { hatWidgetDetailConfig } from '../widgets/types';
import { MenueTrenner, MenueZeile } from './menueZeilen';
import { stelleSichtbarkeitHer, useRueckgaengigStore } from './rueckgaengigStore';
import { useStartseiteMenueStore } from './useStartseiteMenue';

export function WidgetMenue({ instanzId }: {
  instanzId: string;
}): React.ReactElement | null {
  const api = useHomeWidgets();
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const zeigeAnsicht = useStartseiteMenueStore(s => s.zeigeAnsicht);
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
          // Nur DIESES Häkchen zurückdrehen — nicht den ganzen Stand von vorher
          // zurückschreiben (der nähme ein zwischenzeitliches Einklappen mit).
          merke(`${label} ausgeblendet`, stelleSichtbarkeitHer(new Map([[instanzId, true]])));
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
      {/* `unter: 'sichtbare'` — die Zahl „2 / 5" zählt die sichtbaren Nachbarn,
          also muss der Tausch dieselben meinen. Sonst wandert die Karte hinter
          ein ausgeblendetes Widget und steht auf dem Schirm noch immer dort. */}
      <MenueZeile
        label="Nach oben"
        icon={ArrowUp}
        kuerzel={i >= 0 ? `${i + 1} / ${n}` : undefined}
        deaktiviert={i <= 0}
        onClick={() => { void api.move(instanzId, 'hoch', 'sichtbare'); }}
      />
      <MenueZeile
        label="Nach unten"
        icon={ArrowDown}
        deaktiviert={i < 0 || i >= n - 1}
        onClick={() => { void api.move(instanzId, 'runter', 'sichtbare'); }}
      />
      {/* Der Trenner gehört zum Eintrag: ohne Formular endet das Menü bei „Nach
          unten" statt mit einer Linie unter dem letzten Punkt. */}
      {hatWidgetDetailConfig(instanz.config) ? (
        <>
          <MenueTrenner />
          <MenueZeile
            label="Widget-Einstellungen"
            icon={Settings2}
            onClick={() => zeigeAnsicht('einstellungen')}
          />
        </>
      ) : null}
    </>
  );
}

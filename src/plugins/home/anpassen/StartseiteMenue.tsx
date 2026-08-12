/**
 * Das Startseiten-Menü — EINE Positionierung für alle Auslöser.
 *
 * Ein Radix-`Popover` hängt an einem 0×0-Anker, den der Aufrufer per Koordinate
 * setzt: der Rechtsklick liefert die Zeigerposition, ein Knopf die Unterkante
 * seines Rechtecks. Damit gibt es keinen zweiten Weg, ein Menü zu platzieren, und
 * Kollisionen (Rand rechts/unten) löst Radix für beide Fälle gleich.
 *
 * **Das Untermenü ist ein Geschwister-Panel im SELBEN `PopoverContent`**, kein
 * verschachteltes Popover. Optisch dasselbe wie im Handoff (zwei Karten
 * nebeneinander, das Untermenü an seiner Zeile ausgerichtet), aber nur eine
 * Dismissable-Layer — kein Portal im Portal, kein Streit darum, wer `Esc`
 * bekommt. `collisionPadding` klappt die ganze Gruppe nach links, wenn rechts
 * kein Platz ist (Handoff §2.5).
 */
import { useCallback, useRef } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import { WidgetConfigForm } from '../widgets/WidgetConfigForm';
import { DarstellungUntermenue } from './DarstellungUntermenue';
import { FlaechenMenue } from './FlaechenMenue';
import { MenuePanel } from './menueZeilen';
import { WidgetMenue } from './WidgetMenue';
import { WidgetsUntermenue } from './WidgetsUntermenue';
import { useStartseiteMenueStore, type UntermenueId } from './useStartseiteMenue';

/** Handoff §5: Menü min. 250 px, Untermenü 268 px. */
const BREITE_MENUE = 250;
const BREITE_UNTERMENUE = 268;

export function StartseiteMenue(): React.ReactElement {
  const offen = useStartseiteMenueStore(s => s.offen);
  const untermenue = useStartseiteMenueStore(s => s.untermenue);
  const versatz = useStartseiteMenueStore(s => s.untermenueVersatz);
  const ansicht = useStartseiteMenueStore(s => s.ansicht);
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const zeigeUntermenue = useStartseiteMenueStore(s => s.zeigeUntermenue);
  const contentRef = useRef<HTMLDivElement>(null);

  // Der Versatz macht das Untermenü an seiner Zeile fest statt am Kopf des
  // Hauptmenüs — gemessen gegen die Oberkante des Popovers, nicht per offsetTop
  // (das Panel ist nicht garantiert der offsetParent).
  const oeffneUnter = useCallback((id: UntermenueId, el: HTMLElement): void => {
    const oben = contentRef.current?.getBoundingClientRect().top ?? 0;
    zeigeUntermenue(id, Math.max(0, el.getBoundingClientRect().top - oben - 4));
  }, [zeigeUntermenue]);

  if (!offen) return <></>;

  return (
    <Popover open onOpenChange={o => { if (!o) schliesse(); }}>
      <PopoverAnchor asChild>
        <span
          aria-hidden
          style={{ position: 'fixed', left: offen.punkt.x, top: offen.punkt.y, width: 0, height: 0 }}
        />
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        side="bottom"
        align="start"
        sideOffset={2}
        collisionPadding={8}
        aria-label="Startseite anpassen"
        className="w-auto flex-row items-start gap-1.5 bg-transparent p-0 shadow-none ring-0"
        // Rechtsklick INS Menü soll weder das Browser-Menü zeigen noch das
        // Startseiten-Menü ein zweites Mal öffnen.
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        <div
          // Jede Zeile ohne eigenes Untermenü schließt beim Überfahren das offene.
          onMouseOver={e => {
            if (!(e.target as HTMLElement).closest('[data-untermenue]')) zeigeUntermenue(null);
          }}
        >
          <MenuePanel breite={BREITE_MENUE}>
            {ansicht === 'einstellungen' && offen.ziel.art === 'widget' ? (
              <WidgetEinstellungen instanzId={offen.ziel.instanzId} />
            ) : offen.ziel.art === 'widget' ? (
              <WidgetMenue instanzId={offen.ziel.instanzId} oeffneUnter={oeffneUnter} />
            ) : (
              <FlaechenMenue oeffneUnter={oeffneUnter} />
            )}
          </MenuePanel>
        </div>
        {untermenue ? (
          <MenuePanel breite={BREITE_UNTERMENUE} versatz={versatz}>
            {untermenue === 'widgets' ? <WidgetsUntermenue /> : <DarstellungUntermenue />}
          </MenuePanel>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Zweite Ansicht desselben Panels: das vorhandene Detail-Formular
 * (`WidgetConfigForm`, geteilt mit der Einstellungs-Sektion) plus die Fußzeile,
 * die bis v4.5 am Stift-Popover hing.
 */
function WidgetEinstellungen({ instanzId }: { instanzId: string }): React.ReactElement | null {
  const api = useHomeWidgets();
  const navigate = useNavigate();
  const zeigeAnsicht = useStartseiteMenueStore(s => s.zeigeAnsicht);
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const instanz = api.alleInstanzen.find(w => w.id === instanzId);
  if (!instanz) return null;

  return (
    <div className="p-2">
      <button
        type="button"
        onClick={() => zeigeAnsicht('menue')}
        className="mb-2.5 -ml-1 flex items-center gap-1 rounded-[6px] px-1 py-0.5 text-[12.5px] text-[var(--tf-text-secondary)] cursor-pointer hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
      >
        <ChevronLeft size={13} aria-hidden />
        {WIDGET_KATALOG[instanz.typ].label}
      </button>
      <WidgetConfigForm
        instanz={instanz}
        kontext="popover"
        onUpdateConfig={cfg => api.updateConfig(instanz.id, cfg)}
      />
      <div
        className="mt-3.5 flex items-center justify-between gap-3 pt-2.5"
        style={{ borderTop: '0.5px solid var(--tf-border)' }}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
          <Lock size={11} className="shrink-0" aria-hidden />
          nur lokal auf diesem Gerät
        </span>
        <button
          type="button"
          onClick={() => { schliesse(); navigate('/einstellungen?sektion=sec-widgets'); }}
          className="whitespace-nowrap text-[12px] text-[var(--tf-primary)] cursor-pointer hover:underline"
        >
          Alle Einstellungen →
        </button>
      </div>
    </div>
  );
}

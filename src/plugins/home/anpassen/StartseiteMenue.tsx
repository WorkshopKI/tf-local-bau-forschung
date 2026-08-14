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
 * bekommt.
 *
 * Es hängt dabei **absolut** am Hauptmenü und nicht als Flex-Geschwister daneben:
 * sonst wächst der Popover-Inhalt beim Aufklappen von 250 auf 524 px, Radix
 * findet die Gruppe zu breit fürs Fenster und schiebt sie nach links — das
 * Hauptmenü springt vom Auslöser weg (Fehler in v4.7.0). Der Handoff will genau
 * das Gegenteil: das UNTERmenü klappt nach links, das Hauptmenü bleibt stehen
 * (§2.5). Die Seitenwahl rechnet `berechneUntermenueLage`.
 */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useHomeWidgets } from '../widgets/useHomeWidgets';
import { WIDGET_KATALOG } from '../widgets/widgetCatalog';
import { WidgetConfigForm } from '../widgets/WidgetConfigForm';
import { DarstellungUntermenue } from './DarstellungUntermenue';
import { FlaechenMenue } from './FlaechenMenue';
import { HeroMenue } from './HeroMenue';
import { MenuePanel } from './menueZeilen';
import { WidgetMenue } from './WidgetMenue';
import { WidgetsUntermenue } from './WidgetsUntermenue';
import { berechneUntermenueLage, useStartseiteMenueStore, type UntermenueId } from './useStartseiteMenue';

/** Handoff §5: Menü min. 250 px, Untermenü 268 px. */
const BREITE_MENUE = 250;
const BREITE_UNTERMENUE = 268;
/**
 * Die Einstellungs-Ansicht desselben Panels ist breiter als das Menü. Ein Menü
 * führt kurze Verben, das Formular eine Zeile je Lane: Name, Häkchen und der
 * Spaltenschalter nebeneinander. In 250 px blieben dem Namen 77 px — mit der
 * dritten Kartenspalte (v4.21) kürzten dort vier von neun Kategorien, darunter
 * „Zu bearbeiten". Gemessen reichen 290 px für acht davon; „Wartet auf
 * Antragsteller" (137 px) kürzt weiterhin und trägt dafür seinen `title`.
 */
const BREITE_EINSTELLUNGEN = 290;
/** Spalt zwischen den Panels, wie im Handoff-Prototyp. */
const ABSTAND = 6;

export function StartseiteMenue(): React.ReactElement {
  const offen = useStartseiteMenueStore(s => s.offen);
  const untermenue = useStartseiteMenueStore(s => s.untermenue);
  const lage = useStartseiteMenueStore(s => s.lage);
  const ansicht = useStartseiteMenueStore(s => s.ansicht);
  const schliesse = useStartseiteMenueStore(s => s.schliesse);
  const zeigeUntermenue = useStartseiteMenueStore(s => s.zeigeUntermenue);
  const contentRef = useRef<HTMLDivElement>(null);

  // Der Versatz macht das Untermenü an seiner Zeile fest statt am Kopf des
  // Hauptmenüs — gemessen gegen die Oberkante des Popovers, nicht per offsetTop
  // (das Panel ist nicht garantiert der offsetParent).
  const oeffneUnter = useCallback((id: UntermenueId, el: HTMLElement): void => {
    const panel = contentRef.current?.getBoundingClientRect();
    if (!panel) { zeigeUntermenue(id); return; }
    zeigeUntermenue(id, berechneUntermenueLage({
      panel,
      zeileOben: el.getBoundingClientRect().top,
      breite: BREITE_UNTERMENUE,
      abstand: ABSTAND,
      fensterBreite: window.innerWidth,
      fensterHoehe: window.innerHeight,
    }));
  }, [zeigeUntermenue]);

  // „Widget hinzufügen" öffnet das Menü mit bereits ausgeklapptem Untermenü —
  // dessen Seite lässt sich erst messen, wenn das Panel steht. Floating UI
  // reicht die Position asynchron nach, im Layout-Effekt sitzt das Panel also
  // noch am Ursprung. Deshalb einen Tick später, und nur solange die Lage
  // geraten ist. Bewusst `setTimeout` statt `requestAnimationFrame`: die Lage
  // hängt nicht an der Bildwiederholung, und in einem nicht gerenderten Fenster
  // käme ein rAF nie an.
  useLayoutEffect(() => {
    if (!untermenue || lage.gemessen) return;
    const id = window.setTimeout(() => {
      const panel = contentRef.current?.getBoundingClientRect();
      if (!panel?.width) return;
      zeigeUntermenue(untermenue, berechneUntermenueLage({
        panel,
        zeileOben: panel.top,
        breite: BREITE_UNTERMENUE,
        abstand: ABSTAND,
        fensterBreite: window.innerWidth,
        fensterHoehe: window.innerHeight,
      }));
    }, 0);
    return () => window.clearTimeout(id);
  }, [untermenue, lage, zeigeUntermenue]);

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
        className="relative block w-auto bg-transparent p-0 shadow-none ring-0"
        // Ohne das fokussiert Radix beim Öffnen die erste Zeile. Der Fokus wandert
        // stattdessen auf das Panel selbst (`tabIndex={-1}` von Radix' FocusScope),
        // damit Tab von dort in die Einträge führt und `Esc` sicher ankommt.
        onOpenAutoFocus={e => { e.preventDefault(); contentRef.current?.focus(); }}
        // Rechtsklick INS Menü soll weder das Browser-Menü zeigen noch das
        // Startseiten-Menü ein zweites Mal öffnen.
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        <div
          // Jede Zeile ohne eigenes Untermenü schließt beim Überfahren das offene.
          // Der Handler sitzt NUR am Hauptmenü — läge er am Rahmen, schlösse das
          // Überfahren des Untermenüs dieses sofort wieder.
          onMouseOver={e => {
            if (!(e.target as HTMLElement).closest('[data-untermenue]')) zeigeUntermenue(null);
          }}
        >
          <MenuePanel
            breite={
              ansicht === 'einstellungen' && offen.ziel.art === 'widget'
                ? BREITE_EINSTELLUNGEN
                : BREITE_MENUE
            }
          >
            {ansicht === 'einstellungen' && offen.ziel.art === 'widget' ? (
              <WidgetEinstellungen instanzId={offen.ziel.instanzId} />
            ) : offen.ziel.art === 'widget' ? (
              // Ohne `oeffneUnter`: die allgemeinen Untermenüs hängen allein am
              // Menü der freien Fläche (v4.40.2).
              <WidgetMenue instanzId={offen.ziel.instanzId} />
            ) : offen.ziel.art === 'hero' ? (
              <HeroMenue karte={offen.ziel.karte} />
            ) : (
              <FlaechenMenue oeffneUnter={oeffneUnter} />
            )}
          </MenuePanel>
        </div>
        {untermenue ? (
          <div
            className="absolute top-0"
            style={{
              marginTop: lage.versatz,
              left: lage.seite === 'rechts' ? `calc(100% + ${ABSTAND}px)` : undefined,
              right: lage.seite === 'links' ? `calc(100% + ${ABSTAND}px)` : undefined,
            }}
          >
            <MenuePanel breite={BREITE_UNTERMENUE} maxHoehe={lage.maxHoehe || undefined}>
              {untermenue === 'widgets' ? <WidgetsUntermenue /> : <DarstellungUntermenue />}
            </MenuePanel>
          </div>
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

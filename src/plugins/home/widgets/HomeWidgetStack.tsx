/**
 * Rendert die Widget-Instanzen eines Bereichs (haupt/seite) aus der
 * persönlichen Config. Mappt typ → Wrapper-Komponente; die Wrapper
 * entscheiden Selbst-Verstecken (null wie die heutigen Sektionen) und
 * rendern ihre WidgetShell selbst (eigene Titel/Meta/Zähler-Slots).
 *
 * Jede angezeigte Spalte endet mit „Widget hinzufügen" (v4.6) — die Hauptspalte
 * auch dann, wenn sie leer ist. Eine LEERE Seitenspalte zeigt die Startseite seit
 * v6.57 gar nicht erst (`renderbareWidgets` in HomePage): ihre 300 px gehören dann
 * der Hauptspalte und dem Assistent-Dock. Der Rückweg, für den v4.6 den Knopf in
 * jede Spalte setzte, ist seit v4.7 dreifach da — „Startseite anpassen", Rechts-
 * klick und „Widget hinzufügen" der Hauptspalte öffnen alle `Widgets ▸`, dessen
 * Gruppe „Seitenspalte" auch die ausgeblendeten Widgets führt.
 */
import { WidgetHinzufuegen } from '../anpassen/WidgetHinzufuegen';
import { AiAssistentWidget } from '../AiAssistantCard';
import { AntragseingangWidget } from '../EingangAmpelCard';
import { MeineAntraegeWidget } from '../MeineAntraegeSection';
import { NeueAntraegeWidget } from '../NeueAntraegeFuerDich';
import { WeitermachenWidget } from '../WeitermachenSection';
import { KanbanWidget } from './KanbanWidget';
import { NotizenWidget } from './NotizenWidget';
import { FeedbackNewsWidget } from './FeedbackNewsWidget';
import { AuslastungWidget } from './AuslastungWidget';
import { QsFreigabenWidget } from './QsFreigabenWidget';
import { RegistryAenderungenWidget } from './RegistryAenderungenWidget';
import { StatusVerlaufWidget } from './StatusVerlaufWidget';
import { NachtlaufWidget } from './NachtlaufWidget';
import { FristenWidget } from './FristenWidget';
import { TagesbriefWidget } from '../tagesbrief/TagesbriefWidget';
import { useHomeWidgets } from './useHomeWidgets';
import type { WidgetInstanz, WidgetTyp } from './types';
import type { HomeWidgetContext, WidgetProps } from './widgetProps';

/** Jeder Katalog-Typ hat einen Renderer (v1.1 komplett). Neue Zukunfts-Typen
 *  kämen hier zunächst als `null` rein (Katalog `verfuegbar: false`). */
const RENDERERS: Record<WidgetTyp, React.ComponentType<WidgetProps> | null> = {
  weitermachen: WeitermachenWidget,
  'meine-antraege': MeineAntraegeWidget,
  kanban: KanbanWidget,
  antragseingang: AntragseingangWidget,
  'ai-assistent': AiAssistentWidget,
  notizen: NotizenWidget,
  'feedback-news': FeedbackNewsWidget,
  auslastung: AuslastungWidget,
  'qs-freigaben': QsFreigabenWidget,
  'registry-aenderungen': RegistryAenderungenWidget,
  'neue-antraege': NeueAntraegeWidget,
  'status-verlauf': StatusVerlaufWidget,
  fristen: FristenWidget,
  tagesbrief: TagesbriefWidget,
  // Abgeloest von `fristen` (v4.87): im Katalog `verfuegbar: false`, also nie
  // gerendert. Der Eintrag bleibt, weil `RENDERERS` alle Typen fuehren muss.
  meilensteine: null,
  'haengt-fest': null,
  nachtlauf: NachtlaufWidget,
};

/** Die Instanzen, für die es einen Renderer gibt — was eine Spalte tatsächlich
 *  zeigt. HomePage entscheidet damit, ob die Seitenspalte überhaupt steht. */
export function renderbareWidgets(widgets: WidgetInstanz[]): WidgetInstanz[] {
  return widgets.filter(w => RENDERERS[w.typ] !== null);
}

interface Props {
  bereich: 'haupt' | 'seite';
  ctx: HomeWidgetContext;
  className?: string;
}

export function HomeWidgetStack({ bereich, ctx, className }: Props): React.ReactElement | null {
  const api = useHomeWidgets();
  const renderbar = renderbareWidgets(bereich === 'haupt' ? api.haupt : api.seite);
  if (!api.geladen) return null;
  return (
    <div className={className}>
      {renderbar.map(w => {
        const Renderer = RENDERERS[w.typ]!;
        return (
          <Renderer
            key={w.id}
            instanz={w}
            ctx={ctx}
            onToggleEingeklappt={() => api.setEingeklappt(w.id, !w.eingeklappt)}
          />
        );
      })}
      {renderbar.length === 0 ? (
        <p
          className="rounded-[var(--tf-radius-lg)] px-5 py-[22px] text-center text-[12.5px] leading-[1.6] text-[var(--tf-text-tertiary)]"
          style={{ border: '0.5px dashed var(--tf-border-hover)' }}
        >
          <span className="block font-medium text-[var(--tf-text-secondary)]">
            Keine Widgets in dieser Spalte
          </span>
          Rechtsklick auf die freie Fläche → Widgets
        </p>
      ) : null}
      <WidgetHinzufuegen />
    </div>
  );
}

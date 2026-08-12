/**
 * Rendert die Widget-Instanzen eines Bereichs (haupt/seite) aus der
 * persönlichen Config. Mappt typ → Wrapper-Komponente; die Wrapper
 * entscheiden Selbst-Verstecken (null wie die heutigen Sektionen) und
 * rendern ihre WidgetShell selbst (eigene Titel/Meta/Zähler-Slots).
 *
 * Seit v4.6 endet jede Spalte mit „Widget hinzufügen" — auch die leere. Vorher
 * verschwand eine leergeräumte Spalte samt jedem Anfasser; wer alles ausgeblendet
 * hatte, kam nur über die Einstellungen zurück.
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
import { MeilensteineWidget } from './MeilensteineWidget';
import { HaengtFestWidget } from './HaengtFestWidget';
import { NachtlaufWidget } from './NachtlaufWidget';
import { useHomeWidgets } from './useHomeWidgets';
import type { WidgetTyp } from './types';
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
  meilensteine: MeilensteineWidget,
  'haengt-fest': HaengtFestWidget,
  nachtlauf: NachtlaufWidget,
};

interface Props {
  bereich: 'haupt' | 'seite';
  ctx: HomeWidgetContext;
  className?: string;
}

export function HomeWidgetStack({ bereich, ctx, className }: Props): React.ReactElement | null {
  const api = useHomeWidgets();
  const widgets = bereich === 'haupt' ? api.haupt : api.seite;
  const renderbar = widgets.filter(w => RENDERERS[w.typ] !== null);
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

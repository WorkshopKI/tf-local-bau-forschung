/**
 * Rendert die Widget-Instanzen eines Bereichs (haupt/seite) aus der
 * persönlichen Config. Mappt typ → Wrapper-Komponente; die Wrapper
 * entscheiden Selbst-Verstecken (null wie die heutigen Sektionen) und
 * rendern ihre WidgetShell selbst (eigene Titel/Meta/Zähler-Slots).
 */
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
  if (!api.geladen || renderbar.length === 0) return null;
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
    </div>
  );
}

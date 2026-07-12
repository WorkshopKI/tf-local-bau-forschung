/**
 * Rendert die Widget-Instanzen eines Bereichs (haupt/seite) aus der
 * persönlichen Config. Mappt typ → Wrapper-Komponente; die Wrapper
 * entscheiden Selbst-Verstecken (null wie die heutigen Sektionen) und
 * rendern ihre WidgetShell selbst (eigene Titel/Meta/Zähler-Slots).
 */
import { AiAssistentWidget } from '../AiAssistantCard';
import { AntragseingangWidget } from '../EingangAmpelCard';
import { MeineAntraegeWidget } from '../MeineAntraegeSection';
import { WeitermachenWidget } from '../WeitermachenSection';
import { useHomeWidgets } from './useHomeWidgets';
import type { WidgetTyp } from './types';
import type { HomeWidgetContext, WidgetProps } from './widgetProps';

/** Phase 1: kanban/notizen folgen in Phase 2/3; Zukunfts-Typen sind im Katalog
 *  `verfuegbar: false` und erreichen den Stack nie — null als Sicherheitsnetz. */
const RENDERERS: Record<WidgetTyp, React.ComponentType<WidgetProps> | null> = {
  weitermachen: WeitermachenWidget,
  'meine-antraege': MeineAntraegeWidget,
  kanban: null,
  antragseingang: AntragseingangWidget,
  'ai-assistent': AiAssistentWidget,
  notizen: null,
  'qs-freigaben': null,
  'feedback-news': null,
  'registry-aenderungen': null,
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

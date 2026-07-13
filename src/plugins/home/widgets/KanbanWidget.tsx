/**
 * Kanban-Widget-Dispatcher (v1.1): wählt nach `config.quelle` den passenden
 * Renderer — Förderanträge oder Feedback. So bleibt jede Quelle in ihrer eigenen
 * kohärenten Komponente (kein Domänen-Mix), und das Instanz-Modell trägt zwei
 * gleichzeitige Kanbans (eine je Quelle).
 */
import { AntragKanbanWidget } from './AntragKanbanWidget';
import { FeedbackKanbanWidget } from './FeedbackKanbanWidget';
import type { WidgetProps } from './widgetProps';

export function KanbanWidget(props: WidgetProps): React.ReactElement {
  const cfg = props.instanz.config;
  if (cfg.art === 'kanban' && cfg.quelle === 'feedback') {
    return <FeedbackKanbanWidget {...props} />;
  }
  return <AntragKanbanWidget {...props} />;
}

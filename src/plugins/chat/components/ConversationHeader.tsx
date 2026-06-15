import { PanelLeft } from 'lucide-react';

interface ConversationHeaderProps {
  title: string;
  onToggleRail: () => void;
}

/** Kopfzeile der Conversation-Spalte: Sidebar-Toggle, Titel. */
export function ConversationHeader({ title, onToggleRail }: ConversationHeaderProps): React.ReactElement {
  return (
    <div className="convo-head">
      <button className="icon-btn" title="Seitenleiste ein-/ausblenden" onClick={onToggleRail}>
        <PanelLeft size={17} />
      </button>
      <div className="head-left">
        <span className="convo-title">{title}</span>
      </div>
      <div className="head-spacer" />
    </div>
  );
}

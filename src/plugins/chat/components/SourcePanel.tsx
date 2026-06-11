import { X } from 'lucide-react';
import { useNavigation } from '@/core/hooks/useNavigation';
import type { ChatSource } from '../types';

const METHOD_LABEL: Record<string, string> = { hybrid: 'Hybrid', vector: 'Vektor', fulltext: 'Volltext' };

/** «term» → hervorgehobenes .hl-Fragment. */
function renderHighlighted(snippet: string): React.ReactNode[] {
  return snippet.split(/(«[^»]+»)/).map((part, i) =>
    part.startsWith('«') && part.endsWith('»')
      ? <span className="hl" key={i}>{part.slice(1, -1)}</span>
      : <span key={i}>{part}</span>,
  );
}

interface SourcePanelProps {
  src: ChatSource;
  onClose: () => void;
}

/** Slide-over mit Quellen-Details (Snippet, Meta, „Antrag öffnen"). */
export function SourcePanel({ src, onClose }: SourcePanelProps): React.ReactElement {
  const nav = useNavigation();
  return (
    <aside className="srcpanel">
      <div className="srcpanel-head">
        <div className="srcpanel-cap">Quelle {src.n}</div>
        <button className="srcpanel-x" title="Schließen" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="srcpanel-body scroll">
        <div className="srcpanel-title">{src.title}</div>
        <div className="srcpanel-meta">
          <span className="mchip rel">Relevanz {src.relevance} %</span>
          <span className="mchip">{METHOD_LABEL[src.method] ?? src.method}</span>
          {src.type && <span className="mchip">{src.type}</span>}
        </div>
        <div className="srcsnip">
          {src.snippet ? renderHighlighted(src.snippet) : 'Kein Textauszug verfügbar.'}
        </div>
        <div className="srcpanel-links">
          {src.antragFkz && (
            <button className="lnk-pri" onClick={() => nav.navigate('antraege', { selectedId: src.antragFkz })}>
              Antrag {src.antragFkz} öffnen →
            </button>
          )}
          <span className="lnk-sec">{src.sourcePath}</span>
        </div>
      </div>
    </aside>
  );
}

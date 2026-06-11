import { Folder, FileText, Pencil, Search, Sparkles } from 'lucide-react';
import { Composer, type ComposerProps } from './Composer';

const SUGGESTIONS: Array<{ icon: React.ReactNode; label: string }> = [
  { icon: <Folder size={15} />, label: 'Anträge zu einem Thema clustern' },
  { icon: <FileText size={15} />, label: 'Ein Förderprojekt zusammenfassen' },
  { icon: <Pencil size={15} />, label: 'Gutachten-Entwurf vorbereiten' },
  { icon: <Search size={15} />, label: 'Im Archiv nach KI-Projekten suchen' },
];

interface EmptyStateProps extends ComposerProps {
  onSuggestion: (text: string) => void;
}

/** Leerer Chat: Sparkles-Mark, Titel, Composer + Vorschlags-Chips. */
export function EmptyState({ onSuggestion, ...composer }: EmptyStateProps): React.ReactElement {
  return (
    <div className="empty">
      <div className="empty-mark"><Sparkles size={22} /></div>
      <h1 className="empty-title">Wie kann ich unterstützen?</h1>
      <div className="empty-sub">Frag den Archiv-Assistenten zu Anträgen, Dokumenten und Gutachten.</div>
      <Composer {...composer} autoFocus />
      <div className="suggest-row">
        {SUGGESTIONS.map(s => (
          <button key={s.label} className="suggest" onClick={() => onSuggestion(s.label)}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

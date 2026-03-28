import { useState } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { Extension } from '@codemirror/state';

interface MarkdownEditorWithPreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  extensions?: Extension[];
  toolbar?: React.ReactNode;
}

type ViewMode = 'split' | 'editor' | 'preview';

export function MarkdownEditorWithPreview({
  value, onChange, placeholder, readOnly, extensions, toolbar,
}: MarkdownEditorWithPreviewProps): React.ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          {(['editor', 'split', 'preview'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1 text-[12px] rounded-[var(--tf-radius)] cursor-pointer transition-colors ${
                viewMode === mode ? 'bg-[var(--tf-text)] text-[var(--tf-bg)]' : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}>
              {mode === 'editor' ? 'Editor' : mode === 'preview' ? 'Vorschau' : 'Split'}
            </button>
          ))}
        </div>
        {toolbar}
      </div>

      <div className={`flex gap-0 ${viewMode === 'split' ? '' : ''}`}>
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={viewMode === 'split' ? 'flex-1' : 'w-full'}>
            <MarkdownEditor value={value} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
              minHeight="300px" maxHeight="500px" extensions={extensions} />
          </div>
        )}
        {viewMode === 'split' && <div className="w-px bg-[var(--tf-border)] mx-2" />}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'flex-1' : 'w-full'} p-4 rounded-[var(--tf-radius)] overflow-auto`}
            style={{ border: '0.5px solid var(--tf-border)', minHeight: '300px', maxHeight: '500px' }}>
            <MarkdownRenderer content={value} />
          </div>
        )}
      </div>
    </div>
  );
}

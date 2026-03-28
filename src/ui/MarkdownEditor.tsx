import { useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  extensions?: Extension[];
}

const baseTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '13.5px' },
  '.cm-content': { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', padding: '8px 0' },
  '.cm-line': { padding: '0 12px' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--tf-text-tertiary)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-activeLine': { backgroundColor: 'var(--tf-hover)' },
  '.cm-cursor': { borderLeftColor: 'var(--tf-text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'var(--tf-hover) !important' },
  '.cm-placeholder': { color: 'var(--tf-text-tertiary)' },
});

export function MarkdownEditor({
  value, onChange, placeholder, readOnly, minHeight = '200px', maxHeight, className = '', extensions: extraExtensions = [],
}: MarkdownEditorProps): React.ReactElement {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback((val: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(val), 300);
  }, [onChange]);

  return (
    <div className={`rounded-[var(--tf-radius)] overflow-hidden ${className}`}
      style={{ border: '0.5px solid var(--tf-border)', minHeight, maxHeight, overflow: maxHeight ? 'auto' : undefined }}>
      <CodeMirror
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
          baseTheme,
          ...extraExtensions,
        ]}
        style={{ minHeight }}
      />
    </div>
  );
}

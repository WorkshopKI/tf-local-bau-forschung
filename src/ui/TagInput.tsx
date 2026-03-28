import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: (prefix: string) => string[];
}

export function TagInput({ value, onChange, placeholder = 'Tag hinzufügen...', suggestions }: TagInputProps): React.ReactElement {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback((tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
    setInput('');
    setShowSuggestions(false);
  }, [value, onChange]);

  const removeTag = useCallback((tag: string) => {
    onChange(value.filter(t => t !== tag));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1] ?? '');
    }
  };

  const matches = suggestions && input.trim() ? suggestions(input).filter(s => !value.includes(s)) : [];

  return (
    <div className="relative">
      <div
        className="flex flex-wrap gap-1.5 px-2 py-1.5 rounded-[var(--tf-radius)] min-h-[38px] items-center cursor-text"
        style={{ border: '0.5px solid var(--tf-border)' }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] rounded-full">
            {tag}
            <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="cursor-pointer hover:text-[var(--tf-text)]">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-[13px] bg-transparent text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
        />
      </div>

      {showSuggestions && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--tf-bg)] rounded-[var(--tf-radius)] z-10 py-1 max-h-[140px] overflow-y-auto"
          style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {matches.map(s => (
            <button key={s} onMouseDown={() => addTag(s)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

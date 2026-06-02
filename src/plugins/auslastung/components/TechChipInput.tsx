/**
 * TechChipInput — Chip-Eingabe für frei getippte Technologie-Stichworte.
 *
 * Enter/Komma → neuer Chip, Backspace im leeren Input → letzten Chip entfernen,
 * × pro Chip. Paste mit Kommas splittet sofort. Dedupliziert case-insensitiv,
 * begrenzt Chip-Anzahl + -Länge.
 *
 * Extrahiert aus `einstellungen/MeineTechnologienTab.tsx`, damit der Self-
 * Service-Tab UND die PL-Bearbeiten-Maske (`MaInlineDetail.tsx`) denselben
 * Input nutzen.
 */
import { useRef, useState } from 'react';

export function TechChipInput({
  tags,
  onChange,
  maxChips,
  maxChipLen,
  placeholder,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  maxChips: number;
  maxChipLen: number;
  placeholder: string;
}): React.ReactElement {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string): void => {
    const candidate = raw.trim().slice(0, maxChipLen);
    if (!candidate) return;
    if (tags.length >= maxChips) return;
    const lower = candidate.toLowerCase();
    if (tags.some(t => t.toLowerCase() === lower)) {
      setDraft('');
      return;
    }
    onChange([...tags, candidate]);
    setDraft('');
  };

  const removeAt = (idx: number): void => {
    onChange(tags.filter((_, i) => i !== idx));
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    }
  };

  const onChangeRaw = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value;
    // Komma im Wert (z.B. Paste) sofort splitten und committen
    if (val.includes(',')) {
      const parts = val.split(',');
      const last = parts.pop() ?? '';
      for (const p of parts) commit(p);
      setDraft(last);
      return;
    }
    setDraft(val);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] min-h-[44px] cursor-text"
      style={{ border: '0.5px solid var(--tf-border-hover)' }}
      onClick={e => {
        if (e.target === e.currentTarget) inputRef.current?.focus();
      }}
    >
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text)] bg-[var(--tf-bg)] pl-2.5 pr-1 py-1 rounded-md"
          style={{ border: '0.5px solid var(--tf-border-hover)' }}
        >
          {tag}
          <button
            type="button"
            aria-label={`Stichwort '${tag}' entfernen`}
            onClick={() => removeAt(idx)}
            className="w-[18px] h-[18px] inline-flex items-center justify-center rounded text-[14px] leading-none text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={onChangeRaw}
        onKeyDown={onKey}
        onBlur={() => { if (draft) commit(draft); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        disabled={tags.length >= maxChips}
        className="flex-1 min-w-[160px] py-1 px-1 bg-transparent text-[12px] text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)] disabled:cursor-not-allowed"
      />
    </div>
  );
}

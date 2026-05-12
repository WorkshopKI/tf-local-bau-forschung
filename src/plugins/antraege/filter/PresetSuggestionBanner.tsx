import { Lightbulb, X } from 'lucide-react';

interface Props {
  count: number;
  onSave: () => void;
  onDismiss: () => void;
}

/**
 * One-Time-Hint: erscheint wenn die aktuelle Filter-Kombi >= N mal angewendet
 * wurde und der User den Hint für diese Signatur noch nicht weggeklickt hat.
 * Aktion "Speichern" öffnet den SavePresetDialog UND dismissed den Hint
 * (egal ob der Dialog am Ende confirmed wird — der User hat ja agiert).
 */
export function PresetSuggestionBanner({ count, onSave, onDismiss }: Props): React.ReactElement {
  return (
    <div
      className="mx-3 mt-3 rounded-md p-2.5"
      style={{
        background: 'var(--tf-primary-light)',
        border: '0.5px solid var(--tf-border-hover)',
      }}
    >
      <div className="flex items-start gap-2">
        <Lightbulb
          size={13}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--tf-primary)' }}
        />
        <div className="flex-1 min-w-0 text-[11.5px] text-[var(--tf-text)] leading-snug">
          Diese Filter-Kombi hast du {count}-mal verwendet — als Preset speichern?
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Vorschlag schließen"
          title="Nicht mehr fragen"
          className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer -mt-0.5 -mr-0.5"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex gap-1.5 mt-2 ml-[21px]">
        <button
          type="button"
          onClick={onSave}
          className="text-[11px] px-2.5 py-1 rounded text-white cursor-pointer"
          style={{ background: 'var(--tf-primary)' }}
        >
          Als Preset speichern
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] px-2 py-1 rounded text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
        >
          Nicht mehr fragen
        </button>
      </div>
    </div>
  );
}

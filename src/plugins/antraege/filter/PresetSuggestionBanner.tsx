import { Lightbulb, X } from 'lucide-react';

interface Props {
  count: number;
  onPin: () => void;
  onSave: () => void;
  onDismiss: () => void;
}

/**
 * One-Time-Hint: erscheint wenn die aktuelle Filter-Kombi >= N mal angewendet
 * wurde und der User den Hint für diese Signatur noch nicht weggeklickt hat.
 * Beide Aktionen dismissen den Hint (egal ob der Dialog am Ende bestätigt wird
 * — der User hat ja agiert).
 *
 * **Anpinnen steht vorn** (v4.65): der Vorschlag kommt, weil derselbe Satz
 * mehrfach gebraucht wurde — das ist die Beschreibung eines Schalters, nicht
 * eines Archiveintrags. Der Pin sitzt danach als Chip über der Tabelle und ist
 * ein Klick entfernt; ein Preset muss man erst benennen und dann suchen. Beides
 * bleibt erreichbar, die Reihenfolge sagt nur, was gemeint war.
 */
export function PresetSuggestionBanner({ count, onPin, onSave, onDismiss }: Props): React.ReactElement {
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
          Diesen Filterstand hast du {count}-mal verwendet — als Schnellzugriff anpinnen?
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
          onClick={onPin}
          title="Als Schalter über die Tabelle legen — ein Klick schaltet ihn an und aus"
          className="text-[11px] px-2.5 py-1 rounded text-white cursor-pointer"
          style={{ background: 'var(--tf-primary)' }}
        >
          Anpinnen
        </button>
        <button
          type="button"
          onClick={onSave}
          title="Unter einem Namen ablegen und später wieder laden"
          className="text-[11px] px-2 py-1 rounded text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
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

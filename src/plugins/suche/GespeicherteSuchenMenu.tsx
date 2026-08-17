/**
 * Das Klappmenü „Gespeicherte Suchen" im Seitenkopf.
 *
 * Reines Anzeige-Bauteil zum Zustand aus
 * [useGespeicherteSuchen](./useGespeicherteSuchen.ts): es zeigt die gemerkten
 * Anfragen mit ihrer AKTUELLEN Trefferzahl (Probelauf, nicht die gespeicherte)
 * und meldet Klicks nach oben. Ausgeführt wird oben, weil eine gemerkte Suche
 * ihre eigenen Regler mitbringt und die auf der Seite wohnen.
 */
import { Bookmark } from 'lucide-react';
import type { GespeicherteSuche } from './gespeicherteSuchen';

export interface GespeicherteSuchenMenuProps {
  liste: readonly GespeicherteSuche[];
  /** Aktuelle Trefferzahl je Eintrag; fehlt sie, steht „—". */
  treffer: ReadonlyMap<string, number>;
  offen: boolean;
  onToggle: () => void;
  onAusfuehren: (g: GespeicherteSuche) => void;
  onLoeschen: (id: string) => void;
}

export function GespeicherteSuchenMenu({
  liste, treffer, offen, onToggle, onAusfuehren, onLoeschen,
}: GespeicherteSuchenMenuProps): React.ReactElement {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        <Bookmark size={13} aria-hidden />
        Gespeicherte Suchen
        <span className="text-[var(--tf-text-tertiary)]">{liste.length}</span>
      </button>
      {offen && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-[320px] rounded-[11px] py-1"
          style={{
            background: 'var(--tf-sheet)',
            border: '0.5px solid var(--tf-border)',
            boxShadow: 'var(--tf-shadow-dialog)',
          }}
        >
          {liste.length === 0
            ? (
              <p className="px-3 py-2 text-[12.5px] text-[var(--tf-text-tertiary)]">
                Noch nichts gemerkt.
              </p>
            )
            : liste.map(g => (
              <div key={g.id} className="group flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => onAusfuehren(g)}
                  className="min-w-0 flex-1 rounded-[6px] px-2 py-1.5 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
                >
                  <span className="block truncate text-[13px] text-[var(--tf-text)]">{g.name}</span>
                  <span className="block text-[11px] text-[var(--tf-text-tertiary)]">
                    {treffer.get(g.id) ?? '—'} Treffer
                    {g.zuletzt ? ` · zuletzt ${g.zuletzt}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onLoeschen(g.id)}
                  title="Aus den gespeicherten Suchen entfernen"
                  className="mr-1 rounded p-1 text-[var(--tf-text-tertiary)] opacity-0 hover:text-[var(--tf-text)] group-hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

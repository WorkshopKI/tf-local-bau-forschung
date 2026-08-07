/**
 * Aus Tabellenspalten werden Klickzonen — ohne die Spaltenregistry anzufassen.
 *
 * `tableColumns.tsx` beschreibt, WAS eine Zelle zeigt. Was ein Klick darauf tut,
 * ist eine Frage der Tabelle, nicht der Spalte: dieselbe Status-Spalte steht
 * auch im Export und in der Breitenmessung, und beide interessiert kein
 * Ausklappen. Deshalb wird hier nur `render` umhüllt; `accessor`, `sortable`,
 * `filterable` und die Mess-Angaben bleiben, wie sie sind.
 *
 * **Warum `role="button"` statt `<button>`.** Die Status-Zelle enthält bereits
 * das Info-Icon des Herleitungs-Popovers als `<button>`, die FKZ-Zelle den
 * Kopier-Knopf. Ein Button um einen Button ist ungültiges HTML, und der Browser
 * zerreißt die Tab-Reihenfolge daran. Die Zone bringt deshalb Tastatur und ARIA
 * selbst mit: Enter und Leertaste lösen aus, `aria-expanded`/`aria-controls`
 * sagen, was sie steuert.
 */
import { ChevronDown } from 'lucide-react';
import type { SortableColumn } from '@/components/data-table/types';
import { bereichsId, type ReiterId } from './ausklappZustand';

/** Welche Spalte welchen Reiter vorwählt. */
export const AUSKLAPP_SPALTEN: Readonly<Record<string, ReiterId>> = {
  status_naechster_schritt: 'verlauf',
  status: 'verlauf',
  frist: 'fristen',
};

/**
 * Die Spalten, aus denen heraus navigiert wird.
 *
 * **Zwei, nicht eine.** Der Prompt nennt das Akronym — aber die Akronym-Spalte
 * lässt sich über den Spalten-Picker ausblenden, und dann führte aus der Tabelle
 * kein Weg mehr ins Detail. Die FKZ-Spalte ist `locked` und damit die einzige,
 * die garantiert dasteht.
 */
export const NAVIGATIONS_SPALTEN: readonly string[] = ['akronym', 'aktenzeichen'];

export interface KlickzonenApi<T> {
  zeilenKey: (row: T) => string;
  istOffen: (row: T) => boolean;
  offenerReiter: (row: T) => ReiterId | null;
  umschalten: (row: T, reiter: ReiterId) => void;
  oeffnenDetail: (row: T) => void;
  /** `false` = kein Reiter trägt Inhalt; dann bleibt die Tabelle wie bisher. */
  ausklappbar: boolean;
}

const ZONE_BASIS = 'inline-flex items-center gap-1 w-full cursor-pointer '
  + 'hover:underline hover:decoration-dotted underline-offset-2 '
  + 'focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--tf-primary)]';

function AusklappZone({ offen, reiter, ziel, onAus, kinder }: {
  offen: boolean; reiter: ReiterId; ziel: string;
  onAus: (r: ReiterId) => void; kinder: React.ReactNode;
}): React.ReactElement {
  const aus = (e: React.SyntheticEvent): void => {
    e.stopPropagation();
    onAus(reiter);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-expanded={offen}
      aria-controls={ziel}
      onClick={aus}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        aus(e);
      }}
      className={ZONE_BASIS}
    >
      <span className="min-w-0 truncate">{kinder}</span>
      <ChevronDown
        size={12}
        aria-hidden="true"
        className="ml-auto shrink-0 text-[var(--tf-text-tertiary)] transition-transform duration-150"
        style={{ transform: offen ? 'rotate(180deg)' : 'rotate(0deg)' }}
      />
    </span>
  );
}

function NavZone({ onOeffnen, kinder }: {
  onOeffnen: () => void; kinder: React.ReactNode;
}): React.ReactElement {
  return (
    <span
      role="link"
      tabIndex={0}
      title="Antrag öffnen"
      onClick={e => { e.stopPropagation(); onOeffnen(); }}
      onKeyDown={e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        onOeffnen();
      }}
      className={ZONE_BASIS}
    >
      {kinder}
    </span>
  );
}

/**
 * Hüllt die Klickzonen um die gegebenen Spalten. Alle übrigen Spalten kommen
 * unverändert zurück — sie tragen weder Cursor noch Chevron.
 */
export function machKlickbar<T>(
  columns: readonly SortableColumn<T>[], api: KlickzonenApi<T>,
): SortableColumn<T>[] {
  return columns.map(c => {
    const reiter = api.ausklappbar ? AUSKLAPP_SPALTEN[c.key] : undefined;
    if (reiter !== undefined) {
      return {
        ...c,
        render: (row: T) => {
          const inhalt = c.render(row);
          if (inhalt === null || inhalt === undefined) return inhalt;
          const offen = api.istOffen(row) && api.offenerReiter(row) === reiter;
          return (
            <AusklappZone
              offen={offen}
              reiter={reiter}
              ziel={bereichsId(api.zeilenKey(row))}
              onAus={r => api.umschalten(row, r)}
              kinder={inhalt}
            />
          );
        },
      };
    }
    if (NAVIGATIONS_SPALTEN.includes(c.key)) {
      return {
        ...c,
        render: (row: T) => {
          const inhalt = c.render(row);
          if (inhalt === null || inhalt === undefined) return inhalt;
          return <NavZone onOeffnen={() => api.oeffnenDetail(row)} kinder={inhalt} />;
        },
      };
    }
    return c;
  });
}

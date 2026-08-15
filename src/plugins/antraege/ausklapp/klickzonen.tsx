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
import { G_STATUS } from '../tableColumns';
import { bereichsId, type ReiterId } from './ausklappZustand';

/**
 * Welche Spalte welchen Reiter vorwählt — **Rubrik zuerst, Einzelfall danach**.
 *
 * Die ganze Rubrik „Status" klappt den Verlauf auf: wer auf irgendeine
 * Status-Angabe klickt, will wissen, wie sie zustande kam, und es wäre nicht
 * erklärbar, dass zwei der vier Spalten reagieren und zwei nicht. Über die
 * Rubrik statt über eine Schlüsselliste, damit eine künftige Status-Spalte das
 * erbt, ohne dass jemand hier nachträgt.
 */
const AUSKLAPP_GRUPPEN: Readonly<Record<string, ReiterId>> = {
  [G_STATUS]: 'zeitverlauf',
};

/** Einzelspalten außerhalb ihrer Rubrik. `frist` steht unter „Termine", öffnet
 *  aber die Fristrechnung — die übrigen Termin-Spalten sind bloße Daten. */
const AUSKLAPP_SPALTEN: Readonly<Record<string, ReiterId>> = {
  frist: 'vorgangsverlauf',
};

/** Der Reiter, den ein Klick auf diese Spalte vorwählt; `undefined` = kein
 *  Ausklappen. Die Einzelspalte gewinnt gegen ihre Rubrik. */
export function ausklappReiter(
  key: string, gruppe: string | undefined,
): ReiterId | undefined {
  return AUSKLAPP_SPALTEN[key] ?? (gruppe === undefined ? undefined : AUSKLAPP_GRUPPEN[gruppe]);
}

/**
 * Die Spalten, aus denen heraus navigiert wird.
 *
 * **Drei, nicht eine.** Seit v4.63 trägt die zusammengelegte `antrag`-Spalte
 * (Akronym + FKZ) die Identität und ist `locked`, steht also garantiert da. Die
 * beiden Einzelspalten bleiben wählbar und behalten ihre Zone — wer sie
 * einblendet, erwartet dort denselben Weg ins Detail wie zuvor.
 */
export const NAVIGATIONS_SPALTEN: readonly string[] = ['antrag', 'akronym', 'aktenzeichen'];

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
    const reiter = api.ausklappbar ? ausklappReiter(c.key, c.gruppe) : undefined;
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

/**
 * Das Bedienbündel einer Bedingung oder Karte: der **Griff** zum Ziehen und ein
 * **⋯-Menü** mit den Umbau-Schaltern.
 *
 * Bis v6.58 standen hier sieben Icons nebeneinander, per `ml-auto` an den
 * rechten Rand geschoben; seit v6.59 ein Menü direkt am Inhalt. **Die Einträge
 * bestimmt seit v6.60 der Aufrufer**: eine Karte bietet „nach links / rechts,
 * duplizieren, auflösen", eine Bedingung „nach oben / unten, zur Gruppe machen,
 * aus der Gruppe lösen" — dieselbe Machart, verschiedene Wörter.
 *
 * **Ohne Maus erreichbar**: ein Radix-DropdownMenu (Tab auf ⋯, Enter,
 * Pfeiltasten). Gesperrte Einträge bleiben sichtbar und nennen ihren Grund in
 * einer zweiten Zeile, statt zu verblassen (Pitfall #14). Die Farben bleiben
 * gemessen: gesperrt `--tf-text-tertiary`, der Grund `--tf-text-secondary`
 * (5,33:1), weil er Bedeutung trägt.
 *
 * **Tastatur-Ereignisse enden am Menü.** Es liegt im Portal, React reicht seine
 * Ereignisse aber durch den KOMPONENTEN-Baum weiter — und darüber liegt der
 * Meilenstein-`TfTree`, dessen Pfeiltasten sonst die Auswahl verschöben.
 */
import { Fragment } from 'react';
import { GripVertical, MoreHorizontal, type LucideIcon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Ein Eintrag des ⋯-Menüs. */
export interface AktionsEintrag {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  /** Gerade nicht möglich — der Eintrag bleibt sichtbar und nennt `grund`. */
  aus?: boolean;
  grund?: string;
  /** Zerstörend (Entfernen) — in der Gefahr-Farbe. */
  gefahr?: boolean;
  /** Trennlinie vor diesem Eintrag. */
  trennerDavor?: boolean;
}

function Eintrag({ e }: { e: AktionsEintrag }): React.ReactElement {
  const Icon = e.icon;
  const aus = !!e.aus;
  const farbe = aus
    ? 'text-[var(--tf-text-tertiary)]'
    : (e.gefahr ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text)]');
  return (
    <DropdownMenuItem
      disabled={aus}
      onSelect={e.onSelect}
      className={`items-start text-[12.5px] data-disabled:opacity-100 ${farbe}`}
    >
      <Icon className="mt-[2px] size-3.5" />
      <span className="flex min-w-0 flex-col">
        <span>{e.label}</span>
        {aus && e.grund && (
          <span className="text-[11px] leading-snug text-[var(--tf-text-secondary)]">{e.grund}</span>
        )}
      </span>
    </DropdownMenuItem>
  );
}

export function ZeilenAktionen({ was, eintraege, griffProps }: {
  /** „Bedingung" oder „Gruppe" — steht in Titel und Beschriftung. */
  was: string;
  eintraege: readonly AktionsEintrag[];
  /** Ziehen erlaubt? Der Griff bekommt dann die HTML5-Drag-Eigenschaften. */
  griffProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
}): React.ReactElement {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {griffProps && (
        <span
          {...griffProps}
          title={`${was} ziehen — an eine andere Stelle oder in eine andere Karte`}
          className="px-0.5 py-0.5 rounded cursor-grab active:cursor-grabbing
            text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
        >
          <GripVertical size={14} />
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`${was}: weitere Aktionen`}
            title={`${was}: verschieben, umbauen, entfernen`}
            className="p-0.5 rounded cursor-pointer text-[var(--tf-text-secondary)]
              hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] data-[state=open]:bg-[var(--tf-hover)]"
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72" onKeyDown={e => e.stopPropagation()}>
          {eintraege.map((e, i) => (
            <Fragment key={e.label}>
              {e.trennerDavor && i > 0 && <DropdownMenuSeparator />}
              <Eintrag e={e} />
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

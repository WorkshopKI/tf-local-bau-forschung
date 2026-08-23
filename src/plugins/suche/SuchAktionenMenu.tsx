/**
 * Das ⋯-Menü im Kopf der Suchseite: Wege, die zur Suche gehören, aber keine
 * eigene Schaltfläche verdienen.
 *
 * Bewusst kein Radix `DropdownMenu` (in diesem Projekt nicht installiert) —
 * dasselbe `useRef`/`useClickOutside`-Muster wie
 * [SearchDownloadMenu.tsx](src/plugins/suche/SearchDownloadMenu.tsx), damit das
 * Plugin eine Optik behält.
 *
 * Das Menü erscheint nur, wenn es etwas zu zeigen hat: steht kein einziger
 * Eintrag zur Verfügung (alle Flags aus), rendert es `null` statt eines Knopfes,
 * der sich als leere Klappe öffnet.
 */
import { memo, useRef, useState } from 'react';
import { CopyCheck, MoreHorizontal } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useSichtbar } from '@/core/hooks/useSichtbar';
import { seiteId } from '@/core/sichtbarkeit';
import { isDoppelfoerderungEnabled } from '@/config/feature-flags';
import { doppelfoerderungPlugin } from '@/plugins/doppelfoerderung';

function SuchAktionenMenuInner(): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offen, setOffen] = useState(false);
  const { navigate } = useNavigation();
  const sichtbar = useSichtbar();

  useClickOutside(containerRef, () => setOffen(false), offen);

  // Zwei Fragen, beide nötig: der Flag sagt, ob die Seite EINKOMPILIERT ist, die
  // Sichtbarkeits-Achse, ob dieser Nutzer Beta-Sachen sehen will. Der
  // Sidebar-Filter im ShellLayout kann das hier nicht übernehmen — die Seite
  // steht wegen `hideFromNav` gar nicht in der Navigation, und ihr einziger
  // Einstieg ist dieser Menüpunkt (Pitfall #54: nur `useSichtbar()` fragt).
  const doppelfoerderung = isDoppelfoerderungEnabled()
    && sichtbar(seiteId(doppelfoerderungPlugin.id));
  if (!doppelfoerderung) return null;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOffen(o => !o)}
        aria-label="Weitere Aktionen"
        aria-expanded={offen}
        title="Weitere Aktionen"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        <MoreHorizontal size={16} />
      </button>
      {offen && (
        <div
          className="absolute top-full right-0 z-[100] mt-1 w-[290px] rounded-[var(--tf-radius)] bg-[var(--tf-bg)] py-1 shadow-md"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          {doppelfoerderung && (
            <button
              type="button"
              onClick={() => { setOffen(false); navigate(doppelfoerderungPlugin.id); }}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[var(--tf-hover)] cursor-pointer"
            >
              <CopyCheck size={14} className="mt-0.5 shrink-0 text-[var(--tf-text-secondary)]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[12.5px] text-[var(--tf-text)]">Doppelförderung</span>
                <span className="text-[11.5px] leading-snug text-[var(--tf-text-tertiary)]">
                  Eine gemeldete Liste der Frühkoordinierung hochladen und gegen den
                  Bestand halten.
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const SuchAktionenMenu = memo(SuchAktionenMenuInner);

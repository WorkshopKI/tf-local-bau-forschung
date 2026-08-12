/**
 * Eine Zeile je Wurzel der persönlichen Ordner — mit genau einem Knopf.
 *
 * Bis v4.0 gab es eine Wurzel und dafür an vier Stellen ein eigenes Banner
 * („nicht verbunden" / „erneut freigeben"). Bei mehreren Wurzeln wird daraus
 * eine Liste: pro Gruppe eine Zeile, ein Zustand, ein Knopf.
 *
 * **Ein Knopf je Wurzel ist keine Kosmetik.** Unter `file://` verbraucht
 * Chromium die User-Activation pro Berechtigungs-Dialog — eine Schleife über N
 * Wurzeln in einem Klick verhungert ab der zweiten still (recurring-bug §2).
 * N Wurzeln = N Klicks.
 *
 * Der Alt-Slot (v2.0-Einzelwurzel) erscheint als eigene Zeile und wird KEINER
 * Gruppe automatisch zugeordnet — welche es war, weiß niemand. Er lässt sich
 * lesen, bis der Kurator die Gruppen neu gepickt hat, und danach entfernen.
 */

import { FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import type {
  UserFoldersRoot,
  PermStateOrMissing,
} from '@/core/services/infrastructure/smb-handle';

interface WurzelnVerbindenProps {
  wurzeln: readonly UserFoldersRoot[];
  zustaende: Record<string, PermStateOrMissing>;
  /** Verbindet oder gibt GENAU EINE Wurzel frei (ein Dialog). */
  verbinde: (root: UserFoldersRoot) => Promise<void>;
  /** Entfernt eine Wurzel — angeboten wird das nur für den Alt-Ordner. */
  entferne?: (root: UserFoldersRoot) => Promise<void>;
  /** Nur Wurzeln zeigen, aus denen noch nicht gelesen werden kann (Default: true). */
  nurOffene?: boolean;
  /** Erklärender Satz über der Liste. */
  hinweis?: string;
}

export function WurzelnVerbinden({
  wurzeln,
  zustaende,
  verbinde,
  entferne,
  nurOffene = true,
  hinweis,
}: WurzelnVerbindenProps): React.ReactElement | null {
  const sichtbar = nurOffene
    ? wurzeln.filter(r => !istNutzbar(r, zustaende))
    : [...wurzeln];

  if (sichtbar.length === 0) return null;

  return (
    <div className="rounded-[var(--tf-radius)] px-4 py-3.5 space-y-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      {hinweis && (
        <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-prose">{hinweis}</p>
      )}
      <ul className="space-y-2">
        {sichtbar.map(root => (
          <WurzelZeile
            key={root.id}
            root={root}
            zustand={zustaende[root.id] ?? 'missing'}
            verbinde={verbinde}
            entferne={root.legacy ? entferne : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

function WurzelZeile({
  root,
  zustand,
  verbinde,
  entferne,
}: {
  root: UserFoldersRoot;
  zustand: PermStateOrMissing;
  verbinde: (root: UserFoldersRoot) => Promise<void>;
  entferne?: (root: UserFoldersRoot) => Promise<void>;
}): React.ReactElement {
  const verbindenAction = useAsyncAction(() => verbinde(root));
  const entfernenAction = useAsyncAction(async () => { if (entferne) await entferne(root); });

  const hatHandle = root.handle !== null;
  const nutzbar = hatHandle && zustand === 'granted';

  return (
    <li className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--tf-text)] truncate">{root.label}</p>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          {nutzbar ? 'Verbunden' : hatHandle ? 'Zugriff muss erneut bestätigt werden' : 'Nicht verbunden'}
        </p>
        {verbindenAction.error && (
          <p className="text-[12px] text-[var(--tf-danger-text)] mt-0.5">{verbindenAction.error}</p>
        )}
        {entfernenAction.error && (
          <p className="text-[12px] text-[var(--tf-danger-text)] mt-0.5">{entfernenAction.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!nutzbar && (
          <Button
            variant="secondary"
            size="sm"
            icon={FolderOpen}
            loading={verbindenAction.busy}
            onClick={() => verbindenAction.run()}
          >
            {hatHandle ? 'Erneut freigeben' : 'Verbinden'}
          </Button>
        )}
        {entferne && (
          <button
            type="button"
            onClick={() => entfernenAction.run()}
            disabled={entfernenAction.busy}
            className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
            title="Bisherigen Ordner entfernen"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </li>
  );
}

function istNutzbar(root: UserFoldersRoot, zustaende: Record<string, PermStateOrMissing>): boolean {
  return root.handle !== null && zustaende[root.id] === 'granted';
}

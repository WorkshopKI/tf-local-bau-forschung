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
 * Sobald alle Gruppen verbunden sind, heißt seine Aufgabe „Entfernen" und
 * nicht mehr „neu zuordnen" — die Zeile sagt das dann auch (`wurzelLage.ts`).
 */

import { FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  alleGruppenVerbunden,
  sichtbareWurzeln,
  wurzelLage,
  type WurzelLage,
} from '@/core/services/personal-roots';
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
  const sichtbar = sichtbareWurzeln(wurzeln, zustaende, nurOffene);
  const abgeloest = alleGruppenVerbunden(wurzeln, zustaende);

  if (sichtbar.length === 0) return null;

  // Der erklärende Satz gilt dem Verbinden der Gruppen. Steht nur noch der
  // Alt-Ordner da, ist nichts mehr zu verbinden — dann wäre er eine Aufgabe,
  // die es nicht gibt.
  const zeigeHinweis = Boolean(hinweis) && sichtbar.some(r => !r.legacy);

  return (
    <div className="rounded-[var(--tf-radius)] px-4 py-3.5 space-y-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      {zeigeHinweis && (
        <p className="text-[13px] text-[var(--tf-text-secondary)] max-w-prose">{hinweis}</p>
      )}
      <ul className="space-y-2">
        {sichtbar.map(root => (
          <WurzelZeile
            key={root.id}
            root={root}
            lage={wurzelLage(root, zustaende)}
            abgeloest={abgeloest}
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
  lage,
  abgeloest,
  verbinde,
  entferne,
}: {
  root: UserFoldersRoot;
  lage: WurzelLage;
  /** Alle konfigurierten Gruppen sind verbunden — der Alt-Ordner ist nur noch Rest. */
  abgeloest: boolean;
  verbinde: (root: UserFoldersRoot) => Promise<void>;
  entferne?: (root: UserFoldersRoot) => Promise<void>;
}): React.ReactElement {
  const verbindenAction = useAsyncAction(() => verbinde(root));
  const entfernenAction = useAsyncAction(async () => { if (entferne) await entferne(root); });

  // Der Alt-Ordner nach dem Umzug: Entfernen ist die gemeinte Aktion und steht
  // deshalb als beschrifteter Knopf da. „Erneut freigeben" bleibt trotzdem
  // erreichbar — wer merkt, dass dort doch noch etwas liegt, braucht den
  // Rueckweg (ein Zustand ohne Ausgang ist keiner).
  const restBestand = root.legacy && abgeloest;

  return (
    <li className="flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--tf-text)] truncate">{root.label}</p>
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          {zustandstext(root, lage, abgeloest)}
        </p>
        {verbindenAction.error && (
          <p className="text-[12px] text-[var(--tf-danger-text)] mt-0.5">{verbindenAction.error}</p>
        )}
        {entfernenAction.error && (
          <p className="text-[12px] text-[var(--tf-danger-text)] mt-0.5">{entfernenAction.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {lage !== 'verbunden' && (
          <Button
            variant={restBestand ? 'ghost' : 'secondary'}
            size="sm"
            icon={restBestand ? undefined : FolderOpen}
            loading={verbindenAction.busy}
            onClick={() => verbindenAction.run()}
          >
            {lage === 'freigeben' ? 'Erneut freigeben' : 'Verbinden'}
          </Button>
        )}
        {entferne && (restBestand ? (
          <Button
            variant="secondary"
            size="sm"
            icon={Trash2}
            loading={entfernenAction.busy}
            onClick={() => entfernenAction.run()}
          >
            Entfernen
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => entfernenAction.run()}
            disabled={entfernenAction.busy}
            className="p-1 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] cursor-pointer"
            title="Bisherigen Ordner entfernen"
          >
            <Trash2 size={13} />
          </button>
        ))}
      </div>
    </li>
  );
}

function zustandstext(root: UserFoldersRoot, lage: WurzelLage, abgeloest: boolean): string {
  if (root.legacy) {
    return abgeloest
      ? 'Wird nicht mehr gebraucht — alle Gruppen sind verbunden'
      : 'Aus der Zeit vor den Gruppen — bitte einer Gruppe neu zuordnen';
  }
  switch (lage) {
    case 'verbunden': return 'Verbunden';
    case 'freigeben': return 'Zugriff muss erneut bestätigt werden';
    case 'nicht-verbunden': return 'Nicht verbunden';
  }
}

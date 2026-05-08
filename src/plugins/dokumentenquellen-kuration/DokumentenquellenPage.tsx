/**
 * Hauptseite des `dokumentenquellen-kuration`-Plugins.
 *
 * Zwei Sections:
 *   - Verwalten (Dev-Bereich, sichtbar wenn devInfraPanel oder import.meta.env.DEV)
 *   - Aktivieren & indexieren (Kurator-Bereich, immer sichtbar)
 */
import { useStorage } from '@/core/hooks/useStorage';
import { isDevInfraPanelEnabled } from '@/config/feature-flags';
import { useDmsSources } from './hooks/useDmsSources';
import { VerwaltenSection } from './sections/VerwaltenSection';
import { AktivierenIndexierenSection } from './sections/AktivierenIndexierenSection';

export function DokumentenquellenPage(): React.ReactElement {
  const storage = useStorage();
  const { sources, handleStatus, loading, error, reload } = useDmsSources(storage.idb);

  const showDev = isDevInfraPanelEnabled() || import.meta.env.DEV;

  return (
    <div className="px-8 pt-4 pb-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-medium text-[var(--tf-text)]">Dokumentenquellen</h1>
        <p className="mt-1 text-[13px] text-[var(--tf-text-secondary)]">
          DMS-Dokumentenpfade verwalten, aktivieren und indexieren. Alle Quellen
          werden read-only gemountet — die App schreibt nie in diese Verzeichnisse.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-[var(--tf-danger-bg)] px-3 py-2 text-[12px] text-[var(--tf-danger-text)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--tf-text-tertiary)]">
          Lade…
        </div>
      ) : (
        <div className="space-y-8">
          {showDev && (
            <VerwaltenSection
              sources={sources}
              handleStatus={handleStatus}
              onChanged={reload}
            />
          )}
          <AktivierenIndexierenSection
            sources={sources}
            handleStatus={handleStatus}
            onChanged={reload}
          />
        </div>
      )}
    </div>
  );
}

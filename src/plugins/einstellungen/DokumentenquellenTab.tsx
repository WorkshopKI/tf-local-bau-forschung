/**
 * Einstellungen-Tab "Dokumentenquellen" — User-sichtbar, ausgegraut.
 *
 * Vorbereitend fuer eine User-persoenliche-Pfade-Funktion (kommt sobald
 * internes Embedding/LLM-API zur Verfuegung steht). Aktuell nur Disclosure.
 *
 * DMS-Quellen (Mandanten-Ebene) leben im Plugin "Dokumentenquellen" und sind
 * fuer normale User unsichtbar.
 */
import { Lock, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function DokumentenquellenTab(): React.ReactElement {
  return (
    <div>
      <SectionHeader label="Persönliche Dokumentenquellen" />

      <div
        className="mt-3 rounded-md p-4 opacity-70"
        style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--tf-bg)' }}
          >
            <FolderTree className="h-4 w-4 text-[var(--tf-text-tertiary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium text-[var(--tf-text)]">In Vorbereitung</p>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                style={{
                  background: 'var(--tf-bg)',
                  border: '0.5px solid var(--tf-border)',
                  color: 'var(--tf-text-secondary)',
                }}
              >
                <Lock className="h-2.5 w-2.5" />
                kommt später
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-[var(--tf-text-secondary)] leading-relaxed">
              Sobald ein internes Embedding- und LLM-API zur Verfügung steht,
              können Sie hier eigene Dokumentenpfade hinzufügen. Diese werden
              dann ausschließlich auf Ihrem Rechner verarbeitet — kein Cloud-API,
              keine geteilte Indexierung.
            </p>
            <div className="mt-3">
              <Button size="sm" variant="outline" disabled>
                <FolderTree className="h-3 w-3 mr-1" />
                Pfad hinzufügen
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11.5px] text-[var(--tf-text-tertiary)]">
        Hinweis: zentral verwaltete DMS-Quellen werden nicht hier, sondern vom
        Kurator gepflegt.
      </p>
    </div>
  );
}

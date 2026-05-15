/**
 * Admin-Section fuer Kapazitaets-Vorlage + Onboarding-HTML.
 * (Onboarding-XLSX-Import bleibt in der MitarbeiterSection naeher an den MA-Listen.)
 */
import { useState } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { downloadKapazitaetsTemplate } from '../../services/kapazitaets-import';
import { downloadOnboardingHtml } from '../../services/onboarding-html-generator';
import { ImportDialog } from '../../components/ImportDialog';

interface Props {
  antraege: Antrag[];
}

export function ImportExportSection({ antraege }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-3">Import / Export</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Kapazitäten (Bulk-Edit)</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2">
            XLSX-Vorlage mit allen MAs herunterladen, in Excel editieren, wieder hochladen.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadKapazitaetsTemplate(data)}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              Vorlage herunterladen
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              XLSX hochladen
            </button>
          </div>
        </div>
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Onboarding-HTML</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2">
            Single-File-App für neue MAs. Per E-Mail verschicken, XLSX zurück, MA-Verwaltung importieren.
          </p>
          <button
            type="button"
            onClick={() => downloadOnboardingHtml({ antraege, kategorien: data.config.ueberKategorien })}
            disabled={data.config.ueberKategorien.length === 0 || antraege.length === 0}
            className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
          >
            Onboarding-HTML generieren
          </button>
        </div>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

/**
 * Konsolidierter Import/Export-Bereich (v2.12).
 *
 * Vorher gab es zwei separate UI-Bloecke (Aktion-Buttons unter der MA-Tabelle
 * + ImportExportSection unten) mit dem Onboarding-HTML-Button doppelt. Jetzt
 * eine einzige Sektion mit zwei thematischen Spalten:
 *
 *  1. Onboarding (neue MAs)  — HTML-Generator + XLSX-Antwort-Import
 *  2. Snapshot-Export        — anonym vs. mit Klartext-Kuerzeln (geschuetzt)
 *
 * Der frühere „Kapazitäten (Bulk-Edit)"-XLSX-Roundtrip ist entfallen — Kapazität
 * (Typ-Stunden) wird ausschließlich in der Kompetenz-Matrix gepflegt.
 */
import { useState } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymMap } from '../../services/anonym-map';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { downloadOnboardingHtml } from '../../services/onboarding-html-generator';
import { exportDeAnonymizedXlsx } from '../../services/export-service';
import type { OnboardingPreview } from '../../services/onboarding-import';
import { OnboardingImportDialog } from '../../components/OnboardingImportDialog';
import { KalibrierungsReport } from '../../components/KalibrierungsReport';

interface Props {
  antraege: Antrag[];
  anonymMap: AnonymMap;
}

export function ImportExportSection({ antraege, anonymMap }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const kategorien = data.config.ueberKategorien;
  const noKategorien = kategorien.length === 0;
  const noAntraege = antraege.length === 0;

  // Onboarding-Antwort-Import (XLSX-Rueckmeldung vom MA).
  const [onboardingImportOpen, setOnboardingImportOpen] = useState(false);
  const [calibPreviews, setCalibPreviews] = useState<OnboardingPreview[] | null>(null);


  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-3">Import / Export</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Spalte 1 — Onboarding (neue MAs) */}
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Onboarding (neue MAs)</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2 leading-snug">
            Single-File-HTML per E-Mail. MA füllt aus, schickt XLSX zurück, hier importieren.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadOnboardingHtml({ antraege, kategorien })}
              disabled={noKategorien || noAntraege}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              HTML generieren
            </button>
            <button
              type="button"
              onClick={() => setOnboardingImportOpen(true)}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              XLSX-Antwort importieren
            </button>
          </div>
        </div>

        {/* Spalte 2 — Snapshot-Export */}
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Snapshot-Export</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2 leading-snug">
            XLSX mit Klartext-Kürzeln für Auswertung / Ablage.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportDeAnonymizedXlsx({ data, antraege, anonymMap })}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Mit Kürzeln (XLSX)
            </button>
          </div>
        </div>
      </div>

      {/* Modale */}
      <OnboardingImportDialog
        open={onboardingImportOpen}
        onClose={() => setOnboardingImportOpen(false)}
        onCalibrate={(previews) => { setOnboardingImportOpen(false); setCalibPreviews(previews); }}
      />
      <KalibrierungsReport
        open={calibPreviews !== null}
        previews={calibPreviews ?? []}
        onClose={() => setCalibPreviews(null)}
      />
    </div>
  );
}

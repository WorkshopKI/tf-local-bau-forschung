/**
 * Konsolidierter Import/Export-Bereich (v2.12).
 *
 * Vorher gab es zwei separate UI-Bloecke (Aktion-Buttons unter der MA-Tabelle
 * + ImportExportSection unten) mit dem Onboarding-HTML-Button doppelt. Jetzt
 * eine einzige Sektion mit drei thematischen Spalten:
 *
 *  1. Kapazitäten (Bulk-Edit) — XLSX-Template-Roundtrip
 *  2. Onboarding (neue MAs)  — HTML-Generator + XLSX-Antwort-Import
 *  3. Snapshot-Export        — anonym vs. mit Klartext-Kuerzeln (geschuetzt)
 */
import { useState } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import type { AnonymMap } from '../../services/anonym-map';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAuslastungData } from '../../hooks/useAuslastungData';
import { downloadKapazitaetsTemplate } from '../../services/kapazitaets-import';
import { downloadOnboardingHtml } from '../../services/onboarding-html-generator';
import { exportAnonymousXlsx, exportProtectedZip } from '../../services/export-service';
import type { OnboardingPreview } from '../../services/onboarding-import';
import { ImportDialog } from '../../components/ImportDialog';
import { OnboardingImportDialog } from '../../components/OnboardingImportDialog';
import { KalibrierungsReport } from '../../components/KalibrierungsReport';
import { PasswortDialog } from '../../components/PasswortDialog';

interface Props {
  antraege: Antrag[];
  anonymMap: AnonymMap;
}

export function ImportExportSection({ antraege, anonymMap }: Props): React.ReactElement {
  const data = useAuslastungData(s => s.data);
  const kategorien = data.config.ueberKategorien;
  const noKategorien = kategorien.length === 0;
  const noAntraege = antraege.length === 0;

  // Kapazitaeten-Bulk-Edit: Template-Upload via separatem Dialog.
  const [kapazUploadOpen, setKapazUploadOpen] = useState(false);

  // Onboarding-Antwort-Import (XLSX-Rueckmeldung vom MA).
  const [onboardingImportOpen, setOnboardingImportOpen] = useState(false);
  const [calibPreviews, setCalibPreviews] = useState<OnboardingPreview[] | null>(null);

  // Protected-Export mit Passwort.
  const [pwOpen, setPwOpen] = useState(false);
  const exportGeschuetzt = useAsyncAction(async (password: string) => {
    await exportProtectedZip({ data, antraege, anonymMap, password });
    setPwOpen(false);
  });

  return (
    <div className="rounded-[12px] p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[14px] font-medium text-[var(--tf-text)] mb-3">Import / Export</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Spalte 1 — Kapazitäten Bulk-Edit */}
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Kapazitäten (Bulk-Edit)</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2 leading-snug">
            XLSX-Vorlage mit allen MAs herunterladen, in Excel editieren, wieder hochladen.
          </p>
          <div className="flex flex-wrap gap-2">
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
              onClick={() => setKapazUploadOpen(true)}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              XLSX hochladen
            </button>
          </div>
        </div>

        {/* Spalte 2 — Onboarding (neue MAs) */}
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

        {/* Spalte 3 — Snapshot-Export */}
        <div>
          <h4 className="text-[12.5px] font-medium mb-1">Snapshot-Export</h4>
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mb-2 leading-snug">
            Anonyme XLSX für externe Auswertung — oder passwortgeschützter ZIP mit Klartext-Kürzeln.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportAnonymousXlsx({ data, antraege })}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)' }}
            >
              Anonym (XLSX)
            </button>
            <button
              type="button"
              onClick={() => setPwOpen(true)}
              disabled={exportGeschuetzt.busy}
              className="px-3 py-1.5 rounded-md text-[12px] cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--tf-text)', color: 'var(--tf-bg)' }}
            >
              Mit Kürzeln (geschützt)
            </button>
          </div>
        </div>
      </div>

      {/* Modale */}
      <ImportDialog open={kapazUploadOpen} onClose={() => setKapazUploadOpen(false)} />
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
      <PasswortDialog
        open={pwOpen}
        busy={exportGeschuetzt.busy}
        onClose={() => setPwOpen(false)}
        onConfirm={(password) => exportGeschuetzt.run(password)}
      />
      {exportGeschuetzt.error && (
        <p className="mt-2 text-[11px] text-[var(--tf-danger-text)]">
          Export fehlgeschlagen: {exportGeschuetzt.error}
        </p>
      )}
    </div>
  );
}

/**
 * Wartungs-/Reset-Sektion der CSV-Sources-Seite (Konsolidierung 2026-07 aus
 * CsvSourcesPage.tsx extrahiert). Selbst-enthaltend: hält den Reset-Bestätigungs-
 * Zustand + die beiden `useAsyncAction`-Läufe (Zählen, Löschen) und schreibt den
 * Audit-Eintrag. Löscht Antrags-Daten (Anträge/Verbünde/Historie/Row-Hashes) —
 * Schemas + Programme bleiben erhalten.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { clearAntragData, countAntragData } from '@/core/services/csv';
import type { ClearAntragDataResult } from '@/core/services/csv';
import { logAudit } from '@/core/services/infrastructure/audit-log';

export function MaintenanceSection(): React.ReactElement {
  const storage = useStorage();
  const session = useKuratorSession();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetCounts, setResetCounts] = useState<ClearAntragDataResult | null>(null);
  const [resetResult, setResetResult] = useState<ClearAntragDataResult | null>(null);

  const openResetConfirm = useAsyncAction(async () => {
    setResetResult(null);
    const c = await countAntragData(storage.idb);
    setResetCounts(c);
    setResetConfirmOpen(true);
  });

  const confirmReset = useAsyncAction(async () => {
    const r = await clearAntragData(storage.idb);
    await logAudit(storage.idb, {
      action: 'antrag_data_cleared',
      user: session.kuratorName ?? undefined,
      details: { ...r },
    });
    setResetResult(r);
    setResetConfirmOpen(false);
  });

  return (
    <section
      className="mt-10 rounded-[12px] p-[18px]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <h3 className="text-[13px] font-medium text-[var(--tf-text)] mb-1">Wartung</h3>
      <p className="text-[12px] text-[var(--tf-text-tertiary)] mb-3">
        Wenn importierte Antrags-Daten unleserlich erscheinen
        (z.B. <code className="font-mono">Ã+ã€™Ãƒâ€¡</code> statt Umlauten), liegt fast immer ein
        Encoding-Problem an der Quell-CSV vor. Bereinige die Quelldatei extern
        (Excel: „CSV UTF-8 (durch Semikolon getrennt)" beim Speichern, oder
        <code className="font-mono"> iconv -f WINDOWS-1252 -t UTF-8</code>) und nutze danach diesen Reset:
      </p>

      {resetResult ? (
        <div className="text-[12px] text-emerald-700 mb-3">
          Reset abgeschlossen: {resetResult.antraege.toLocaleString('de-DE')} Anträge,{' '}
          {resetResult.verbuende.toLocaleString('de-DE')} Verbünde,{' '}
          {resetResult.historie.toLocaleString('de-DE')} Historie-Einträge,{' '}
          {resetResult.rowHashes.toLocaleString('de-DE')} Row-Hashes gelöscht.
          Du kannst jetzt über „CSV neu wählen" oder „Neu registrieren" die CSVs erneut einspielen.
        </div>
      ) : null}

      {resetConfirmOpen && resetCounts ? (
        <div className="flex flex-col gap-2 p-3 rounded-[8px] bg-[var(--tf-bg-secondary)]">
          <p className="text-[12px] text-[var(--tf-text)]">
            Löscht{' '}
            <strong>{resetCounts.antraege.toLocaleString('de-DE')}</strong> Anträge,{' '}
            <strong>{resetCounts.verbuende.toLocaleString('de-DE')}</strong> Verbünde,{' '}
            <strong>{resetCounts.historie.toLocaleString('de-DE')}</strong> Historie-Einträge und{' '}
            <strong>{resetCounts.rowHashes.toLocaleString('de-DE')}</strong> Row-Hashes.
            CSV-Schemas und Programme bleiben erhalten — die importierten Quellen kannst du
            danach unverändert re-importieren.
          </p>
          {confirmReset.error ? (
            <div className="text-[12px] text-[var(--tf-danger-text)]">
              Fehler: {confirmReset.error}
            </div>
          ) : null}
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResetConfirmOpen(false)}
              disabled={confirmReset.busy}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmReset.run()}
              disabled={confirmReset.busy}
            >
              {confirmReset.busy ? 'Lösche…' : 'Antrags-Daten löschen'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openResetConfirm.run()}
            disabled={!session.isActive || openResetConfirm.busy}
          >
            Antrags-Daten zurücksetzen
          </Button>
          {openResetConfirm.error ? (
            <div className="mt-2 text-[12px] text-[var(--tf-danger-text)]">
              Fehler: {openResetConfirm.error}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

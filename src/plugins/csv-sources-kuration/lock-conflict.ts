/**
 * Geteilter `onLockConflict`-Handler für die expliziten Re-Import-Dialoge
 * (CsvSourceReimportDialog, CsvAddColumnsDialog).
 *
 * Ein belegter Build-Lock tritt im Normalbetrieb nur auf, wenn ein vorheriger
 * Import **abgestürzt** ist — sonst gibt das `finally` in `importCsvSource` den
 * Lock frei. Der Lock gilt erst nach 2 h als „stale" (auto-übernehmbar), und im
 * Prod-Build (kurator/pl) gibt es keine UI, um ihn vorher freizugeben. Statt den
 * Kurator bis zur 2h-Grenze auszusperren, fragen wir nach und übernehmen den
 * Lock per `forceLock` (Single-Team-Trust-Modell).
 */
export function confirmLockConflict(ageMinutes: number): Promise<'force' | 'abort'> {
  const mins = Math.max(1, Math.round(ageMinutes));
  const ok = window.confirm(
    `Es ist bereits ein Import als laufend markiert (seit ~${mins} Min).\n\n`
    + `Falls ein vorheriger Import abgestürzt ist, kannst du den Lock übernehmen und `
    + `fortfahren. Brich ab, wenn an anderer Stelle gerade wirklich ein Import läuft.\n\n`
    + `Lock übernehmen und fortfahren?`,
  );
  return Promise.resolve(ok ? 'force' : 'abort');
}

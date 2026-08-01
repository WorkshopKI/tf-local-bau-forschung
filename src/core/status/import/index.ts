/** Referenz-Importe des Vorgangssystems (XLSX → Katalog-Entwurf, mit Diff). */
export {
  leseXlsxTabelle, istLeseFehler, spalte, zelle, kopfKey,
  type XlsxTabelle, type XlsxLeseErgebnis, type XlsxLeseFehler,
} from './xlsx-tabelle';
export {
  berechneDiff, diffZusammenfassung,
  type Diff, type DiffEintrag, type DiffArt,
} from './diff';
export {
  importiereStatusKatalog, type StatusKatalogImportErgebnis,
} from './status-katalog-import';
export {
  importiereTriggerTabelle, triggerSchluessel, type TriggerImportErgebnis,
} from './trigger-import';

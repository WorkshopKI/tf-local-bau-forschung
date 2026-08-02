/** Referenz-Importe des Vorgangssystems (XLSX → Katalog-Entwurf, mit Diff). */
export {
  leseXlsxTabelle, leseMappe, findeKopfInMappe, blattReihenfolge,
  istLeseFehler, spalte, zelle, kopfKey,
  type XlsxTabelle, type XlsxLeseErgebnis, type XlsxLeseFehler, type RohBlatt,
} from './xlsx-tabelle';
export {
  berechneDiff, diffZusammenfassung,
  type Diff, type DiffEintrag, type DiffArt,
} from './diff';
export {
  leseParameterBlatt, bestimmeZeilenart, PARAMETER_BLATT,
  type ParameterBlatt, type ParameterZeile, type Zeilenart, type BlattFormat,
} from './parameter-blatt';
export {
  importiereStatusKatalog,
  type StatusKatalogImportErgebnis, type ZeilenBilanz, type EbenenHinweis,
} from './status-katalog-import';
export {
  importiereTriggerTabelle, triggerSchluessel, TRIGGER_BLATT,
  type TriggerImportErgebnis, type ProgrammStatistik, type NichtInterpretiert,
} from './trigger-import';

/** Gutachten-Vorlagen-Service (DOCX-Füller + Verzeichnis-Quelle) — Barrel. */
export * from './types';
export { FIELD_MAPPING, resolveField } from './field-mapping';
export { ANKER_EP, ankerFuer, ankerKeyGueltig, vorlagenTypFuerDatei, type VorlagenTyp } from './anchor-mapping';
export { processDocumentXml, fillTemplate } from './fill-template';
export type { ProcessResult, FillOptions } from './fill-template';
export {
  getVorlagenHandle,
  pickVorlagenVerzeichnis,
  ensureReadPermission,
  listVorlagen,
  readVorlage,
} from './vorlagen-quelle';
export { saveGutachtenDocx } from './save-docx';
export type { SaveResult } from './save-docx';

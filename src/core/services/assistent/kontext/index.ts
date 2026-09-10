/**
 * Assistent-Panel (Phase 1) — deterministischer Kontext-Assembler.
 * Reine Funktion + Datenmodell; siehe assembliere.ts / types.ts.
 */
export { assembliereAssistentKontext, beschreibeKontext } from './assembliere';
export {
  GESAMT_MAX_CHARS,
  HISTORIE_MAX_CHARS,
  HISTORIE_TURN_MAX_CHARS,
  RETRIEVAL_CHUNK_MAX_CHARS,
  RETRIEVAL_K,
  RETRIEVAL_MIN_SCORE,
} from './assembliere';
export type {
  ArbeitsvorratFrist,
  ArbeitsvorratUebersicht,
  AssistentEntitaetArt,
  AssistentKontextEingabe,
  AssistentPrompt,
  AssistentTurn,
  KontextBlock,
  KontextEntitaet,
  NutzerRolle,
  VorhabenDokument,
} from './types';
export { akteZeilen, AKTE_MAX_TERMINE } from './akte';
export type {
  AkteArtefakte,
  AkteAufgabe,
  AkteFrist,
  AkteJournal,
  AkteMeilensteine,
  AkteOffenesPaar,
  AkteStillstand,
  AkteTeilvorhaben,
  AkteTermin,
  AkteVerlauf,
  VorgangsAkte,
} from './akte';

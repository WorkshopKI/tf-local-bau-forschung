/**
 * Assistent-Ereignisprotokoll (Phase 0) — gerätelokales, opt-in Protokoll
 * app-semantischer Aktionen. Siehe types.ts (Invarianten + Katalog) und
 * docs/architecture/assistent-protokoll.md.
 */
export type {
  AssistentEreignis,
  AssistentEreignisTyp,
  EntitaetArt,
  NeuesEreignis,
  ProtokollStatistik,
} from './types';
export {
  ASSISTENT_OPTIN_KEY,
  EREIGNISPROTOKOLL_STORE,
  MAX_EREIGNISSE,
  RETENTION_TAGE,
} from './types';
export {
  exportiereProtokoll,
  initProtokoll,
  istProtokollAktiv,
  ladeAlleEreignisse,
  ladeEreignisseSeit,
  ladeLetzteEreignisse,
  ladeStatistik,
  loescheProtokollVollstaendig,
  protokolliereEreignis,
  setzeProtokollAktiv,
} from './recorder';

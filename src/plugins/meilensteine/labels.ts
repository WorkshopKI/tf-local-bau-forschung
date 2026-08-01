/**
 * Anzeige-Texte und -Stile des Meilenstein-Moduls. Farben ausschließlich über
 * `--tf-*`-Tokens (Guard `theme-token-contract`).
 */
import type { MstZustand, Prognose } from '@/core/meilensteine';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';

export const ZUSTAND_LABEL: Record<MstZustand, string> = {
  erreicht: 'Erreicht',
  offen: 'Offen',
  faellig: 'Fällig',
  gerissen: 'Gerissen',
  nichtRelevant: 'Nicht relevant',
};

/** Punkt-/Textfarbe je Zustand. */
export const ZUSTAND_FARBE: Record<MstZustand, string> = {
  erreicht: 'var(--tf-success-text)',
  offen: 'var(--tf-border-hover)',
  faellig: 'var(--tf-warning-text)',
  gerissen: 'var(--tf-danger-text)',
  nichtRelevant: 'var(--tf-border)',
};

export const PROGNOSE_LABEL: Record<Prognose, string> = {
  imPlan: 'Im Plan',
  gefaehrdet: 'Gefährdet',
  nichtHaltbar: 'Frist nicht haltbar',
  abgeschlossen: 'Abgeschlossen',
  unbekannt: 'Unbekannt',
};

export const PROGNOSE_FARBE: Record<Prognose, string> = {
  imPlan: 'var(--tf-success-text)',
  gefaehrdet: 'var(--tf-warning-text)',
  nichtHaltbar: 'var(--tf-danger-text)',
  abgeschlossen: 'var(--tf-text-tertiary)',
  unbekannt: 'var(--tf-text-tertiary)',
};

/** Reihenfolge für Filter-Leisten und Verteilungs-Anzeigen. */
export const PROGNOSE_REIHENFOLGE: readonly Prognose[] = [
  'nichtHaltbar', 'gefaehrdet', 'imPlan', 'abgeschlossen', 'unbekannt',
];

export const OPERATOR_LABEL: Record<string, string> = {
  ist: 'ist',
  istNicht: 'ist nicht',
  gefuellt: 'ist gefüllt',
  leer: 'ist leer',
  datumVor: 'liegt vor',
  datumNach: 'liegt nach',
  // Vorgangssystem (To-do-Regeln); der Editor ist domänenfrei und zeigt sie
  // deshalb auch an einem Meilenstein-Plan, falls dort einer auftaucht.
  tageSeit: 'liegt länger zurück als',
  datumNachFeld: 'liegt nach dem Datum von',
  foerdervarianteIn: 'Fördervariante ist eine von',
};

export const TYP_LABEL: Record<AntragstypBucket, string> = {
  FuE: 'FuE', DS: 'DS', DL: 'DL', NW: 'NW',
};

/** Einheitliche 0,5px-Umrandung wie im Status-Cockpit. */
export const feldStil: React.CSSProperties = {
  border: '0.5px solid var(--tf-border)',
  background: 'var(--tf-bg)',
};

export function formatDatum(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleDateString('de-DE');
}

/** „+3 Tage" / „−12 Tage" / „pünktlich". */
export function formatAbweichung(tage: number | null): string {
  if (tage === null) return '—';
  if (tage === 0) return 'pünktlich';
  return tage > 0 ? `+${tage} Tage` : `${tage} Tage`;
}

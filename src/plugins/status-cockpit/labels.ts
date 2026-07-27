/**
 * Geteilte Beschriftungen + Formularklassen für die Status-Cockpit-Tabs.
 *
 * Rein darstellend: deutsche Labels für die Enums (SpinePhase, StatusCategory,
 * Prominenz, Werkzeug), die Aufzähl-Reihenfolgen für Selects/Filter und die
 * gemeinsamen Feld-Klassen (aus dem ChecklistenEditor-Muster übernommen).
 */
import {
  SPINE_REIHENFOLGE,
  type SpinePhase, type StatusCategory, type Prominenz, type Werkzeug,
  type StatusFeldEintrag,
} from '@/core/status';

export const SPINE_LABEL: Record<SpinePhase, string> = {
  eingang: 'Eingang',
  vollstaendigkeit: 'Vollständigkeit',
  fachpruefung: 'Fachprüfung',
  bewilligung: 'Bewilligung',
  schluss: 'Schluss',
  keine: '—',
};

export const KATEGORIE_LABEL: Record<StatusCategory, string> = {
  offen: 'Offen',
  in_pruefung: 'In Prüfung',
  nachforderung: 'Nachforderung',
  entscheidung: 'Entscheidung',
  bewilligt: 'Bewilligt',
  begleitung: 'Begleitung',
  abgelehnt: 'Abgelehnt',
  abgeschlossen: 'Abgeschlossen',
  sonstige: 'Sonstige',
};

export const PROMINENZ_LABEL: Record<Prominenz, string> = {
  meilenstein: 'Meilenstein',
  normal: 'Normal',
  nebensaechlich: 'Nebensächlich',
  ignoriert: 'Ignoriert',
};

export const WERKZEUG_LABEL: Record<Werkzeug, string> = {
  gutachten: 'Gutachten',
  nachforderung: 'Nachforderung',
  ablehnung: 'Ablehnung',
};

export const EBENE_LABEL: Record<'verbund' | 'tv', string> = {
  verbund: 'Verbund',
  tv: 'Teilvorhaben',
};

export const TYP_LABEL: Record<StatusFeldEintrag['typ'], string> = {
  wert: 'Wert',
  datum: 'Datum',
  text: 'Text',
};

/** Kategorie-Werte in Taxonomie-Reihenfolge (für Selects + Filter-Pills). */
export const KATEGORIE_WERTE: readonly StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

/** Prominenz-Werte (für Selects + Filter-Pills). */
export const PROMINENZ_WERTE: readonly Prominenz[] = [
  'meilenstein', 'normal', 'nebensaechlich', 'ignoriert',
];

/** Spine-Phasen in amtlicher Reihenfolge (Eingang→…→Schluss, keine). */
export const SPINE_WERTE: readonly SpinePhase[] = SPINE_REIHENFOLGE;

/** Gemeinsame Klasse für Inline-Formularfelder (Select/Input), dicht. */
export const feldKlasse =
  'w-full text-[12.5px] rounded px-2 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]';

/** Haarlinien-Rahmen für Inline-Formularfelder (einzige erlaubte Inline-Style-Ausnahme). */
export const feldStil: React.CSSProperties = { border: '0.5px solid var(--tf-border)' };

/** ISO-Zeitstempel → `DD.MM.YYYY`; leer/ungültig → `—`. */
export function formatDatum(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** ISO-Zeitstempel → `DD.MM.YYYY, HH:MM`; leer/ungültig → `—`. */
export function formatZeitpunkt(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

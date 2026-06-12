/**
 * Geteilte Bausteine rund um Qualitätsregeln — genutzt von RegelnTab (Liste),
 * regelTableColumns (Tabellen-Zellen) und SkillVerwaltungPage (Editor-Routing +
 * Typ-Picker). Bewusst in ein eigenes Modul gehoben, um Zirkular-Imports
 * zwischen Tab, Spalten und Page zu vermeiden.
 */
import type { QualitaetsRegel, Schweregrad } from '@/core/services/skill-registry';

export const TYP_LABEL: Record<string, string> = {
  zeichen_max: 'Zeichen max',
  wortanzahl: 'Wortanzahl',
  satzanzahl: 'Satzanzahl',
  satzlaenge_max: 'Satzlänge',
  verbotenes_muster: 'Verbotenes Muster',
  pflicht_anfang: 'Pflicht-Anfang',
  keine_aufzaehlungen: 'Keine Aufzählungen',
};

export const ADD_TYPEN = Object.keys(TYP_LABEL);

const DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
  zeichen_max: { max: 1000 },
  wortanzahl: {},
  satzanzahl: { min: 8, max: 12 },
  satzlaenge_max: { maxWoerter: 25 },
  verbotenes_muster: { muster: [], istRegex: false },
  pflicht_anfang: { text: '' },
  keine_aufzaehlungen: {},
};

export function blankRegel(typ: string): QualitaetsRegel {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: TYP_LABEL[typ] ?? typ,
    typ,
    params: { ...(DEFAULT_PARAMS[typ] ?? {}) },
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: now,
    geaendert_am: now,
  };
}

export function upsertRegel(regeln: QualitaetsRegel[], r: QualitaetsRegel): QualitaetsRegel[] {
  const i = regeln.findIndex(x => x.id === r.id);
  if (i < 0) return [...regeln, r];
  const copy = [...regeln];
  copy[i] = r;
  return copy;
}

/** Schweregrad-Pille (Fehler = rot, Hinweis = amber). */
export function SevPill({ s }: { s: Schweregrad }): React.ReactElement {
  return (
    <span className={`text-[11px] px-2.5 py-1 rounded-[99px] ${s === 'fehler' ? 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]' : 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]'}`}>
      {s === 'fehler' ? 'Fehler' : 'Hinweis'}
    </span>
  );
}

/** Aktiv-Toggle. In Tabellen-Zellen `stopPropagation` am Aufrufer setzen, damit
 *  der Zeilen-Klick (= Bearbeiten) nicht mitfeuert. */
export function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled: boolean }): React.ReactElement {
  return (
    <button
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-block w-8 h-[18px] rounded-[99px] align-middle disabled:opacity-50 ${on ? 'bg-[var(--tf-text)]' : 'bg-[var(--tf-border-hover)]'}`}
    >
      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-[99px] bg-[var(--tf-bg)] ${on ? 'left-4' : 'left-0.5'}`} />
    </button>
  );
}

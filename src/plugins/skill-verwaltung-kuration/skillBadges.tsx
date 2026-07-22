/**
 * Geteilte Skill-Badges (Reifegrad, Aktivierungs-Gate, Kategorie).
 *
 * Liegen bewusst außerhalb von `SkillsTab.tsx`: Listen-, Karten- UND Tabellen-
 * Ansicht (`skillTableColumns.tsx`) rendern dieselben Marker — eine Quelle für
 * Wortlaut und Optik. Eigener Wortstamm gegenüber `SkillsTab.tsx`, damit keine
 * Casing-Kollision zweier Geschwister-Module entsteht (Coding-Standard).
 */
import { skillKategorieLabel, type Reifegrad, type SkillRecord } from '@/core/services/skills';

export const REIFEGRAD_LABEL: Record<Reifegrad, string> = {
  entwurf: 'Entwurf',
  erprobt: 'Erprobt',
  empfohlen: 'Empfohlen',
};

const REIFEGRAD_STYLE: Record<Reifegrad, string> = {
  entwurf: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]',
  erprobt: 'bg-[var(--tf-primary-light)] text-[var(--tf-primary)]',
  empfohlen: 'bg-[var(--tf-primary)] text-white',
};

/** Sortier-Rang des Reifegrads (Entwurf → Erprobt → Empfohlen). */
const REIFEGRAD_RANG: Record<Reifegrad, number> = { entwurf: 0, erprobt: 1, empfohlen: 2 };

const BADGE_BASE = 'text-[10.5px] px-1.5 py-0.5 rounded-[5px] whitespace-nowrap';

/** Reifegrad eines Skills (fehlt → `'entwurf'`, wie `normalizeSkill`). */
export function reifegradOf(s: SkillRecord): Reifegrad {
  return s.reifegrad ?? 'entwurf';
}

/**
 * Sortier-Wert der Status-Spalte: deaktivierte Skills zuerst (sie brauchen
 * Aufmerksamkeit), danach nach Reifegrad aufsteigend.
 */
export function skillStatusRang(s: SkillRecord): number {
  return (s.aktiv === false ? 0 : 1) * 10 + REIFEGRAD_RANG[reifegradOf(s)];
}

export function ReifegradBadge({ r }: { r: Reifegrad }): React.ReactElement {
  return <span className={`${BADGE_BASE} ${REIFEGRAD_STYLE[r]}`}>{REIFEGRAD_LABEL[r]}</span>;
}

/** Sichtbarer Hinweis, dass ein Skill deaktiviert ist (Module mit Gate führen ihn nicht aus). */
export function InaktivBadge(): React.ReactElement {
  return (
    <span className={`${BADGE_BASE} bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]`}>
      inaktiv
    </span>
  );
}

/** Fachliche Kategorie des Skills (abgeleitet oder vom Kurator gesetzt). */
export function KategoriePill({ skill }: { skill: SkillRecord }): React.ReactElement {
  return (
    <span className={`${BADGE_BASE} bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]`}>
      {skillKategorieLabel(skill)}
    </span>
  );
}

/** Status-Zelle/-Gruppe: Reifegrad + (falls gesperrt) das Inaktiv-Badge. */
export function SkillStatusBadges({ skill }: { skill: SkillRecord }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ReifegradBadge r={reifegradOf(skill)} />
      {skill.aktiv === false && <InaktivBadge />}
    </span>
  );
}

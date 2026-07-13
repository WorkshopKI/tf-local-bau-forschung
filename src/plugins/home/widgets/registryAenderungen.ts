/**
 * Reiner Selektor des Registry-Änderungen-Widgets (Phase 4 v1.1, Kurator-only),
 * node-testbar. Leitet aus Skills + Regeln der geladenen Registry die jüngsten
 * Änderungen ab — KEIN neues Journal, nur vorhandene Felder.
 *
 * Änderungsart-Heuristik (der Snapshot trägt KEIN `aktiv` — Aktivierung kann nur
 * inferiert werden): `version === 1`/keine Vorgänger-Historie → **neu**; sonst
 * `diffSkillVersions(historie[1], historie[0])` — leerer Diff = reiner Zustands-
 * wechsel → aktiviert bzw. deaktiviert (nach aktuellem `aktiv`), sonst
 * geändert. Regeln haben keine Historie → reduziert (neu, wenn erstellt_am ===
 * geaendert_am; sonst deaktiviert/geändert nach `aktiv`).
 */
import { diffSkillVersions } from '@/core/services/skills/registry/versioning';
import type { QualitaetsRegel, SkillRecord } from '@/core/services/skills/registry/types';

export type AenderungsArt = 'neu' | 'geaendert' | 'aktiviert' | 'deaktiviert';

export interface RegistryAenderung {
  key: string;
  art: AenderungsArt;
  objektArt: 'skill' | 'regel';
  /** Skill-ID (Monospace) bzw. Regel-Name (für „…"). */
  id: string;
  name: string;
  geaendertAm: string;
  /** Aktueller Aktiv-Zustand (undefined ⇒ aktiv). */
  aktiv: boolean;
  reifegrad?: string;
  begruendung?: string;
}

export function skillAenderungsArt(skill: SkillRecord): AenderungsArt {
  const hist = skill.historie ?? [];
  if (skill.version <= 1 || hist.length <= 1) return 'neu';
  const diff = diffSkillVersions(hist[1]!, hist[0]!);
  if (diff.unveraendert) return skill.aktiv === false ? 'deaktiviert' : 'aktiviert';
  return 'geaendert';
}

export function regelAenderungsArt(regel: QualitaetsRegel): AenderungsArt {
  if (regel.erstellt_am === regel.geaendert_am) return 'neu';
  if (!regel.aktiv) return 'deaktiviert';
  return 'geaendert';
}

/** Alle Skill- + Regel-Änderungen, `geaendert_am` absteigend, gekappt. */
export function baueRegistryAenderungen(
  skills: SkillRecord[],
  regeln: QualitaetsRegel[],
  maxEintraege: number,
): RegistryAenderung[] {
  const eintraege: RegistryAenderung[] = [];
  for (const s of skills) {
    eintraege.push({
      key: `skill:${s.id}`,
      art: skillAenderungsArt(s),
      objektArt: 'skill',
      id: s.id,
      name: s.name,
      geaendertAm: s.geaendert_am,
      aktiv: s.aktiv !== false,
      reifegrad: s.reifegrad,
      begruendung: s.historie?.[0]?.begruendung,
    });
  }
  for (const r of regeln) {
    eintraege.push({
      key: `regel:${r.id}`,
      art: regelAenderungsArt(r),
      objektArt: 'regel',
      id: r.id,
      name: r.name,
      geaendertAm: r.geaendert_am,
      aktiv: r.aktiv,
    });
  }
  eintraege.sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm));
  return eintraege.slice(0, Math.max(0, maxEintraege));
}

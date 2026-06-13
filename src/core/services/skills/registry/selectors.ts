/**
 * Reine Selektoren über einer geladenen Registry — kein IO, kein React.
 * Genutzt von der Skill-Verwaltung (UI), dem Antragsdetail-Consumer und Tests.
 */
import { KNOWN_REGEL_TYPEN, type QualitaetsRegel, type SkillRecord, type SkillRegistryFile } from './types';

/** Skill per ID (oder `undefined`). */
export function getSkillById(file: SkillRegistryFile, id: string): SkillRecord | undefined {
  return file.skills.find(s => s.id === id);
}

/**
 * Löst die einem Skill zugeordneten Regel-IDs auf konkrete Regeln auf
 * (Reihenfolge der `regelIds`, fehlende IDs werden ausgelassen).
 */
export function resolveRegeln(file: SkillRegistryFile, skill: SkillRecord): QualitaetsRegel[] {
  const byId = new Map(file.regeln.map(r => [r.id, r]));
  return skill.regelIds.map(id => byId.get(id)).filter((r): r is QualitaetsRegel => r !== undefined);
}

/** Namen aller Skills, die eine bestimmte Regel verwenden („verwendet in"). */
export function skillsUsingRegel(file: SkillRegistryFile, regelId: string): string[] {
  return file.skills.filter(s => s.regelIds.includes(regelId)).map(s => s.name);
}

/** True, wenn der Regel-Typ der Engine bekannt ist (sonst „unbekannter Typ"). */
export function isKnownRegelTyp(typ: string): boolean {
  return KNOWN_REGEL_TYPEN.has(typ);
}

function num(params: Record<string, unknown>, key: string): number | undefined {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : '';
}

/** Kurzform der Regel-Parameter für Listen/Tabellen (z.B. „max 1000 Zeichen"). */
export function describeRegelParams(regel: QualitaetsRegel): string {
  const p = regel.params;
  switch (regel.typ) {
    case 'zeichen_max':
      return `max ${num(p, 'max') ?? '—'} Zeichen`;
    case 'wortanzahl': {
      const min = num(p, 'min');
      const max = num(p, 'max');
      if (min !== undefined && max !== undefined) return `${min}–${max} Wörter`;
      if (min !== undefined) return `≥ ${min} Wörter`;
      if (max !== undefined) return `≤ ${max} Wörter`;
      return 'Wortanzahl';
    }
    case 'satzanzahl':
      return `${num(p, 'min') ?? '—'}–${num(p, 'max') ?? '—'} Sätze`;
    case 'satzlaenge_max':
      return `max ${num(p, 'maxWoerter') ?? '—'} Wörter / Satz`;
    case 'verbotenes_muster': {
      const muster = Array.isArray(p.muster) ? (p.muster as unknown[]).filter(x => typeof x === 'string') : [];
      if (muster.length === 0) return 'kein Muster';
      return muster.length === 1 ? `Muster: „${muster[0] as string}"` : `${muster.length} Muster`;
    }
    case 'pflicht_anfang': {
      const t = str(p, 'text');
      return t ? `Anfang: „${t.slice(0, 32)}${t.length > 32 ? '…' : ''}"` : 'Pflicht-Anfang';
    }
    case 'keine_aufzaehlungen':
      return 'im finalen Text';
    case 'absatz_min':
      return `≥ ${num(p, 'min') ?? '—'} Absätze`;
    default:
      return 'unbekannter Typ';
  }
}

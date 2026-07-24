/**
 * Reine Transformationen einer Katalog-Version fürs Cockpit-Inline-Edit. Jede
 * Funktion liefert eine neue Version (nie in-place); id/feldId bleiben stabil.
 */
import type {
  MappingVersion, NaechsterSchrittRegel, StatusFeldEintrag, StatusWertEintrag,
} from './typen';

export function aendereWert(
  version: MappingVersion, id: string, patch: Partial<StatusWertEintrag>,
): MappingVersion {
  return {
    ...version,
    werte: version.werte.map(w => (w.id === id ? { ...w, ...patch, id: w.id, feldId: w.feldId } : w)),
  };
}

export function aendereFeld(
  version: MappingVersion, feldId: string, patch: Partial<StatusFeldEintrag>,
): MappingVersion {
  return {
    ...version,
    felder: version.felder.map(f => (f.feldId === feldId ? { ...f, ...patch, feldId: f.feldId } : f)),
  };
}

export function aendereRegel(
  version: MappingVersion, id: string, patch: Partial<NaechsterSchrittRegel>,
): MappingVersion {
  return {
    ...version,
    regeln: version.regeln.map(r => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
  };
}

/** Übernimmt einen kuratierten Wert (aus dem Unkuratiert-Puffer promoted). */
export function fuegeWertHinzu(version: MappingVersion, wert: StatusWertEintrag): MappingVersion {
  if (version.werte.some(w => w.id === wert.id)) return aendereWert(version, wert.id, wert);
  return { ...version, werte: [...version.werte, wert] };
}

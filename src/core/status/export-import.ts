/**
 * JSON-Export/-Import einer Katalog-Version. Import validiert Struktur UND
 * referenzielle Konsistenz (jeder Wert/jede Regel verweist auf ein bekanntes
 * Feld), bevor die Fassung übernommen wird. Rein.
 */
import type { Bedingung, MappingVersion } from './typen';

export function exportiereVersion(version: MappingVersion): string {
  return JSON.stringify(version, null, 2);
}

export interface ImportErgebnis {
  ok: boolean;
  version?: MappingVersion;
  fehler?: string;
}

function bedingungFeldIds(b: Bedingung, out: Set<string>): void {
  if ('alle' in b) { b.alle.forEach(x => bedingungFeldIds(x, out)); return; }
  if ('einige' in b) { b.einige.forEach(x => bedingungFeldIds(x, out)); return; }
  out.add(b.feldId);
}

/** Validiert eingelesenen JSON-Text und liefert die Version oder einen Fehler. */
export function validiereImport(text: string): ImportErgebnis {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, fehler: 'Kein gültiges JSON.' };
  }
  if (!data || typeof data !== 'object') return { ok: false, fehler: 'Kein Objekt.' };
  const v = data as Partial<MappingVersion>;
  if (!Array.isArray(v.felder) || !Array.isArray(v.werte) || !Array.isArray(v.regeln)) {
    return { ok: false, fehler: 'Struktur unvollständig (felder/werte/regeln fehlen).' };
  }
  const feldIds = new Set<string>();
  for (const f of v.felder) {
    if (!f || typeof f.feldId !== 'string' || typeof f.typ !== 'string' || (f.ebene !== 'verbund' && f.ebene !== 'tv')) {
      return { ok: false, fehler: 'Ungültiger Feld-Eintrag.' };
    }
    feldIds.add(f.feldId);
  }
  for (const w of v.werte) {
    if (!w || typeof w.id !== 'string' || typeof w.feldId !== 'string' || typeof w.wert !== 'string') {
      return { ok: false, fehler: 'Ungültiger Wert-Eintrag.' };
    }
    if (!feldIds.has(w.feldId)) {
      return { ok: false, fehler: `Wert „${w.wert}" verweist auf unbekanntes Feld „${w.feldId}".` };
    }
  }
  for (const r of v.regeln) {
    if (!r || typeof r.id !== 'string' || !r.bedingung || !Array.isArray(r.schritte)) {
      return { ok: false, fehler: 'Ungültiger Regel-Eintrag.' };
    }
    const referenziert = new Set<string>();
    bedingungFeldIds(r.bedingung as Bedingung, referenziert);
    for (const fid of referenziert) {
      if (!feldIds.has(fid)) {
        return { ok: false, fehler: `Regel „${r.id}" verweist auf unbekanntes Feld „${fid}".` };
      }
    }
  }
  return { ok: true, version: v as MappingVersion };
}

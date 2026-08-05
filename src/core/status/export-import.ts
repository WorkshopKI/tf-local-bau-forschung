/**
 * JSON-Export/-Import einer Katalog-Version. Import validiert Struktur UND
 * referenzielle Konsistenz (jeder Wert/jede Regel verweist auf ein bekanntes
 * Feld), bevor die Fassung übernommen wird. Rein.
 */
import { ALLE_STRAENGE, type Bedingung, type MappingVersion } from './typen';
import { findeZyklus } from './kategorien';
import { bedingungFeldRefs, referenzierbareFelder } from './bedingung';
import { strangAusEintrag } from './regelsatz';

export function exportiereVersion(version: MappingVersion): string {
  return JSON.stringify(version, null, 2);
}

export interface ImportErgebnis {
  ok: boolean;
  version?: MappingVersion;
  fehler?: string;
}

/** Alle von einer Bedingung genannten Felder — über den geteilten Sammler, damit
 *  ein neuer Operator hier nicht durchrutscht (siehe `bedingung.ts`). */
function bedingungFeldIds(b: Bedingung, out: Set<string>): void {
  for (const feldId of bedingungFeldRefs(b)) out.add(feldId);
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
  if (!Array.isArray(v.felder) || !Array.isArray(v.werte)) {
    return { ok: false, fehler: 'Struktur unvollständig (felder/werte fehlen).' };
  }
  // Kategorien sind optional (Fassungen vor dem Code-Inventar haben keine),
  // müssen aber in sich stimmen: eindeutige Ids, existierende Elternknoten,
  // kein Zyklus. Ein kaputter Baum ließe die Anzeige endlos laufen.
  const kategorieIds = new Set<string>();
  if (v.kategorien !== undefined) {
    if (!Array.isArray(v.kategorien)) return { ok: false, fehler: 'Feld „kategorien" ist keine Liste.' };
    for (const k of v.kategorien) {
      if (!k || typeof k.id !== 'string' || typeof k.label !== 'string'
        || (k.ebene !== 'verbund' && k.ebene !== 'tv')) {
        return { ok: false, fehler: 'Ungültiger Kategorie-Eintrag.' };
      }
      if (kategorieIds.has(k.id)) return { ok: false, fehler: `Kategorie „${k.id}" doppelt.` };
      kategorieIds.add(k.id);
    }
    for (const k of v.kategorien) {
      if (k.elternId != null && !kategorieIds.has(k.elternId)) {
        return { ok: false, fehler: `Kategorie „${k.id}" verweist auf unbekannten Elternknoten „${k.elternId}".` };
      }
    }
    const zyklus = findeZyklus(v.kategorien);
    if (zyklus) return { ok: false, fehler: `Kategorie „${zyklus}" liegt in einem Ringschluss.` };
  }

  const feldIds = new Set<string>();
  for (const f of v.felder) {
    if (!f || typeof f.feldId !== 'string' || typeof f.typ !== 'string' || (f.ebene !== 'verbund' && f.ebene !== 'tv')) {
      return { ok: false, fehler: 'Ungültiger Feld-Eintrag.' };
    }
    if (f.kategorieId != null && !kategorieIds.has(f.kategorieId)) {
      return { ok: false, fehler: `Feld „${f.feldId}" verweist auf unbekannte Kategorie „${f.kategorieId}".` };
    }
    feldIds.add(f.feldId);
  }
  // Derselbe Prüfbegriff, den der Regel-Editor vorab anzeigt (`bedingung.ts`).
  const referenzierbar = referenzierbareFelder(v.felder);
  for (const w of v.werte) {
    if (!w || typeof w.id !== 'string' || typeof w.feldId !== 'string' || typeof w.wert !== 'string') {
      return { ok: false, fehler: 'Ungültiger Wert-Eintrag.' };
    }
    if (!feldIds.has(w.feldId)) {
      return { ok: false, fehler: `Wert „${w.wert}" verweist auf unbekanntes Feld „${w.feldId}".` };
    }
  }
  // Die To-do-Kaskade ist optional (Fassungen vor dem Vorgangssystem führen
  // keine); geprüft wird sie trotzdem, sobald sie da ist.
  const regelIds = new Set((v.todoRegeln ?? []).map(r => r?.id));
  for (const r of v.todoRegeln ?? []) {
    if (!r || typeof r.id !== 'string' || !r.bedingung || typeof r.todo !== 'string') {
      return { ok: false, fehler: 'Ungültiger To-do-Regel-Eintrag.' };
    }
    const referenziert = new Set<string>();
    bedingungFeldIds(r.bedingung as Bedingung, referenziert);
    for (const fid of referenziert) {
      if (!referenzierbar.has(fid)) {
        return { ok: false, fehler: `To-do-Regel „${r.id}" verweist auf unbekanntes Feld „${fid}".` };
      }
    }
    // Eine Sperre auf eine Regel-Id, die es nicht (mehr) gibt, sperrt nichts —
    // und sagt es nicht. Zwei Formen sind keine Ids und deshalb ausgenommen: der
    // Sentinel `'*'` und ein `strang:`-Eintrag. Ein Strang wird NICHT gegen die
    // vorhandenen Regeln geprüft — eine Sperre darf einen Strang nennen, den
    // heute keine Regel trägt (der nächste Termin füllt ihn), und eine
    // Fehlermeldung stünde dann im Weg statt zu helfen.
    for (const id of [...(r.sperrt ?? []), ...(r.sperrtNicht ?? [])]) {
      if (id === ALLE_STRAENGE || strangAusEintrag(id) !== null) continue;
      if (!regelIds.has(id)) {
        return { ok: false, fehler: `To-do-Regel „${r.id}" verweist auf unbekannte Regel „${id}".` };
      }
    }
  }
  return { ok: true, version: v as MappingVersion };
}

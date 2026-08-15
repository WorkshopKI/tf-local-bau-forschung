/**
 * Persistenz der selbst angelegten Spalten.
 *
 * **Persönliche Spalten sind gerätelokal** (IndexedDB, kv-Key) — sie stehen in
 * keiner Snapshot-Allowlist, werden nicht auf den Daten-Share gespiegelt und
 * nicht exportiert. Das ist keine Bequemlichkeit, sondern die Bedingung dafür,
 * dass sie in JEDER Variante funktionieren: in prod hat ein normaler Nutzer
 * keine Schreibrechte auf den Share, eine geteilte Ablage wäre dort tot.
 * Maschinell gehalten vom Guard `eigene-spalten-lokal`.
 *
 * **Team-Spalten** kommen aus einem Sidecar und werden hier nur gelesen — sie
 * zu schreiben ist Sache der Kuration (Stufe C).
 *
 * Der Lese-Pfad ist **tolerant**: eine kaputte oder halb migrierte Definition
 * lässt die übrigen stehen, statt die ganze Liste zu verwerfen. Eine Spalte
 * verschwinden zu lassen ist harmlos (sie ist wieder anlegbar); alle
 * verschwinden zu lassen wäre Datenverlust.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { Bedingung } from '@/core/status/typen';
import type { EigeneSpalte, SpaltenFarbe, SpaltenRegel } from './typen';
import { herkunftVon } from './typen';

/** IDB-Key (kv-Store). Steht in KEINER Snapshot-Allowlist. */
export const EIGENE_SPALTEN_IDB_KEY = 'eigene-spalten:personal';

const FARBEN: readonly SpaltenFarbe[] = ['default', 'info', 'success', 'warning', 'danger'];

function alsFarbe(v: unknown): SpaltenFarbe | undefined {
  return typeof v === 'string' && (FARBEN as readonly string[]).includes(v)
    ? v as SpaltenFarbe
    : undefined;
}

function alsText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Prüft eine einzelne Definition. `null` = unbrauchbar, wird übersprungen.
 *
 * Die Bedingungs-Bäume der Regel-Spalten werden hier **nicht** validiert: der
 * Auswerter (`pruefeBedingung`) ist gegen Unsinn robust und liefert dann
 * schlicht `false`. Eine eigene Baum-Validierung wäre eine zweite Wahrheit
 * neben ihm.
 */
function leseSpalte(raw: unknown): EigeneSpalte | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = alsText(o.id);
  const label = alsText(o.label).trim();
  if (id === '' || label === '' || herkunftVon(id) === null) return null;

  const basis = {
    id, label,
    ...(typeof o.beschreibung === 'string' && o.beschreibung.trim() !== ''
      ? { beschreibung: o.beschreibung } : null),
    ...(typeof o.breite === 'number' && Number.isFinite(o.breite) ? { breite: o.breite } : null),
  };

  if (o.art === 'feld') {
    const feldId = alsText(o.feldId).trim();
    if (feldId === '') return null;
    return { ...basis, art: 'feld', feldId, typ: o.typ === 'datum' ? 'datum' : 'wert' };
  }
  if (o.art === 'sammel') {
    const felder = Array.isArray(o.felder)
      ? o.felder.filter((f): f is string => typeof f === 'string' && f.trim() !== '')
      : [];
    if (felder.length === 0) return null;
    return { ...basis, art: 'sammel', felder, wahl: o.wahl === 'aeltestes' ? 'aeltestes' : 'juengstes' };
  }
  if (o.art === 'regel') {
    const regeln: SpaltenRegel[] = [];
    for (const r of Array.isArray(o.regeln) ? o.regeln : []) {
      if (typeof r !== 'object' || r === null) continue;
      const rr = r as Record<string, unknown>;
      const text = alsText(rr.text).trim();
      if (text === '' || typeof rr.wenn !== 'object' || rr.wenn === null) continue;
      const farbe = alsFarbe(rr.farbe);
      regeln.push({ wenn: rr.wenn as Bedingung, text, ...(farbe ? { farbe } : null) });
    }
    if (regeln.length === 0) return null;
    const sonstRoh = typeof o.sonst === 'object' && o.sonst !== null
      ? o.sonst as Record<string, unknown> : null;
    const sonstText = sonstRoh ? alsText(sonstRoh.text).trim() : '';
    const sonstFarbe = sonstRoh ? alsFarbe(sonstRoh.farbe) : undefined;
    return {
      ...basis, art: 'regel', regeln,
      ...(sonstText !== ''
        ? { sonst: { text: sonstText, ...(sonstFarbe ? { farbe: sonstFarbe } : null) } }
        : null),
    };
  }
  return null;
}

/** Tolerant: was sich lesen lässt, kommt durch; der Rest fällt still weg. */
export function leseSpaltenListe(raw: unknown): EigeneSpalte[] {
  if (!Array.isArray(raw)) return [];
  const out: EigeneSpalte[] = [];
  const gesehen = new Set<string>();
  for (const eintrag of raw) {
    const s = leseSpalte(eintrag);
    if (!s || gesehen.has(s.id)) continue;
    gesehen.add(s.id);
    out.push(s);
  }
  return out;
}

export async function ladePersoenlicheSpalten(idb: IDBStore): Promise<EigeneSpalte[]> {
  return leseSpaltenListe(await idb.get<unknown>(EIGENE_SPALTEN_IDB_KEY).catch(() => null));
}

export async function speicherePersoenlicheSpalten(
  idb: IDBStore, spalten: readonly EigeneSpalte[],
): Promise<void> {
  if (spalten.length === 0) {
    await idb.delete(EIGENE_SPALTEN_IDB_KEY);
    return;
  }
  await idb.set(EIGENE_SPALTEN_IDB_KEY, spalten);
}

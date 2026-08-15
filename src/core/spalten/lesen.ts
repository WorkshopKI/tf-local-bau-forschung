/**
 * Der tolerante Leser für Spalten-Definitionen — eine Fassung für beide Ablagen.
 *
 * Die persönlichen Definitionen liegen in IndexedDB, die des Teams in einer
 * Sidecar-Datei auf dem Share. Beide Wege führen dieselbe Struktur, beide können
 * auf dieselbe Weise kaputtgehen (halb migriert, von Hand editiert), und beide
 * brauchen dieselbe Antwort darauf. Zwei Parser liefen unweigerlich auseinander
 * — und zwar genau dort, wo es weh tut: eine Definition, die die eine Seite
 * annimmt und die andere verwirft, wäre je nach Ablage sichtbar oder nicht.
 *
 * **Tolerant heißt: einzeln verwerfen, nie die Liste.** Eine Spalte verlieren
 * ist harmlos (sie ist wieder anlegbar), alle verlieren wäre Datenverlust.
 */
import type { Bedingung } from '@/core/status/typen';
import type { EigeneSpalte, SpaltenFarbe, SpaltenHerkunft, SpaltenRegel } from './typen';
import { herkunftVon } from './typen';

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

/**
 * Nur die Definitionen einer Reichweite.
 *
 * **Jede Ablage filtert auf ihre eigene Herkunft**, und zwar beim LESEN. Die
 * Herkunft steckt in der Id (`frei:ich:` / `frei:team:`), aber sie steht in
 * einer Datei, die auch von Hand editiert werden kann: ohne diesen Filter
 * schöbe eine `frei:ich:`-Zeile in der Team-Sidecar allen Kolleginnen eine
 * Spalte unter, die als „meine" aussieht und die niemand von ihnen löschen
 * kann — und umgekehrt ließe sich eine Team-Spalte lokal überschreiben, ohne
 * dass das Team etwas davon merkt.
 */
export function nurHerkunft(
  spalten: readonly EigeneSpalte[], herkunft: SpaltenHerkunft,
): EigeneSpalte[] {
  return spalten.filter(s => herkunftVon(s.id) === herkunft);
}

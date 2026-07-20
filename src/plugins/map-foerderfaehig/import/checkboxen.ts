/**
 * Patentsituation und Innovationstyp.
 *
 * Die Quelle nutzt zwei unvereinbare Checkbox-Kodierungen direkt nebeneinander:
 *
 * - `patentsituation_checklist`: numerische String-Keys `"0"`–`"4"` → bool,
 *   ganz ohne Beschriftung. Die Bedeutung der Indizes ist nur extern bekannt und
 *   lebt deshalb in der Schema-Definition.
 * - `technologieneuerung`: deutsche Klartext-Sätze als Keys
 *   (`"Einstieg in ein neues Technologiegebiet"`). Das ist besonders
 *   bruchgefährdet — jede Formulierungsänderung im Formular ändert den Key.
 *
 * `labelHerkunft` macht im UI sichtbar, worauf die Anzeige beruht: eine
 * gepflegte Zuordnung, der Schlüssel selbst, oder gar nichts.
 */
import type { MapCheckbox } from '../types';

/** Deutet einen Quellwert als Häkchen. Rein. */
export function alsHaken(wert: unknown): boolean {
  if (typeof wert === 'boolean') return wert;
  if (typeof wert === 'string') return ['true', 'ja', '1', 'x'].includes(wert.trim().toLowerCase());
  if (typeof wert === 'number') return wert !== 0;
  return false;
}

/**
 * Wandelt ein Checkbox-Objekt in eine stabil sortierte Liste.
 *
 * `labels` ordnet numerischen Keys eine Beschriftung zu. Fehlt sie, wird der
 * Schlüssel selbst zur Beschriftung (`'schluessel'`) — sinnvoll bei Klartext-
 * Keys, ehrlich bei numerischen (`'unbekannt'`, Anzeige „Position 3"). Rein.
 */
export function ernteCheckboxen(
  roh: unknown, labels: Readonly<Record<string, string>> = {},
): MapCheckbox[] {
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh)) return [];

  return Object.entries(roh as Record<string, unknown>)
    .map(([key, wert]) => {
      const ausSchema = labels[key];
      const numerisch = /^\d+$/.test(key);
      const label = ausSchema ?? (numerisch ? `Position ${key}` : key);
      const labelHerkunft: MapCheckbox['labelHerkunft'] =
        ausSchema !== undefined ? 'schema' : numerisch ? 'unbekannt' : 'schluessel';
      return { key, label, gesetzt: alsHaken(wert), labelHerkunft };
    })
    .sort((a, b) => {
      const az = Number(a.key);
      const bz = Number(b.key);
      if (Number.isFinite(az) && Number.isFinite(bz)) return az - bz;
      return a.key.localeCompare(b.key, 'de');
    });
}

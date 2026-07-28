/**
 * Die reinen Regeln fürs Ziehen im Ordner-Editor.
 *
 * Warum getrennt vom Component: ob ein Ordner irgendwo abgelegt werden **darf**,
 * entscheidet die Baum-Struktur, nicht die Anzeige — und genau das lässt sich
 * ohne DOM prüfen. Der Component hält nur, was gerade gezogen wird.
 */
import { erzeugtZyklus, kinderVon, type StatusKategorie } from '@/core/status';

/**
 * Reihenfolge, ab der die Sammelordner sitzen („Nicht zugeordnet" = 999).
 * Ein zugezogener Ordner reiht sich davor ein, nie dahinter.
 */
export const SAMMEL_GRENZE = 900;

/**
 * Darf `ziehId` unter `zielId` abgelegt werden (`null` = oberste Ebene)?
 *
 * Vier Gründe für Nein, alle mit Absicht:
 * - Verbund und Teilvorhaben sind **getrennte Bäume** — ein Ordner wechselt die
 *   Ebene nicht, dafür trägt er die falschen Codes.
 * - Der Ordner liegt schon dort (der Drop wäre eine Nulländerung).
 * - Selbstbezug oder ein eigener Nachfahre als Elternknoten — das verwirft
 *   `aendereKategorie` ohnehin; es gar nicht erst als Ziel zu leuchten ist
 *   ehrlicher als ein Drop, der stillschweigend nichts tut.
 */
export function darfAblegen(
  kategorien: readonly StatusKategorie[], ziehId: string, zielId: string | null,
): boolean {
  const zieh = kategorien.find(k => k.id === ziehId);
  if (!zieh) return false;
  if (zielId === null) return zieh.elternId !== null;
  if (zieh.elternId === zielId) return false;
  const ziel = kategorien.find(k => k.id === zielId);
  if (!ziel || ziel.ebene !== zieh.ebene) return false;
  return !erzeugtZyklus(kategorien, ziehId, zielId);
}

/**
 * Reihenfolge für einen Ordner, der neu unter `elternId` einzieht: hinter die
 * vorhandenen Geschwister, aber vor die Sammelordner. Ohne Geschwister 10.
 */
export function naechsteReihenfolge(
  kategorien: readonly StatusKategorie[], ebene: 'verbund' | 'tv', elternId: string | null,
): number {
  const geschwister = kinderVon(kategorien.filter(k => k.ebene === ebene), elternId)
    .filter(k => k.reihenfolge < SAMMEL_GRENZE);
  const max = geschwister.reduce((m, k) => Math.max(m, k.reihenfolge), 0);
  return max + 10;
}

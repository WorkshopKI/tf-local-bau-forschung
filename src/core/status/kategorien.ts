/**
 * Reine Helfer für den Statusbaum (`MappingVersion.kategorien`).
 *
 * Der Baum bildet die Ordnerstruktur des Fachsystems ab und ist **kuratierbare
 * Daten**, kein Code-Enum — die PL legt Ordner an, benennt um und hängt Felder
 * um, ohne dass ein Build nötig wird. Deshalb liegt hier nur die Mechanik
 * (Pfad, Kinder, Sortierung, Zyklenschutz), nicht der Inhalt; der steht im Seed.
 *
 * Verbund- und TV-Baum sind getrennte Wurzeln (`ebene`) — die Funktionen
 * filtern nie selbst danach, der Aufrufer entscheidet, welche Ebene er zeigt.
 */
import type { StatusKategorie } from './typen';

/** Id des Sammelordners je Ebene für Felder ohne Zuordnung. */
export const NICHT_ZUGEORDNET_ID: Record<'verbund' | 'tv', string> = {
  verbund: 'vb.nicht-zugeordnet',
  tv: 'tv.nicht-zugeordnet',
};

/** Index über die Id — einmal bauen, dann O(1) statt `find` je Zugriff. */
export function kategorieIndex(
  kategorien: readonly StatusKategorie[],
): Map<string, StatusKategorie> {
  return new Map(kategorien.map(k => [k.id, k]));
}

/**
 * Pfad von der Wurzel bis zur Kategorie (inklusive). Leer, wenn die Id
 * unbekannt ist. Bricht bei einem Zyklus ab, statt zu hängen — kaputte Daten
 * sollen die Anzeige nicht einfrieren.
 */
export function kategoriePfad(
  kategorien: readonly StatusKategorie[], id: string,
): StatusKategorie[] {
  const idx = kategorieIndex(kategorien);
  const out: StatusKategorie[] = [];
  const gesehen = new Set<string>();
  let cur = idx.get(id);
  while (cur && !gesehen.has(cur.id)) {
    gesehen.add(cur.id);
    out.unshift(cur);
    cur = cur.elternId ? idx.get(cur.elternId) : undefined;
  }
  return out;
}

/** Lesbarer Pfad („Antragsbearbeitung › pre-check"); leer, wenn unbekannt. */
export function kategoriePfadLabel(
  kategorien: readonly StatusKategorie[], id: string | undefined,
): string {
  if (!id) return '';
  return kategoriePfad(kategorien, id).map(k => k.label).join(' › ');
}

/** Direkte Kinder, nach `reihenfolge` und dann Label sortiert. */
export function kinderVon(
  kategorien: readonly StatusKategorie[], elternId: string | null,
): StatusKategorie[] {
  return kategorien
    .filter(k => k.elternId === elternId)
    .sort((a, b) => a.reihenfolge - b.reihenfolge || a.label.localeCompare(b.label, 'de'));
}

/**
 * Alle Kategorien einer Ebene in Baum-Reihenfolge (Tiefensuche), jeweils mit
 * ihrer Tiefe. Das ist die Reihenfolge, in der Cockpit und Detailseite rendern.
 */
export function flacheBaumListe(
  kategorien: readonly StatusKategorie[], ebene: 'verbund' | 'tv',
): { kategorie: StatusKategorie; tiefe: number }[] {
  const derEbene = kategorien.filter(k => k.ebene === ebene);
  const out: { kategorie: StatusKategorie; tiefe: number }[] = [];
  const gesehen = new Set<string>();
  const lauf = (elternId: string | null, tiefe: number): void => {
    for (const k of kinderVon(derEbene, elternId)) {
      if (gesehen.has(k.id)) continue;   // Zyklenschutz
      gesehen.add(k.id);
      out.push({ kategorie: k, tiefe });
      lauf(k.id, tiefe + 1);
    }
  };
  lauf(null, 0);
  return out;
}

/**
 * Würde `elternId` als neuer Elternknoten von `id` einen Zyklus erzeugen?
 * Prüft, ob `id` auf dem Pfad des künftigen Elternknotens liegt (und deckt
 * damit auch den Selbstbezug `id === elternId` ab).
 */
export function erzeugtZyklus(
  kategorien: readonly StatusKategorie[], id: string, elternId: string | null,
): boolean {
  if (elternId === null) return false;
  if (elternId === id) return true;
  return kategoriePfad(kategorien, elternId).some(k => k.id === id);
}

/**
 * Findet die erste Kategorie, die Teil eines Zyklus ist — für die
 * Import-Validierung. `null`, wenn der Baum sauber ist.
 */
export function findeZyklus(kategorien: readonly StatusKategorie[]): string | null {
  const idx = kategorieIndex(kategorien);
  for (const start of kategorien) {
    const gesehen = new Set<string>([start.id]);
    let cur = start.elternId ? idx.get(start.elternId) : undefined;
    while (cur) {
      if (gesehen.has(cur.id)) return start.id;
      gesehen.add(cur.id);
      cur = cur.elternId ? idx.get(cur.elternId) : undefined;
    }
  }
  return null;
}

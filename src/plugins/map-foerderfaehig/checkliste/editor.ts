/**
 * Bearbeitung der Checkliste im laufenden Betrieb — der Kern der Demo-Botschaft
 * „fehlt ein Kriterium, ergänzt es gleich".
 *
 * Jede Änderung erhöht die Version und stempelt Autor und Zeitpunkt. Laufende
 * Prüfungen wandern NICHT mit: sie tragen ihre Version im Datensatz und werden
 * erst beim ausdrücklichen Nachziehen migriert. Sonst änderte sich die Grundlage
 * einer halb fertigen Bewertung unter der Hand.
 *
 * Gelöscht wird nie — Items werden auf `aktiv: false` gesetzt. Ein gelöschtes
 * Item hinterliesse verwaiste Bewertungen in jeder bestehenden Prüfung.
 */
import type { MapChecklistenDefinition, MapChecklistenItem, MapPruefklasse } from './typen';

export interface ItemAenderung {
  kriterium?: string;
  hinweis?: string;
  fundstelle?: string;
  klasse?: MapPruefklasse;
}

export interface NeuesItem {
  gruppe: string;
  kriterium: string;
  klasse: MapPruefklasse;
  hinweis?: string;
  fundstelle?: string;
}

interface Stempel {
  autor: string | null;
  zeitpunkt: string;
}

function naechsteVersion(
  definition: MapChecklistenDefinition, stempel: Stempel,
): Pick<MapChecklistenDefinition, 'version' | 'geaendertAm' | 'geaendertVon'> {
  return {
    version: definition.version + 1,
    geaendertAm: stempel.zeitpunkt,
    geaendertVon: stempel.autor,
  };
}

/** Bildet eine stabile, kollisionsfreie ID für ein neues Item. Rein. */
export function bildeItemId(
  gruppe: string, kriterium: string, vergeben: ReadonlySet<string>,
): string {
  const normal = (s: string): string =>
    s.toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const basis = `${normal(gruppe).slice(0, 12)}.${normal(kriterium).slice(0, 28)}` || 'item';
  if (!vergeben.has(basis)) return basis;

  let n = 2;
  while (vergeben.has(`${basis}-${n}`)) n++;
  return `${basis}-${n}`;
}

/** Ändert ein Item und zählt die Version hoch. Rein. */
export function aendereItem(
  definition: MapChecklistenDefinition,
  itemId: string,
  aenderung: ItemAenderung,
  stempel: Stempel,
): MapChecklistenDefinition {
  return {
    ...definition,
    ...naechsteVersion(definition, stempel),
    items: definition.items.map(item =>
      item.id === itemId ? { ...item, ...bereinige(aenderung) } : item,
    ),
  };
}

/** Leere Strings entfernen die optionalen Felder, statt sie leer zu setzen. */
function bereinige(aenderung: ItemAenderung): Partial<MapChecklistenItem> {
  const out: Partial<MapChecklistenItem> = {};
  if (aenderung.kriterium !== undefined) out.kriterium = aenderung.kriterium.trim();
  if (aenderung.klasse !== undefined) out.klasse = aenderung.klasse;
  if (aenderung.hinweis !== undefined) {
    const t = aenderung.hinweis.trim();
    out.hinweis = t.length > 0 ? t : undefined;
  }
  if (aenderung.fundstelle !== undefined) {
    const t = aenderung.fundstelle.trim();
    out.fundstelle = t.length > 0 ? t : undefined;
  }
  return out;
}

/**
 * Ergänzt ein Item am Ende seiner Gruppe. Neue Items sind immer binär und
 * tragen `herkunft: 'app'` — sie sind damit von der Papiervorlage
 * unterscheidbar. Rein.
 */
export function ergaenzeItem(
  definition: MapChecklistenDefinition, neu: NeuesItem, stempel: Stempel,
): MapChecklistenDefinition {
  const id = bildeItemId(neu.gruppe, neu.kriterium, new Set(definition.items.map(i => i.id)));

  const item: MapChecklistenItem = {
    id,
    gruppe: neu.gruppe,
    kriterium: neu.kriterium.trim(),
    art: 'binaer',
    klasse: neu.klasse,
    herkunft: 'app',
    aktiv: true,
    ...(neu.hinweis?.trim() ? { hinweis: neu.hinweis.trim() } : {}),
    ...(neu.fundstelle?.trim() ? { fundstelle: neu.fundstelle.trim() } : {}),
  };

  // Ans Ende der eigenen Gruppe einsortieren, damit die Reihenfolge der
  // Vorlage erhalten bleibt.
  const letzterDerGruppe = definition.items.map(i => i.gruppe).lastIndexOf(neu.gruppe);
  const items = [...definition.items];
  items.splice(letzterDerGruppe >= 0 ? letzterDerGruppe + 1 : items.length, 0, item);

  return { ...definition, ...naechsteVersion(definition, stempel), items };
}

/** Deaktiviert oder reaktiviert ein Item (kein Löschen). Rein. */
export function setzeItemAktiv(
  definition: MapChecklistenDefinition, itemId: string, aktiv: boolean, stempel: Stempel,
): MapChecklistenDefinition {
  return {
    ...definition,
    ...naechsteVersion(definition, stempel),
    items: definition.items.map(item => (item.id === itemId ? { ...item, aktiv } : item)),
  };
}

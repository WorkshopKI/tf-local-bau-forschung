/**
 * Dateiname-basierter Typ-Vorschlag (statisch, KEIN Inhaltssignal). Zulässig,
 * weil die Dateien vom User selbst benannt/exportiert sind. Reihenfolge zählt:
 * TVB vor VB (sonst fängt „vb" in „teilvorhaben…" nicht). Trennzeichen werden
 * entfernt, damit „Vorhabens-Beschreibung" / „vorhabens_beschreibung" greifen.
 */
export type AufnahmeTyp = 'vorhabensbeschreibung' | 'teilvorhabensbeschreibung' | 'stellungnahme' | 'unklar';

export const AUFNAHME_TYPEN: AufnahmeTyp[] =
  ['vorhabensbeschreibung', 'teilvorhabensbeschreibung', 'stellungnahme', 'unklar'];

export const AUFNAHME_TYP_LABEL: Record<AufnahmeTyp, string> = {
  vorhabensbeschreibung: 'Vorhabensbeschreibung',
  teilvorhabensbeschreibung: 'Teilvorhabensbeschreibung',
  stellungnahme: 'Stellungnahme',
  unklar: 'unklar',
};

/** Keyword → Typ, in Prüf-Reihenfolge (spezifisch vor allgemein). */
const REGELN: ReadonlyArray<{ keys: string[]; typ: AufnahmeTyp }> = [
  { keys: ['teilvorhaben', 'tvb'], typ: 'teilvorhabensbeschreibung' },
  { keys: ['vorhabensbeschreibung', 'vb'], typ: 'vorhabensbeschreibung' },
  { keys: ['stellungnahme'], typ: 'stellungnahme' },
];

export function typVorschlag(filename: string): AufnahmeTyp {
  const norm = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const { keys, typ } of REGELN) {
    if (keys.some(k => norm.includes(k))) return typ;
  }
  return 'unklar';
}

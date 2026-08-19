/**
 * Pure Zuordnungslogik der Dokumenten-Aufnahmefläche (testbar ohne React).
 *
 * Die Aufnahme läuft auf Verbund-Ebene. Bekannte Kennungen (`knownIds`) sind die
 * Verbund-ID UND die Aktenzeichen aller Teilvorhaben — alle zählen als zugehörig
 * (manchmal reichen mehrere TVs dieselbe Projektbeschreibung ein, jeweils mit dem
 * eigenen TV-FKZ; auch der Verbund-FKZ kommt im Dateinamen vor).
 *
 * Erkennung per Substring-Match auf dem normalisierten Dateinamen — das fängt auch
 * Verbund-IDs (z.B. `ZEP…`), die der 16XX-FKZ-Extraktor nicht kennt. Ist der
 * Dateiname nicht eindeutig zuordenbar, ordnet der Bearbeiter manuell zu
 * (Prinzip „lieber Bearbeiter entscheiden lassen als falsch raten").
 */
import { extractFkz } from '@/phase2/matcher/fkz-extractor';
import type { AntragDokumentTyp } from '@/core/services/csv/types';

export type FkzCase = 'match' | 'ambig';

/**
 * Dateiname/Titel matcht „Anlage 5" (Varianten mit Space/Underscore/Punkt/Bindestrich).
 * EINZIGE Quelle — die Aufbereitungs-Auflösung (`quellen.ts`) importiert dieses Muster,
 * damit Erkennung beim Upload und Auflösung deckungsgleich sind (kein Regex-Duplikat).
 */
export const ANLAGE5_RE = /anlage[\s_.-]*5(?!\d)/i;

/** Dateiname deutet auf ein Marketing-/Verwertungskonzept hin. */
export const MARKETING_RE = /(marketing|verwertung)/i;

export interface FkzClassification {
  /** FKZ laut 16XX-Extraktor (nur zur Anzeige; null wenn keiner erkannt). */
  detectedFkz: string | null;
  /** Welche bekannte Kennung (Verbund-ID / TV-Az) im Dateinamen steckt, oder null. */
  matchedId: string | null;
  /** `match` = eindeutig diesem Verbund zuzuordnen; `ambig` = Bearbeiter entscheidet. */
  fkzCase: FkzCase;
}

/** Normalisiert für den Substring-Vergleich (Großschreibung, ohne Trenner). */
export function normId(s: string): string {
  return s.toUpperCase().replace(/[\s_.\-/]+/g, '');
}

export function classifyFkz(filename: string, knownIds: string[]): FkzClassification {
  const detectedFkz = extractFkz(filename)?.fkz ?? null;
  const haystack = normId(filename);
  const matchedId = knownIds.find(id => id.trim().length > 0 && haystack.includes(normId(id))) ?? null;
  return { detectedFkz, matchedId, fkzCase: matchedId ? 'match' : 'ambig' };
}

/**
 * Leitet aus dem Dateinamen einen Vorbeleg-Dokumenttyp ab, damit eine einmal
 * abgelegte Datei überall korrekt getaggt ist (Prinzip „einmal hochladen → überall
 * verfügbar"): „…Anlage 5…" → `arbeitsplan`, Marketing/Verwertung → `marketingkonzept`,
 * sonst der übergebene `fallback` (= `defaultTyp` der jeweiligen Aufnahmefläche).
 * Anlage 5 hat Vorrang (eine Anlage-5-Datei ist nie ein Marketingkonzept). Rein.
 */
export function typAusDateiname(filename: string, fallback: AntragDokumentTyp): AntragDokumentTyp {
  if (ANLAGE5_RE.test(filename)) return 'arbeitsplan';
  if (MARKETING_RE.test(filename)) return 'marketingkonzept';
  return fallback;
}

/**
 * Vollständiges Dokumenttyp-Vokabular — GETEILT über alle Aufnahmeflächen (Gutachten,
 * Kurzfassung, Nachforderungen, Aufbereitung) UND die Typ-Label-Ableitung (Assistent).
 * Hier (pure, node-testbar), damit Konsumenten die Labels ohne React-Import nutzen.
 * `DokumentAufnahme` re-exportiert die Liste; `AUFBEREITUNG_TYP_OPTIONEN` ebenfalls.
 */
export const DOKUMENT_TYP_OPTIONEN: ReadonlyArray<{ value: AntragDokumentTyp; label: string }> = [
  { value: 'vorhabensbeschreibung', label: 'Vorhabensbeschreibung' },
  { value: 'teilvorhabensbeschreibung', label: 'Teilvorhabensbeschreibung' },
  { value: 'arbeitsplan', label: 'Arbeitsplan (Anlage 5)' },
  { value: 'marketingkonzept', label: 'Marketing-/Verwertungskonzept' },
  { value: 'stellungnahme', label: 'Stellungnahme' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

const TYP_LABEL = new Map<string, string>(DOKUMENT_TYP_OPTIONEN.map(o => [o.value, o.label]));

/** Menschliches Label eines Dokumenttyps (Fallback „Dokument"). */
export function typLabelFuerDokument(typ: string): string {
  return TYP_LABEL.get(typ) ?? 'Dokument';
}

/** Erster bekannte Dokumenttyp in den Tags eines Dokuments (sonst `'sonstiges'`). */
export function typAusTags(tags: ReadonlyArray<string>): AntragDokumentTyp {
  for (const t of tags) if (TYP_LABEL.has(t)) return t as AntragDokumentTyp;
  return 'sonstiges';
}

/** Ist dieser Tag ein Dokumenttyp der Aufnahme (kein frei vergebenes Schlagwort)? */
export function istDokumentTypTag(tag: string): boolean {
  return TYP_LABEL.has(tag.trim().toLowerCase());
}

/**
 * Die Verbund-/Antrags-Kennung aus den Tags eines aufgenommenen Dokuments —
 * `null`, wenn die Tags nicht der Signatur der Aufnahme entsprechen.
 *
 * `DokumentAufnahme` legt GENAU `[relationTag, typ]` ab; daran ist die Kennung
 * eindeutig zu erkennen, ohne sie an ihrer Schreibweise raten zu müssen (die
 * Kennungen heißen je nach Programm `16KN…`, `ZEP…`, `ZKN…`).
 *
 * Gebraucht wird das von der Tag-Verwaltung: diese Kennung ist ein
 * Maschinen-Schlüssel, über den `listDocsByFkz` die Dokumente eines Antrags
 * findet — kein Schlagwort, das jemand umbenennen oder löschen dürfte. Bis
 * v4.116 schwemmte „Neu zählen" sie gleichberechtigt in die Tag-Liste.
 *
 * Konservativ: sobald jemand dem Dokument ein eigenes Schlagwort hinzufügt,
 * passt die Signatur nicht mehr und die Funktion sagt nichts.
 */
export function relationTagAusTags(tags: ReadonlyArray<string>): string | null {
  if (tags.length !== 2) return null;
  const [erst, zweit] = tags;
  if (!erst || !zweit) return null;
  if (!istDokumentTypTag(zweit) || istDokumentTypTag(erst)) return null;
  return erst;
}

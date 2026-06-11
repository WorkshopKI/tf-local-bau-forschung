/**
 * Eingang-Manifest: Konvertierungsstatus je Datei eines abgelegten ZIPs.
 * Datei liegt als `ZAH/eingang/{zipname}.manifest.json` (kein IDB-Spiegel).
 * Reine Logik hier; das Schreiben/Lesen macht `antraege-eingang.ts`.
 */
export type DateiStatus = 'offen' | 'konvertiert' | 'fehlgeschlagen' | 'uebersprungen';

export interface ManifestDatei {
  name: string;
  status: DateiStatus;
}

export interface EingangManifest {
  zipname: string;
  erstellt_am?: string;
  dateien: ManifestDatei[];
  schemaVersion: 1;
}

export function leeresManifest(zipname: string, namen: string[]): EingangManifest {
  return { zipname, dateien: namen.map(name => ({ name, status: 'offen' })), schemaVersion: 1 };
}

export function setDateiStatus(m: EingangManifest, name: string, status: DateiStatus): EingangManifest {
  return { ...m, dateien: m.dateien.map(d => (d.name === name ? { ...d, status } : d)) };
}

/**
 * Löschbar, sobald KEINE Datei mehr `offen` ist (alle verarbeitet — auch
 * fehlgeschlagene/übersprungene). Sonst blockierten Fehler das Löschen für immer.
 */
export function istLoeschbar(m: EingangManifest): boolean {
  return m.dateien.length > 0 && m.dateien.every(d => d.status !== 'offen');
}

export function zusammenfassung(m: EingangManifest): {
  gesamt: number; konvertiert: number; fehlgeschlagen: number; uebersprungen: number; offen: number;
} {
  const z = { gesamt: m.dateien.length, konvertiert: 0, fehlgeschlagen: 0, uebersprungen: 0, offen: 0 };
  for (const d of m.dateien) {
    if (d.status === 'konvertiert') z.konvertiert++;
    else if (d.status === 'fehlgeschlagen') z.fehlgeschlagen++;
    else if (d.status === 'uebersprungen') z.uebersprungen++;
    else z.offen++;
  }
  return z;
}

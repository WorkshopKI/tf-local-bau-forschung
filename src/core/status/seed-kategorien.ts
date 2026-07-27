/**
 * Der ausgelieferte Statusbaum — die Ordnerstruktur, in der das Fachsystem die
 * Statuseinträge führt.
 *
 * **Herkunft**: aus Bildschirmfotos des Fachsystems übertragen (Ordnerbäume
 * „Verbundeinträge" und „Teilvorhaben"). Vier Ordner waren dort eingeklappt und
 * sind hier deshalb leer angelegt — ihre Codes kommen über die Spalten-Entdeckung
 * herein und werden von der PL einsortiert. Details:
 * `docs/status-system/KATALOG-CODES.md`.
 *
 * Der Baum ist **Vorbelegung, keine Wahrheit**: die PL legt Ordner an, benennt um
 * und hängt Felder um, ohne dass ein Build nötig wäre. Deshalb sind die Ids
 * stabil und sprechend — sie überleben jedes Umbenennen.
 *
 * Verbund und Teilvorhaben sind getrennte Wurzeln: „Kommunikation" gibt es auf
 * beiden Ebenen mit verschiedenen Codes dahinter (`[XYB]` gegen `[YB]`).
 */
import type { StatusKategorie } from './typen';

/** Sammelordner je Ebene, in dem Felder ohne Zuordnung sichtbar bleiben. */
const NICHT_ZUGEORDNET_REIHENFOLGE = 999;

function k(
  id: string, elternId: string | null, label: string,
  ebene: 'verbund' | 'tv', reihenfolge: number,
): StatusKategorie {
  return { id, elternId, label, ebene, reihenfolge, aktiv: true };
}

export const SEED_KATEGORIEN: readonly StatusKategorie[] = [
  // --- Verbundeinträge ---
  k('vb.kommunikation', null, 'Kommunikation', 'verbund', 10),
  k('vb.antragsbearbeitung', null, 'Antragsbearbeitung', 'verbund', 20),
  // Im Fachsystem eingeklappt — leer ausgeliefert, Inhalt kommt über die Entdeckung.
  k('vb.international', null, 'internationale Projekte', 'verbund', 30),
  k('vb.betreuung', null, 'Betreuung', 'verbund', 40),
  k('vb.nicht-zugeordnet', null, 'Nicht zugeordnet', 'verbund', NICHT_ZUGEORDNET_REIHENFOLGE),

  // --- Teilvorhaben ---
  k('tv.kommunikation', null, 'Kommunikation', 'tv', 10),
  k('tv.antragsbearbeitung', null, 'Antragsbearbeitung', 'tv', 20),
  k('tv.antragsbearbeitung.precheck', 'tv.antragsbearbeitung', 'pre-check', 'tv', 10),
  k('tv.antragsbearbeitung.ruecknahmeempfehlung', 'tv.antragsbearbeitung', 'Rücknahmeempfehlung', 'tv', 20),
  k('tv.antragsbearbeitung.ablehnung', 'tv.antragsbearbeitung', 'Ablehnung', 'tv', 30),
  k('tv.antragsbearbeitung.widerspruch-antrag', 'tv.antragsbearbeitung', 'Widerspruch Antragsphase', 'tv', 40),
  k('tv.antragsbearbeitung.widerspruch-zuwendung', 'tv.antragsbearbeitung', 'Widerspruch gegen den Zuwendungsbescheid', 'tv', 50),
  k('tv.antragsbearbeitung.ruecknahme-zuwendung', 'tv.antragsbearbeitung', 'Rücknahme des Zuwendungsbescheides', 'tv', 60),
  k('tv.antragsbearbeitung.stichprobe', 'tv.antragsbearbeitung', 'Stichprobe', 'tv', 70),
  // Die folgenden vier waren im Fachsystem eingeklappt (siehe Kopf).
  k('tv.betreuung', null, 'Betreuung', 'tv', 30),
  k('tv.vor-ort-besuch', null, 'Vor-Ort-Besuch', 'tv', 40),
  k('tv.verwendungsnachweis', null, 'Verwendungsnachweis', 'tv', 50),
  k('tv.archiv', null, 'SV - Keller - Archiv', 'tv', 60),
  k('tv.nicht-zugeordnet', null, 'Nicht zugeordnet', 'tv', NICHT_ZUGEORDNET_REIHENFOLGE),
];

/** Ordner, die bewusst ohne ausgelieferte Codes starten (im Fachsystem eingeklappt). */
export const LEERE_SEED_KATEGORIEN: readonly string[] = [
  'vb.international',
  'vb.nicht-zugeordnet',
  'tv.betreuung',
  'tv.vor-ort-besuch',
  'tv.verwendungsnachweis',
  'tv.archiv',
  'tv.nicht-zugeordnet',
];

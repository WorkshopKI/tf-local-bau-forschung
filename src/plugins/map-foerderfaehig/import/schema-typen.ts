/**
 * Deklarative Beschreibung einer Einreichungs-Schema-Generation.
 *
 * Der Adapter kennt keine Pfade — er liest sie aus einer `MapSchemaDefinition`.
 * Neue Plattform-Generation heisst deshalb: eine Definition ergänzen, nicht den
 * Adapter anfassen.
 */
import type { MapSchemaId } from '../types';

/** Ein Zielfeld des Strukturmodells und seine möglichen Quellpfade. */
export interface FeldSpez {
  /** Pfad im Strukturmodell, z. B. `kosten.personal`. */
  ziel: string;
  /**
   * Quellpfade in Prioritätsreihenfolge. Index 0 ist der primäre Pfad, alle
   * weiteren sind Aliasse — sie fangen Drift ab, ohne sie zu verstecken (der
   * Import-Report weist jeden gegriffenen Alias aus).
   */
  pfade: readonly string[];
  /** Fehlt ein Pflichtfeld, ist das ein Fehler-Befund (aber kein Abbruch). */
  pflicht: boolean;
}

export interface MapSchemaDefinition {
  id: MapSchemaId;
  label: string;
  /**
   * Diskriminierende Marker-Pfade. Sie entscheiden die Erkennung — NICHT die
   * Trefferquote der Zielfelder.
   *
   * Grund: die importrelevanten Felder liegen in beiden bekannten Generationen
   * auf identischen Pfaden. Eine Erkennung über „wenigste fehlende Pflichtfelder"
   * liefert deshalb immer Gleichstand und damit ein beliebiges Ergebnis. Marker
   * sind Pfade, die es nachweislich nur in genau einer Generation gibt.
   */
  marker: readonly string[];
  felder: readonly FeldSpez[];
  listenPfade: {
    arbeitspakete: string;
    einsatzplanung: string;
  };
  /** Anlagen-Arrays, in Anzeigereihenfolge. */
  anlagenPfade: readonly string[];
  /**
   * Stellen, an denen Nebengrids Arbeitspakete referenzieren — Grundlage für
   * die Suche nach verwaisten Referenzen. `*` traversiert Array-Ebenen.
   * Bewusst NUR Pfade ausserhalb der Datenschutz-Deny-Liste.
   */
  apRefPfade: readonly string[];
  /** Beschriftungen für Checkbox-Gruppen mit numerischen Schlüsseln. */
  checkboxLabels: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

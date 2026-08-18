/**
 * Der gewählte **Betrachtungsbereich** — gerätelokal, drei Stufen.
 *
 * Die *Definition* (welche Programme zum Standard-Bereich gehören) ist Team-
 * Kuration und lebt im Status-Katalog bzw. im Code-Seed
 * (`core/status/betrachtungsbereich.ts`). Die *Auswahl* ist persönlich: ob
 * jemand gerade den Standard-Bereich, den Vollbestand oder eine eigene
 * Programm-Liste ansieht, geht niemanden sonst etwas an und gehört deshalb in
 * localStorage, nicht auf den Share.
 *
 * **Kein Zustand ohne Anzeige** (Pitfall #46): jede Datensicht, die den Bereich
 * anwendet, trägt den Chip im Kopf. Der Store liefert dafür die Bausteine, die
 * Konsumenten wenden ihn selbst an — nie ein stiller Filter im Daten-Layer.
 *
 * Die Speicher-Mechanik selbst steht in [bereichsStore.ts](./bereichsStore.ts)
 * und wird mit der Richtlinien-Auswahl der Suche geteilt; verschieden ist nur
 * der Grundzustand (hier `standard`, dort `alle`).
 */
import { erzeugeBereichsStore } from './bereichsStore';
import type { BereichModus } from '@/core/status/betrachtungsbereich';

export type { BereichModus };

/**
 * Versionierter Key: `_v1` ist der erste Stand. Wer die Bedeutung des
 * gespeicherten Werts ändert (andere Stufen, andere Semantik von `auswahl`),
 * bumpt hier — ein alter Eintrag darf nie unter neuer Lesart weitergelten
 * (Muster wie `ansichtPersistenz.bereichV2`).
 *
 * **Ein Wechsel des Standard-Bereichs bumpt hier NICHT** (geprüft beim Nachzug
 * der Generation 2015): `modus` heißt weiter dasselbe, `auswahl` weiter „genau
 * diese Codes" — kein gespeicherter Wert wird unter neuer Lesart gelesen. Und
 * `standard` speichert bewusst keine Liste, greift den neuen Bereich also von
 * selbst ab. Wer eine eigene Auswahl gesetzt hat, behält sie (sie gehört ihm);
 * dass sie vom Standard abweicht, sagt das Auswahl-Panel.
 */
const KEY = 'teamflow_betrachtungsbereich_v1';

export const useBetrachtungsbereichStore = erzeugeBereichsStore(KEY, 'standard');

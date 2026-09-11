/**
 * Tagesbrief — der Themen-Katalog als Code.
 *
 * Eine deklarative Tabelle, kein Verhalten: Beschriftung, Familie und
 * Verfügbarkeit je Thema. Das Bauen der Sätze steht in `punkte.ts` (rein), das
 * Beschaffen der Rohdaten in `useTagesbrief.ts` (unrein).
 *
 * `verfuegbarWenn` ist die Bauzeit-/Freischaltungs-Frage („kann dieses Thema in
 * diesem Build überhaupt etwas sagen?"), nicht die Nutzerwahl — die steht als
 * **Abwahl** in der Widget-Config, damit später ergänzte Themen von selbst
 * erscheinen statt stumm zu bleiben.
 */
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
import type { Familie, ThemaId } from './typen';

export interface Thema {
  id: ThemaId;
  /** Beschriftung in der Themenwahl — und im Leertext, der sie aufzählt. */
  label: string;
  familie: Familie;
  /**
   * Trägt das Thema eine Uhr? Nur Uhr-Themen ranken; die übrigen stehen im
   * Nachsatz. Rein deklarativ — `baueBrief` entscheidet an `punkt.tage`, dieses
   * Feld beschreibt die Erwartung und trägt die Themenwahl-Gruppierung.
   */
  uhr: boolean;
  /** Kann dieses Thema in diesem Build/dieser Freischaltung etwas sagen? */
  verfuegbarWenn: () => boolean;
}

const immer = (): boolean => true;

/**
 * Der Katalog in **stabiler** Reihenfolge — sie ist der Gleichstands-Entscheider
 * der Rangfolge (zwei Punkte mit derselben Tageszahl behalten diese Ordnung) und
 * die Reihenfolge des Nachsatzes.
 */
export const THEMEN: readonly Thema[] = [
  // **Meilensteine stehen bewusst NICHT hier** (bis v6.60.3 das Thema
  // „Fristen"). Ein Meilenstein ist ein Soll-Termin ab Eingang über den ganzen
  // Plan — eine Aussage über das Tempo, keine Handlung für heute. Im Brief
  // verdrängte er beim Entdoppeln den To-do-Punkt desselben Verbunds und schob
  // eine lange Bedingungs-Bezeichnung vor die Aufgabe; gemessen standen vier von
  // fünf Zeilen so da. Die Termine stehen auf der Fristen-Karte.
  {
    id: 'stillstand',
    label: 'Stillstand',
    familie: 'arbeitsvorrat',
    uhr: true,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'zu-tun',
    label: 'Was zu tun ist',
    familie: 'arbeitsvorrat',
    uhr: true,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'liegt-bei-anderen',
    label: 'Liegt bei anderen',
    familie: 'arbeitsvorrat',
    // KEINE Uhr im Rang: eine Aufgabe, die bei einer anderen Rolle liegt oder
    // auf jemanden wartet, ist eine Auskunft, keine Handlung
    // (aufgaben-anzeige.ts). Gemessen am 11.09.2026 (Kürzel THü, liest als
    // FB): oben standen AIRES „GA schreiben" (liegt bei AB) und zwei Vorgänge
    // mit „Keine Aufgabe mehr", deren FB-Teil durch war und die beim AB lagen.
    // Die Rangliste gehört dem, was man selbst tun kann; die übrigen stehen
    // hier mit Namen. Abgewählt verschwinden sie aus dem Brief, in die
    // Rangliste kehren sie nicht zurück.
    uhr: false,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'kuerzel-status',
    label: 'Kürzel ↔ Status',
    familie: 'arbeitsvorrat',
    // Laut Kürzeln erledigt, der amtliche Status sagt noch offen — dieselbe
    // Menge, die „Meine Anträge" als Zählzeile führt und nicht mehr als offen
    // zählt. Ein Befund ohne Handlungsanweisung: die App leitet keinen Status
    // ab (Pitfall #44). Abgewählt bleibt der Vorgang trotzdem aus der Rangliste.
    uhr: false,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'nachtlauf',
    label: 'Änderungen über Nacht',
    familie: 'bewegung',
    uhr: false,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'eingang',
    label: 'Neu dazugekommen',
    familie: 'bewegung',
    // KEINE Uhr, und bewusst NICHT die Eingangs-Ampel: deren zwei Zahlen
    // („älter als 90 Tage", „31–90 Tage") stehen bereits als klickbare Kacheln
    // in der Hero-Karte direkt darüber, und sie messen ALTER, während der Brief
    // Frist rechnet. Gezählt werden stattdessen die `antrag-neu`-Einträge des
    // Journals — dieselbe Quelle wie „Änderungen über Nacht", und eine Aussage,
    // die sonst niemand macht.
    uhr: false,
    verfuegbarWenn: isVorgangssystemEnabled,
  },
  {
    id: 'entwuerfe',
    label: 'Meine Entwürfe',
    familie: 'eigenes',
    uhr: false,
    verfuegbarWenn: immer,
  },
  {
    id: 'weitermachen',
    label: 'Weitermachen',
    familie: 'eigenes',
    uhr: false,
    verfuegbarWenn: immer,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    familie: 'umfeld',
    uhr: false,
    verfuegbarWenn: immer,
  },
  {
    id: 'registry',
    label: 'Skills & Regeln',
    familie: 'umfeld',
    uhr: false,
    verfuegbarWenn: isKuratorFreigeschaltet,
  },
  // **Auslastung steht bewusst NICHT hier.** Sie war als zehntes Thema geplant
  // und ist der einzige Fall, dessen Quelle sonst niemand auf der Startseite
  // lädt: `computeQuartalsAuslastung` + `computeAltlasten` laufen über den
  // vollen Antragsbestand, weshalb schon das Auslastungs-Widget selbst
  // eingeklappt startet. Eine Karte, die eine andere Karte teuer macht, ist der
  // falsche Handel — und ein Häkchen, das nie etwas bewirkt, wäre schlimmer als
  // keines. Die Zahl steht auf der Auslastungs-Karte, einen Klick entfernt.
];

/** Beschriftung je Familie — Überschriften der Themenwahl. */
export const FAMILIE_LABEL: Record<Familie, string> = {
  arbeitsvorrat: 'Arbeitsvorrat',
  bewegung: 'Bewegung',
  eigenes: 'Eigenes',
  umfeld: 'Umfeld',
};

const NACH_ID = new Map<ThemaId, Thema>(THEMEN.map(t => [t.id, t]));

export function themaVon(id: ThemaId): Thema | undefined {
  return NACH_ID.get(id);
}

/** Rang eines Themas im Katalog — der Gleichstands-Entscheider der Rangfolge. */
export function themaRang(id: ThemaId): number {
  const i = THEMEN.findIndex(t => t.id === id);
  return i === -1 ? THEMEN.length : i;
}

/**
 * Die aktiven Themen: im Build verfügbar **und** nicht abgewählt.
 *
 * Abwahl statt Auswahl — ein später ergänztes Thema ist damit von selbst dabei,
 * ohne dass eine gewachsene Config es kennen müsste.
 */
export function aktiveThemen(aus: readonly ThemaId[]): Set<ThemaId> {
  const abgewaehlt = new Set(aus);
  return new Set(
    THEMEN.filter(t => t.verfuegbarWenn() && !abgewaehlt.has(t.id)).map(t => t.id),
  );
}

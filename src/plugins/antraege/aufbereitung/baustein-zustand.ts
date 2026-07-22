/**
 * Der Baustein-Zustand als EINE Karte — reine Logik, kein React, kein IO.
 *
 * Der Hook hielt vorher zwölf `useState` (je Baustein einer für den Skill, einer für
 * den UI-Zustand). Jede Änderung musste sechs bis zwölf Stellen synchron treffen; das
 * war die strukturelle Wurzel der Fix-Serie. Hier liegt derselbe Zustand als
 * `Record<Id, …>` mit ein paar puren Übergängen, die einzeln testbar sind.
 *
 * Die öffentliche Oberfläche des Hooks bleibt unverändert: `alsFelder()` leitet die
 * Einzelfelder (`aspekte`, `steckbrief`, …) wieder ab, sodass kein Tab angefasst wird.
 */
import type { SkillRecord } from '@/core/services/skills';
import type { ChatResetStatus } from '@/core/services/ai/chat-reset';
import {
  BAUSTEIN_IDS, BAUSTEIN_KATALOG,
  type AufbereitungBausteinId, type BausteinDatenMap,
} from './baustein-katalog';

/** UI-Status eines Bausteins (Compute-Status + die Vor-Zustände `fehlt`/`laeuft`). */
export type BausteinUiStatus = 'fehlt' | 'laeuft' | 'ok' | 'degradiert' | 'fehler';

export interface BausteinUiState<T> {
  status: BausteinUiStatus;
  daten?: T;
  /** Roh-Antwort bei `degradiert` (einsehbar im UI). */
  rohtext?: string;
  /** Chat-Reset-Status des Laufs (Pitfall #36) — `'nicht-gefunden'`/`'timeout'` →
   *  Warn-Banner auf der Seite. Nur bei echtem Submit gesetzt (nicht bei Cache-Hit). */
  chatResetStatus?: ChatResetStatus;
  /** Anzahl automatischer Retries (nur bei Auffälligkeit gesetzt). */
  retryAnzahl?: number;
  /** Begründung der Degradation (z.B. „Modell hat keine Sektion zugeordnet"). */
  begruendung?: string;
}

export const FEHLT: BausteinUiState<never> = { status: 'fehlt' };

/** Ein Baustein-Slot: der aufgelöste Skill plus der UI-Zustand seines letzten Laufs. */
export interface BausteinSlot<K extends AufbereitungBausteinId> {
  skill: SkillRecord;
  ui: BausteinUiState<BausteinDatenMap[K]>;
}

export type BausteinZustand = { [K in AufbereitungBausteinId]: BausteinSlot<K> };

/** Startzustand: Seed-Skills aus dem Katalog, alle Bausteine `fehlt`. */
export function initialerZustand(): BausteinZustand {
  const out = {} as BausteinZustand;
  for (const id of BAUSTEIN_IDS) {
    // Der Katalog ist über die Id typisiert; die Schleife kann das nicht mitführen.
    (out as Record<string, BausteinSlot<AufbereitungBausteinId>>)[id] = {
      skill: BAUSTEIN_KATALOG[id].seedSkill,
      ui: FEHLT,
    };
  }
  return out;
}

/** Setzt den UI-Zustand EINES Bausteins (reiner Übergang). */
export function setzeUi(
  zustand: BausteinZustand,
  id: AufbereitungBausteinId,
  ui: BausteinUiState<unknown>,
): BausteinZustand {
  return { ...zustand, [id]: { ...zustand[id], ui } } as BausteinZustand;
}

/** Setzt den Skill EINES Bausteins (Registry-Lookup, Seed bleibt Fallback). */
export function setzeSkill(
  zustand: BausteinZustand,
  id: AufbereitungBausteinId,
  skill: SkillRecord,
): BausteinZustand {
  return { ...zustand, [id]: { ...zustand[id], skill } } as BausteinZustand;
}

/**
 * Setzt ALLE Bausteine auf denselben UI-Zustand — für „Kontext gewechselt" (`fehlt`)
 * und „Korpus nicht auflösbar" (`fehler`).
 *
 * Die Skills bleiben stehen: sie hängen an der Registry, nicht am Antrag. Sie hier
 * mit zurückzusetzen hiesse, nach jedem Antragswechsel wieder auf den Seeds zu laufen,
 * bis der Registry-Effekt erneut durch ist.
 */
export function setzeAlleUi(zustand: BausteinZustand, ui: BausteinUiState<never>): BausteinZustand {
  const out = { ...zustand } as BausteinZustand;
  for (const id of BAUSTEIN_IDS) {
    (out as Record<string, BausteinSlot<AufbereitungBausteinId>>)[id] = { ...zustand[id], ui };
  }
  return out;
}

/**
 * Füllt LEERE Slots aus dem Cache (Rehydrierung beim Öffnen einer Seite).
 *
 * Nur `status: 'fehlt'` wird überschrieben: ein laufender oder bereits fertiger
 * Baustein bleibt stehen, auch wenn die Leseantwort später eintrifft. Ein Miss
 * (`null`) ist ein No-op — diese Funktion löscht nie, sonst risse ein Zwischenstand
 * frische Ergebnisse mit.
 */
export function fuelleAusCache(
  zustand: BausteinZustand,
  gecacht: Partial<{ [K in AufbereitungBausteinId]: BausteinDatenMap[K] | null }>,
): BausteinZustand {
  const out = { ...zustand } as BausteinZustand;
  for (const id of BAUSTEIN_IDS) {
    const daten = gecacht[id];
    if (daten == null || zustand[id].ui.status !== 'fehlt') continue;
    (out as Record<string, BausteinSlot<AufbereitungBausteinId>>)[id] = {
      ...zustand[id], ui: { status: 'ok', daten },
    };
  }
  return out;
}

/** Die Einzelfelder der öffentlichen Hook-Oberfläche (unverändert gegenüber vorher). */
export interface BausteinFelder {
  aspekte: BausteinUiState<BausteinDatenMap['aspekte']>;
  steckbrief: BausteinUiState<BausteinDatenMap['steckbrief']>;
  zahlen: BausteinUiState<BausteinDatenMap['zahlen']>;
  glossar: BausteinUiState<BausteinDatenMap['glossar']>;
  verwertung: BausteinUiState<BausteinDatenMap['verwertung']>;
  recherchePrompt: BausteinUiState<BausteinDatenMap['recherchePrompt']>;
}

/** Leitet die Einzelfelder aus der Karte ab — die Tabs bleiben unangetastet. */
export function alsFelder(zustand: BausteinZustand): BausteinFelder {
  return {
    aspekte: zustand.aspekte.ui,
    steckbrief: zustand.steckbrief.ui,
    zahlen: zustand.zahlen.ui,
    glossar: zustand.glossar.ui,
    verwertung: zustand.verwertung.ui,
    recherchePrompt: zustand.recherchePrompt.ui,
  };
}

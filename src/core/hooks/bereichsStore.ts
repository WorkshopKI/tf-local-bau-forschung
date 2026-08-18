/**
 * Der Speicher hinter einer Richtlinien-Auswahl — **eine** Mechanik, zwei Nutzer.
 *
 * Die App kennt zwei solche Auswahlen, und sie sind bewusst getrennt:
 *
 *  - der **Betrachtungsbereich** schneidet den *Arbeitsvorrat* (Listen, Zähler,
 *    Fristen, Auslastung). Grundzustand: der Standard-Bereich, also die letzten
 *    drei Richtlinien-Generationen.
 *  - die **Richtlinien der Suche** schneiden die *Trefferliste*. Grundzustand:
 *    `alle` — die Suche ist Evidenz und darf nichts stillschweigend wegnehmen
 *    (Pitfall #46). Wer alte Richtlinien loswerden will, sagt es einmal; die
 *    Wahl wird gemerkt.
 *
 * Gleiche Stufen, gleiche Persistenz, **anderer Grundzustand** — also ein
 * Bauteil mit Parametern statt zweier Abschriften, die auseinanderlaufen.
 *
 * Beides ist gerätelokal: welchen Ausschnitt jemand ansieht, geht niemanden
 * sonst etwas an und gehört deshalb in localStorage, nicht auf den Share.
 */
import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type { BereichModus } from '@/core/status/betrachtungsbereich';

/** Was gespeichert wird. `auswahl` gilt nur bei `modus === 'auswahl'`. */
export interface BereichsWahl {
  modus: BereichModus;
  auswahl: string[];
}

export interface BereichsWahlStore extends BereichsWahl {
  setModus: (modus: BereichModus) => void;
  setAuswahl: (programme: string[]) => void;
}

/**
 * Der Grundzustand einer Auswahl — der Modus, auf den ohne gespeicherten Wert
 * und beim Zurückfallen gilt. Bewusst auf die beiden *listenlosen* Stufen
 * beschränkt: `auswahl` ohne Liste wäre ein Bereich ohne Inhalt.
 */
export type BereichsGrundModus = Extract<BereichModus, 'standard' | 'alle'>;

function lade(key: string, grund: BereichsGrundModus): BereichsWahl {
  const leer: BereichsWahl = { modus: grund, auswahl: [] };
  if (typeof localStorage === 'undefined') return leer;
  try {
    const roh = localStorage.getItem(key);
    if (!roh) return leer;
    const p = JSON.parse(roh) as Partial<BereichsWahl>;
    const modus: BereichModus = p.modus === 'alle' || p.modus === 'auswahl' || p.modus === 'standard'
      ? p.modus
      : grund;
    const auswahl = Array.isArray(p.auswahl) ? p.auswahl.filter(x => typeof x === 'string') : [];
    // Eine leere eigene Auswahl wäre ein Bereich ohne Inhalt — das ist keine
    // Absicht, sondern ein halb fertiger Klick. Zurück auf den Grundzustand.
    return modus === 'auswahl' && auswahl.length === 0 ? leer : { modus, auswahl };
  } catch {
    return leer;
  }
}

function speichere(key: string, s: BereichsWahl): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    /* Quota/privater Modus — die Auswahl gilt dann nur für diese Sitzung. */
  }
}

/**
 * Baut einen Auswahl-Store auf einem localStorage-Schlüssel.
 *
 * `key` ist **versioniert** zu führen (`…_v1`): wer die Bedeutung des
 * gespeicherten Werts ändert, bumpt ihn — ein alter Eintrag darf nie unter
 * neuer Lesart weitergelten. Ein Wechsel des *Standard-Bereichs* ist kein
 * solcher Fall: `standard` speichert bewusst keine Liste und greift den neuen
 * Bereich von selbst ab.
 */
export function erzeugeBereichsStore(
  key: string, grund: BereichsGrundModus,
): UseBoundStore<StoreApi<BereichsWahlStore>> {
  return create<BereichsWahlStore>(set => ({
    ...lade(key, grund),
    setModus: modus => set(s => {
      const next: BereichsWahl = { modus, auswahl: s.auswahl };
      speichere(key, next);
      return next;
    }),
    setAuswahl: programme => set(s => {
      const next: BereichsWahl = programme.length > 0
        ? { modus: 'auswahl', auswahl: programme }
        : { modus: grund, auswahl: [] };
      speichere(key, next);
      return { ...s, ...next };
    }),
  }));
}

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
 */
import { create } from 'zustand';

export type BereichModus = 'standard' | 'alle' | 'auswahl';

/**
 * Versionierter Key: `_v1` ist der erste Stand. Wer die Bedeutung des
 * gespeicherten Werts ändert (andere Stufen, andere Semantik von `auswahl`),
 * bumpt hier — ein alter Eintrag darf nie unter neuer Lesart weitergelten
 * (Muster wie `ansichtPersistenz.bereichV2`).
 */
const KEY = 'teamflow_betrachtungsbereich_v1';

interface Gespeichert {
  modus: BereichModus;
  auswahl: string[];
}

function lade(): Gespeichert {
  if (typeof localStorage === 'undefined') return { modus: 'standard', auswahl: [] };
  try {
    const roh = localStorage.getItem(KEY);
    if (!roh) return { modus: 'standard', auswahl: [] };
    const p = JSON.parse(roh) as Partial<Gespeichert>;
    const modus: BereichModus = p.modus === 'alle' || p.modus === 'auswahl' ? p.modus : 'standard';
    const auswahl = Array.isArray(p.auswahl) ? p.auswahl.filter(x => typeof x === 'string') : [];
    // Eine leere eigene Auswahl wäre ein Bereich ohne Inhalt — das ist keine
    // Absicht, sondern ein halb fertiger Klick. Zurück auf den Standard.
    return modus === 'auswahl' && auswahl.length === 0 ? { modus: 'standard', auswahl: [] } : { modus, auswahl };
  } catch {
    return { modus: 'standard', auswahl: [] };
  }
}

function speichere(s: Gespeichert): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Quota/privater Modus — die Auswahl gilt dann nur für diese Sitzung. */
  }
}

interface BereichState extends Gespeichert {
  setModus: (modus: BereichModus) => void;
  setAuswahl: (programme: string[]) => void;
}

export const useBetrachtungsbereichStore = create<BereichState>(set => ({
  ...lade(),
  setModus: modus => set(s => {
    const next = { modus, auswahl: s.auswahl };
    speichere(next);
    return next;
  }),
  setAuswahl: programme => set(s => {
    const next: Gespeichert = programme.length > 0
      ? { modus: 'auswahl', auswahl: programme }
      : { modus: 'standard', auswahl: [] };
    speichere(next);
    return { ...s, ...next };
  }),
}));

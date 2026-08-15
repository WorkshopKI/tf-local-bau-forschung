/**
 * Mehrfachauswahl in der Förderanträge-Tabelle.
 *
 * **Der Schlüssel ist immer ein Teilvorhaben** (`aktenzeichen`), nie eine Zeile.
 * In der Ansicht „Antrag" steht eine Zeile für einen ganzen Verbund; ihr Häkchen
 * wählt deshalb alle seine TV auf einmal. Sonst hinge an der Auswahl eine
 * Bedeutung, die sich beim Umschalten der Ansicht ändert — und ein Export
 * enthielte je nach Ansicht andere Zeilen.
 *
 * **Nicht persistiert.** Eine Auswahl ist ein Moment, kein Zustand: wer die App
 * neu lädt, hat einen neuen Arbeitsschritt vor sich. Ein wiederhergestelltes
 * „13 Anträge gewählt" wäre eine Behauptung über eine Absicht, die niemand mehr
 * hat.
 *
 * Aufgehoben wird die Auswahl NICHT automatisch beim Filtern — wer eine Liste
 * zusammenklickt und dazwischen den Filter dreht, verlöre sonst seine Arbeit.
 * Stattdessen schneiden die Aktionen die Auswahl gegen die aktuelle Liste
 * (`gewaehlteAus`), damit nie etwas exportiert wird, das gerade gar nicht dasteht.
 */
import { create } from 'zustand';

interface AuswahlStore {
  gewaehlt: ReadonlySet<string>;
  /** Einen Satz Schlüssel gemeinsam setzen oder abwählen (eine Zeile = ein Satz). */
  setzeViele: (keys: readonly string[], an: boolean) => void;
  leeren: () => void;
}

export const useAntraegeAuswahl = create<AuswahlStore>((set, get) => ({
  gewaehlt: new Set<string>(),

  setzeViele: (keys, an) => {
    if (keys.length === 0) return;
    const next = new Set(get().gewaehlt);
    for (const k of keys) {
      if (an) next.add(k);
      else next.delete(k);
    }
    set({ gewaehlt: next });
  },

  leeren: () => {
    if (get().gewaehlt.size === 0) return;
    set({ gewaehlt: new Set<string>() });
  },
}));

/** Die Schlüssel, die eine Zeile umfasst: ein Verbund alle seine TV, sonst sich
 *  selbst. Genau EINE Stelle beantwortet das — Zelle, Kopf-Häkchen und Zähler
 *  müssen dieselbe Menge meinen. */
export function zeilenSchluessel(
  row: { aktenzeichen: string; _verbund?: { tvs: readonly { aktenzeichen: string }[] } },
): string[] {
  return row._verbund ? row._verbund.tvs.map(t => t.aktenzeichen) : [row.aktenzeichen];
}

/** Zustand eines Häkchens über einem Satz Schlüssel. */
export function haekchenStand(
  keys: readonly string[], gewaehlt: ReadonlySet<string>,
): { an: boolean; teilweise: boolean } {
  if (keys.length === 0) return { an: false, teilweise: false };
  let treffer = 0;
  for (const k of keys) if (gewaehlt.has(k)) treffer++;
  return { an: treffer === keys.length, teilweise: treffer > 0 && treffer < keys.length };
}

/**
 * Die gewählten Anträge, geschnitten gegen eine Liste — die Grundlage jeder
 * Massen-Aktion. Reihenfolge ist die der Liste, nicht die der Klicks: der Export
 * soll so aussehen wie die Tabelle.
 */
export function gewaehlteAus<T extends { aktenzeichen: string }>(
  liste: readonly T[], gewaehlt: ReadonlySet<string>,
): T[] {
  if (gewaehlt.size === 0) return [];
  return liste.filter(a => gewaehlt.has(a.aktenzeichen));
}

/**
 * Die Kategorie-Referenzen (`referenzEmbedding`) an den Ueberkategorien
 * setzen — die eine Regel dafuer, an einer Stelle.
 *
 * Die Referenzen sind Mittelwerte ueber die Verbund-Vektoren der bereits
 * klassifizierten Verbuende ([klassifizierung-engine.ts](./klassifizierung-engine.ts)).
 * Sie liegen NICHT im Embedding-Korpus, sondern in `_intern/auslastung.json` —
 * zwei Umgebungen mit getrennten Daten-Shares teilen diese Datei also nicht.
 * Wer den Korpus geholt statt gebaut hat, muss sie deshalb aus seinen eigenen
 * Klassifizierungen nachziehen; genau dafuer gibt es diese Funktion zweimal
 * denselben Weg (Bau und Download).
 *
 * Rein und ohne Store, damit der Sonderfall unten pruefbar ist statt nur
 * beobachtbar.
 */
import type { UeberKategorie } from '../../types';

export interface ReferenzUebernahme {
  /** Die Kategorien nach der Uebernahme — bei `unveraendert` dieselbe Liste. */
  kategorien: UeberKategorie[];
  /** Wie viele Kategorien danach eine Referenz tragen. */
  uebernommen: number;
  /** Es wurde nichts angefasst (leere Zentren, siehe unten). */
  unveraendert: boolean;
}

/**
 * Zentren uebernehmen — mit einer Ausnahme, die Datenverlust verhindert.
 *
 * **Leere Zentren schreiben nichts.** Eine leere Map heisst nicht „diese
 * Kategorien haben keine Referenz mehr", sondern fast immer „die Grundlage lag
 * gerade nicht vor" — keine Klassifizierungen geladen, keine Verbund-Vektoren
 * lokal. Wuerde sie durchgeschrieben, loeschte ein Lauf auf einem kalten
 * Rechner die Referenzen des ganzen Teams aus `auslastung.json`, ohne dass
 * irgendwo etwas Neues entstanden waere.
 *
 * Eine EINZELNE Kategorie ohne neues Zentrum verliert ihre alte Referenz
 * dagegen sehr wohl: dann gibt es zu ihr keine klassifizierten Verbuende mehr,
 * und eine Referenz aus einer fruehereren Zuordnung waere schlicht falsch.
 */
export function uebernimmKategorieReferenzen(
  kategorien: UeberKategorie[],
  zentren: Map<string, number[]>,
): ReferenzUebernahme {
  if (zentren.size === 0) {
    const vorhanden = kategorien.filter(
      k => Array.isArray(k.referenzEmbedding) && k.referenzEmbedding.length > 0,
    ).length;
    return { kategorien, uebernommen: vorhanden, unveraendert: true };
  }

  const naechste = kategorien.map(k => ({ ...k, referenzEmbedding: zentren.get(k.id) }));
  return {
    kategorien: naechste,
    uebernommen: naechste.filter(k => (k.referenzEmbedding?.length ?? 0) > 0).length,
    unveraendert: false,
  };
}

/**
 * Was ein Nachzieh-Lauf ausgerichtet hat.
 *
 * `nicht-gespeichert` ist bewusst ein eigener Ausgang und kein Fehler: die
 * Referenzen GELTEN dann in dieser Sitzung, sie stehen nur nicht in
 * `auslastung.json`. Wer das zusammenwirft, sagt entweder „hat geklappt"
 * (und der naechste Seitenaufbau widerlegt es) oder „ging nicht" (obwohl die
 * Klassifizierung jetzt Vorschlaege macht).
 */
export type ReferenzErgebnis =
  | { art: 'geschrieben'; uebernommen: number; gesamt: number }
  | { art: 'leer'; vorhanden: number }
  | { art: 'nicht-gespeichert'; uebernommen: number; grund: string };

/** Ein Satz fuer die Oberflaeche — an einer Stelle, fuer alle drei Aufrufer. */
export function beschreibeReferenzErgebnis(erg: ReferenzErgebnis): string {
  switch (erg.art) {
    case 'geschrieben':
      return `Kategorie-Referenzen neu berechnet: ${erg.uebernommen} von ${erg.gesamt} `
        + 'Kategorien tragen jetzt eine.';
    case 'leer':
      return erg.vorhanden > 0
        ? 'Die Kategorie-Referenzen ließen sich nicht neu berechnen (keine klassifizierten '
          + `Verbünde oder keine Verbund-Vektoren) — die vorhandenen für ${erg.vorhanden} `
          + 'Kategorien bleiben unverändert.'
        : 'Kategorie-Referenzen gibt es noch keine — dafür fehlen klassifizierte Verbünde '
          + 'oder die Verbund-Vektoren.';
    case 'nicht-gespeichert':
      return 'Die Kategorie-Referenzen wurden neu berechnet, ließen sich aber nicht speichern '
        + `(${erg.grund}). Sie gelten bis zum Neuladen der Seite; die Vektoren selbst sind `
        + 'davon nicht betroffen.';
  }
}

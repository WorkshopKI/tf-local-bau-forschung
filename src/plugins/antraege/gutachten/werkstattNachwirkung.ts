/**
 * Was bedeutet eine gespeicherte Anweisung für den Abschnitt, der gerade offen ist?
 *
 * Bisher schloss die Werkstatt und nichts sagte, ob etwas gewirkt hat. Der Prompt
 * gilt aber erst beim NÄCHSTEN Erzeugen — der Text auf dem Schirm stammt weiter
 * vom alten. Ohne diesen Hinweis liest sich das wie „hat nichts gebracht", und der
 * Bearbeiter ändert ein zweites Mal am selben Prompt herum.
 *
 * Reine Funktion, weil das Repo keine Render-Tests hat (Muster: `abschnittAnzeige.ts`).
 * Die Aktion wird nur ANGEBOTEN, nie ausgeführt: ein automatisches Neu-Erzeugen
 * würde einen Text überschreiben, den der Nutzer vielleicht gerade abnehmen wollte.
 */
import type { StepStatus } from './types';

export interface WerkstattNachwirkung {
  text: string;
  /** Angebotene Folgeaktion — `null` heißt „nur informieren". */
  aktion: 'neu-erzeugen' | 'erneut-oeffnen' | null;
}

export function werkstattNachwirkung(p: {
  /** Skill-Version beim Öffnen der Werkstatt (`null`, wenn kein Skill am Schritt hängt). */
  versionVorher: number | null;
  /** Skill-Version nach `reloadRegistry`. */
  versionNachher: number | null;
  abschnittStatus: StepStatus;
}): WerkstattNachwirkung | null {
  const { versionVorher, versionNachher, abschnittStatus } = p;
  // Kein Band ohne belegte Änderung: unbekannte Version oder gleiche Version heißt
  // „nichts gespeichert" bzw. „nur die Struktur berührt".
  if (versionVorher == null || versionNachher == null) return null;
  if (versionNachher <= versionVorher) return null;

  const gespeichert = `Anweisung gespeichert (v${versionNachher}).`;
  if (abschnittStatus === 'freigegeben') {
    return {
      text: `${gespeichert} Der Abschnitt ist freigegeben und bleibt unverändert.`,
      aktion: 'erneut-oeffnen',
    };
  }
  if (abschnittStatus === 'entwurf') {
    return {
      text: `${gespeichert} Sie wirkt beim nächsten Erzeugen — der Text unten stammt noch von v${versionVorher}.`,
      aktion: 'neu-erzeugen',
    };
  }
  // Leerer Abschnitt: es gibt nichts zu ersetzen, der reguläre Generieren-Knopf steht ohnehin da.
  return { text: `${gespeichert} Sie wirkt beim Erzeugen dieses Abschnitts.`, aktion: null };
}

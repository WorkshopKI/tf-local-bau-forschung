/**
 * Wie eine Bahn dasteht — die einzige Rechnung des Board-Primitivs, und die
 * einzige, die ohne DOM prüfbar ist (Vitest läuft node-only).
 *
 * Portiert aus `plugins/feedback-board/boardSpalten.ts` (v3.43), wo sie als
 * `spaltenAnsicht`/`istSchiene` am Feedback-Datenmodell hing. Hier nimmt sie nur
 * noch drei Aussagen entgegen; welche Karten in welcher Bahn liegen und ob eine
 * Sicht sie füllen kann, bleibt Sache des Aufrufers.
 */

/**
 * Was der Nutzer zuletzt über DIESE Bahn gesagt hat. `auto` heißt „nichts
 * gesagt" — dann entscheidet der Inhalt (voll = Bahn, leer = Schiene).
 *
 * Ein Wunsch statt zweier Booleans: „aufgeklappt" und „eingeklappt" sind keine
 * unabhängigen Schalter, sondern die beiden Richtungen derselben Aussage. Als
 * `entfaltet: boolean` (v3.41.1) ließ sich die zweite gar nicht ausdrücken.
 */
export type TfBahnWunsch = 'auto' | 'offen' | 'zu';

/**
 * `leer-offen` und `voll-schiene` entstehen NUR durch eine Geste — und sind
 * damit die Zustände, die einen Weg zurück tragen müssen: bis v3.41 klappte eine
 * leere Bahn auf und blieb es bis zum Neuladen.
 */
export type TfBahnAnsicht = 'voll' | 'schiene' | 'leer-offen' | 'voll-schiene';

export interface TfBahnLage {
  /** Nichts zu zeigen — weder Karten noch eine Fußzeile. */
  leer: boolean;
  /** Die aktive Sicht kann diese Bahn gar nicht füllen. */
  unerreichbar: boolean;
  wunsch: TfBahnWunsch;
}

export function bahnAnsicht({ leer, unerreichbar, wunsch }: TfBahnLage): TfBahnAnsicht {
  // Eine gefüllte Bahn folgt dem Wunsch — eingeklappt behält sie ihre Zahl und
  // bleibt Drop-Ziel, verliert also nichts außer Breite.
  if (!leer) return wunsch === 'zu' ? 'voll-schiene' : 'voll';
  // Eine unerreichbare Bahn bleibt Schiene, auch nach einem Klick: aufgeklappt
  // behauptete sie ein zweites Mal „hier ist nichts" (v3.39).
  if (unerreichbar) return 'schiene';
  return wunsch === 'offen' ? 'leer-offen' : 'schiene';
}

/** Ist diese Ansicht die Schmalschiene? Die beiden Wege dorthin (leer von
 *  selbst, voll von Hand) teilen sich Geometrie, Beschriftung und Drop-Ziel. */
export function istSchiene(ansicht: TfBahnAnsicht): boolean {
  return ansicht === 'schiene' || ansicht === 'voll-schiene';
}

/**
 * Wunsch-Karte je Bahn — der Zustand, den ein Aufrufer hält, der das Einklappen
 * ÜBERLEBEN lassen will. Fehlender Schlüssel heißt `auto` (nichts gesagt).
 */
export type TfBahnWuensche = Readonly<Record<string, TfBahnWunsch>>;

/**
 * Speicherform ⇄ Zustand. Persistiert wird nur die Liste der eingeklappten
 * Bahnen und nicht die volle Karte: `auto` und `offen` sind für eine gefüllte
 * Bahn dasselbe Bild, und eine Liste altert gutmütig — verschwindet eine Bahn
 * aus den Daten, steht ihr Schlüssel nur unbenutzt herum.
 */
export function wunschAusEingeklappten(keys: readonly string[]): TfBahnWuensche {
  const karte: Record<string, TfBahnWunsch> = {};
  for (const key of keys) karte[key] = 'zu';
  return karte;
}

/** Die eingeklappten Bahnen als sortierte Liste — sortiert, damit zweimal
 *  derselbe Zustand auch dieselbe gespeicherte Zeichenkette ergibt. */
export function eingeklappteBahnen(wuensche: TfBahnWuensche): string[] {
  return Object.keys(wuensche).filter(key => wuensche[key] === 'zu').sort();
}

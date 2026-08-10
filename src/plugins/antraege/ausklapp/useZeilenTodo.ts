/**
 * Die **To-do-Auswertung einer Tabellenzeile** — je Teilvorhaben, je Regelsatz.
 *
 * Dieselbe Engine wie im Vorgangs-Board und auf der Detailseite, nur auf die
 * Zeile eingegrenzt: `ermittleTodosAlleRollen` über den Kontext EINES
 * Teilvorhabens (Verbund-Felder plus die eigenen). Kein zweiter Evaluator, keine
 * zweite Kaskade — die Regelsatz-Auswahl liegt in der Engine, nicht hier
 * (Pitfall #47).
 *
 * **Die Rollenwahl kommt aus dem Profil**, wie die Startwahl des Boards
 * (`leseStatusRolle`). Ein eigenes Auswahlfeld im aufgeklappten Bereich wäre eine
 * zweite Stelle, an der dieselbe Frage beantwortet wird — und der Ausklapp hält
 * bewusst keinen Zustand über seine Lebensdauer hinaus. `'alle'` liest den
 * AB-Satz, genau wie `sichtVon` im Board.
 *
 * **Läuft nur mit dem Vorgangssystem.** Ohne Flag gibt es die Kaskade in dieser
 * Variante nicht; der Hook liefert dann eine leere Lage, statt Regeln
 * auszuwerten, die nirgends sichtbar wären.
 */
import { useMemo } from 'react';
import { useProfile } from '@/core/hooks/useProfile';
import { leseStatusRolle } from '@/core/status/rollen';
import { REGELSATZ_DEFAULT } from '@/core/status/regelsatz';
import { baueTodoKontext, ermittleTodosAlleRollen } from '@/core/status/todo-engine';
import type { Rolle } from '@/core/status/typen';
import type { StatusVerlauf } from '../status/useStatusVerlauf';
import { adresseFuerWaechter, type AdressLage, type TvTodo } from './kopfkarte/aufgabe';

export interface ZeilenTodo {
  /** Die Teilvorhaben, die DIESE Zeile trägt, mit ihrer Auswertung. */
  jeTv: TvTodo[];
  /** Der Regelsatz, den die Anzeige liest. */
  rolle: Rolle;
  /** Die Fassung führt keine To-do-Regeln — dann kann die Engine nichts sagen. */
  ohneRegeln: boolean;
  /** Die eine Adresse der Zeile für den Stillstands-Wächter. */
  adresse: AdressLage;
}

export interface ZeilenTodoQuelle {
  quelle: StatusVerlauf;
  /** Aktenzeichen der geklickten Zeile. */
  aktenzeichen: string;
  /** Verdichtete Verbundzeile? Dann zählen alle Teilvorhaben. */
  istVerbundZeile: boolean;
  /** ISO — injiziert, nie eine Uhr in der Auswertung. */
  stichtag: string;
  /** Ist das Vorgangssystem gebaut? */
  an: boolean;
}

const LEER: ZeilenTodo = {
  jeTv: [], rolle: REGELSATZ_DEFAULT, ohneRegeln: false,
  adresse: { todo: null, uneinig: false },
};

export function useZeilenTodo(q: ZeilenTodoQuelle): ZeilenTodo {
  const { profile } = useProfile();
  const gewaehlt = leseStatusRolle(profile?.status_rolle);
  const rolle: Rolle = gewaehlt === 'alle' ? REGELSATZ_DEFAULT : gewaehlt;
  const { version, jeTeilvorhaben } = q.quelle;

  return useMemo<ZeilenTodo>(() => {
    if (!q.an || version === null) return LEER;
    const regeln = version.todoRegeln ?? [];
    if (regeln.length === 0) return { ...LEER, rolle, ohneRegeln: true };
    // Dieselbe Auswahl wie in `useZeilenVerlauf`: die Verbundzeile steht für
    // alle Teilvorhaben, eine TV-Zeile nur für ihres.
    const relevante = q.istVerbundZeile
      ? jeTeilvorhaben
      : jeTeilvorhaben.filter(t => t.aktenzeichen === q.aktenzeichen);
    const jeTv: TvTodo[] = relevante.map(tv => ({
      aktenzeichen: tv.aktenzeichen,
      todos: ermittleTodosAlleRollen(regeln, baueTodoKontext(tv.vorkommen), q.stichtag),
    }));
    return { jeTv, rolle, ohneRegeln: false, adresse: adresseFuerWaechter(jeTv) };
  }, [q.an, version, jeTeilvorhaben, q.istVerbundZeile, q.aktenzeichen, q.stichtag, rolle]);
}

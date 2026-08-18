/**
 * **Was im Feld steht, ist im Frage-Modus noch keine Anfrage.**
 *
 * Der Fehler, den das behebt (v4.107): die Liste durchsuchte den Wortlaut mit
 * dem Fragesatz, sobald jemand ihn tippte. „alle Netzwerke die für Phase 2
 * abgelehnt wurden" kommt als Wortlaut-Suche über Titel und Antragsteller
 * erwartungsgemäß auf **null** Treffer — die Liste war leer, alle Filter standen
 * auf „Alle", und es sah aus, als hätte die KI etwas getan. Sie war nie gefragt
 * worden.
 *
 * Die Regel dagegen ist dieselbe wie in der Dokumenten-Suche
 * (`SuchSeite.frageOffen`): ein Fragesatz wird erst dann zur Anfrage, wenn er
 * **übersetzt** ist. Bis dahin liefert diese Funktion den leeren Text, und die
 * Liste steht unverändert da.
 *
 * Die Identität hängt am Wortlaut der Frage, nicht an einem Flag: wer nach dem
 * Übersetzen weitertippt, hat wieder eine offene Frage. Genau das prüft die
 * Dokumenten-Suche mit `frageplan.frage === query.trim()`.
 *
 * Rein — die zwei Zeilen stehen hier und nicht in einem der beiden Konsumenten,
 * weil Liste (`useFilteredAntraege`) und Hybrid-Suche
 * (`useAntraegeHybridSearch`) **denselben** Text sehen müssen. Zwei Kopien
 * derselben Bedingung wären zwei Gelegenheiten, sie verschieden zu ändern.
 */
import { useAntraegeStore } from '../store';

export interface SuchtextLage {
  /** Der rohe Feldtext. */
  search: string;
  /** Steht der Umschalter auf „einer Frage"? */
  frageModus: boolean;
  /** Die zuletzt erfolgreich übersetzte Frage. */
  frageGestellt: string | null;
  /** Hat diese Frage überhaupt Themen-Begriffe ergeben? */
  hatPlanTeile: boolean;
}

/** Ist die Frage im Feld noch ungestellt? Für Knopf und Hinweiszeile. */
export function frageOffen(lage: SuchtextLage): boolean {
  const { search, frageModus, frageGestellt } = lage;
  if (!frageModus) return false;
  if (search.trim().length === 0) return false;
  return frageGestellt === null || frageGestellt !== search.trim();
}

/**
 * Der Text, mit dem tatsächlich gesucht wird.
 *
 * Im Frage-Modus ist der Fragesatz **nie** ein Wortlaut-Suchbegriff. Er fährt
 * nur dann als Anfrage los, wenn die Übersetzung Leitbegriffe ergeben hat — dann
 * ersetzen sie die Zerlegung der Eingabe (`WortlautOptionen.planTeile`), und der
 * Satz selbst ist bloß der Auslöser, den die Suchstufe braucht.
 *
 * Der häufige Fall ist der andere: eine Frage nach Status, Jahr und PreCheck
 * nennt **kein** Thema. Sie setzt Filter, und die Wortlaut-Stufe hat nichts zu
 * tun. Liefe der Satz trotzdem als Suchbegriff mit, käme die Liste leer zurück —
 * und zwar nach einem erfolgreichen KI-Lauf, was den Fehler doppelt schwer
 * findbar macht.
 */
export function wirksamerSuchtext(lage: SuchtextLage): string {
  if (!lage.frageModus) return lage.search;
  if (frageOffen(lage)) return '';
  return lage.hatPlanTeile ? lage.search : '';
}

/** Die Lage aus dem Store — eine Quelle für alle vier Leser. */
function useLage(): SuchtextLage {
  const search = useAntraegeStore(s => s.search);
  const frageModus = useAntraegeStore(s => s.frageModus);
  const frageGestellt = useAntraegeStore(s => s.frageGestellt);
  const planTeile = useAntraegeStore(s => s.planTeile);
  return { search, frageModus, frageGestellt, hatPlanTeile: planTeile !== null };
}

/** Die Store-Fassung für die Konsumenten. */
export function useWirksamerSuchtext(): string {
  return wirksamerSuchtext(useLage());
}

/** Dasselbe für den Kopf, der die Hinweiszeile und den Knopf zeigt. */
export function useFrageOffen(): boolean {
  return frageOffen(useLage());
}

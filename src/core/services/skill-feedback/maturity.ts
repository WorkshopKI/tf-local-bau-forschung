/**
 * Beratender Reifegrad-Vorschlag (rein). Liefert NUR einen Vorschlag — das
 * tatsächliche Setzen bleibt ein manueller Kurator-Registry-Write (S2). Nie eine
 * automatische Rückstufung ohne klares Negativ-Signal; bei dünner Datenlage `null`
 * (kein Vorschlag). Konservativ: ein Vorschlag wird nur erzeugt, wenn er sich vom
 * aktuellen Reifegrad unterscheidet.
 */
import type { SkillAggregat } from './aggregate';
import type { Reifegrad } from './types';

/** Mindest-Nutzung für „erprobt". */
export const ERPROBT_MIN_NUTZUNG = 5;
/** Mindest-Nutzung für „empfohlen". */
export const EMPFOHLEN_MIN_NUTZUNG = 20;
/** Mindest-Feedback-Anzahl für „empfohlen" (sonst zu dünn fürs Top-Level). */
export const EMPFOHLEN_MIN_FEEDBACK = 3;
/** Mindest-Zustimmungsquote (👍/gesamt) für „empfohlen". */
export const EMPFOHLEN_MIN_ZUSTIMMUNG = 0.8;
/** Mindest-Zustimmungsquote für „erprobt" (nur wenn überhaupt Feedback vorliegt). */
export const ERPROBT_MIN_ZUSTIMMUNG = 0.5;
/** Ab so vielen Feedbacks kann ein Negativ-Signal „klar" sein. */
export const NEGATIV_MIN_FEEDBACK = 3;
/** Zustimmungsquote, ab der (mit genug Feedback) ein klares Negativ-Signal vorliegt. */
export const NEGATIV_MAX_ZUSTIMMUNG = 0.3;

const RANG: Record<Reifegrad, number> = { entwurf: 0, erprobt: 1, empfohlen: 2 };

/**
 * Schlägt einen Reifegrad vor oder `null` (kein Vorschlag). Aufstufung folgt aus
 * Nutzung + Zustimmung; Abstufung NUR bei klarem Negativ-Signal (viel Ablehnung
 * bei genug Feedback). Gleichstand oder dünne Datenlage → `null`.
 */
export function suggestReifegrad(agg: SkillAggregat, aktuell: Reifegrad): Reifegrad | null {
  const feedbackTotal = agg.up + agg.down;
  const zustimmung = feedbackTotal > 0 ? agg.up / feedbackTotal : null;
  const klaresNegativ =
    feedbackTotal >= NEGATIV_MIN_FEEDBACK && zustimmung !== null && zustimmung <= NEGATIV_MAX_ZUSTIMMUNG;

  // Dünne Datenlage ohne klares Signal → kein Vorschlag.
  if (agg.nutzung < ERPROBT_MIN_NUTZUNG && feedbackTotal < NEGATIV_MIN_FEEDBACK) return null;

  // „Verdiente" Stufe aus Nutzung + Zustimmung.
  let verdient: Reifegrad = 'entwurf';
  if (
    agg.nutzung >= EMPFOHLEN_MIN_NUTZUNG &&
    feedbackTotal >= EMPFOHLEN_MIN_FEEDBACK &&
    zustimmung !== null &&
    zustimmung >= EMPFOHLEN_MIN_ZUSTIMMUNG
  ) {
    verdient = 'empfohlen';
  } else if (
    agg.nutzung >= ERPROBT_MIN_NUTZUNG &&
    (zustimmung === null || zustimmung >= ERPROBT_MIN_ZUSTIMMUNG)
  ) {
    verdient = 'erprobt';
  }

  // Klares Negativ-Signal kappt die verdiente Stufe auf „entwurf".
  if (klaresNegativ) verdient = 'entwurf';

  if (RANG[verdient] > RANG[aktuell]) return verdient; // Aufstufung
  if (RANG[verdient] < RANG[aktuell]) return klaresNegativ ? verdient : null; // Abstufung nur mit Signal
  return null; // nichts Neues vorzuschlagen
}

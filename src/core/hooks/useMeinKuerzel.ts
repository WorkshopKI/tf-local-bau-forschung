/**
 * useMeinKuerzel (v2.11) — zentraler Getter fuers effektive Bearbeiter-Kuerzel.
 *
 *  - MA-Login aktiv (`isMaLoginEnabled`) UND angemeldet → das aus dem Passwort
 *    entschluesselte Session-Kuerzel (read-only, nicht manipulierbar).
 *  - sonst (Fallback wenn keine Zugangsdatei existiert, oder andere Varianten
 *    ohne MA-Login wie pl/kurator/demo) → das editierbare Profilfeld
 *    `bearbeiter_kuerzel`.
 *
 * ALLE Kuerzel-Konsumenten (Dashboard „Meine Anträge", „Meine Fristen",
 * Selbsteintragung, Übernahme-Wünsche, Feedback-Reviewer, …) nutzen diesen Hook
 * statt `profile.bearbeiter_kuerzel` direkt. Rueckgabetyp ist drop-in-kompatibel
 * zu `profile?.bearbeiter_kuerzel` (`string | undefined`).
 *
 * Hinweis: im Login-Modus liefert der Hook ein einzelnes echtes Kuerzel — die
 * frueheren Profil-Spezialwerte „MUE,SCH" (Vertretung) / „alle" (Übersicht)
 * stehen prod-Usern dann nicht mehr zur Verfuegung (Identitaet ist abgeleitet,
 * nicht frei). Die PL behaelt volle Freiheit (kein MA-Login → Profilfeld).
 */
import { useProfile } from '@/core/hooks/useProfile';
import { useMAIdentity } from '@/core/hooks/useMAIdentity';
import { isMaLoginEnabled } from '@/config/feature-flags';

export function useMeinKuerzel(): string | undefined {
  const sessionKuerzel = useMAIdentity(s => s.kuerzel);
  const istAngemeldet = useMAIdentity(s => s.istAngemeldet);
  const { profile } = useProfile();
  if (isMaLoginEnabled() && istAngemeldet && sessionKuerzel) {
    return sessionKuerzel;
  }
  return profile?.bearbeiter_kuerzel;
}

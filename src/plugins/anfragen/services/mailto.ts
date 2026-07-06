/**
 * mailto-Aufbau für die Antwort an den Original-Absender.
 *
 * Bewusst OHNE Body: `mailto` trägt kein HTML und kappt lange Bodies in der Praxis
 * (~2000 Zeichen nach URL-Encoding) — de-anonymisierte Antworten liegen fast immer
 * darüber. Der Knopf öffnet daher nur einen adressierten Leer-Entwurf (An +
 * „Re:"-Betreff); der formatierte Antworttext kommt aus der Zwischenablage (Strg+V,
 * siehe `services/clipboard.ts`). So bleibt die Formatierung erhalten und die
 * frühere „Antwort zu lang"-Grenze entfällt.
 *
 * Bekannte Grenze (bewusst akzeptiert): `mailto` trägt kein Threading
 * (`In-Reply-To`/`References`) — die Antwort wird eine neue Mail an den Absender.
 */

/** Reply-Präfixe, die nicht verdoppelt werden (DE: „AW:", EN: „Re:", Weiterleitung). */
const REPLY_PREFIX_RE = /^(re|aw|wg|fwd?):/i;

export function replyBetreff(betreff: string): string {
  const b = betreff.trim();
  return REPLY_PREFIX_RE.test(b) ? b : `Re: ${b}`;
}

/** Adressierter Leer-Entwurf: An + „Re:"-Betreff, KEIN Body. */
export function buildMailtoLeer(to: string, betreff: string): string {
  const subject = encodeURIComponent(replyBetreff(betreff));
  return `mailto:${to}?subject=${subject}`; // allow-anfrage-export: adressierter Leer-Entwurf (kein Body, kein Leak)
}

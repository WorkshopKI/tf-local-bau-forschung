/**
 * mailto-Aufbau für die finale (de-anonymisierte) Antwort an den Original-Absender.
 *
 * Bekannte Grenze (bewusst akzeptiert): `mailto` trägt KEIN Threading
 * (`In-Reply-To`/`References`) — die Antwort wird eine neue Mail an den Absender,
 * nicht in den Thread eingehängt. `.eml` würde Threading tragen, öffnet aber
 * read-only statt als Entwurf — nicht den Aufwand wert.
 */

/** Reply-Präfixe, die nicht verdoppelt werden (DE: „AW:", EN: „Re:", Weiterleitung). */
const REPLY_PREFIX_RE = /^(re|aw|wg|fwd?):/i;

/** Konservative Schwelle: Windows/Outlook kappen `mailto`-Body in der Praxis ~2000
 *  Zeichen (nach URL-Encoding). Darüber → auf Clipboard umlenken. */
export const MAILTO_MAX_BODY = 1800;

export function replyBetreff(betreff: string): string {
  const b = betreff.trim();
  return REPLY_PREFIX_RE.test(b) ? b : `Re: ${b}`;
}

export function buildMailto(to: string, betreff: string, body: string): string {
  const subject = encodeURIComponent(replyBetreff(betreff));
  const encoded = encodeURIComponent(body);
  return `mailto:${to}?subject=${subject}&body=${encoded}`; // allow-anfrage-export: finaler de-anonymisierter Mail-Entwurf an den Original-Absender (kein externer Leak)
}

/** True, wenn der URL-encodete Body die mailto-Praxisgrenze überschreitet. */
export function mailtoBodyZuLang(body: string): boolean {
  return encodeURIComponent(body).length > MAILTO_MAX_BODY;
}

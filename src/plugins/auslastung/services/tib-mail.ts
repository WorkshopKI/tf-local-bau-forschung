/**
 * TIB-Mail-Aufloesung + E-Mail-Vorlagen-Interpolation (v2.12).
 *
 * Loest das echte TIB-Kuerzel → E-Mail auf (CSV-Spalte TIB_MAIL aus der
 * Begleitungs-Quelle, gemappt als Canonical `tib_mail`) und baut daraus eine
 * `mailto:`-URL fuer den Zugangspasswort-Versand. Reine Funktionen (testbar).
 */
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { CANONICAL_TIB_KUERZ, CANONICAL_TIB_MAIL } from '../types';
import { normalizeKuerzel } from './anonym-map';

/**
 * Baut eine Map `normalisiertes Kuerzel → E-Mail` aus den Antraegen. Scannt
 * tib_kuerz + tib_mail pro Record; die erste NICHT-LEERE Mail pro Kuerzel
 * gewinnt (deterministisch ueber die Antrags-Reihenfolge). Spiegelt den Scan in
 * `kuerzel-map.ts`. Fehlt `tib_mail` (z.B. Bgl noch nicht neu importiert), bleibt
 * die Map fuer das Kuerzel leer → der Aufrufer faellt auf mailto-ohne-Empfaenger.
 */
export function buildKuerzelMailMap(antraege: Array<Antrag | AntragListItem>): Map<string, string> {
  const map = new Map<string, string>();
  for (const a of antraege) {
    const rec = a as Record<string, unknown>;
    const k = normalizeKuerzel(rec[CANONICAL_TIB_KUERZ]);
    if (!k || map.has(k)) continue; // schon eine Mail fuer dieses Kuerzel gefunden
    const rawMail = rec[CANONICAL_TIB_MAIL];
    const mail = typeof rawMail === 'string' ? rawMail.trim() : '';
    if (mail) map.set(k, mail);
  }
  return map;
}

/** Ersetzt `{key}`-Platzhalter. Fehlt der Key, bleibt der Platzhalter stehen. */
export function interpolateMailTemplate(tpl: string, values: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? `{${key}}`);
}

/**
 * Baut eine `mailto:`-URL mit interpoliertem Betreff + Body. `email` leer →
 * mailto ohne Empfaenger (PL traegt manuell ein). `mailto:` ist ein OS-Schema
 * und funktioniert unter file://. Zeilenumbrueche werden zu CRLF normalisiert
 * (Outlook-robust).
 */
export function buildMailtoUrl(
  email: string,
  betreff: string,
  vorlage: string,
  values: Record<string, string>,
): string {
  const subject = encodeURIComponent(interpolateMailTemplate(betreff, values));
  const body = encodeURIComponent(interpolateMailTemplate(vorlage, values).replace(/\r?\n/g, '\r\n'));
  const to = email ? encodeURIComponent(email) : '';
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

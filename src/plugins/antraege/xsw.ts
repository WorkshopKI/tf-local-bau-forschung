/**
 * T_XSW („Wiedereinreicher")-Helfer.
 *
 * Das CSV-Custom-Feld `t_xsw` (Spalte `T_XSW` der Antragsbasis) ist ein
 * Freitext-Hinweis, dass ein Antrag schon einmal eingereicht wurde — inkl. der
 * TIB-Kürzel des damaligen Bearbeiters (im Text durch `/`, `_` o.ä. getrennt,
 * z.B. `Wiedereinreicher ZEP250142_JoA/KaLa`).
 *
 * - Anzeige: in allen Titel-Ansichten rot/fett hinter dem VB-Titel
 *   (Komponente `XswSuffix`, gemeinsamer Style `XSW_SUFFIX_CLASS`).
 * - Home-Bump: enthält der Text das EIGENE Kürzel des Users, wird der Antrag in
 *   „Neue Anträge für dich" nach oben sortiert (`xswMatchesOwnKuerzel`).
 *
 * Pure Funktionen → unit-testbar (siehe `__tests__/xsw.test.ts`). Die JSX-
 * Komponente liegt in `XswSuffix.tsx`.
 */
import { normalizeKuerzel } from '@/plugins/auslastung/services/anonym-map';

/** Rot + fett — einzige Style-Quelle für den T_XSW-Suffix. Token aus theme.css. */
export const XSW_SUFFIX_CLASS = 'text-[var(--tf-danger-text)] font-bold';

/**
 * Liest das `t_xsw`-Feld aus einem beliebigen Record (`Antrag` /
 * `AntragListItem` / `AntragVorgang`) über die Index-Signatur — gekapselt,
 * damit nirgends `as string` über den `[key:string]: unknown`-Zugriff nötig
 * ist. Liefert getrimmten String oder `null` (leer/whitespace/Nicht-String).
 */
export function readXsw(rec: unknown): string | null {
  if (rec == null) return null;
  const v = (rec as Record<string, unknown>).t_xsw;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

/**
 * Zerlegt den T_XSW-Freitext in normalisierte Kürzel-Token. Erst NFC über den
 * GESAMTEN Text (Pitfall #22) — sonst zerlegt der Split eine NFD-Umlaut-Folge
 * wie `THU` + Combining-Diaeresis (U+0308, `\p{M}`) am Mark, weil dieser weder
 * `\p{L}` noch `\p{N}` ist; NFC fügt ihn vorher zu `THÜ` zusammen. Danach Split
 * auf alles außer Buchstaben/Ziffern (`u`-Flag erhält Umlaute im Token; `_`/`/`
 * trennen `JoA` und `KaLa`). Jedes Token läuft zusätzlich durch
 * `normalizeKuerzel` (uppercase); leere raus.
 */
export function tokenizeXsw(text: string): string[] {
  const out: string[] = [];
  for (const part of text.normalize('NFC').split(/[^\p{L}\p{N}]+/u)) {
    const k = normalizeKuerzel(part);
    if (k) out.push(k);
  }
  return out;
}

/**
 * True, wenn der T_XSW-Text ein Token enthält, das EXAKT einem der eigenen
 * Kürzel des Users entspricht. `ownKuerzelRaw` ist der rohe Profil-Wert
 * (`profile.bearbeiter_kuerzel`), kann mehrere Kürzel kommagetrennt enthalten
 * ("MUE,SCH"). Token-Gleichheit (kein Substring), damit `OA` nicht in `JoA`
 * matcht.
 */
export function xswMatchesOwnKuerzel(
  text: string | null,
  ownKuerzelRaw: string | null | undefined,
): boolean {
  if (!text || !ownKuerzelRaw) return false;
  const own = new Set<string>();
  for (const part of ownKuerzelRaw.split(',')) {
    const k = normalizeKuerzel(part);
    if (k) own.add(k);
  }
  if (own.size === 0) return false;
  return tokenizeXsw(text).some(tok => own.has(tok));
}

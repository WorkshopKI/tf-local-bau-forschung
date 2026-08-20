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
import { normalizeKuerzel } from '@/plugins/auslastung/services/identitaet';

/** Rot + fett — einzige Style-Quelle für den T_XSW-Suffix. Token aus theme.css. */
export const XSW_SUFFIX_CLASS = 'text-[var(--tf-danger-text)] font-bold';

/**
 * Schlüssel, unter denen die Spalte `T_XSW` im Record liegen kann — in
 * Lese-Reihenfolge.
 *
 * `t_xsw` ist der kanonische Name und der Schlüssel der schlanken Projektion;
 * die produktiven Schemas mappen die Spalte aber als **Custom-Feld**
 * `wiedereinreicher` (`{"custom":"wiedereinreicher","label":"Wiedereinreicher"}`
 * in `9097-anb-aitisigpt`). Gemessen am echten Bestand: `t_xsw` in 0 von
 * 14 225 Records, `wiedereinreicher` in 1 452 gefüllt. Blind auf `t_xsw` zu
 * lesen hieß, dass der Hinweis nirgends erschien (v4.124).
 */
const XSW_KEYS = ['t_xsw', 'wiedereinreicher'] as const;

/**
 * Liest das `T_XSW`-Feld aus einem beliebigen Record (`Antrag` /
 * `AntragListItem` / `AntragVorgang`) über die Index-Signatur — gekapselt,
 * damit nirgends `as string` über den `[key:string]: unknown`-Zugriff nötig
 * ist. Probiert die Schlüssel aus `XSW_KEYS` der Reihe nach und liefert den
 * ersten getrimmten Treffer oder `null` (leer/whitespace/Nicht-String).
 */
export function readXsw(rec: unknown): string | null {
  if (rec == null) return null;
  const r = rec as Record<string, unknown>;
  for (const key of XSW_KEYS) {
    const v = r[key];
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t.length > 0) return t;
  }
  return null;
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

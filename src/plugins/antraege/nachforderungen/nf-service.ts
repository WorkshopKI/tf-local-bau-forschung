/**
 * NF-Service (Artefakt-Engine) — reine Helfer für den Nachforderungs-Durchstich:
 * Katalog-Formatierung (Slot-Input), administrative QS, Verbund-Merge (G-Bausteine
 * EINMAL am Verbund gefüllt + in JEDE TV-NF) und der E-Mail-Entwurf je TV.
 *
 * Bewusst LLM-frei + ohne React (testbar). Die Generierung selbst läuft über den
 * Skill-Runner (`useNachforderungen`); diese Funktionen tragen den Rest.
 */
import {
  NF_BAUSTEIN_IDS, SEED_NF_REGELN, runRegelChecks, type CheckResult, type NfBaustein,
} from '@/core/services/skills';
import { buildMailtoUrl } from '@/plugins/auslastung/services/tib-mail';

/** Überschriften des Verbund-/TV-Blocks in einer zusammengesetzten TV-NF. */
export const VERBUND_BLOCK_TITEL = 'Fragen, die das Gesamtvorhaben betreffen';
export const TV_BLOCK_TITEL = 'Fragen zum Teilvorhaben';

/**
 * Formatiert die übergebenen Bausteine als Slot-Input für `{{nfBausteine}}`. Pro
 * Baustein: ID + Thema + Kategorie + wortgetreuer Text. Die Reihenfolge bleibt
 * erhalten (Katalog-Reihenfolge).
 */
export function formatBausteinKatalog(bausteine: NfBaustein[]): string {
  return bausteine
    .map(b => `### ${b.id} — ${b.thema} (${b.kategorie})\n${b.text}`)
    .join('\n\n');
}

/**
 * Administrative + textliche NF-QS über den finalen Text (deterministisch). Das
 * harte Tor: bleibt ein ungefüllter Platzhalter, liefert `nf_keine_platzhalter_reste`
 * einen Fehler — der Lauf ist NICHT freigabereif. Der fachliche Check (Baustein-
 * Passung) ist LLM-QS und hier bewusst nicht enthalten.
 */
export function pruefeNf(finalerText: string): CheckResult[] {
  return runRegelChecks(finalerText, SEED_NF_REGELN);
}

/** True, wenn der Text das administrative Tor passiert (kein `fehler`-Check). */
export function nfFreigabereif(finalerText: string): boolean {
  return pruefeNf(finalerText).every(c => c.level !== 'fehler');
}

/** Validiert vom LLM gewählte Baustein-IDs gegen den Katalog. */
export function gueltigeBausteinIds(ids: string[]): { gueltig: string[]; unbekannt: string[] } {
  const gueltig: string[] = [];
  const unbekannt: string[] = [];
  for (const id of ids) (NF_BAUSTEIN_IDS.has(id) ? gueltig : unbekannt).push(id);
  return { gueltig, unbekannt };
}

/**
 * Setzt die NF eines Teilvorhabens zusammen: der **identische** Verbund-Block
 * (G-Bausteine, einmal am Verbund-Kontext gefüllt) + der TV-spezifische Block
 * (T-Bausteine). Leere Blöcke werden ausgelassen. Der Verbund-Block ist für jede
 * TV-NF wortgleich (gleicher `gBlock`-Input → gleicher Abschnitt).
 */
export function mergeNfFuerTv(gBlock: string, tvBlock: string): string {
  const teile: string[] = [];
  if (gBlock.trim()) teile.push(`## ${VERBUND_BLOCK_TITEL}\n\n${gBlock.trim()}`);
  if (tvBlock.trim()) teile.push(`## ${TV_BLOCK_TITEL}\n\n${tvBlock.trim()}`);
  return teile.join('\n\n');
}

/** Betreff-/Body-Vorlage des NF-E-Mail-Entwurfs (Platzhalter: {fkz}, {nachforderungen}). */
export const NF_EMAIL_BETREFF = 'Nachforderungen zu Ihrem ZIM-Antrag {fkz}';
export const NF_EMAIL_VORLAGE =
  'Sehr geehrte Damen und Herren,\n\n'
  + 'ausgehend von den Anforderungen der Richtlinie, insbesondere hinsichtlich Antragsberechtigung, '
  + 'Gegenstand der Förderung, Zuwendungsvoraussetzungen sowie Art, Umfang und Höhe der Förderung, '
  + 'mussten wir bei der Bearbeitung Ihres Antrags feststellen, dass wir weitere Informationen bzw. '
  + 'Unterlagen zur Beurteilung Ihres Vorhabens benötigen.\n\n'
  + '{nachforderungen}\n\n'
  + 'Mit freundlichen Grüßen';

/**
 * Baut den `mailto:`-Entwurf einer TV-NF. `email` leer → mailto ohne Empfänger
 * (Adresse als editierbarer Platzhalter, Mensch trägt sie ein). Versendet wird
 * NICHTS automatisch — der Mensch öffnet/prüft/sendet (Entwurf ≠ Entscheidung).
 */
export function buildNfMailto(opts: { email?: string; fkz: string; nachforderungen: string }): string {
  return buildMailtoUrl(opts.email ?? '', NF_EMAIL_BETREFF, NF_EMAIL_VORLAGE, {
    fkz: opts.fkz,
    nachforderungen: opts.nachforderungen,
  });
}
